// S-Ask's engine, as the takeoff lane publishes it (R-AI-003, docs/design/s-ask.md): a statement in,
// the FACTS of an answer out — never a sentence (I-398). The `ai.ask` door hands the statement here
// after the one guard has resolved the reader's participation (I-406).
//
// It reads through the register's one reader and its sibling readers and never through a SUM of its
// own (B-17): `registerViewOf` for the objects and the lines, `levelStackOf` for the stack and its
// heights, `schedulesViewOf` for the schedules and the note readings, the sheet index for the sheets,
// and the Trace's own resolution over the records the pinned revision was measured on for where each
// member and each cited entity stands (I-404). What a query needs beyond the register and the stack is
// read only when its intent is asked, so a count does not open the schedules.
import { forTenant } from "@/core/db";
import { modelJudgmentOf } from "@/core/db/model-outcomes";
import { parseSourceKey, propose, sourceKeyResolver } from "@/core/model";
import { sheetOfKey, traceCitations } from "@/core/sheets/frames";
import { levelStackOf } from "@/modules/takeoff/levels";
import { sheetLayoutsOf } from "@/modules/takeoff/notes";
import { manifestOfRevision, registerViewOf } from "@/modules/takeoff/register-ui/server";
import { schedulesViewOf } from "@/modules/takeoff/schedules-ui/server";
import { sheetIndexOf } from "@/modules/takeoff/sheets";
import { findInIndex, textIndexAt, type TextIndex } from "@/modules/takeoff/sheets/text-index";
import { appStorage } from "@/core/storage/app";
import { pinnedRecordsOf, type PinnedRecord } from "@/modules/takeoff/trace";
import { answerReading, routeStatement, type Routed } from "./answer";
import { openIntentOf, resolveReading, type AskSubject } from "./grammar";
import { ASK_REFUSAL_CODES, type AskAnswer, type AskEntity, type AskObject, type AskPlace, type AskSchedule, type AskSheet, type AskSourceNeed, type AskSources, type AskStatement, type AskTextHit } from "./law";
import { viewOfPlacement } from "./queries/common";
import { queryFor } from "./queries/registry";
import { askRouteKeys, askRouteStateOf, isRoutable, proposeRoute, settleRoute, type AskRoutePort } from "./route-question";
import { vocabularyOf, type AskVocabulary } from "./vocabulary";

export * from "./law";
export { askArrivalOf, type AskArrival, type AskExample } from "./arrival";
export { answerReading, answerStatement, routeStatement, type Routed } from "./answer";
export { ASK_SLOTS, completeReading, openIntentOf, readQuestion, readWithIntent, resolveReading, wordsOf, type AskSlot, type AskSubject, type GrammarOutcome } from "./grammar";
export { ASK_ROUTE_CONFIDENCE_FLOOR, askRouteRequest, askRouteStateOf, readRouteProposal, settleRoute, type AskRoutePort, type AskRouteState } from "./route-question";
export { ASK_QUERIES, ASK_QUERY_LIST, queryFor, registryOf, type AskQuery } from "./queries/registry";
export { vocabularyOf, type AskVocabulary } from "./vocabulary";

/** Which project is asked, in which workspace — the guard has already resolved both. */
export type AskScope = { readonly tenantId: string; readonly projectId: string };

/** The register and the stack: what every question is read against. */
async function baseOf(scope: AskScope): Promise<AskSources> {
  const [register, stack] = await Promise.all([registerViewOf(scope), levelStackOf(scope)]);
  return {
    campaign: register.campaign,
    objects: register.objects,
    lines: register.lines,
    refusals: register.refusals,
    stack,
    notes: [],
    schedules: [],
    sheets: [],
    memberAt: () => null,
    entityAt: () => null,
    findText: () => [],
  };
}

/**
 * Where each register object's member stands and what its Trace selects there — the Trace's own
 * resolution (`traceCitations`, I-421) over the record whose placements hold the member, asked once
 * per object and kept.
 */
function memberLocator(objects: readonly AskObject[], records: ReadonlyMap<string, PinnedRecord>): (objectKey: string) => AskPlace | null {
  const byKey = new Map(objects.map((object) => [object.objectKey, object]));
  const kept = new Map<string, AskPlace | null>();
  return (objectKey) => {
    if (kept.has(objectKey)) return kept.get(objectKey) ?? null;
    let place: AskPlace | null = null;
    const object = byKey.get(objectKey);
    if (object !== undefined) {
      for (const [drawingId, record] of records) {
        if (!record.standing.members.has(object.sourceKey)) continue;
        const traced = traceCitations({ viewKey: viewOfPlacement(object.sourceKey) ?? object.sourceKey, sources: [object.sourceKey] }, record.standing);
        if (traced.layoutName !== null) place = { drawingId, layoutName: traced.layoutName, sheetLabel: record.labelOf(traced.layoutName), keys: [...traced.flyTo] };
        break;
      }
    }
    kept.set(objectKey, place);
    return place;
  };
}

/**
 * One cited entity — its words and the sheet it stands on (`sheetOfKey`, the one sheet resolver) — on
 * the drawing named, else on the first drawing of the pinned revision that holds the key: a
 * `DXF_HANDLE` is unique within a drawing, never across two.
 */
async function entityLocator(scope: AskScope, drawingIds: readonly string[], records: ReadonlyMap<string, PinnedRecord>): Promise<(drawingId: string | null, key: string) => AskEntity | null> {
  const texts = new Map<string, Map<string, string>>();
  for (const drawingId of drawingIds) {
    if (!records.has(drawingId)) continue;
    const layouts = await sheetLayoutsOf({ tenantId: scope.tenantId, projectId: scope.projectId, drawingId });
    texts.set(drawingId, new Map(layouts.flatMap((layout) => layout.texts.map((text) => [text.sourceKey, text.text] as const))));
  }
  return (drawingId, key) => {
    for (const candidate of drawingId === null ? drawingIds : [drawingId]) {
      const record = records.get(candidate);
      if (record === undefined || !record.standing.spaces.has(key)) continue;
      const layoutName = sheetOfKey(key, record.standing.spaces, record.standing.sheets, record.standing.frames);
      return { drawingId: candidate, text: texts.get(candidate)?.get(key) ?? null, layoutName, sheetLabel: layoutName === null ? null : record.labelOf(layoutName) };
    }
    return null;
  };
}

/**
 * The sheets of the pinned revision, as the sheet index names them: a drawing's paper sheets, or its
 * model space where it holds no paper sheet at all.
 */
async function sheetsOf(scope: AskScope, records: ReadonlyMap<string, PinnedRecord>): Promise<AskSheet[]> {
  const cards = (await sheetIndexOf(scope)).filter((card) => records.has(card.drawingId));
  const sheets: AskSheet[] = [];
  for (const drawingId of new Set(cards.map((card) => card.drawingId))) {
    const own = cards.filter((card) => card.drawingId === drawingId);
    const paper = own.filter((card) => card.kind === "paper");
    for (const card of paper.length > 0 ? paper : own) {
      sheets.push({ drawingId, layoutName: card.layoutName, number: card.proposal.number, title: card.proposal.title, discipline: card.confirmed?.discipline ?? card.proposal.discipline });
    }
  }
  return sheets;
}

/** One drawing of the pinned revision and the index of the words its sheets show. */
export type AskTextIndex = { readonly drawingId: string; readonly index: TextIndex };

/**
 * Every text of the pinned revision's sheets saying the words asked (SRCH-1's index, I-676): the
 * index's own reading (`findInIndex`, one hit per key), drawing by drawing in the set's order, each
 * drawing's sheets in its inventory's order with model space last, a sheet's texts as drawn.
 */
export function textFinderOf(indexes: readonly AskTextIndex[]): (text: string) => AskTextHit[] {
  return (text) =>
    indexes.flatMap(({ drawingId, index }) =>
      findInIndex(index, text)
        .sort((left, right) => left.entry.sheetRank - right.entry.sheetRank || left.ordinal - right.ordinal)
        .map((match): AskTextHit => ({
          drawingId,
          layoutName: match.entry.layoutName,
          sheetLabel: match.entry.sheetLabel,
          sourceKey: match.entry.key,
          excerpt: match.excerpt.text,
          clippedStart: match.excerpt.clippedStart,
          clippedEnd: match.excerpt.clippedEnd,
        })),
    );
}

/** The text index of each record the pinned revision was measured on — kept per content hash, read once. */
async function textIndexesOf(scope: AskScope, records: ReadonlyMap<string, PinnedRecord>): Promise<AskTextIndex[]> {
  const storage = appStorage();
  const indexes: AskTextIndex[] = [];
  for (const [drawingId, record] of records) indexes.push({ drawingId, index: await textIndexAt(scope.tenantId, record.artifactSha256, storage, `ingest ${record.ingestId}`) });
  return indexes;
}

/** The sources one query needs, read beside the register and the stack it was routed against. */
async function sourcesFor(scope: AskScope, base: AskSources, needs: readonly AskSourceNeed[]): Promise<AskSources> {
  if (base.campaign === null || needs.length === 0) return base;
  const manifest = await manifestOfRevision(scope.tenantId, base.campaign.setRevisionId);
  const drawingIds = manifest.map((member) => member.drawingId);
  const records = await pinnedRecordsOf(scope, base.campaign.setRevisionId, drawingIds);

  let schedules: AskSchedule[] = [];
  let notes: AskSources["notes"] = [];
  if (needs.includes("schedules") || needs.includes("notes")) {
    const view = await schedulesViewOf(scope);
    schedules = view.sheets.flatMap((sheet) => sheet.schedules.map((table) => ({ scheduleKey: table.scheduleKey, viewKey: table.viewKey, title: table.title, drawingId: sheet.drawingId, header: table.header, rows: table.rows })));
    notes = view.sheets.flatMap((sheet) => sheet.notes.readings.filter((reading) => !reading.superseded));
  }
  return {
    ...base,
    schedules,
    notes,
    sheets: needs.includes("sheets") ? await sheetsOf(scope, records) : [],
    memberAt: needs.includes("members") ? memberLocator(base.objects, records) : base.memberAt,
    entityAt: needs.includes("entities") ? await entityLocator(scope, drawingIds, records) : base.entityAt,
    findText: needs.includes("texts") ? textFinderOf(await textIndexesOf(scope, records)) : base.findText,
  };
}

/** Who is asking, for the ledger row a machine-routed question writes (L-AI-01). */
export type AskCaller = { readonly actor: string; readonly requestId: string };

/** The way to a model and to what it judged, over one project — the production seam unless a suite hands its own (B-23). */
export type AskSeam = { readonly route?: AskRoutePort };

/** The production routing port: the model seam's own `propose`, and the ledger's own judgment of the call. */
function productionRoute(scope: AskScope): AskRoutePort {
  return { propose, judgmentOf: (callId) => modelJudgmentOf(forTenant({ tenantId: scope.tenantId }), scope, callId) };
}

/**
 * The one defining key of each subject (I-397), read by code: a mark's is the mark entity of the
 * first registered member bearing it in the register's own order, on the first drawing of the pinned
 * revision whose record placed that member; a level's is its first stated storey-height reading. A
 * class, a kind, a note kind and a discipline carry none, and neither does a subject no record places.
 */
async function subjectKeysOf(scope: AskScope, base: AskSources, subjects: readonly AskSubject[]): Promise<(subject: AskSubject) => string | null> {
  const keys = new Map<string, string>();
  const marks = subjects.filter((subject) => subject.slot === "mark").map((subject) => subject.label);
  if (marks.length > 0 && base.campaign !== null) {
    const manifest = await manifestOfRevision(scope.tenantId, base.campaign.setRevisionId);
    const drawingIds = manifest.map((member) => member.drawingId);
    const records = await pinnedRecordsOf(scope, base.campaign.setRevisionId, drawingIds);
    for (const mark of marks) {
      for (const object of base.objects) {
        if (object.mark !== mark || object.corroboration === "REPUDIATED") continue;
        const markKey = drawingIds.map((drawingId) => records.get(drawingId)?.standing.members.get(object.sourceKey)?.markKey).find((key) => key !== undefined && parseSourceKey(key) !== null);
        if (markKey !== undefined) {
          keys.set(`mark|${mark}`, markKey);
          break;
        }
      }
    }
  }
  for (const subject of subjects) {
    if (subject.slot !== "level") continue;
    const stated = base.stack.find((level) => level.label === subject.label)?.height.current.find((reading) => reading.sourceKey !== null && parseSourceKey(reading.sourceKey) !== null);
    if (stated !== undefined && stated.sourceKey !== null) keys.set(`level|${subject.label}`, stated.sourceKey);
  }
  return (subject) => keys.get(`${subject.slot}|${subject.label}`) ?? null;
}

/**
 * The machine's routing of a question the grammar refused because its intent is open (I-396,
 * I-397), or null where the machine is not asked: a person's reading, an outcome the grammar ruled
 * itself, no campaign, or no subject with a key to cite. The seam's refusal (a missing recording, an
 * uncited answer) is not caught: it reaches the door and renders as registered (§1.1).
 */
async function machineRouted(scope: AskScope, base: AskSources, vocabulary: AskVocabulary, statement: AskStatement, caller: AskCaller, port: AskRoutePort): Promise<Routed | null> {
  if (statement.reading !== undefined || base.campaign === null) return null;
  const previous = statement.previous === undefined ? null : resolveReading(statement.previous, vocabulary);
  const subjects = openIntentOf(statement.question, vocabulary, previous !== null && previous.outcome === "READ" ? previous.reading : null);
  if (subjects === null) return null;
  const state = askRouteStateOf(statement.question, subjects, await subjectKeysOf(scope, base, subjects));
  if (!isRoutable(state)) return null;
  // The resolver is named by the revision the campaign is pinned at, over exactly the keys offered
  // (the coverage-cause precedent, I-623): an answer citing anything else is SOURCE_UNRESOLVED.
  const artifact = sourceKeyResolver(base.campaign.setRevisionId, askRouteKeys(state));
  const ctx = { tenantId: scope.tenantId, projectId: scope.projectId, actor: caller.actor, requestId: caller.requestId };
  const proposal = await proposeRoute(ctx, state, artifact, port);
  const settled = settleRoute(statement.question, vocabulary, { payload: proposal.payload, callId: proposal.callId }, await port.judgmentOf(proposal.callId));
  return settled.outcome === "READ" ? { outcome: "READ", reading: settled.reading, routedBy: "MODEL", followUp: false, callId: settled.callId } : settled;
}

/**
 * Ask the drawings one question (test contract: `askTheDrawings`). The grammar reads it against the
 * register and the stack; a clarify or a refusal is answered there and then, and a reading is answered
 * by its intent's one query over the sources it needs — no model call and no ledger row (I-406). Only
 * where the grammar refuses a question because it cannot tell which intent the words ask, and the
 * words name a subject with a key to cite, is the machine asked to route it (I-396, I-397): one
 * ledgered call, attributed to the project.
 */
export async function askTheDrawings(scope: AskScope, statement: AskStatement, caller?: AskCaller, seam: AskSeam = {}): Promise<AskAnswer> {
  const base = await baseOf(scope);
  const vocabulary = vocabularyOf(base);
  let routed: Routed = routeStatement(statement, vocabulary);
  if (caller !== undefined && routed.outcome === "REFUSED" && routed.code === ASK_REFUSAL_CODES.notUnderstood && routed.reading === null) {
    routed = (await machineRouted(scope, base, vocabulary, statement, caller, seam.route ?? productionRoute(scope))) ?? routed;
  }
  if (routed.outcome !== "READ") return routed;
  const sources = await sourcesFor(scope, base, queryFor(routed.reading.intent).needs);
  return answerReading(routed, sources);
}
