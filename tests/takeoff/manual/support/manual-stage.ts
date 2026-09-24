/**
 * The world a hand measurement is recorded in, live (S1, docs/design/s-measure.md): a workspace, a
 * project made through its door, a level of the stack, a drawing ingested and partitioned by the
 * shipped jobs, its sheet's discipline confirmed, its views' scale affirmed and the drawing pinned —
 * which opens the campaign a measurement stands in. Everything is driven through the shipped seams:
 * the stages of the gate, the partition and the drawing sets are borrowed, never copied (ARCH-02).
 *
 * The drawing is S-08 in miniature, in millimetres: a GROUND FLOOR PLAN whose slab outline and lift
 * pit are closed LWPOLYLINEs, and a TYPICAL DETAIL OF FOOTING beside it with an outline of its own.
 *
 * Mechanics only — nothing here judges the product.
 */
import { expect } from "vitest";
import { writtenAtV3 } from "../../../cad/support/entitygraph-versions";
import { COLUMN_C1, createProjectThroughDoor, performAct, insertion, registerSeam, stageTenantTemplate, unique } from "../../gate/support/gate-stage";
import { rebuildDoor, stepSink, viewAssignmentRows, MODEL_SPACE, type JsonValue } from "../../partition/support/partition-stage";
import { pinning, setsSeam } from "../../sets/support/sets-stage";
import { INGEST_JOB_MODULE, INGEST_MODULE, stageDrawing, stubCli, tempDir, withCadCommand } from "../../support/ingest-stage";
import { actorOf, closeStage, enrol, openSheetsStage, productModule, storageOf, type Person } from "../../support/sheets-stage";
import { sql } from "../../../spine/uploads/support/upload-stage";
import { sheetIdOf } from "../../../../src/core/sheets/law";

export { actorOf, closeStage, createProjectThroughDoor, performAct, productModule, sql, unique };
export type { Person };

/** The homes the suites read. */
export const ACTS_MODULE = "src/core/acts/index.ts";
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
export const ERRORS_MODULE = "src/core/errors.ts";

/** The act this stage records, and the ones it stands the world up with. */
export const RECORD_MANUAL_MEASUREMENT = "RECORD_MANUAL_MEASUREMENT";
export const REPUDIATE = "REPUDIATE";

/** The manual pair the world's edition cites: the blinding under a traced outline (S2, minted by OPEN-3). */
export const MANUAL_BLINDING_PAIR = { ruleId: "pcc.blinding.area", version: "1" };

/** The captions of the two views, as the grammar reads them. */
const PLAN_CAPTION = "GROUND FLOOR PLAN";
const DETAIL_CAPTION = "TYPICAL DETAIL OF FOOTING";

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0], source: "bylayer" };

/** A closed ring's corners, anticlockwise from the least. */
type Ring = readonly (readonly [number, number])[];

/** S-08 in miniature: the slab outline and the lift pit on the plan, and the footing's outline on the detail. */
export const SLAB: Ring = [
  [0, -50],
  [40, -50],
  [40, -10],
  [0, -10],
];
export const PIT: Ring = [
  [10, -30],
  [20, -30],
  [20, -20],
  [10, -20],
];
export const FOOTING: Ring = [
  [600, -50],
  [640, -50],
  [640, -10],
  [600, -10],
];

/** What the staged world is: who, where, and the keys a trace cites. */
export type ManualWorld = {
  person: Person;
  projectId: string;
  drawingId: string;
  ingestId: string;
  levelId: string;
  /** The partition's own keys for the plan and the detail. */
  planView: string;
  detailView: string;
  /** The source keys of the three rings. */
  slabKey: string;
  pitKey: string;
  footingKey: string;
};

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
const handle = (ordinal: number): string => `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;

/** The drawing, as an EntityGraph v3: two captioned views, three rings, and a header in millimetres. */
function buildArtifact(salt: number): { json: string; keys: { plan: string; detail: string; slab: string; pit: string; footing: string } } {
  let ordinal = salt * 0x10000;
  const next = (): string => handle((ordinal += 1));
  const entities: Record<string, unknown>[] = [];
  const text = (value: string, at: readonly [number, number], height: number): string => {
    const key = next();
    entities.push({ key, type: "TEXT", space: MODEL_SPACE, layer: "CAPTIONS", colour: CHANNELS, text: value, height, points: [[...at]] });
    return key;
  };
  const ring = (points: Ring, layer: string): string => {
    const key = next();
    entities.push({ key, type: "LWPOLYLINE", space: MODEL_SPACE, layer, colour: CHANNELS, closed: true, points: points.map(([x, y]) => [x, y]) });
    return key;
  };
  const plan = text(PLAN_CAPTION, [0, 0], 5);
  const slab = ring(SLAB, "SLAB");
  const pit = ring(PIT, "SLAB");
  const detail = text(DETAIL_CAPTION, [600, 0], 5);
  const footing = ring(FOOTING, "FOUNDATION");
  const graph = writtenAtV3({
    entitygraph_version: 3,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: MODEL_SPACE, kind: "model", bbox: { min: [-10, -60], max: [700, 10] }, strays_rejected: 0 }] as unknown as JsonValue,
    dropped_layouts: [],
    entities: entities as unknown as JsonValue,
    derived: [],
    block_attributes: [],
    counters: [],
  });
  return { json: JSON.stringify(graph), keys: { plan, detail, slab, pit, footing } };
}

/** The view one entity was partitioned into — read off the partition the product wrote (B-19). */
function viewHolding(tenantId: string, ingestId: string, entityKey: string): string {
  const rows = viewAssignmentRows(tenantId, ingestId).filter((row) => row.entityKey === entityKey);
  expect(rows.length, `the partition put ${entityKey} in exactly one view (L-CAD-06)`).toBe(1);
  return (rows[0] as { viewKey: string }).viewKey;
}

/**
 * The world, staged through the shipped doors. The person is the project's creator, so PRINCIPAL,
 * so MEASURE — the act's permission (L-ACT-03).
 */
export async function stageManualWorld(label: string, salt: number): Promise<ManualWorld> {
  await openSheetsStage();
  const person = await enrol(`manual-${label}`);
  // The edition cites the blinding's manual pair (S3): the act's preview asks the gate for the figure
  // it would publish, and a pair the edition does not cite is refused by name there (I-384).
  await stageTenantTemplate(person.tenantId, [MANUAL_BLINDING_PAIR]);
  const projectId = await createProjectThroughDoor(person, unique(`Manual ${label}`));
  const actor = actorOf(person);

  // A level before the pin, so the campaign's stack snapshot names it (L-REG-07).
  await performAct(actor, insertion(projectId, "GF", 0));
  const levelId = sql(`select level_id::text from levels where project_id = '${projectId}'::uuid and repudiated_act_id is null order by ordinal limit 1;`)[0]?.[0] ?? "";
  expect(levelId, "the stack holds the level the act inserted").not.toBe("");

  // The drawing, recorded by the shipped ingest job over a stand-in CLI, and partitioned.
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);
  const built = buildArtifact(salt);
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; manual ${label} ${salt}\n`);
  const drawing = await stageDrawing(person, projectId, bytes, { name: unique(`S-08-${label}.dxf`), format: "dxf" });
  const stub = stubCli({ artifact: built.json, stderr: "", exitCode: 0 });
  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${label}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });
  const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, "the staged drawing left an ingest record").not.toBeNull();
  const ingestId = (record as { ingestId: string }).ingestId;
  const rebuild = await rebuildDoor();
  await rebuild.runPartitionJob({ tenantId: person.tenantId, drawingId: drawing.drawingId, ingestId, requestedBy: person.userId }, stepSink(`partition-${label}`).progress, { storage: await storageOf() });

  const planView = viewHolding(person.tenantId, ingestId, built.keys.plan);
  const detailView = viewHolding(person.tenantId, ingestId, built.keys.detail);
  expect(viewHolding(person.tenantId, ingestId, built.keys.slab), "the slab outline stands in the plan").toBe(planView);
  expect(viewHolding(person.tenantId, ingestId, built.keys.pit), "and so does the pit").toBe(planView);
  expect(viewHolding(person.tenantId, ingestId, built.keys.footing), "the footing stands in the detail").toBe(detailView);

  // The sheet's discipline, confirmed by a person (L-REG-03), and both views' scale of record — the
  // header's own millimetres, rank 4 (L-MEA-05).
  await performAct(actor, { type: "CONFIRM_DISCIPLINE", projectId, group: { kind: "SHEET", sheetId: sheetIdOf(ingestId, MODEL_SPACE), discipline: "STRUCTURAL" } });
  await performAct(actor, { type: "AFFIRM_SCALE", projectId, drawingId: drawing.drawingId, rank: "FILE_UNITS", viewKeys: [planView, detailView] });

  // The drawing pinned: the campaign opens (L-REG-07).
  const sets = await setsSeam();
  const setScope = { tenantId: person.tenantId, projectId };
  const lineage = (await sets.drawingLineagesOf(setScope)).find((candidate) => candidate.current.revisionId === drawing.drawingId);
  expect(lineage, "the staged drawing is a lineage of the project").toBeDefined();
  const created = await sets.createSet(setScope, { userId: person.userId }, unique(`${label} set`));
  expect(created.created, `the set was created: ${JSON.stringify(created)}`).toBe(true);
  const setId = (created as { created: true; setId: string }).setId;
  const toggled = await sets.toggleMember(setScope, setId, (lineage as { drawingId: string }).drawingId);
  expect(toggled.toggled, `the drawing joined the set: ${JSON.stringify(toggled)}`).toBe(true);
  await performAct(actor, pinning(projectId, setId) as unknown as Record<string, unknown>);

  return { person, projectId, drawingId: drawing.drawingId, ingestId, levelId, planView, detailView, slabKey: built.keys.slab, pitKey: built.keys.pit, footingKey: built.keys.footing };
}

/** The condition J-000's hand item applies, in miniature: slab · blinding, 75 mm. */
export function blindingRecipe(thickness = "75"): Record<string, unknown> {
  return {
    conditionId: null,
    conditionName: "75 CC blinding under SOG",
    geometry: "POLYGON",
    elementClass: "slab",
    kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding.area" }],
    readings: [{ attribute: "t", valueAsWritten: thickness, unitAsWritten: "mm", basis: "ENTERED", sourceKey: null }],
  };
}

/** A ring's corners, each snapped on the entity that draws it. */
export function snapped(ring: Ring, key: string): { x: number; y: number; cites: string[] }[] {
  return ring.map(([x, y]) => ({ x, y, cites: [key] }));
}

/** A ring's corners, placed free. */
export function free(ring: Ring): { x: number; y: number; cites: string[] }[] {
  return ring.map(([x, y]) => ({ x, y, cites: [] }));
}

/** The act's input: the blinding traced on the plan, the pit cut out — or whatever a case changes. */
export function tracing(world: ManualWorld, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: RECORD_MANUAL_MEASUREMENT,
    projectId: world.projectId,
    drawingId: world.drawingId,
    layoutName: MODEL_SPACE,
    viewKey: world.planView,
    recipe: blindingRecipe(),
    level: { levelId: world.levelId },
    geometry: { geometry: "POLYGON", outer: snapped(SLAB, world.slabKey), cutouts: [{ role: "OPENING", ring: snapped(PIT, world.pitKey) }] },
    replaces: null,
    ...over,
  };
}

/** Rows of one table this tenant holds, as psql reads them under a system reason. */
export function countOf(table: string, where: string): number {
  return Number(sql(`select count(*)::text from ${table} where ${where};`)[0]?.[0] ?? "0");
}

/** The register scope the world's campaign opened: its pinned revision, read off the campaign the pin opened. */
export function campaignOf(world: ManualWorld): { campaignId: string; setRevisionId: string } {
  const rows = sql(`select campaign_id::text, set_revision_id::text from campaigns where project_id = '${world.projectId}'::uuid;`);
  expect(rows.length, "the pin opened exactly one campaign").toBe(1);
  const [campaignId = "", setRevisionId = ""] = rows[0] ?? [];
  return { campaignId, setRevisionId };
}

/**
 * A condition in a project's chest, as the chest (S5) will author one — written here under the stage's
 * system reason because no door writes one yet. Retired where asked. Its id.
 */
export function stageCondition(world: ManualWorld, options: { projectId?: string; name: string; retired?: boolean }): string {
  const projectId = options.projectId ?? world.projectId;
  const retired = options.retired === true ? `now(), '${world.person.userId}'::uuid` : "null, null";
  const rows = sql(
    `insert into conditions (tenant_id, project_id, name, geometry, element_class, kinds, readings, colour, hatch, authored_by, retired_at, retired_by)
       values ('${world.person.tenantId}'::uuid, '${projectId}'::uuid, '${options.name}', 'POLYGON', 'slab',
               '[{"kind":"rcc.concrete","ruleId":"rcc.concrete.slab"}]', '[]', 'slab', 'solid', '${world.person.userId}'::uuid, ${retired})
       returning condition_id::text;`,
  );
  const conditionId = rows[0]?.[0] ?? "";
  expect(conditionId, `the chest holds ${options.name}`).not.toBe("");
  return conditionId;
}

/** A slab the machine sighted in the world's revision, registered through the register's own door on the world's level. Its object key. */
export async function stageRegisterObject(world: ManualWorld, mark: string): Promise<string> {
  const { setRevisionId } = campaignOf(world);
  const register = await registerSeam();
  const scope = { tenantId: world.person.tenantId, projectId: world.projectId, setRevisionId };
  const answer = await register.registerSighting(scope, { ...COLUMN_C1, label: `sog-${mark}`, elementType: "slab", mark, level: { levelId: world.levelId } });
  expect(answer.registered, `the machine's slab ${mark} registered: ${JSON.stringify(answer)}`).toBe(true);
  return answer.objectKey ?? "";
}

/**
 * A member the machine measured in the world's campaign: a slab registered through the register's own
 * door on the world's level, and ONE published line of it — the line written under the stage's system
 * reason, as the gate would publish it, because the world's template stages no method to publish it
 * through. Its object key.
 */
export async function stageMachineLine(world: ManualWorld, kind: string): Promise<string> {
  const { campaignId } = campaignOf(world);
  const objectKey = await stageRegisterObject(world, "SOG1");
  sql(
    `insert into quantity_lines (tenant_id, campaign_id, project_id, set_revision_id, object_key, drawing_id, view_key, class, kind, rule_id, rule_version,
                                 edition_digest, engine, quantity_basis, selection_basis, coverage, value, unit, formula, bindings, selectors, deductions, omitted, calibration_keys)
     select c.tenant_id, c.campaign_id, c.project_id, c.set_revision_id, '${objectKey}', '${world.drawingId}'::uuid, 'v:LAYOUT_PLAN:machine', 'slab', '${kind}', '${kind}.slab', '1',
            c.edition_digest, 'VECTOR', 'MEASURED', 'MEASURED', 'COMPLETE', 1.6, 'm2', 'L x B', '{}', '{}', '[]', '[]', '[]'
       from campaigns c where c.campaign_id = '${campaignId}'::uuid;`,
  );
  expect(countOf("quantity_lines", `campaign_id = '${campaignId}'::uuid and object_key = '${objectKey}'`), "one machine line in the cell").toBe(1);
  return objectKey;
}
