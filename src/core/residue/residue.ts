// L-QTY-05's residue: a QUERY over the borne grid, never a table. One cell per (sighted class × kind
// the catalogue bears for that class × level sighted), each resolved to what the campaign measured
// and — where it measured nothing — to the one cause that explains it.
//
// Two halves, deliberately: `resolveResidue` is pure, so the arms the clause fixes are judged
// without a database and the certificate reads the same answer the grid does (B-19); `residueOf`
// composes the reading the arms are judged over. The absence itself is spelled once, in this file,
// in the one query that asks what a campaign left unpublished — a channel reader answers what it
// SAW, and a second home for "this is absent" is the defect L-QTY-05 bans.
import {
  acts,
  and,
  drawingSetRevisions,
  eq,
  forTenant,
  inArray,
  ingests,
  quantityLines,
  railObservations,
  registerObjects,
  scopeDeclarations,
  sql,
  type TenantTx,
} from "../db";
import { campaignsOf } from "../campaigns";
import { BEARS } from "../catalogue/bears";
import { WORK_ITEM_CATALOGUE } from "../catalogue/catalogue";
import { compareCanonical } from "../identity";
import { levelsOf } from "../levels/store";
import { REFUSALS } from "../errors";
import { layoutSightings } from "./channels/layout";
import { partitionSightings } from "./channels/partition";
import { registerSightings } from "./channels/register";
import type { ManifestSheet, SightingScope } from "./channels/scope";
import {
  IN_BILL,
  QUANTITY_BEARING,
  type BillReading,
  type MeasurementReading,
  type ResidueCell,
  type ResidueDeclaration,
  type ResidueInput,
  type ResidueLevel,
  type ResidueObservation,
  type Sighting,
} from "./law";

/** The two causes a person may declare a cell under, one per axis (risk note 2). */
const NOT_IN_PROJECT_SCOPE = "NOT_IN_PROJECT_SCOPE" as const;
const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL" as const;

/** The causes the machine reads rather than a person declaring them. */
const INGESTION_TRUNCATED = "INGESTION_TRUNCATED" as const;
const NOT_ESTABLISHED = "NOT_ESTABLISHED" as const;
const NO_BEARER_SIGHTED = "NO_BEARER_SIGHTED" as const;
const KIND_NOT_YET_SEEDED = "KIND_NOT_YET_SEEDED" as const;

/** The two grains a row of the grid stands at (I-196). */
const CELL = "CELL" as const;
const KIND = "KIND" as const;

/** The fact an ingest records about a space that was read only in part (R-TO-001, risk note 4). */
const EXPLODE_TRUNCATED = "explode_truncated";

/** The whole reading one project's coverage screen and the certificate are drawn from. */
export type Residue = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly campaign: { readonly campaignId: string; readonly setRevisionId: string } | null;
  /**
   * Everything the cells were resolved from, kept beside them: the level stack they stand on, the
   * sightings that bore them and the acts that moved them. The answer carries its own evidence, so a
   * reader of the residue never asks a second query for what the first already read (B-19).
   */
  readonly input: ResidueInput;
  readonly cells: readonly ResidueCell[];
};

/** A project with no campaign pinned has read nothing — the empty reading, spelled once. */
const NOTHING_READ: ResidueInput = Object.freeze({
  bears: [],
  workItems: [],
  levels: [],
  sightings: [],
  lines: [],
  declarations: [],
  truncated: [],
  observations: [],
});

/**
 * Which project's residue is read, in whose workspace — and, where a caller already stands on one,
 * which campaign of it. Naming none reads the campaign the project is standing in, which is what a
 * screen wants; naming one is how a caller that already resolved a campaign asks about that one and
 * no other (L-REG-07).
 */
export type ResidueScope = { readonly tenantId: string; readonly projectId: string; readonly campaignId?: string };

/* ------------------------------------------------------------------ the pure resolution */

/** One cell's address, as every index below is keyed on it. */
function keyOf(kind: string, klass: string, levelId: string | null): string {
  return `${kind}\u0000${klass}\u0000${levelId ?? ""}`;
}

/** Group a list under a key, in the order the list holds. */
function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const held = new Map<string, T[]>();
  for (const row of rows) {
    const list = held.get(key(row));
    if (list === undefined) held.set(key(row), [row]);
    else list.push(row);
  }
  return held;
}

/**
 * The declaration in force over one cell on one axis, or null. A row whose act does not resolve
 * states nothing: an act nobody can point at is not a record (L-ACT-01).
 */
function declared(declarations: readonly ResidueDeclaration[], cause: typeof NOT_IN_PROJECT_SCOPE | typeof NOT_IN_THIS_BILL): ResidueDeclaration | null {
  return declarations.find((declaration) => declaration.cause === cause && declaration.inForce && declaration.actResolves) ?? null;
}

/**
 * L-QTY-05's arms, in order, on the measurement axis: published lines stand above everything, then a
 * person's declaration that the kind is outside the project, then a sheet that was read only in part
 * and could yield nothing, and last the fall-through — nothing explains this absence.
 */
function measurementOf(hasLines: boolean, scoped: ResidueDeclaration | null, truncated: boolean): MeasurementReading {
  if (hasLines) return QUANTITY_BEARING;
  if (scoped !== null) return NOT_IN_PROJECT_SCOPE;
  if (truncated) return INGESTION_TRUNCATED;
  return NOT_ESTABLISHED;
}

/** The bill axis, orthogonal to the measurement one and resolved in its own order (L-QTY-05). */
function billOf(hasLines: boolean, held: ResidueDeclaration | null): BillReading {
  if (hasLines) return IN_BILL;
  if (held !== null) return NOT_IN_THIS_BILL;
  return IN_BILL;
}

/** Whether every sighting of a cell stands on a sheet that was read only in part (risk note 4). */
function attributedToTruncation(sightings: readonly Sighting[], truncatedDrawings: ReadonlySet<string>): boolean {
  return sightings.length > 0 && sightings.every((sighting) => truncatedDrawings.has(sighting.drawingId));
}

/**
 * The levels one class was sighted on: those its sightings name, or the unlevelled one where none.
 *
 * A level a sighting names is a level sighted whether or not the project's stack holds a row for it
 * — the register is what saw it (L-REG-04), and a cell dropped for want of a label would be a cell
 * the certificate never speaks about. The stack orders the columns and names them; it does not
 * decide which exist.
 */
function levelsSighted(sightings: readonly Sighting[], levels: ReadonlyMap<string, ResidueLevel>): (string | null)[] {
  const named = [...new Set(sightings.map((sighting) => sighting.levelId).filter((levelId): levelId is string => levelId !== null))];
  if (named.length === 0) return [null];
  return named.sort((left, right) => (levels.get(left)?.ordinal ?? 0) - (levels.get(right)?.ordinal ?? 0) || compareCanonical(left, right));
}

/**
 * The residue, resolved (L-QTY-05). One cell per (sighted class × kind borne for that class × level
 * sighted) and no cell for an unsighted class or an unborne kind; the two kind grains L-QTY-07 asks
 * for stand at the head, because a kind with no cell is still a kind the certificate speaks about.
 */
export function resolveResidue(input: ResidueInput): ResidueCell[] {
  const levelById = new Map(input.levels.map((level) => [level.levelId, level]));
  const truncatedDrawings = new Set(input.truncated.map((sheet) => sheet.drawingId));

  const sightingsByClass = groupBy(input.sightings, (sighting) => sighting.class);
  const linesByCell = groupBy(input.lines, (line) => keyOf(line.kind, line.class, line.levelId));
  const declarationsByCell = groupBy(input.declarations, (declaration) => keyOf(declaration.kind, declaration.class, declaration.levelId));
  const observationsByKindClass = groupBy(input.observations, (observation) => `${observation.kind}\u0000${observation.class}`);

  const kindsByClass = new Map<string, string[]>();
  for (const row of input.bears) {
    const held = kindsByClass.get(row.class);
    if (held === undefined) kindsByClass.set(row.class, [row.kind]);
    else if (!held.includes(row.kind)) held.push(row.kind);
  }

  const sightedClasses = [...sightingsByClass.keys()].sort(compareCanonical);
  const borneBySighted = new Set(sightedClasses.flatMap((klass) => kindsByClass.get(klass) ?? []));
  const borneAnywhere = new Set(input.bears.map((row) => row.kind));

  /* --- the kind grains: a kind that cannot be celled out is a row, never a silence (I-196) --- */
  const kindRows: ResidueCell[] = [];
  for (const kind of [...input.workItems].sort(compareCanonical)) {
    if (borneBySighted.has(kind)) continue;
    kindRows.push(kindGrain(kind, borneAnywhere.has(kind) ? NO_BEARER_SIGHTED : KIND_NOT_YET_SEEDED));
  }

  /* --- the grid itself --- */
  const cells: ResidueCell[] = [];
  for (const klass of sightedClasses) {
    const sightings = sightingsByClass.get(klass) ?? [];
    const kinds = [...(kindsByClass.get(klass) ?? [])].sort(compareCanonical);
    for (const kind of kinds) {
      for (const levelId of levelsSighted(sightings, levelById)) {
        const held = sightings.filter((sighting) => sighting.levelId === levelId || sighting.levelId === null);
        const lines = linesByCell.get(keyOf(kind, klass, levelId)) ?? [];
        const declarations = declarationsByCell.get(keyOf(kind, klass, levelId)) ?? [];
        const scoped = declared(declarations, NOT_IN_PROJECT_SCOPE);
        const boundary = declared(declarations, NOT_IN_THIS_BILL);
        const hasLines = lines.length > 0;
        cells.push({
          kind,
          class: klass,
          levelId,
          levelLabel: levelId === null ? "" : (levelById.get(levelId)?.label ?? ""),
          grain: CELL,
          measurement: measurementOf(hasLines, scoped, attributedToTruncation(held, truncatedDrawings)),
          bill: billOf(hasLines, boundary),
          // I-192: a declaration the published lines deny is beaten on its own axis, marked, and
          // omitted from the statements — the row stays and nothing is withdrawn.
          contradicted: hasLines && (scoped !== null || boundary !== null),
          lineIds: lines.map((line) => line.lineId),
          sightings: held,
          observations: (observationsByKindClass.get(`${kind}\u0000${klass}`) ?? []).filter(
            (observation) => observation.levelId === null || observation.levelId === levelId,
          ),
          measurementActId: scoped?.actId ?? null,
          billActId: boundary?.actId ?? null,
        });
      }
    }
  }

  cells.sort(
    (left, right) =>
      compareCanonical(left.kind, right.kind) ||
      compareCanonical(left.class ?? "", right.class ?? "") ||
      (levelById.get(left.levelId ?? "")?.ordinal ?? 0) - (levelById.get(right.levelId ?? "")?.ordinal ?? 0) ||
      compareCanonical(left.levelId ?? "", right.levelId ?? ""),
  );

  return [...kindRows, ...cells];
}

/** One kind-grain row: it spans every class and level, so it names neither (I-196). */
function kindGrain(kind: string, cause: typeof NO_BEARER_SIGHTED | typeof KIND_NOT_YET_SEEDED): ResidueCell {
  return {
    kind,
    class: null,
    levelId: null,
    levelLabel: "",
    grain: KIND,
    measurement: cause,
    bill: IN_BILL,
    contradicted: false,
    lineIds: [],
    sightings: [],
    observations: [],
    measurementActId: null,
    billActId: null,
  };
}

/* ------------------------------------------------------------------------- the reading */

/**
 * One project's residue, read whole. A project with no campaign pinned answers an empty residue
 * rather than a fault: an absence is a state, and the screen teaches the next action from it
 * (R-UI-050).
 */
export async function residueOf(scope: ResidueScope): Promise<Residue> {
  const open = await campaignsOf(scope);
  const named = scope.campaignId;
  const campaign = named === undefined ? open[open.length - 1] : open.find((held) => held.campaignId === named);
  if (campaign === undefined) {
    return { tenantId: scope.tenantId, projectId: scope.projectId, campaign: null, input: NOTHING_READ, cells: [] };
  }

  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const sheets = await manifestOf(tx, scope.tenantId, campaign.setRevisionId);
    const sighting: SightingScope = { tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId: campaign.setRevisionId, sheets };

    // The union of EXISTS L-QTY-05 states: three readers, each saying what it saw, laid side by side.
    const [fromRegister, fromPartition, fromLayout, levelRows, lines, declarations, truncated, observations] = await Promise.all([
      registerSightings(tx, sighting),
      partitionSightings(tx, sighting),
      layoutSightings(tx, sighting),
      levelsOf(tx, { tenantId: scope.tenantId, projectId: scope.projectId }),
      publishedLinesOf(tx, scope.tenantId, campaign.campaignId, campaign.setRevisionId),
      declarationsOf(tx, scope.tenantId, campaign.campaignId),
      truncatedSheetsOf(tx, scope.tenantId, sheets),
      observationsOf(tx, scope.tenantId, campaign.campaignId, campaign.setRevisionId),
    ]);

    const levels: ResidueLevel[] = levelRows.map((level) => ({ levelId: level.levelId, ordinal: level.ordinal, label: level.label }));
    const read: ResidueInput = {
      bears: BEARS.map((row) => ({ class: row.class, kind: row.kind })),
      workItems: Object.keys(WORK_ITEM_CATALOGUE),
      levels,
      sightings: [...fromRegister, ...fromPartition, ...fromLayout],
      lines,
      declarations,
      truncated,
      observations,
    };

    return {
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      campaign: { campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId },
      input: read,
      cells: resolveResidue(read),
    };
  });
}

/** The drawings the pinned revision names, as the pin recorded them (L-REG-06). */
async function manifestOf(tx: TenantTx, tenantId: string, setRevisionId: string): Promise<ManifestSheet[]> {
  const held = await tx
    .select({ manifest: drawingSetRevisions.manifest })
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
    .limit(1);
  return (held[0]?.manifest ?? []).map((member) => ({ drawingId: member.drawingId, layoutName: member.name }));
}

/**
 * Every line this campaign published, in the cell it stands in. A line is keyed on the object it was
 * measured off, and the level that object stands on is the register's reading of it (L-REG-04), so
 * the level comes from the register row rather than from a column of its own.
 */
async function publishedLinesOf(tx: TenantTx, tenantId: string, campaignId: string, setRevisionId: string) {
  const rows = await tx
    .select({ kind: quantityLines.kind, class: quantityLines.class, levelId: registerObjects.levelId, lineId: quantityLines.lineId })
    .from(quantityLines)
    .innerJoin(
      registerObjects,
      and(
        eq(registerObjects.tenantId, quantityLines.tenantId),
        eq(registerObjects.setRevisionId, setRevisionId),
        eq(registerObjects.objectKey, quantityLines.objectKey),
      ),
    )
    .where(and(eq(quantityLines.tenantId, tenantId), eq(quantityLines.campaignId, campaignId)));
  return rows.map((row) => ({ kind: row.kind, class: row.class, levelId: row.levelId ?? "", lineId: row.lineId }));
}

/** Every declaration a person made over a cell of this campaign, with whether its act resolves. */
async function declarationsOf(tx: TenantTx, tenantId: string, campaignId: string): Promise<ResidueDeclaration[]> {
  const rows = await tx
    .select({
      class: scopeDeclarations.class,
      kind: scopeDeclarations.kind,
      levelId: scopeDeclarations.levelId,
      cause: scopeDeclarations.cause,
      actId: scopeDeclarations.actId,
      inForce: scopeDeclarations.inForce,
      actResolved: acts.actId,
    })
    .from(scopeDeclarations)
    .leftJoin(acts, and(eq(acts.tenantId, scopeDeclarations.tenantId), eq(acts.actId, scopeDeclarations.actId)))
    .where(and(eq(scopeDeclarations.tenantId, tenantId), eq(scopeDeclarations.campaignId, campaignId)));
  return rows.map((row) => ({
    class: row.class,
    kind: row.kind,
    levelId: row.levelId,
    cause: row.cause,
    actId: row.actId,
    inForce: row.inForce,
    actResolves: row.actResolved !== null,
  }));
}

/**
 * The sheets of this manifest that were read only in part. The fact is the extractor's own, carried
 * on the ingest record and read by the name it was recorded under — nothing is counted a second time
 * on this side (L-CAD-01, R-TO-001).
 */
async function truncatedSheetsOf(tx: TenantTx, tenantId: string, sheets: readonly ManifestSheet[]): Promise<ManifestSheet[]> {
  if (sheets.length === 0) return [];
  const rows = await tx
    .select({ drawingId: ingests.drawingId, facts: ingests.facts })
    .from(ingests)
    .where(and(eq(ingests.tenantId, tenantId), inArray(ingests.drawingId, sheets.map((sheet) => sheet.drawingId))));

  return sheets.filter((sheet) =>
    rows.some((row) => row.drawingId === sheet.drawingId && countersOf(row.facts).some((counter) => counter.space === sheet.layoutName && counter.truncated)),
  );
}

/** One space's counter, as the record states it: which space, and whether exploding was cut short. */
function countersOf(facts: Readonly<Record<string, unknown>>): { space: string; truncated: boolean }[] {
  const counters = facts["counters"];
  if (!Array.isArray(counters)) return [];
  return counters.map((counter) => {
    const held = (counter ?? {}) as Record<string, unknown>;
    return { space: typeof held["space"] === "string" ? held["space"] : "", truncated: held[EXPLODE_TRUNCATED] === true };
  });
}

/**
 * What the rails observed about what this campaign did NOT publish — the tree's one spelling of an
 * absence, and the reason it lives here rather than in a channel (L-QTY-05).
 *
 * An observation standing beside a published line is not residue evidence: the reading it explains
 * ended in a quantity. So the query asks the store for the observations whose object the campaign
 * published nothing for, which is a question about rows that are not there and can only be asked one
 * way. Every other file in this tree says what it SAW.
 */
async function observationsOf(tx: TenantTx, tenantId: string, campaignId: string, setRevisionId: string): Promise<ResidueObservation[]> {
  const rows = await tx
    .select({
      class: railObservations.class,
      kind: railObservations.kind,
      code: railObservations.code,
      levelId: registerObjects.levelId,
    })
    .from(railObservations)
    .leftJoin(
      registerObjects,
      and(
        eq(registerObjects.tenantId, railObservations.tenantId),
        eq(registerObjects.setRevisionId, setRevisionId),
        eq(registerObjects.objectKey, railObservations.objectKey),
      ),
    )
    .where(
      and(
        eq(railObservations.tenantId, tenantId),
        eq(railObservations.campaignId, campaignId),
        sql`not exists (select 1 from ${quantityLines} where ${quantityLines.tenantId} = ${railObservations.tenantId} and ${quantityLines.campaignId} = ${railObservations.campaignId} and ${quantityLines.objectKey} = ${railObservations.objectKey})`,
      ),
    );

  return rows.map((row) => ({
    class: row.class,
    kind: row.kind,
    levelId: row.levelId,
    rail: `${row.class}/${row.kind}`,
    reason: reasonOf(row.code),
  }));
}

/**
 * What an observation's rail-local code says, in the registry's own words where the code is one of
 * the closed taxonomy's — never paraphrased here (R-SPINE-062, I-191). A code the registry does not
 * hold is carried as the rail spelled it: an observation is evidence for the reader, and dropping it
 * would be the silence R-UI-020 forbids.
 */
function reasonOf(code: string): string {
  const held = (REFUSALS as Readonly<Record<string, { message: string } | undefined>>)[code];
  return held?.message ?? code;
}
