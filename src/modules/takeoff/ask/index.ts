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
import { sheetOfKey, traceCitations } from "@/core/sheets/frames";
import { levelStackOf } from "@/modules/takeoff/levels";
import { sheetLayoutsOf } from "@/modules/takeoff/notes";
import { manifestOfRevision, registerViewOf } from "@/modules/takeoff/register-ui/server";
import { schedulesViewOf } from "@/modules/takeoff/schedules-ui/server";
import { sheetIndexOf } from "@/modules/takeoff/sheets";
import { pinnedRecordsOf, type PinnedRecord } from "@/modules/takeoff/trace";
import { answerReading, routeStatement } from "./answer";
import type { AskAnswer, AskEntity, AskObject, AskPlace, AskSchedule, AskSheet, AskSourceNeed, AskSources, AskStatement } from "./law";
import { viewOfPlacement } from "./queries/common";
import { queryFor } from "./queries/registry";
import { vocabularyOf } from "./vocabulary";

export * from "./law";
export { answerReading, answerStatement, routeStatement, type Routed } from "./answer";
export { completeReading, readQuestion, resolveReading, wordsOf, type GrammarOutcome } from "./grammar";
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
  };
}

/**
 * Ask the drawings one question (test contract: `askTheDrawings`). The grammar reads it against the
 * register and the stack; a clarify or a refusal is answered there and then, and a reading is answered
 * by its intent's one query over the sources it needs. No model is called on this path and no ledger
 * row is written (I-406).
 */
export async function askTheDrawings(scope: AskScope, statement: AskStatement): Promise<AskAnswer> {
  const base = await baseOf(scope);
  const routed = routeStatement(statement, vocabularyOf(base));
  if (routed.outcome !== "READ") return routed;
  const sources = await sourcesFor(scope, base, queryFor(routed.reading.intent).needs);
  return answerReading(routed, sources);
}
