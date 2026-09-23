// @vitest-environment node
/**
 * DB LANE — the details of measurement read a member's grid off the record its line was MEASURED on,
 * never the drawing's current one (I-422, I-528 (e)).
 *
 * The register's staged campaign is measured through the shipped seams on a drawing the pin recorded
 * (VD-1: its lines cite a placement key on the pinned ingest). Its placements are then given a grid
 * reading, and a LATER upload of the same drawing is recorded beside it: other bytes, a partition that
 * stands, the very same placement keys read at another grid intersection. That later record is the
 * drawing's CURRENT one — the partition's own door (`placementsOf`) answers its grid, which the suite
 * asserts first, so the scene is proved rather than assumed.
 *
 * What is graded is what the draft states (`boqViewOf`, the one reading the screen, the PDF's details
 * and the workbook's Quantities sheet all read): each member line's grid is the one its pinned record
 * filed, and none reads the later upload's.
 *
 * This suite opens a live database, so it is the DATABASE lane's (derived from its imports,
 * scripts/lib/pg-suites.mjs); nothing here measures time (AM-10 §3).
 */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { closeStage, productModule, sql, stageRegisterCampaign, type StagedRegisterCampaign } from "../register-ui/support/register-ui-stage";

/** Staging and measuring a campaign is minutes of real work; the reading is all this suite grades. */
const BUDGET_MS = 900_000;

/** The grid the LATER upload places every member at — an intersection no pinned placement reads. */
const MOVED_LETTER = "Z";
const MOVED_NUMERAL = "99";

/** What the draft is read through (test contract: `boqViewOf`). */
type DraftLine = { lineId: string; objectKey: string; grid?: string };
type DraftView = { payload: { sections: { groups: { items: { lines: DraftLine[] }[] }[] }[]; unclassified: { lines: DraftLine[] } } | null };
type BoqServer = { boqViewOf(scope: { tenantId: string; projectId: string }): Promise<DraftView> };

/** The partition's door onto the drawing's CURRENT record. */
type PartitionDoor = {
  placementsOf(scope: { tenantId: string; projectId: string; drawingId: string }): Promise<{ placementKey: string; gridLetter: string | null; gridNumeral: string | null }[] | null>;
};

/**
 * Every member line a draft lists, placed or kept: the details of measurement cover both, and the
 * workbook's Quantities sheet lists the unclassified with the same columns (I-267). The staged columns
 * stand on no level of the stack, so the taxonomy keeps them — which is exactly where a line's own
 * evidence is all a reader has.
 */
function draftLinesOf(view: DraftView): DraftLine[] {
  if (view.payload === null) return [];
  return [...view.payload.sections.flatMap((section) => section.groups.flatMap((group) => group.items.flatMap((item) => item.lines))), ...view.payload.unclassified.lines];
}

let staged!: StagedRegisterCampaign;
/** placement key → the grid its pinned record files, `A/1`. */
let pinnedGrid!: Map<string, string>;

/** The pinned record's placement keys, in the store's own order. */
function pinnedKeys(): string[] {
  return sql(
    `select placement_key from placements
      where ${ident(TENANT_COLUMN)} = ${lit(staged.tenantId)}::uuid and ingest_id = ${lit(staged.drawn.ingestId)}::uuid
      order by placement_key;`,
  ).map((row) => row[0] ?? "");
}

/** The placements table's own columns, in their order — copied whole, so a column added later is carried too. */
function placementColumns(): string[] {
  return sql(
    `select column_name from information_schema.columns
      where table_schema = current_schema() and table_name = 'placements'
      order by ordinal_position;`,
  ).map((row) => row[0] ?? "");
}

beforeAll(async () => {
  staged = await stageRegisterCampaign("boq-grid");
  const { tenantId, projectId } = staged;
  const { drawingId, ingestId: pinned } = staged.drawn;

  /* --- the pinned record's members, each read at its own intersection (A/1, B/2, …) --- */
  const keys = pinnedKeys();
  expect(keys.length, "the pinned record holds a placement per staged member").toBeGreaterThan(0);
  pinnedGrid = new Map();
  keys.forEach((key, at) => {
    const letter = String.fromCharCode("A".charCodeAt(0) + at);
    const numeral = String(at + 1);
    sql(
      `update placements set grid_letter = ${lit(letter)}, grid_numeral = ${lit(numeral)}
        where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(pinned)}::uuid and placement_key = ${lit(key)};`,
    );
    pinnedGrid.set(key, `${letter}/${numeral}`);
  });

  /* --- a LATER upload of the same drawing: other bytes, newer, its partition standing, every member moved --- */
  const later = randomUUID();
  sql(
    `insert into ingests (tenant_id, ingest_id, drawing_id, sha256, job_id, artifact_sha256, extractor_scheme, extractor_tool,
                          extractor_tool_version, extractor_parameter_set_hash, facts, created_at)
     select tenant_id, ${lit(later)}::uuid, drawing_id, ${lit(randomBytes(32).toString("hex"))}, ${lit(`later-${later}`)}, artifact_sha256,
            extractor_scheme, extractor_tool, extractor_tool_version, extractor_parameter_set_hash, facts, created_at + interval '1 minute'
       from ingests where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(pinned)}::uuid;`,
  );
  const columns = placementColumns();
  const moved = columns.map((column) =>
    column === "ingest_id" ? `${lit(later)}::uuid` : column === "grid_letter" ? lit(MOVED_LETTER) : column === "grid_numeral" ? lit(MOVED_NUMERAL) : ident(column),
  );
  sql(
    `insert into placements (${columns.map(ident).join(", ")})
     select ${moved.join(", ")} from placements
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(pinned)}::uuid;`,
  );
  sql(
    `insert into partition_rebuilds (tenant_id, project_id, drawing_id, ingest_id)
     values (${lit(tenantId)}::uuid, ${lit(projectId)}::uuid, ${lit(drawingId)}::uuid, ${lit(later)}::uuid);`,
  );

  /* --- the scene, proved: the drawing's CURRENT partition now reads every member at the moved grid --- */
  const partition = await productModule<PartitionDoor>("src/modules/takeoff/partition/index.ts");
  const current = (await partition.placementsOf({ tenantId, projectId, drawingId })) ?? [];
  expect(current.map((placement) => placement.placementKey).sort(), "the later upload's partition stands and places the same members").toEqual([...keys].sort());
  for (const placement of current) {
    expect(`${placement.gridLetter ?? ""}/${placement.gridNumeral ?? ""}`, `the current record reads ${placement.placementKey} at the moved grid`).toBe(`${MOVED_LETTER}/${MOVED_NUMERAL}`);
  }
}, BUDGET_MS);

afterAll(async () => {
  await closeStage();
}, 120_000);

test(
  "each member line's grid in the details of measurement is the one its PINNED record filed — a later upload that moved the member moves nothing a standing line says (I-422)",
  async () => {
    const server = await productModule<BoqServer>("src/modules/takeoff/boq/server.ts");
    const view = await server.boqViewOf({ tenantId: staged.tenantId, projectId: staged.projectId });
    const lines = draftLinesOf(view);
    expect(lines.length, "the staged campaign's published lines stand in the draft").toBeGreaterThan(0);

    for (const line of lines) {
      const placementKey = staged.sourceKeys[line.objectKey];
      expect(placementKey, `the draft's line ${line.lineId} is a member the register placed`).toBeDefined();
      const filed = pinnedGrid.get(placementKey as string);
      expect(filed, `the pinned record files a grid for ${String(placementKey)}`).toBeDefined();
      expect(line.grid, `${line.lineId} reads its grid off the record it was measured on, not the later upload's ${MOVED_LETTER}/${MOVED_NUMERAL}`).toBe(filed);
    }
  },
  BUDGET_MS,
);
