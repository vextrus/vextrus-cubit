/**
 * AC-2 — the Trace's two doors, over a staged campaign (R-UI-022, R-TO-011, X-2).
 *
 * The corpus is the register's own staged campaign (`stageRegisterCampaign()`), driven end to end
 * through the shipped seams: nothing here inserts a line by hand, so what the doors answer is what a
 * real measurement published. Every expectation is recomputed from that corpus — the cited keys from
 * each line's own bindings, the citing lines from the keys they in fact carry, the order from the
 * `published_at` the store recorded — so no count, roster or order below is a transcript of today's
 * fixture (B-19).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  QUANTITY_LINES_TABLE,
  closeStage,
  door,
  field,
  principalOf,
  productModule,
  rowsOfCampaign,
  stageRegisterCampaign,
  takeoffCaller,
  type StagedRegisterCampaign,
} from "../register-ui/support/register-ui-stage";
import { REGISTER_UI_SERVER_MODULE, citedKeysSpelling, traceSeam, type LineEvidence, type TraceScope } from "./support/trace-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

let staged: StagedRegisterCampaign;
let scope: TraceScope;
/** The lines the register's own reading answers, which is what the Trace is asked about. */
let published: { lineId: string; sourceKey: string; variables: Record<string, { source: string }>; quantityBasis: string; objectKey: string; kind: string; value: string | null; unit: string; formula: string; repudiated: boolean }[];

beforeAll(async () => {
  staged = await stageRegisterCampaign("trace");
  scope = { tenantId: staged.tenantId, projectId: staged.projectId };
  const server = await productModule<{ registerViewOf: (s: TraceScope) => Promise<{ lines: typeof published }> }>(REGISTER_UI_SERVER_MODULE);
  const view = await server.registerViewOf(scope);
  published = view.lines.filter((line) => !line.repudiated);
  expect(published.length, `the staged campaign published lines for the Trace to answer about: ${JSON.stringify(view.lines)}`).toBeGreaterThan(0);
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

describe("AC-2: lineEvidence", () => {
  test("AC-2: a line answers its sheet, its cited keys, its formula and its live variables", async () => {
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
      expect(typeof held.layoutName, "and its layout — the ingest's recorded one, else model space (risk note 3)").toBe("string");
      expect((held.layoutName ?? "").length, "a layout the viewer can be addressed at is never empty").toBeGreaterThan(0);

      expect(held.sourceKeys, "the cited keys are the line's own key, then each binding's source in binding order, duplicates collapsed").toEqual(citedKeysSpelling(line));

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

/** The whole evidence of every published line of the staged campaign, by lineId. */
async function evidenceOfPublished(lineEvidence: (scope: TraceScope, lineId: string) => Promise<LineEvidence | null>): Promise<Map<string, LineEvidence>> {
  const evidence = new Map<string, LineEvidence>();
  for (const line of published) evidence.set(line.lineId, (await lineEvidence(scope, line.lineId)) as LineEvidence);
  return evidence;
}

describe("AC-2: linesCiting", () => {
  test("AC-2: every published line of the drawing whose keys intersect the ask, each once, in publishedAt then lineId order", async () => {
    const { lineEvidence, linesCiting } = await traceSeam();
    const stored = storedLines();

    const evidence = await evidenceOfPublished(lineEvidence);

    const drawingIds = [...new Set([...evidence.values()].map((held) => held.drawingId))];
    expect(drawingIds.length, `the staged campaign's lines stand on one drawing: ${JSON.stringify(drawingIds)}`).toBe(1);
    const drawingId = drawingIds[0] as string;

    const asked = [...new Set([...evidence.values()].flatMap((held) => held.sourceKeys))];
    /* The rule, recomputed: the lines whose own cited keys meet the ask, ordered as the store
       published them and then by their id — never the order this file happens to hold them in. */
    const expected = inPublishedOrder(
      published.filter((line) => (evidence.get(line.lineId) as LineEvidence).sourceKeys.some((key) => asked.includes(key))).map((line) => line.lineId),
      stored,
    );
    expect(expected.length, "the ask names keys that some published line cites").toBeGreaterThan(0);

    const answered = await linesCiting(scope, { drawingId, sourceKeys: asked });
    expect(answered.map((row) => String(row["lineId"])), "every citing line, once, in publishedAt then lineId order").toEqual(expected);

    /* The order is a fact about the lines, not about the ask. */
    const reversed = await linesCiting(scope, { drawingId, sourceKeys: [...asked].reverse() });
    expect(reversed.map((row) => String(row["lineId"])), "asking the same keys in another order answers the same sequence").toEqual(expected);
  }, BUDGET_MS);

  /*
   * The predicate has to SEPARATE, or "the lines that cite those entities" (X-2) is just "the lines
   * of this sheet". The two asks below are built from the corpus's own census of which lines cite
   * which key: one key exactly one line holds, and one that line shares with its siblings. Neither
   * key nor line is named here — both are found by probing (B-19), so the test stays true as the
   * staged campaign grows.
   */
  test("AC-2: a key one line alone cites answers that line and withholds the sheet's other lines", async () => {
    const { lineEvidence, linesCiting } = await traceSeam();
    const stored = storedLines();
    const evidence = await evidenceOfPublished(lineEvidence);

    const citedBy = new Map<string, string[]>();
    for (const [lineId, held] of evidence) for (const key of held.sourceKeys) citedBy.set(key, [...(citedBy.get(key) ?? []), lineId]);
    const census = [...citedBy].map(([key, lineIds]) => [key, lineIds.length]);

    const sole = [...citedBy].find(([, lineIds]) => lineIds.length === 1);
    expect(sole, `the staged corpus holds a key exactly one published line cites — the case "withheld" is about: ${JSON.stringify(census)}`).toBeTruthy();
    const [ownKey, holders] = sole as [string, string[]];
    const onlyLineId = holders[0] as string;
    const drawingId = (evidence.get(onlyLineId) as LineEvidence).drawingId as string;

    const siblings = [...evidence.values()].filter((line) => line.drawingId === drawingId && line.lineId !== onlyLineId);
    expect(siblings.length, `and other published lines of that same sheet, which such an ask must withhold: ${JSON.stringify([...evidence.keys()])}`).toBeGreaterThan(0);

    const answeredOne = await linesCiting(scope, { drawingId, sourceKeys: [ownKey] });
    expect(answeredOne.map((row) => String(row["lineId"])), "the lines that cite THOSE entities, not every line the sheet published (X-2)").toEqual([onlyLineId]);

    /* Widened by a key that line SHARES, the same ask gathers them all — each once, however many of
       the asked keys it holds. */
    const shared = [...citedBy].find(([key, lineIds]) => key !== ownKey && lineIds.includes(onlyLineId) && lineIds.length > 1);
    expect(shared, `the corpus holds a key that line shares with a sibling — the case "once however many match" is about: ${JSON.stringify(census)}`).toBeTruthy();
    const [sharedKey, sharers] = shared as [string, string[]];

    const answeredBoth = (await linesCiting(scope, { drawingId, sourceKeys: [ownKey, sharedKey] })).map((row) => String(row["lineId"]));
    const expected = inPublishedOrder(
      [onlyLineId, ...sharers].filter((lineId) => (evidence.get(lineId) as LineEvidence).drawingId === drawingId),
      stored,
    );
    expect(answeredBoth, "every line either asked key names, in publishedAt then lineId order").toEqual(expected);
    expect(answeredBoth.length, `and the line holding BOTH asked keys stands once, not twice: ${JSON.stringify(answeredBoth)}`).toBe(new Set(answeredBoth).size);
  }, BUDGET_MS);

  test("AC-2: a line matched by several of the asked keys is answered once", async () => {
    const { lineEvidence, linesCiting } = await traceSeam();
    const multi = [];
    for (const line of published) {
      const held = (await lineEvidence(scope, line.lineId)) as LineEvidence;
      if (held.sourceKeys.length > 1) multi.push(held);
    }
    expect(multi.length, "the staged corpus holds a line citing more than one key — the case 'once however many match' is about").toBeGreaterThan(0);

    const held = multi[0] as LineEvidence;
    const answered = await linesCiting(scope, { drawingId: held.drawingId as string, sourceKeys: held.sourceKeys });
    expect(answered.filter((row) => String(row["lineId"]) === held.lineId).length, "the line stands once however many of its keys were asked").toBe(1);
  }, BUDGET_MS);

  test("AC-2: a key nobody cites, and a drawing nobody published on, answer the empty list", async () => {
    const { lineEvidence, linesCiting } = await traceSeam();
    const held = (await lineEvidence(scope, published[0]?.lineId as string)) as LineEvidence;

    expect(await linesCiting(scope, { drawingId: held.drawingId as string, sourceKeys: [`DXF_HANDLE:${randomUUID()}`] }), "a key no line cites answers []").toEqual([]);
    expect(await linesCiting(scope, { drawingId: randomUUID(), sourceKeys: held.sourceKeys }), "and a drawing this project published nothing on answers []").toEqual([]);
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
    expect((traced as LineEvidence).sourceKeys, "answering the same cited keys the module answers").toEqual(held.sourceKeys);

    const citing = (await door(caller, "linesCiting")({ projectId: staged.projectId, drawingId: held.drawingId, sourceKeys: held.sourceKeys })) as Record<string, unknown>[];
    expect(Array.isArray(citing), "the lane answers a list of the lines citing the held selection").toBe(true);
    expect(citing.map((row) => String(row["lineId"])), "which holds the line those keys were read off").toContain(lineId);
  }, BUDGET_MS);
});
