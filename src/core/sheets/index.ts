// R-TO-004's sheets, as core answers them: what a project's drawings currently amount to, what each
// layout's title block proposes, and which of those proposals a person has confirmed.
//
// It lives in core because the act seam is core and L-ACT-02 makes the act map's totality a
// compile-time property: CONFIRM_DISCIPLINE's rendering has to resolve its own membership, and a
// rendering that reached into `src/modules` could not (ARCH-01). The module above composes these
// answers with the raster seam's pictures and the group labels a screen writes sentences from.
import { and, desc, drawings, eq, forTenant, inArray, ingests, isUuid, sheetDisciplines, type TenantTx } from "../db";
import { entityGraphSchema, type EntityGraph } from "../entitygraph/schema";
import type { Storage } from "../storage";
import { readTitleBlock } from "./grammar";
import { DISCIPLINES, FIDELITY_FACTS, sheetIdOf, type Discipline, type FidelityFact, type ScaleState, type SheetProposal } from "./law";

export { readTitleBlock } from "./grammar";
export {
  DISCIPLINES,
  FIDELITY_FACTS,
  PROPOSAL_BASES,
  SCALE_STATES,
  parseSheetId,
  sheetIdOf,
  type Discipline,
  type FidelityFact,
  type ProposalBasis,
  type ScaleState,
  type SheetProposal,
} from "./law";

/** Which project's sheets are being asked about, in whose workspace. */
export type SheetScope = { tenantId: string; projectId: string };

/**
 * The half of an ingest record a sheet is read from. It is stated structurally rather than imported:
 * the record's own home is `src/modules/takeoff/ingest`, which core may not name (ARCH-01), and this
 * is the shape both that seam's records and this file's own read answer in.
 */
export type SheetSourceRecord = {
  readonly ingestId: string;
  readonly drawingId: string;
  readonly artifactSha256: string;
  readonly extractor: { readonly scheme: string };
  readonly facts: Readonly<Record<string, unknown>>;
};

/** One drawing of a project and the record that currently stands for it, or none yet. */
export type ProjectDrawing = {
  readonly drawingId: string;
  readonly name: string;
  readonly format: string;
  readonly record: SheetSourceRecord | null;
};

/** One sheet, as core reads it out of a record: what it is, what it proposes and what it lost. */
export type SheetFacts = {
  readonly sheetId: string;
  readonly ingestId: string;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly kind: "model" | "paper";
  readonly scheme: string;
  readonly proposal: SheetProposal;
  readonly scaleState: ScaleState;
  readonly facts: Readonly<Record<FidelityFact, number | boolean>>;
};

/** One confirmation a person made, as the store holds it (L-ACT-01: append-only, act-carried). */
export type SheetConfirmation = {
  readonly sheetId: string;
  readonly ingestId: string;
  readonly layoutName: string;
  readonly discipline: Discipline;
  readonly actId: string;
};

/** The counters an ingest record carries, read structurally off the json column it is stored in. */
type RecordedFacts = {
  insunits?: { unit?: string | null } | null;
  dropped_layouts?: readonly string[];
  layouts?: readonly { name?: unknown; kind?: unknown; strays_rejected?: unknown }[];
  counters?: readonly { space?: unknown; explode_truncated?: unknown; explode_losses?: unknown; flatten_capped?: unknown }[];
};

/** Is this string one of the disciplines the closed enum holds? */
export function isDiscipline(value: string): value is Discipline {
  return (DISCIPLINES as readonly string[]).includes(value);
}

/**
 * Every drawing a project holds, each with the ingest record that currently stands for it — the
 * newest, since a re-ingest supersedes rather than replaces (R-TO-001).
 *
 * A drawing waiting on its first ingest answers `record: null` rather than being left out: a screen
 * that showed nothing for it could not tell "no drawings" from "not read yet", and R-UI-050 asks an
 * empty surface to say which emptiness it is.
 */
export async function projectDrawingsOf(tx: TenantTx, scope: SheetScope): Promise<ProjectDrawing[]> {
  if (!isUuid(scope.projectId)) return [];

  const drawn = await tx
    .select()
    .from(drawings)
    .where(and(eq(drawings.tenantId, scope.tenantId), eq(drawings.projectId, scope.projectId)))
    .orderBy(desc(drawings.createdAt));
  if (drawn.length === 0) return [];

  const ingested = await tx
    .select()
    .from(ingests)
    .where(
      and(
        eq(ingests.tenantId, scope.tenantId),
        inArray(
          ingests.drawingId,
          drawn.map((drawing) => drawing.drawingId),
        ),
      ),
    )
    .orderBy(desc(ingests.createdAt));

  const current = new Map<string, SheetSourceRecord>();
  for (const row of ingested) {
    // Newest first, so the first row seen for a drawing is the record that stands for it.
    if (current.has(row.drawingId)) continue;
    current.set(row.drawingId, {
      ingestId: row.ingestId,
      drawingId: row.drawingId,
      artifactSha256: row.artifactSha256,
      extractor: { scheme: row.extractorScheme },
      facts: row.facts,
    });
  }

  return drawn.map((drawing) => ({
    drawingId: drawing.drawingId,
    name: drawing.name,
    format: drawing.format,
    record: current.get(drawing.drawingId) ?? null,
  }));
}

/**
 * The sheets of one record: one per layout its own inventory names, in the inventory's order, each
 * carrying what the title block proposes, the scale state the artifact's extents and units decide,
 * and every fidelity fact the record reported (R-TO-004, R-TO-001).
 *
 * The proposals are computed on read from the artifact the record points at, never stored: a stored
 * partition would be a second answer to a question the artifact already answers, and it could
 * disagree with the record it was derived from.
 */
export async function sheetsOfRecord(tenantId: string, record: SheetSourceRecord, storage: Storage): Promise<SheetFacts[]> {
  const facts = record.facts as RecordedFacts;
  const layouts = facts.layouts ?? [];
  if (layouts.length === 0) return [];

  const graph = await artifactOf(tenantId, record, storage);
  const placeable = (facts.insunits ?? null)?.unit ?? null;

  return layouts.map((layout) => {
    const layoutName = String(layout.name ?? "");
    const extent = graph.layouts.find((entry) => entry.name === layoutName)?.bbox ?? null;
    return {
      sheetId: sheetIdOf(record.ingestId, layoutName),
      ingestId: record.ingestId,
      drawingId: record.drawingId,
      layoutName,
      kind: sheetKind(layout.kind, layoutName),
      scheme: record.extractor.scheme,
      proposal: readTitleBlock(graph, layoutName),
      // R-TO-004's scale state, derived and no further: a sheet whose extents or whose drawing unit
      // the extractor could not state cannot be placed at any scale, and one that can is simply not
      // affirmed yet — AFFIRM_SCALE is an act nobody has performed.
      scaleState: extent === null || placeable === null ? "unplaceable" : "unaffirmed",
      facts: fidelityFactsOf(facts, layoutName),
    };
  });
}

/**
 * Every confirmation a project holds (L-REG-03: discipline is human-confirmed, and an unconfirmed
 * drawing is not walked). Read on the caller's own transaction, so the act seam judges membership
 * against the very state its write will land in.
 */
export async function confirmationsOf(tx: TenantTx, scope: SheetScope): Promise<SheetConfirmation[]> {
  if (!isUuid(scope.projectId)) return [];
  const rows = await tx
    .select()
    .from(sheetDisciplines)
    .where(and(eq(sheetDisciplines.tenantId, scope.tenantId), eq(sheetDisciplines.projectId, scope.projectId)))
    .orderBy(desc(sheetDisciplines.createdAt));

  return rows.map((row) => ({
    sheetId: sheetIdOf(row.ingestId, row.layoutName),
    ingestId: row.ingestId,
    layoutName: row.layoutName,
    discipline: row.discipline,
    actId: row.actId,
  }));
}

/** The same two reads, on a transaction of their own — what a read-only caller outside an act uses. */
export async function sheetStateOf(scope: SheetScope): Promise<{ drawings: ProjectDrawing[]; confirmations: SheetConfirmation[] }> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => ({
    drawings: await projectDrawingsOf(tx, scope),
    confirmations: await confirmationsOf(tx, scope),
  }));
}

/**
 * R-TO-001's counters as the named facts a card shows, one per name in the roster: the layout's own
 * stray count, its space's three counters, and the record-level dropped layouts. Each is reported as
 * the number or the flag it is — a map of per-type losses is shown as how many were lost, and a list
 * of dropped layouts as how many were dropped, because a card shows a fact and not a structure.
 */
function fidelityFactsOf(facts: RecordedFacts, layoutName: string): Record<FidelityFact, number | boolean> {
  const layout = (facts.layouts ?? []).find((row) => row.name === layoutName);
  const counter = (facts.counters ?? []).find((row) => row.space === layoutName);
  const reported: Record<FidelityFact, number | boolean> = {
    strays_rejected: countOf(layout?.strays_rejected),
    explode_truncated: counter?.explode_truncated === true,
    explode_losses: totalOf(counter?.explode_losses),
    flatten_capped: totalOf(counter?.flatten_capped),
    dropped_layouts: (facts.dropped_layouts ?? []).length,
  };
  // The roster is what a card carries, whole: a fact suppressed at zero would make an absent badge
  // mean both "nothing was lost" and "this build forgot the fact" (R-TO-001).
  return Object.fromEntries(FIDELITY_FACTS.map((name) => [name, reported[name]])) as Record<FidelityFact, number | boolean>;
}

/** A counter the record states, or none where it states none. */
function countOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** How much a per-type counter map amounts to: the extractor counts what it lost, type by type. */
function totalOf(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  let total = 0;
  for (const count of Object.values(value as Record<string, unknown>)) total += countOf(count);
  return total;
}

/** The space a recorded sheet stands in, refusing a fact that is neither of the two (L-CAD-05). */
function sheetKind(kind: unknown, layoutName: string): "model" | "paper" {
  // The artifact was validated against the mirror before it was recorded, so a third answer here is
  // our own record gone wrong rather than anything the drawing did (ARCH-03).
  if (kind !== "model" && kind !== "paper") throw new Error(`the record says sheet ${layoutName} stands in ${JSON.stringify(kind)}, which is no space (L-CAD-05)`);
  return kind;
}

/** The artifact a record was written from, read back and validated against the one mirror (L-CAD-05). */
async function artifactOf(tenantId: string, record: SheetSourceRecord, storage: Storage): Promise<EntityGraph> {
  const bytes = await storage.get(tenantId, record.artifactSha256);
  // An artifact a record points at that the store does not hold is an outage of ours, not the
  // drawing's fault: the record and the object were written together (ARCH-03).
  if (bytes === null) throw new Error(`the store holds no artifact at ${record.artifactSha256} for ingest ${record.ingestId} (SEAM-STORAGE)`);
  const parsed = entityGraphSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
  if (!parsed.success) throw new Error(`the artifact at ${record.artifactSha256} is not an EntityGraph this tree reads: ${parsed.error.message}`);
  return parsed.data;
}
