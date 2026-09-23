/**
 * AC-2 — the Trace's two doors, over a staged campaign (R-UI-022, R-TO-011, X-2).
 *
 * The corpus is the register's own staged campaign (`stageRegisterCampaign()`), driven end to end
 * through the shipped seams: nothing here inserts a line by hand, so what the doors answer is what a
 * real measurement published. Since VD-1 that campaign is staged in PRODUCTION's shapes: its lines are
 * measured on a drawing the pin recorded and the ingest read, their count cites a placement key, their
 * view key is anchored at the plan's own caption, and each variable cites the entity it was read at —
 * a schedule cell on another sheet, a level note in model space. (Before VD-1 they cited raw handles on
 * a drawing no record held, which is why the Trace passed here and missed on every real line.)
 *
 * Every expectation is recomputed from that corpus — the member keys from the placement rows the store
 * holds, the sheets from the stage's artifact, the citing lines from the entities they in fact cite,
 * the order from the `published_at` the store recorded — so no count, roster or order below is a
 * transcript of today's fixture (B-19).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import {
  QUANTITY_LINES_TABLE,
  closeStage,
  door,
  field,
  principalOf,
  productModule,
  rowsOfCampaign,
  sql,
  stageRegisterCampaign,
  takeoffCaller,
  type StagedRegisterCampaign,
} from "../register-ui/support/register-ui-stage";
import { REGISTER_UI_SERVER_MODULE, traceSeam, type LineEvidence, type TraceScope } from "./support/trace-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

let staged: StagedRegisterCampaign;
let scope: TraceScope;
/** The lines the register's own reading answers, which is what the Trace is asked about. */
let published: {
  lineId: string;
  sourceKey: string;
  variables: Record<string, { source: string }>;
  quantityBasis: string;
  objectKey: string;
  kind: string;
  value: string | null;
  unit: string;
  formula: string;
  repudiated: boolean;
  layoutName: string | null;
  sheetLabel: string | null;
  sourceKeys: string[];
  traceKeys: string[];
}[];
/** The placement rows the store holds for the pinned record, by placement key: the member each line cites. */
let members: Map<string, { outlineKey: string; markKey: string }>;

beforeAll(async () => {
  staged = await stageRegisterCampaign("trace");
  scope = { tenantId: staged.tenantId, projectId: staged.projectId };
  const server = await productModule<{ registerViewOf: (s: TraceScope) => Promise<{ lines: typeof published }> }>(REGISTER_UI_SERVER_MODULE);
  const view = await server.registerViewOf(scope);
  published = view.lines.filter((line) => !line.repudiated);
  expect(published.length, `the staged campaign published lines for the Trace to answer about: ${JSON.stringify(view.lines)}`).toBeGreaterThan(0);

  // The store's own placement rows, read as the audit reads them — never the stage's intentions.
  members = new Map(
    sql(
      `select placement_key, outline_key, mark_key from placements
        where ${ident(TENANT_COLUMN)} = ${lit(staged.tenantId)}::uuid and ingest_id = ${lit(staged.drawn.ingestId)}::uuid
        order by placement_key;`,
    ).map((row) => [row[0] ?? "", { outlineKey: row[1] ?? "", markKey: row[2] ?? "" }]),
  );
  expect(members.size, "the pinned record holds a placement row per staged member").toBeGreaterThan(0);
}, BUDGET_MS);

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The store's own record of each published line, by lineId — where `published_at` is read from. */
function storedLines(): Map<string, Record<string, unknown>> {
  const held = new Map<string, Record<string, unknown>>();
  for (const row of rowsOfCampaign(QUANTITY_LINES_TABLE, staged.tenantId, staged.campaignId)) held.set(String(field(row, "lineId", "line_id")), row);
  return held;
}

/** The member a line was measured off: the placement row its count cites (setup.ts's `sourceEntity`). */
function memberOf(line: (typeof published)[number]): { placementKey: string; outlineKey: string; markKey: string } {
  const cited = Object.values(line.variables).map((binding) => binding.source);
  const placementKey = cited.find((key) => members.has(key));
  expect(placementKey, `${line.lineId} cites the placement it was measured off, as production lines do: ${JSON.stringify(cited)}`).toBeDefined();
  return { placementKey: placementKey as string, ...(members.get(placementKey as string) as { outlineKey: string; markKey: string }) };
}

/** Every entity a line cites, resolved: its member's outline and mark, then each binding's source key. */
function entitiesOf(line: (typeof published)[number]): string[] {
  const member = memberOf(line);
  const sources = Object.values(line.variables)
    .map((binding) => binding.source)
    .filter((key) => key.startsWith("DXF_HANDLE:"));
  return [...new Set([member.outlineKey, member.markKey, ...sources])];
}

describe("AC-2: lineEvidence", () => {
  test("AC-2: a line answers its sheet, its member, its formula and its live variables", async () => {
    const { lineEvidence } = await traceSeam();
    const stored = storedLines();

    for (const line of published) {
      const evidence = (await lineEvidence(scope, line.lineId)) as LineEvidence | null;
      expect(evidence, `the project holds ${line.lineId}, so the Trace answers for it`).not.toBeNull();
      const held = evidence as LineEvidence;

      expect(held.lineId, "the answer names the line it was asked about").toBe(line.lineId);
      expect(held.objectKey, "the object the line stands on, verbatim").toBe(line.objectKey);
      expect(held.kind, "the kind it was published under").toBe(line.kind);
      expect(held.value, "the quantity as the register itself reads it").toBe(line.value);
      expect(held.unit, "in the unit the register itself reads it").toBe(line.unit);
      expect(held.formula, "the formula it was measured by, verbatim").toBe(line.formula);
      expect(held.quantityBasis, "the basis the pulse and the chip are drawn in").toBe(line.quantityBasis);
      expect(typeof held.selectionBasis, "and the basis the selection was made on").toBe("string");

      expect(held.drawingId, "the sheet the evidence stands on is the drawing the line was published from").toBe(String(field(stored.get(line.lineId), "drawingId", "drawing_id")));
      // VD-1 (walk-0): the layout is the paper sheet whose window frames the member — never `Model`,
      // which the artifact does not hold, and never the one layout a confirmation happened to record.
      expect(held.layoutName, "the Trace opens the sheet whose window frames the member (I-421)").toBe(staged.drawn.planSheet);
      expect(line.layoutName, "and the register's own row names the same sheet, from the same resolver (B-17)").toBe(held.layoutName);

      // TEST_AMENDED (VD-1): the Trace selects the MEMBER, so the keys it flies to are exactly the
      // outline and the mark the store's placement row names — as strict as the cited-keys equality it
      // replaces, and read off the store rather than off the line (I-421, B-19).
      const member = memberOf(line);
      expect(held.traceKeys, "the Trace selects exactly the member's outline and mark, from its placement row").toEqual([member.outlineKey, member.markKey]);
      expect(line.traceKeys, "the register's Source chip carries the same selection").toEqual(held.traceKeys);
      // I-426: the register's `sourceKeys` — what the JSON export publishes as `lines[].sourceKeys` —
      // keeps its 1.0 meaning, every key the line CITES (its view key, then each binding's source, each
      // once), which is not the selection: the member's outline and mark are cited nowhere.
      const cited = [...new Set([line.sourceKey, ...Object.values(line.variables).map((binding) => binding.source)].filter((key) => key.length > 0))];
      expect(line.sourceKeys, "the register still lists every key the line cites, in cited order").toEqual(cited);
      expect(line.sourceKeys, "and the placement the line was measured off is among them").toContain(member.placementKey);
      expect(line.sourceKeys.filter((key) => line.traceKeys.includes(key)), "none of which is the member's outline or mark").toEqual([]);

      // Every cited key is answered the sheet it stands on — the member's with the member, a variable
      // read on another sheet on THAT sheet, one read in model space no window frames in model space.
      expect(held.sourceSheets[line.sourceKey], "the view stands on the member's sheet").toBe(staged.drawn.planSheet);
      expect(held.sourceSheets[member.placementKey], "and so does the placement").toBe(staged.drawn.planSheet);
      for (const [name, binding] of Object.entries(line.variables)) {
        if (binding.source === staged.drawn.sectionCell) expect(held.sourceSheets[binding.source], `${name} was read on the schedule's own sheet`).toBe(staged.drawn.scheduleSheet);
        if (binding.source === staged.drawn.levelNote) expect(held.sourceSheets[binding.source], `${name} was read in model space, spelled as the artifact spells it`).toBe(staged.drawn.modelSheet);
      }

      expect(Object.keys(held.variables), "one live variable per binding of the formula").toEqual(Object.keys(line.variables));
      for (const [name, binding] of Object.entries(held.variables)) {
        expect(binding.source, `the variable ${name} names where it was read`).toBe(line.variables[name]?.source);
        for (const reading of ["value", "unit", "basis"] as const) {
          expect(typeof binding[reading], `the variable ${name} states its ${reading}`).toBe("string");
        }
      }
    }
  }, BUDGET_MS);

  test("AC-2: a line this project or this tenant does not hold answers null, and never throws", async () => {
    const { lineEvidence } = await traceSeam();
    const held = published[0]?.lineId as string;

    expect(await lineEvidence(scope, randomUUID()), "a lineId nobody published is a fact, not a refusal (I-88's idiom)").toBeNull();
    expect(await lineEvidence({ tenantId: staged.tenantId, projectId: randomUUID() }, held), "a line of another project of this tenant is not this project's").toBeNull();
    expect(await lineEvidence({ tenantId: randomUUID(), projectId: staged.projectId }, held), "and a line of another tenant is not reachable at all").toBeNull();
  }, BUDGET_MS);
});

/** The store's own order over a set of lines: `publishedAt`, then `lineId` — never this file's. */
function inPublishedOrder(lineIds: readonly string[], stored: Map<string, Record<string, unknown>>): string[] {
  return [...new Set(lineIds)]
    .map((lineId) => ({ lineId, at: String(field(stored.get(lineId), "publishedAt", "published_at")) }))
    .sort((a, b) => (a.at === b.at ? (a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0) : a.at < b.at ? -1 : 1))
    .map((row) => row.lineId);
}

describe("AC-2: linesCiting", () => {
  test("AC-2: every published line of the drawing whose entities meet the ask, each once, in publishedAt then lineId order", async () => {
    const { linesCiting } = await traceSeam();
    const stored = storedLines();

    const asked = [...new Set(published.flatMap((line) => entitiesOf(line)))];
    /* The rule, recomputed: the lines whose own cited entities meet the ask, ordered as the store
       published them and then by their id — never the order this file happens to hold them in. */
    const expected = inPublishedOrder(
      published.filter((line) => entitiesOf(line).some((key) => asked.includes(key))).map((line) => line.lineId),
      stored,
    );
    expect(expected.length, "the ask names entities that some published line cites").toBeGreaterThan(0);

    const answered = await linesCiting(scope, { drawingId: staged.drawn.drawingId, sourceKeys: asked });
    expect(answered.map((row) => String(row["lineId"])), "every citing line, once, in publishedAt then lineId order").toEqual(expected);

    /* The order is a fact about the lines, not about the ask. */
    const reversed = await linesCiting(scope, { drawingId: staged.drawn.drawingId, sourceKeys: [...asked].reverse() });
    expect(reversed.map((row) => String(row["lineId"])), "asking the same keys in another order answers the same sequence").toEqual(expected);
  }, BUDGET_MS);

  /*
   * X-2 from the DRAWING (walk-0, BLOCKS_DEMO: "No published line cites this selection" on S-10's C2):
   * a reader holds a column's OUTLINE on the sheet, and no line cites an outline — a line cites its
   * placement. The door meets the selection through the register's own join, so holding the outline
   * lists the line measured off it and withholds its siblings'; holding the schedule cell every
   * member's section was read at gathers them all, each once.
   */
  test("VD-1: holding a member's outline answers the line measured off it, and withholds its siblings'", async () => {
    const { linesCiting } = await traceSeam();
    const stored = storedLines();
    expect(published.length, "the staged campaign publishes a line per measured member, so an ask has lines to tell apart").toBeGreaterThan(1);

    for (const line of published) {
      const member = memberOf(line);
      const byOutline = await linesCiting(scope, { drawingId: staged.drawn.drawingId, sourceKeys: [member.outlineKey] });
      expect(byOutline.map((row) => String(row["lineId"])), `holding ${line.objectKey}'s outline lists the line measured off it, and no sibling's (X-2)`).toEqual([line.lineId]);
      const byMark = await linesCiting(scope, { drawingId: staged.drawn.drawingId, sourceKeys: [member.markKey] });
      expect(byMark.map((row) => String(row["lineId"])), "and so does holding its mark").toEqual([line.lineId]);
    }

    const shared = await linesCiting(scope, { drawingId: staged.drawn.drawingId, sourceKeys: [staged.drawn.sectionCell] });
    expect(shared.map((row) => String(row["lineId"])), "the schedule cell every section was read at gathers every line, in the store's order").toEqual(
      inPublishedOrder(
        published.filter((line) => entitiesOf(line).includes(staged.drawn.sectionCell)).map((line) => line.lineId),
        stored,
      ),
    );
    expect(shared.length, "and every published line cites it").toBe(published.length);
  }, BUDGET_MS);

  test("AC-2: a line matched by several of the asked keys is answered once", async () => {
    const { linesCiting } = await traceSeam();
    const line = published[0] as (typeof published)[number];
    const member = memberOf(line);
    const answered = await linesCiting(scope, { drawingId: staged.drawn.drawingId, sourceKeys: [member.outlineKey, member.markKey, staged.drawn.sectionCell] });
    expect(answered.filter((row) => String(row["lineId"]) === line.lineId).length, "the line stands once however many of its entities were asked").toBe(1);
  }, BUDGET_MS);

  test("AC-2: a key nobody cites, and a drawing nobody published on, answer the empty list", async () => {
    const { lineEvidence, linesCiting } = await traceSeam();
    const held = (await lineEvidence(scope, published[0]?.lineId as string)) as LineEvidence;

    expect(await linesCiting(scope, { drawingId: held.drawingId as string, sourceKeys: [`DXF_HANDLE:${randomUUID()}`] }), "a key no line cites answers []").toEqual([]);
    expect(await linesCiting(scope, { drawingId: randomUUID(), sourceKeys: held.traceKeys }), "and a drawing this project published nothing on answers []").toEqual([]);
    expect(await linesCiting(scope, { drawingId: held.drawingId as string, sourceKeys: [] }), "an empty ask cites nothing").toEqual([]);
  }, BUDGET_MS);
});

describe("AC-2: the doors on the wire", () => {
  test("AC-2: `takeoff.lineEvidence` and `takeoff.linesCiting` answer a signed-in member of the project", async () => {
    const { lineEvidence } = await traceSeam();
    const caller = await takeoffCaller(principalOf(staged));
    const lineId = published[0]?.lineId as string;
    const held = (await lineEvidence(scope, lineId)) as LineEvidence;

    const traced = (await door(caller, "lineEvidence")({ projectId: staged.projectId, lineId })) as LineEvidence | null;
    expect(traced, "the lane answers the evidence of a line of the caller's own project").not.toBeNull();
    expect((traced as LineEvidence).lineId, "and it is the line that was asked for").toBe(lineId);
    expect((traced as LineEvidence).traceKeys, "answering the same member the module answers").toEqual(held.traceKeys);

    const citing = (await door(caller, "linesCiting")({ projectId: staged.projectId, drawingId: held.drawingId, sourceKeys: held.traceKeys })) as Record<string, unknown>[];
    expect(Array.isArray(citing), "the lane answers a list of the lines citing the held selection").toBe(true);
    expect(citing.map((row) => String(row["lineId"])), "which holds the line that member was measured into").toContain(lineId);
  }, BUDGET_MS);
});
