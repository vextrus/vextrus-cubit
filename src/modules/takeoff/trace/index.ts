// The Trace, both ways (R-UI-022, R-TO-011, X-2): from a published quantity line to the entities it
// was read at, and from a held selection back to the lines that cite it.
//
// One reading, two doors (ARCH-02): the tRPC lane and the viewer route's server actions both come
// through here, and neither re-derives what a line cites or how the two addresses are spelled. The
// spelling lives here rather than in either screen because the register composes the viewer's
// address and the viewer composes the register's — a rule each of them would otherwise hold a copy
// of (B-17).
//
// WHICH SHEET a line stands on, and WHAT on it the Trace selects, is core's one pure reading
// (`@/core/sheets/frames`, `traceCitations`, I-421), asked over the record the line's pinned revision
// measured — core's one reading of that record too (`@/core/sheets/pinned`, I-422), read once per
// drawing of a campaign, never once per line (R-TO-050's 50 000 lines). What this file adds is the
// two doors and the lines they answer about.
//
// Nothing here judges. A lineId this project does not hold is a fact and answers `null`; a key
// nobody cites answers the empty list. No refusal code is invented for either (I-88's idiom).
//
// The two addresses and the reading of what a line cites live in `./address.ts` and are re-published
// here, so this barrel stays the one home the test contract names while a browser component may
// reach the spelling without carrying the store into its bundle (ARCH-01's spirit, B-17).
import { campaignsOf } from "@/core/campaigns";
import { and, asc, eq, forTenant, isUuid, quantityLines } from "@/core/db";
import { traceCitations, type TracedCitations } from "@/core/sheets/frames";
import { pinnedRecordsIn, type PinnedRecord } from "@/core/sheets/pinned";
import { appStorage } from "@/core/storage/app";
import { repudiatedObjectsOf } from "@/modules/takeoff/register";
import { citedKeysOf, type LineBinding, type LineEvidence } from "./address";

export { LINE_PARAM, citedKeysOf, originAddress, selectionAddress, traceAddress } from "./address";
export type { AddressableLine, AddressableSelection, LineBinding, LineEvidence } from "./address";

/** Which project's lines are being traced, in which workspace — the register's own scope. */
export type TraceScope = {
  readonly tenantId: string;
  readonly projectId: string;
};

/** What the other direction is asked: which sheet, and which of its keys are held. */
export type CitingAsk = {
  readonly drawingId: string;
  readonly sourceKeys: readonly string[];
};

/* ------------------------------------------------------------- the record a line was read on */

/**
 * One drawing of a pinned revision, as the Trace reads it: where its keys stand, how a reader names
 * each of its sheets and where each member stands on the grid. Core's (`@/core/sheets/pinned`),
 * because the coverage residue places its sightings over the very same record (B-17).
 */
export type { PinnedGrid, PinnedRecord } from "@/core/sheets/pinned";

/**
 * The record each named drawing of one pinned revision was measured on (I-422) — core's one reading
 * of it (`pinnedRecordsIn`), asked in a transaction of this workspace. A drawing the revision does not
 * name, or whose pinned bytes nobody read, is absent from the answer: its lines name no sheet and are
 * offered no Trace, which is honest rather than a guess (I-181).
 */
export async function pinnedRecordsOf(scope: TraceScope, setRevisionId: string, drawingIds: readonly string[]): Promise<Map<string, PinnedRecord>> {
  const wanted = [...new Set(drawingIds)].filter((drawingId) => isUuid(drawingId));
  if (wanted.length === 0 || !isUuid(setRevisionId)) return new Map();
  const storage = appStorage();
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => pinnedRecordsIn(tx, scope.tenantId, setRevisionId, wanted, storage));
}

/**
 * What the Trace makes of one stored line, over the record it was read on: the sheet it opens, what
 * it selects there, every entity it cites, and the sheet each cited key stands on (I-421). The one
 * composition the register, the Trace block and the other direction all read (B-17).
 */
export function tracedLineOf(row: { readonly viewKey: string; readonly bindings: Record<string, unknown> }, record: PinnedRecord | null | undefined): TracedCitations {
  // The same keys `citedKeysOf` reads, in its order: the view the line was read in, then each binding.
  const sources = Object.values(variablesOf(row.bindings)).map((binding) => binding.source);
  return traceCitations({ viewKey: row.viewKey, sources }, record?.standing ?? null);
}

/* --------------------------------------------------------------------------------- the doors */

/**
 * One line's whole evidence, or nothing. A lineId nobody published, one of another project, one of
 * another tenant and a value that is no id at all all answer `null` — the Trace's missing cell is a
 * fact about the address, never a fault and never a registered refusal (I-88's idiom).
 */
export async function lineEvidence(scope: TraceScope, lineId: string): Promise<LineEvidence | null> {
  if (!isUuid(lineId) || !isUuid(scope.projectId) || !isUuid(scope.tenantId)) return null;
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.projectId, scope.projectId), eq(quantityLines.lineId, lineId)))
      .limit(1),
  );
  const row = rows[0];
  if (row === undefined) return null;
  const records = await pinnedRecordsOf(scope, row.setRevisionId, [row.drawingId]);
  return evidenceOf(row, tracedLineOf(row, records.get(row.drawingId)));
}

/**
 * The other direction of X-2: every published line of that sheet whose cited ENTITIES meet the held
 * selection, each line once however many of its keys match, in the order the store published them.
 *
 * A held selection is entities of the drawing — a column's outline, a schedule cell — and a line
 * cites its member by its placement, so a line is met through the register's own join: its placement
 * resolved to the outline and the mark it was read off, beside every source key its bindings name
 * (I-421). Selecting C2's outline on S-10 therefore lists every line measured off C2, at every
 * storey its placement stands on.
 *
 * A line measured off an object a person has struck is not answered: it is withheld from the
 * register's own table too, and a way back to a row nobody can see is no way back (I-173).
 */
export async function linesCiting(scope: TraceScope, ask: CitingAsk): Promise<LineEvidence[]> {
  if (ask.sourceKeys.length === 0 || !isUuid(ask.drawingId) || !isUuid(scope.projectId) || !isUuid(scope.tenantId)) return [];

  // The campaign the register RENDERS, and no other. A way back is only a way back to a row a reader
  // can then look at: the register's table is one campaign's — the project's latest — so a line of a
  // campaign before it would offer a reticle for a row that is not on the screen it lands on
  // (I-173's rule, R-UI-050). A project with no campaign at all has no line to cite.
  const open = await campaignsOf(scope);
  const rendered = open[open.length - 1];
  if (rendered === undefined) return [];

  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(quantityLines)
      .where(
        and(
          eq(quantityLines.tenantId, scope.tenantId),
          eq(quantityLines.projectId, scope.projectId),
          eq(quantityLines.drawingId, ask.drawingId),
          eq(quantityLines.campaignId, rendered.campaignId),
        ),
      )
      .orderBy(asc(quantityLines.publishedAt), asc(quantityLines.lineId)),
  );
  if (rows.length === 0) return [];

  const asked = new Set(ask.sourceKeys);
  const records = await pinnedRecordsOf(scope, rendered.setRevisionId, [ask.drawingId]);
  const record = records.get(ask.drawingId);
  const held: LineEvidence[] = [];
  for (const row of rows) {
    const traced = tracedLineOf(row, record);
    const cited = citedKeysOf({ sourceKey: row.viewKey, variables: variablesOf(row.bindings) });
    if (traced.entities.some((key) => asked.has(key)) || cited.some((key) => asked.has(key))) held.push(evidenceOf(row, traced));
  }
  if (held.length === 0) return [];

  const struck = await struckObjects(scope, [...new Set(rows.map((row) => row.setRevisionId))]);
  return held.filter((line) => !struck.has(line.objectKey));
}

/* ---------------------------------------------------------------------------------- composing */

/**
 * The variables a published line carries, as a screen states them — the one home of that reading,
 * shared by the register's table and the Trace's block (B-17). `bindings` is stored as the rail
 * wrote it, so what is not a reading of a value and a unit is not shown as one.
 */
export function variablesOf(bindings: Record<string, unknown>): Record<string, LineBinding> {
  const held: Record<string, LineBinding> = {};
  for (const [name, raw] of Object.entries(bindings)) {
    if (typeof raw !== "object" || raw === null) continue;
    const binding = raw as { value?: unknown; unit?: unknown; basis?: unknown; source?: unknown; canonical?: { value?: unknown; unit?: unknown } };
    if (typeof binding.value !== "string" || typeof binding.unit !== "string") continue;
    held[name] = {
      value: binding.value,
      unit: binding.unit,
      basis: typeof binding.basis === "string" ? binding.basis : "",
      source: typeof binding.source === "string" ? binding.source : "",
      canonical: {
        value: typeof binding.canonical?.value === "string" ? binding.canonical.value : binding.value,
        unit: typeof binding.canonical?.unit === "string" ? binding.canonical.unit : binding.unit,
      },
    };
  }
  return held;
}

/** One stored line as the Trace answers it — the register's own reading of it, plus its sheet. */
function evidenceOf(row: typeof quantityLines.$inferSelect, traced: TracedCitations): LineEvidence {
  const variables = variablesOf(row.bindings);
  return {
    lineId: row.lineId,
    objectKey: row.objectKey,
    kind: row.kind,
    value: row.value,
    unit: row.unit,
    drawingId: row.drawingId,
    layoutName: traced.layoutName,
    traceKeys: traced.flyTo,
    sourceSheets: traced.sheets,
    formula: row.formula,
    variables,
    quantityBasis: row.quantityBasis,
    selectionBasis: row.selectionBasis,
  };
}

/** Every object of these pinned revisions a person has struck, in one lookup per revision. */
async function struckObjects(scope: TraceScope, setRevisionIds: readonly string[]): Promise<Set<string>> {
  const struck = new Set<string>();
  for (const setRevisionId of setRevisionIds) {
    const rows = await repudiatedObjectsOf({ tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId });
    for (const row of rows) struck.add(row.objectKey);
  }
  return struck;
}
