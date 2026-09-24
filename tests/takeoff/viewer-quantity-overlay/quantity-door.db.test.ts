/**
 * viewer.md Part 6 — the quantity overlay's data door and the feed's `?part=quantities`, over a
 * campaign published end to end through the shipped seams (the register's own staged campaign: three
 * columns sighted, placed on a column layout plan framed by a paper sheet, two measured by the gate and
 * the third queued as INTERPRETED_UNCORROBORATED).
 *
 * Every expectation is READ from the store (B-19): the lines and queue items of the campaign, the
 * placement rows the plan wrote, and the objects a person struck — so a campaign that publishes
 * differently moves both sides at once. The sums are recomputed with decimal.js (B-07).
 *
 * The BNBC figures of the slice's proof (S-10: 27 columns, 208 lines, 93.892896 m³, the beams hatched)
 * are read by J-000's m3-measure-and-register leg over the golden run, which is where F-RCC6-BNBC is
 * measured; this suite proves the same door over a campaign it can stage in a scratch database.
 */
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { closeStage, field, productModule, rowsOfCampaign, sql, stageRegisterCampaign, QUANTITY_LINES_TABLE, QUEUE_ITEMS_TABLE, type StagedRegisterCampaign } from "../register-ui/support/register-ui-stage";
import { enrol } from "../../spine/uploads/support/upload-stage";

const BUDGET_MS = 900_000;
const DIALLED = "http://127.0.0.1";
const DOOR_MODULE = "src/modules/takeoff/viewer-quantity-overlay/server.ts";
const SCENE_MODULE = "src/modules/takeoff/viewer-quantity-overlay/scene.ts";
const ROUTE_MODULE = "src/app/api/viewer/[drawing]/[layout]/route.ts";

type Sum = { kind: string; unit: string; value: string; lines: number };
type Placement = { key: string; class: string; mark: string; keys: string[]; box: { min: number[]; max: number[] } | null; basis: string | null; sums: Sum[]; unmeasured: { kind: string; codes: string[] }[]; condition: { key: string } };
type Overlay = { campaignId: string; placements: Placement[]; elsewhere: { layoutName: string; label: string; placements: number }[] };
type Door = { quantityOverlayOf: (scope: { tenantId: string; projectId: string; drawingId: string; layoutName: string }) => Promise<Overlay | null> };
type Route = { GET: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> };

let staged: StagedRegisterCampaign;
/** The placement each object of the revision stands at, as the store holds it. */
let placementOf: Map<string, string>;

beforeAll(async () => {
  staged = await stageRegisterCampaign("quantities");
  placementOf = new Map(
    sql(
      `select object_key, placement_key from register_objects
        where ${ident(TENANT_COLUMN)} = ${lit(staged.tenantId)}::uuid and set_revision_id = ${lit(staged.setRevisionId)}::uuid;`,
    ).map((row) => [row[0] ?? "", row[1] ?? ""]),
  );
}, BUDGET_MS);

afterAll(async () => {
  await closeStage();
}, 120_000);

async function overlayOn(layoutName: string): Promise<Overlay | null> {
  const door = await productModule<Door>(DOOR_MODULE);
  return door.quantityOverlayOf({ tenantId: staged.tenantId, projectId: staged.projectId, drawingId: staged.drawn.drawingId, layoutName });
}

/** What the store says each placement's COMPLETE lines add to, per kind — the door's figures, recomputed. */
function storedSums(): Map<string, Map<string, Decimal>> {
  const held = new Map<string, Map<string, Decimal>>();
  for (const row of rowsOfCampaign(QUANTITY_LINES_TABLE, staged.tenantId, staged.campaignId)) {
    if (String(field(row, "coverage", "coverage")) !== "COMPLETE") continue;
    const placement = placementOf.get(String(field(row, "objectKey", "object_key"))) ?? "";
    const kinds = held.get(placement) ?? new Map<string, Decimal>();
    const kind = String(field(row, "kind", "kind"));
    kinds.set(kind, (kinds.get(kind) ?? new Decimal(0)).plus(String(field(row, "value", "value"))));
    held.set(placement, kinds);
  }
  return held;
}

describe("the quantity door over a published campaign", () => {
  test("on the plan's sheet, every member stands with its outline and mark, its exact COMPLETE sums and its basis", async () => {
    const overlay = await overlayOn(staged.drawn.planSheet);
    expect(overlay, "the project has a campaign, so the door answers").not.toBeNull();
    expect(overlay?.campaignId, "the campaign the register renders").toBe(staged.campaignId);
    const sums = storedSums();
    const stored = rowsOfCampaign(QUANTITY_LINES_TABLE, staged.tenantId, staged.campaignId);
    const queued = rowsOfCampaign(QUEUE_ITEMS_TABLE, staged.tenantId, staged.campaignId).map((row) => placementOf.get(String(field(row, "objectKey", "object_key"))));
    const lined = stored.map((row) => placementOf.get(String(field(row, "objectKey", "object_key"))));

    expect(new Set(overlay?.placements.map((placement) => placement.key)), "every member a line or a queue item stands at is on the plan's sheet").toEqual(new Set([...lined, ...queued]));
    for (const placement of overlay?.placements ?? []) {
      const member = Object.values(staged.drawn.members).find((keys) => placement.keys.includes(keys.outlineKey));
      expect(member, `${placement.mark} is named by the outline it was read off`).toBeDefined();
      expect([...placement.keys].sort(), `${placement.mark}'s outline and mark both stand on the sheet`).toEqual([member?.outlineKey, member?.markKey].sort());
      expect(placement.box, `${placement.mark} has a box on the sheet`).not.toBeNull();
      const expected = sums.get(placement.key) ?? new Map<string, Decimal>();
      expect(Object.fromEntries(placement.sums.map((sum) => [sum.kind, sum.value])), `${placement.mark}'s figures are the store's COMPLETE lines, added exactly`).toEqual(
        Object.fromEntries([...expected.entries()].map(([kind, value]) => [kind, value.toFixed()])),
      );
      expect(placement.basis === null, `${placement.mark} wears a basis exactly where it was measured`).toBe(expected.size === 0);
      expect(placement.condition.key, "a rail's member stands under its class, read as a condition").toBe(`class:${placement.class}`);

      // What the store holds as seen-and-not-billed for this member: its PARTIAL lines' omissions and its queue items' causes.
      const partialCodes = stored
        .filter((row) => placementOf.get(String(field(row, "objectKey", "object_key"))) === placement.key && String(field(row, "coverage", "coverage")) !== "COMPLETE")
        .flatMap((row) => (field(row, "omitted", "omitted") as { code: string }[]).map((entry) => entry.code));
      const queuedCodes = queued.filter((key) => key === placement.key).map(() => "INTERPRETED_UNCORROBORATED");
      expect(new Set(placement.unmeasured.flatMap((kind) => kind.codes)), `${placement.mark} is unmeasured by exactly the codes the store holds for it`).toEqual(new Set([...partialCodes, ...queuedCodes]));
    }
    // The campaign this stage publishes: its lines omit the storey height (PARTIAL_DECLARED) and its third
    // member is queued — so this suite proves the unmeasured path on a live store, and the COMPLETE path
    // is proven by the unit suite's sums and by J-000 on F-RCC6-BNBC's S-10.
    expect(stored.length, "the staged campaign published lines").toBeGreaterThan(0);
    expect(overlay?.placements.every((placement) => placement.sums.length === 0 || sums.has(placement.key)), "no figure stands that the store does not hold").toBe(true);
  }, BUDGET_MS);

  test("the legend over the door reads the store's measured scope: the measured count and the exact sum", async () => {
    const overlay = (await overlayOn(staged.drawn.planSheet)) as Overlay;
    const scene = await productModule<{ legendOf: (overlay: Overlay, toggles: { quantities: boolean; unmeasured: boolean }) => { rows: { condition: { key: string }; measured: number; totals: Sum[]; unmeasured: number }[] } }>(SCENE_MODULE);
    const legend = scene.legendOf(overlay, { quantities: true, unmeasured: true });
    const lines = rowsOfCampaign(QUANTITY_LINES_TABLE, staged.tenantId, staged.campaignId).filter((row) => String(field(row, "coverage", "coverage")) === "COMPLETE");
    const exact = lines.reduce((sum, row) => sum.plus(String(field(row, "value", "value"))), new Decimal(0));
    expect(legend.rows.map((row) => row.condition.key)).toEqual(["class:column"]);
    expect(legend.rows[0]?.measured, "one measured placement per member with a COMPLETE line").toBe(storedSums().size);
    expect(legend.rows[0]?.totals.map((total) => [total.value, total.lines]), "the measured scope is the store's COMPLETE lines, whole — and nothing where there are none").toEqual(lines.length === 0 ? [] : [[exact.toFixed(), lines.length]]);
    expect(legend.rows[0]?.unmeasured, "every member with a line or a queue item that was not billed is counted unmeasured").toBe(overlay.placements.filter((placement) => placement.unmeasured.length > 0).length);
    expect(legend.rows[0]?.unmeasured).toBeGreaterThan(0);
  }, BUDGET_MS);

  test("on a sheet the members do not stand on, nothing is painted and the resolver names the plan's sheet", async () => {
    const overlay = await overlayOn(staged.drawn.scheduleSheet);
    expect(overlay?.placements, "no member of the plan stands on the schedule's sheet").toEqual([]);
    expect(overlay?.elsewhere.map((sheet) => sheet.layoutName), "the members are named on the sheet whose window frames them").toEqual([staged.drawn.planSheet]);
    expect(overlay?.elsewhere[0]?.placements, "every member the plan's sheet paints is counted there").toBe((await overlayOn(staged.drawn.planSheet))?.placements.length);
  }, BUDGET_MS);
});

describe("the feed's ?part=quantities", () => {
  async function feed(cookie: string | null, tenant: string = staged.tenantId): Promise<{ status: number; body: Record<string, unknown> }> {
    const route = await productModule<Route>(ROUTE_MODULE);
    const url = `${DIALLED}/api/viewer/${staged.drawn.drawingId}/${encodeURIComponent(staged.drawn.planSheet)}?tenant=${tenant}&part=quantities`;
    const headers: Record<string, string> = {};
    if (cookie !== null) headers["cookie"] = cookie;
    const answer = await route.GET(new Request(url, { headers }), { params: Promise.resolve({ drawing: staged.drawn.drawingId, layout: staged.drawn.planSheet }) });
    return { status: answer.status, body: (await answer.json()) as Record<string, unknown> };
  }

  test("a participant is answered the door's own overlay", async () => {
    const answered = await feed(staged.person.cookie);
    expect(answered.status).toBe(200);
    expect(answered.body["quantities"], "the feed answers what the door answers, verbatim").toEqual(JSON.parse(JSON.stringify(await overlayOn(staged.drawn.planSheet))));
  }, BUDGET_MS);

  test("a person who is no participant of the project is refused by name, and a signed-out caller too", async () => {
    const stranger = await enrol("quantities-stranger");
    const refused = await feed(stranger.cookie);
    expect(refused.status).toBe(403);
    expect((refused.body["refusal"] as { code?: string } | undefined)?.code, "refused by the register's own code").toBe("WORKSPACE_PERMISSION_NOT_HELD");
    const signedOut = await feed(null);
    expect(signedOut.status).toBe(401);
    expect((signedOut.body["refusal"] as { code?: string } | undefined)?.code).toBe("SIGNED_OUT");
  }, BUDGET_MS);
});
