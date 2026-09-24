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
import { actSourceOf, readCitedKey } from "@/core/identity";
import { and, asc, eq, forTenant, inArray, isUuid, manualMeasurements, quantityLines, registerObjects } from "@/core/db";
import { sheetOfKey, standsOn, traceCitations, type TracedCitations } from "@/core/sheets/frames";
import { pinnedRecordsIn, type PinnedRecord } from "@/core/sheets/pinned";
import { appStorage } from "@/core/storage/app";
import { levelsOf } from "@/modules/takeoff/levels";
import { repudiatedObjectsOf } from "@/modules/takeoff/register";
import { citedKeysOf, type LineBinding, type LineEvidence, type LineMember, type LineOmission } from "./address";

export { LINE_PARAM, citedKeysOf, originAddress, selectionAddress, sourceLinksOf, traceAddress } from "./address";
export type { AddressableLine, AddressableSelection, LineBinding, LineEvidence, LineMember, LineOmission, SourceLink } from "./address";

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
export function tracedLineOf(row: { readonly viewKey: string; readonly bindings: Record<string, unknown> }, record: PinnedRecord | null | undefined, acts: ActSources = NO_ACTS): TracedCitations {
  // The same keys `citedKeysOf` reads, in its order: the view the line was read in, then each binding —
  // an `act:` key read through to the entities the hand measurement it names was traced on (I-619).
  const sources = Object.values(variablesOf(row.bindings)).flatMap((binding) => acts.get(binding.source) ?? [binding.source]);
  return traceCitations({ viewKey: row.viewKey, sources }, record?.standing ?? null);
}

/* ------------------------------------------------------------- the sixth scheme: `act:` */

/**
 * What an `act:` key a line cites stands on, by the key: the source keys the hand measurement that act
 * recorded was traced on, every ring, each key once, in the order drawn (I-619). A figure a person
 * ENTERED at a card is cited at the act that recorded it (`actSourceOf`, s-measure I-384) — an act is on
 * no sheet, but the measurement it recorded is: the Trace reads the act through to its ring, so "one
 * click back to the drawing" holds for the entered thickness as for the traced area. An act that
 * recorded no hand measurement, or one of another project, is absent: it stays a key on no sheet.
 */
export type ActSources = ReadonlyMap<string, readonly string[]>;

const NO_ACTS: ActSources = new Map();

/** The act ids the `act:` keys among these name — the cited-key grammar's own reading (`readCitedKey`). */
function actIdsOf(keys: readonly string[]): string[] {
  const ids = keys.filter((key) => readCitedKey(key).scheme === "act").map((key) => key.slice(key.indexOf(":") + 1));
  return [...new Set(ids)].filter((id) => isUuid(id));
}

/** Every point's source keys of a stored trace (`manual_measurements.traced`, the act's judged geometry), each once. */
export function tracedSourcesOf(traced: unknown): string[] {
  const held = new Set<string>();
  const shape = traced as { outer?: unknown; cutouts?: unknown; run?: unknown; points?: unknown } | null;
  const rings: unknown[] = [];
  if (Array.isArray(shape?.outer)) rings.push(shape.outer);
  if (Array.isArray(shape?.cutouts)) for (const cutout of shape.cutouts) rings.push((cutout as { ring?: unknown } | null)?.ring);
  if (Array.isArray(shape?.run)) rings.push(shape.run);
  if (Array.isArray(shape?.points)) rings.push(shape.points);
  for (const ring of rings) {
    if (!Array.isArray(ring)) continue;
    for (const point of ring) {
      const sources = (point as { sources?: unknown } | null)?.sources;
      if (Array.isArray(sources)) for (const source of sources) if (typeof source === "string" && source !== "") held.add(source);
    }
  }
  return [...held];
}

/**
 * What each `act:` key among these stands on (I-619): one read of the project's hand measurements the
 * acts recorded, whatever the count of keys.
 */
export async function actSourcesOf(scope: TraceScope, keys: readonly string[]): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>();
  const actIds = actIdsOf(keys);
  if (actIds.length === 0 || !isUuid(scope.projectId) || !isUuid(scope.tenantId)) return found;
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({ actId: manualMeasurements.actId, traced: manualMeasurements.traced })
      .from(manualMeasurements)
      .where(and(eq(manualMeasurements.tenantId, scope.tenantId), eq(manualMeasurements.projectId, scope.projectId), inArray(manualMeasurements.actId, actIds))),
  );
  for (const row of rows) {
    const sources = tracedSourcesOf(row.traced);
    if (sources.length > 0) found.set(actSourceOf(row.actId), sources);
  }
  return found;
}

/** Every binding source these stored lines cite — what `actSourcesOf` is asked about. */
function bindingSourcesOf(rows: readonly { readonly bindings: Record<string, unknown> }[]): string[] {
  return rows.flatMap((row) => Object.values(variablesOf(row.bindings)).map((binding) => binding.source));
}

/**
 * One entity a row NAMES — a sighting, a queue item, a storey-height reading's note — as the Trace
 * selects it: the sheet it stands on and the keys the viewer flies to there (I-555).
 *
 * The key is read by the grammar that minted it, exactly as a line's citations are (`traceCitations`):
 * a placement key or a bar set is the member, resolved to the outline and the mark it was read off; a
 * source key is its own entity. The sheet is the one the caller already names (a sighting states
 * its own), else the one the entity stands on. Only keys that stand on that sheet are selected, so
 * the viewer never lands with a key it cannot hold; a key the record does not hold — a view, an act, an
 * entity of another record — answers `null`, and the row shows its key with no link (I-181).
 *
 * The drawing is the caller's where it names one, else the first drawing of the records that holds
 * the key: a `DXF_HANDLE` is unique within a drawing, never across two (the Ask locator's reading).
 */
export function entitySelectionOf(
  key: string,
  records: ReadonlyMap<string, PinnedRecord>,
  at: { readonly drawingId?: string | null; readonly layoutName?: string | null } = {},
): { drawingId: string; layoutName: string; sourceKeys: string[] } | null {
  const candidates = at.drawingId === undefined || at.drawingId === null ? [...records.keys()] : [at.drawingId];
  for (const drawingId of candidates) {
    const record = records.get(drawingId);
    if (record === undefined) continue;
    const traced = traceCitations({ viewKey: "", sources: [key] }, record.standing);
    if (traced.entities.length === 0) continue;
    const { spaces, sheets, frames } = record.standing;
    // A member opens where its outline stands (the Trace's own reading); an entity on its own sheet.
    const named = at.layoutName !== undefined && at.layoutName !== null && at.layoutName !== "" ? at.layoutName : null;
    const scheme = readCitedKey(key).scheme;
    const layoutName = named ?? (scheme === "placement" || scheme === "bars" ? traced.layoutName : sheetOfKey(key, spaces, sheets, frames));
    if (layoutName === null) continue;
    const sourceKeys = traced.entities.filter((entity) => standsOn(entity, layoutName, spaces, sheets, frames));
    if (sourceKeys.length > 0) return { drawingId, layoutName, sourceKeys };
  }
  return null;
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
  const record = records.get(row.drawingId);
  const members = await membersOf(scope, row.setRevisionId, [row.objectKey]);
  const acts = await actSourcesOf(scope, bindingSourcesOf([row]));
  return evidenceOf(row, tracedLineOf(row, record, acts), record, members);
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
  const acts = await actSourcesOf(scope, bindingSourcesOf(rows));
  const held: LineEvidence[] = [];
  for (const row of rows) {
    const traced = tracedLineOf(row, record, acts);
    const cited = citedKeysOf({ sourceKey: row.viewKey, variables: variablesOf(row.bindings) });
    if (traced.entities.some((key) => asked.has(key)) || cited.some((key) => asked.has(key))) held.push(evidenceOf(row, traced, record, EMPTY_MEMBERS));
  }
  if (held.length === 0) return [];

  const struck = await struckObjects(scope, [...new Set(rows.map((row) => row.setRevisionId))]);
  const shown = held.filter((line) => !struck.has(line.objectKey));
  // Each citing row is named by its member as the register names it (I-552): one read of the
  // revision's objects for the rows that are answered, never one per row.
  const members = await membersOf(scope, rendered.setRevisionId, shown.map((line) => line.objectKey));
  return shown.map((line) => ({ ...line, member: members.get(line.objectKey) ?? null }));
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

/**
 * The components a line enumerated as omitted, as the store holds them (`quantity_lines.omitted`, the
 * offer's `OmittedComponent[]`). The column is `json` of unknown shape at the type level, so each
 * entry is read for the two strings it carries and an entry carrying neither is not invented into
 * one (L-QTY-02: what the row declared, and nothing it did not). The one home of that reading, read
 * by the register's table and the Trace's block alike (B-17).
 */
export function omissionsOf(stored: readonly unknown[]): LineOmission[] {
  const held: LineOmission[] = [];
  for (const entry of stored) {
    const variable = (entry as { variable?: unknown } | null)?.variable;
    const code = (entry as { code?: unknown } | null)?.code;
    if (typeof variable === "string" && typeof code === "string") held.push({ variable, code });
  }
  return held;
}

/**
 * The level a register row stands on, as a reader reads it: the label, never the surrogate's id; the
 * slot or label the reading named where the row stands on no level of the stack; "" where it names
 * none. The one home of that reading — the register's table and the Trace's heading say it alike.
 */
export function levelLabelOf(row: { levelId: string | null; levelSlot: string | null; levelLabel: string | null } | undefined, labels: ReadonlyMap<string, string>): string {
  if (row === undefined) return "";
  if (row.levelId !== null) return labels.get(row.levelId) ?? "";
  return row.levelSlot ?? row.levelLabel ?? "";
}

const EMPTY_MEMBERS: ReadonlyMap<string, LineMember> = new Map();

/**
 * The member each of these objects is, inside one pinned revision: its mark and its level's label
 * (I-552). One read of the objects asked for and one of the project's levels, whatever the count.
 * An object the revision's register does not hold is absent from the answer.
 */
async function membersOf(scope: TraceScope, setRevisionId: string, objectKeys: readonly string[]): Promise<Map<string, LineMember>> {
  const held = new Map<string, LineMember>();
  const wanted = [...new Set(objectKeys)];
  if (wanted.length === 0 || !isUuid(setRevisionId)) return held;
  const [rows, levels] = await Promise.all([
    forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
      tx
        .select({ objectKey: registerObjects.objectKey, mark: registerObjects.mark, levelId: registerObjects.levelId, levelSlot: registerObjects.levelSlot, levelLabel: registerObjects.levelLabel })
        .from(registerObjects)
        .where(and(eq(registerObjects.tenantId, scope.tenantId), eq(registerObjects.setRevisionId, setRevisionId), inArray(registerObjects.objectKey, wanted))),
    ),
    levelsOf(scope),
  ]);
  const labels = new Map(levels.map((level) => [level.levelId, level.label]));
  for (const row of rows) held.set(row.objectKey, { mark: row.mark, level: levelLabelOf(row, labels) });
  return held;
}

/** How a reader names each sheet the Trace names, by layout name — where the record numbers it. */
function sheetLabelsOf(traced: TracedCitations, record: PinnedRecord | null | undefined): Record<string, string> {
  const labels: Record<string, string> = {};
  if (record === null || record === undefined) return labels;
  for (const layoutName of [traced.layoutName, ...Object.values(traced.sheets)]) {
    if (layoutName === null || layoutName in labels) continue;
    const label = record.labelOf(layoutName);
    if (label !== null && label !== "") labels[layoutName] = label;
  }
  return labels;
}

/** One stored line as the Trace answers it — the register's own reading of it, plus its sheet. */
function evidenceOf(row: typeof quantityLines.$inferSelect, traced: TracedCitations, record: PinnedRecord | null | undefined, members: ReadonlyMap<string, LineMember>): LineEvidence {
  const variables = variablesOf(row.bindings);
  return {
    lineId: row.lineId,
    objectKey: row.objectKey,
    elementClass: row.class,
    member: members.get(row.objectKey) ?? null,
    kind: row.kind,
    value: row.value,
    omitted: omissionsOf(row.omitted),
    unit: row.unit,
    drawingId: row.drawingId,
    layoutName: traced.layoutName,
    traceKeys: traced.flyTo,
    sourceSheets: traced.sheets,
    sheetLabels: sheetLabelsOf(traced, record),
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
