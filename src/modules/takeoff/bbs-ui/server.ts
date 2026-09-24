// S-BBS's reading, composed once (ARCH-02): the residue answers which campaign this project has
// open, the ONE door answers that campaign's bill of bars, and the campaign's own published lines
// answer whether any of its reinforcement was only partly declared.
//
// IT COMPOSES RATHER THAN COMPUTES. `bbsOf` is inc-309's door and the bill is its answer, carried
// across whole: no figure of this screen's own is added to it, and none is taken away (goal, B-17).
import { and, asc, drawingSetRevisions, drawingSets, eq, forTenant, projects, quantityLines } from "@/core/db";
import { notMeasuredRowsOf, notMeasuredScopeOf } from "@/core/documents/kinds/boq-draft";
import { dhakaDateParts } from "@/core/format";
import { measurementStatementOf, residueOf } from "@/core/residue";
import { bbsOf, type BbsDocument } from "@/modules/takeoff/rebar";
import { manifestOfRevision } from "@/modules/takeoff/register-ui/server";
import { entitySelectionOf, pinnedRecordsOf, type PinnedRecord } from "@/modules/takeoff/trace";
import type { BbsParticulars } from "./emission";
import type { BbsNotInSchedule, BbsOmission, BbsSheetSelection, BbsTraces, BbsView } from "./view";

/** Which project's schedule is being read, in which workspace (SEAM-TENANT). */
export type BbsScope = { readonly tenantId: string; readonly projectId: string };

/** The kind whose lines say whether this campaign's reinforcement was wholly read (L-QTY-03). */
const RCC_REBAR = "rcc.rebar";

/** What a line says about what it could not measure (L-QTY-02). */
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/**
 * The components of a rebar line that are LENGTH terms: the run itself (`net`) and its laps. A line
 * that declares either missing holds bars nobody can cut to (I-567); the ties are the
 * section's own perimeter and are not among them.
 */
const LENGTH_TERMS: readonly string[] = Object.freeze(["net", "lap"]);

/** The reading a project with no campaign answers with (R-UI-050's empty cell). */
const NOTHING_SCHEDULED: BbsView = { campaignId: null, setRevisionId: null, document: null, partial: false, omitted: [], deferred: [], notInSchedule: [] };

/**
 * The whole reading one bar-schedule screen paints (test contract: `bbsViewOf`).
 *
 * A project with no campaign open answers the empty reading rather than a fault: an absence is a
 * state, and the screen teaches the next action from it (R-UI-050). The campaign is resolved exactly
 * as `boqViewOf` resolves one — the residue's own answer — so the draft and the schedule can never
 * be read off two different campaigns (B-17).
 */
export async function bbsViewOf(scope: BbsScope): Promise<BbsView> {
  const residue = await residueOf(scope);
  const campaign = residue.campaign;
  if (campaign === null) return NOTHING_SCHEDULED;

  const [document_, declared] = await Promise.all([
    bbsOf({ tenantId: scope.tenantId, projectId: scope.projectId, campaignId: campaign.campaignId }),
    partlyDeclared(scope.tenantId, campaign.campaignId),
  ]);
  const traces = await tracesOf(scope, campaign.setRevisionId, document_);

  return {
    campaignId: campaign.campaignId,
    setRevisionId: campaign.setRevisionId,
    document: document_,
    partial: declared.partial,
    omitted: declared.omitted,
    deferred: declared.deferred,
    notInSchedule: notInScheduleOf(measurementStatementOf(residue.cells)),
    traces,
  };
}

/**
 * Where the schedule's figures came from, for the Trace (s-bbs I-559): the record each drawing of
 * the campaign's pinned revision was measured on, read ONCE, and every key resolved against it by the
 * Trace's one reading of a named entity (`entitySelectionOf`).
 *
 * - An entry's MASS is the mass of every member it counts, so it selects all of them — each member's
 *   outline and mark — on the plan its first member stands on; a member standing on another sheet is
 *   still counted in the figure and simply not selected there.
 * - A bar's MARK was read off the schedule's cells (`sourceKeys`), so it selects those cells on the
 *   sheet the first of them is drawn on.
 *
 * Nothing is guessed: what resolves to nothing is absent, and the cell states its figure unlinked.
 */
export async function tracesOf(scope: BbsScope, setRevisionId: string, document_: BbsDocument): Promise<BbsTraces> {
  if (document_.rows.length === 0) return { members: {}, bars: {} };
  const manifest = await manifestOfRevision(scope.tenantId, setRevisionId);
  const records = await pinnedRecordsOf(scope, setRevisionId, manifest.map((member) => member.drawingId));
  return tracesOver(document_, records);
}

/** The pure half of `tracesOf`: the schedule's keys, resolved over records already read. */
export function tracesOver(document_: Pick<BbsDocument, "rows">, records: ReadonlyMap<string, PinnedRecord>): BbsTraces {
  const members: Record<string, BbsSheetSelection> = {};
  const bars: Record<string, BbsSheetSelection> = {};
  for (const line of document_.rows) {
    if (!(line.objectKey in members)) {
      const selection = selectionOfAll(line.members.length > 0 ? line.members : [line.objectKey], records);
      if (selection !== null) members[line.objectKey] = selection;
    }
    const cells = selectionOfAll(line.sourceKeys, records);
    if (cells !== null) bars[line.barKey] = cells;
  }
  return { members, bars };
}

/**
 * Several named keys on ONE sheet: the sheet the first key that resolves stands on, and every key's
 * entities that stand on that same sheet, each once, in order.
 */
function selectionOfAll(keys: readonly string[], records: ReadonlyMap<string, PinnedRecord>): BbsSheetSelection | null {
  let first: BbsSheetSelection | null = null;
  const selected: string[] = [];
  for (const key of keys) {
    const selection: BbsSheetSelection | null = first === null ? entitySelectionOf(key, records) : entitySelectionOf(key, records, { drawingId: first.drawingId, layoutName: first.layoutName });
    if (selection === null) continue;
    if (first === null) first = selection;
    for (const entity of selection.sourceKeys) if (!selected.includes(entity)) selected.push(entity);
  }
  return first === null ? null : { drawingId: first.drawingId, layoutName: first.layoutName, sourceKeys: selected };

/**
 * The reinforcement no line was published for, as the draft BOQ closes on it (I-569): the
 * measurement statement's own `rcc.rebar` rows, read through the draft's own reading of a statement
 * row and said in its closing block's words — so the schedule and the draft name one boundary, and a
 * schedule of column steel never passes for the building's (B-17, L-QTY-07).
 */
export function notInScheduleOf(statement: Parameters<typeof notMeasuredRowsOf>[0]): BbsNotInSchedule[] {
  return notMeasuredScopeOf({ notMeasured: notMeasuredRowsOf(statement.filter((row) => row.kind === RCC_REBAR)) });
}

/**
 * Whether any `rcc.rebar` line of this campaign stands PARTLY DECLARED — a tie zone nobody
 * transcribed, say (L-QTY-02, REBAR_TIE_ZONE_UNSTATED) — and the registered codes those lines state
 * for what they left out, each once, in the order the lines first state it, with the components of
 * the line each was stated for (I-354).
 *
 * It is READ from the published lines rather than defaulted: a flag hard-coded false would draw a
 * whole schedule over a campaign whose bars are only part of the story, and the reader would never
 * learn what is missing from the figures in front of them (Decision §2).
 */
async function partlyDeclared(tenantId: string, campaignId: string): Promise<{ partial: boolean; omitted: BbsOmission[]; deferred: string[] }> {
  const lines = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ objectKey: quantityLines.objectKey, coverage: quantityLines.coverage, omitted: quantityLines.omitted })
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, tenantId), eq(quantityLines.campaignId, campaignId), eq(quantityLines.kind, RCC_REBAR)))
      .orderBy(asc(quantityLines.publishedAt), asc(quantityLines.lineId)),
  );
  const partly = lines.filter((line) => line.coverage === PARTIAL_DECLARED);
  const byCode = new Map<string, string[]>();
  const deferred: string[] = [];
  for (const line of partly) {
    for (const { code, variable } of omittedComponentsOf(line.omitted)) {
      const held = byCode.get(code) ?? [];
      if (!byCode.has(code)) byCode.set(code, held);
      if (variable !== null && !held.includes(variable)) held.push(variable);
      // A length term left out makes this member's running bars storey-height runs (I-567).
      if (variable !== null && LENGTH_TERMS.includes(variable) && !deferred.includes(line.objectKey)) deferred.push(line.objectKey);
    }
  }
  return { partial: partly.length > 0, omitted: [...byCode.entries()].map(([code, components]) => ({ code, components })), deferred };
}

/**
 * What one line's `omitted` states, read off the store's own shape (L-QTY-02): each component's
 * registered code, and the line variable it was declared for where the line names one.
 */
function omittedComponentsOf(omitted: readonly unknown[]): { code: string; variable: string | null }[] {
  return omitted.flatMap((component) => {
    const held = component as { code?: unknown; variable?: unknown } | null;
    const code = held?.code;
    const variable = held?.variable;
    return typeof code === "string" && code !== "" ? [{ code, variable: typeof variable === "string" && variable !== "" ? variable : null }] : [];
  });
}

/** What an issued schedule is ABOUT, read from the project and the pin its campaign measured. */
export type BbsAbout = {
  /** The project's own name — what the schedule is a schedule OF. */
  readonly project: string;
  /** Everything the particulars block says but the day it was issued, which is the issue's own. */
  readonly particulars: Omit<BbsParticulars, "issuedOn">;
};

/** A recorded text, or nothing where the project recorded none — an empty field is not a statement. */
function recorded(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value.trim();
}

/**
 * The particulars an issued schedule states in words (s-bbs I-535): the project's name, code, client
 * and site as the project records them, and the drawing set the campaign's pinned revision belongs to
 * — its name, WHICH of its pins this is (counted from the first in the store's own write order,
 * `appendSeq`, never by a random surrogate), and the day it was pinned in the document's zone.
 *
 * Read, never composed: a particular the project does not record is answered as nothing, and the page
 * says so. A pin the store cannot find for a campaign that names it is not a gap in the paper but a
 * store that contradicts itself, and it is raised as the outage it is (ARCH-03).
 */
export async function bbsParticularsOf(scope: BbsScope, setRevisionId: string): Promise<BbsAbout> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const [project] = await tx
      .select({ name: projects.name, code: projects.code, client: projects.client, site: projects.siteAddress })
      .from(projects)
      .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.projectId, scope.projectId)))
      .limit(1);
    const [pinned] = await tx
      .select({ setId: drawingSetRevisions.setId, pinnedAt: drawingSetRevisions.createdAt, set: drawingSets.name })
      .from(drawingSetRevisions)
      .innerJoin(drawingSets, eq(drawingSets.setId, drawingSetRevisions.setId))
      .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
      .limit(1);
    if (project === undefined || pinned === undefined) {
      throw new Error(`the schedule's particulars cannot be read: project ${scope.projectId} or its pinned revision ${setRevisionId} is not in the store`);
    }
    const pins = await tx
      .select({ setRevisionId: drawingSetRevisions.setRevisionId })
      .from(drawingSetRevisions)
      .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setId, pinned.setId)))
      .orderBy(asc(drawingSetRevisions.appendSeq));
    const revision = pins.findIndex((pin) => pin.setRevisionId === setRevisionId) + 1;
    return {
      project: project.name,
      particulars: {
        code: recorded(project.code),
        client: recorded(project.client),
        site: recorded(project.site),
        drawingSet: pinned.set,
        revision,
        pinnedOn: dhakaDateParts(pinned.pinnedAt),
      },
    };
  });
}
