/**
 * S1, live: RECORD_MANUAL_MEASUREMENT through the act seam over a world the shipped doors stood up —
 * a drawing ingested, partitioned, discipline-confirmed, scale-affirmed and pinned (V-DB,
 * docs/design/s-measure.md I-373 … I-387, I-495).
 *
 * What one committed hand measurement IS in the store: one act row, one `manual_measurements` row,
 * and one register row whose key is its placement key and one level segment — the store's own CHECK
 * (`register_objects_level_stated_once`) held it. Then the register's identity at work: the same trace
 * again is DUPLICATE_IDENTITY; an attribute-only edit supersedes and strikes its predecessor, never
 * refused; a delete (REPUDIATE) and a re-trace work; ground already measured is MANUAL_OVERLAP by name.
 * And the two reads the store answers the act by: a condition the chest does not hold standing is
 * MANUAL_CONDITION_NOT_STANDING before anything is written (never the store's foreign key as a fault),
 * and a machine line published in the cell is MANUAL_CELL_MACHINE_MEASURED until its object is struck.
 *
 * Product modules are loaded by absolute path after the stage has named the scratch world.
 */
import { afterAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import {
  ACTS_MODULE,
  ERRORS_MODULE,
  RECORD_MANUAL_MEASUREMENT,
  REFUSAL_MARKER_MODULE,
  REPUDIATE,
  actorOf,
  blindingRecipe,
  closeStage,
  countOf,
  createProjectThroughDoor,
  free,
  performAct,
  productModule,
  snapped,
  sql,
  stageCondition,
  stageMachineLine,
  stageManualWorld,
  stageRegisterObject,
  tracing,
  unique,
  FOOTING,
  PIT,
  SLAB,
  type ManualWorld,
} from "./support/manual-stage";

const BUDGET_MS = 600_000;

type Acts = {
  preview(actor: unknown, input: unknown): Promise<{ subjects: { subjectId: string; before: string[]; after: string[] }[]; measurement?: { objectKey: string; supersedes: string | null; replaces: string | null; figure: unknown } }>;
  commit(actor: unknown, input: unknown, digest: string): Promise<{ actId: string }>;
  consequenceDigest(consequence: unknown): string;
};

let staging: Promise<ManualWorld> | undefined;
const staged = (): Promise<ManualWorld> => (staging ??= stageManualWorld("act", 91));

afterAll(async () => {
  await closeStage();
}, 120_000);

async function refusalOf(work: () => Promise<unknown>): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf(error: unknown): string | null }>(REFUSAL_MARKER_MODULE);
  try {
    await work();
  } catch (failure) {
    return refusalCodeOf(failure);
  }
  return null;
}

/** The one hand measurement standing in the world's project: recorded, and struck by no act. */
function standingOn(world: ManualWorld): string {
  const rows = sql(
    `select m.object_key from manual_measurements m
      where m.project_id = '${world.projectId}'::uuid
        and not exists (select 1 from repudiated_objects r where r.project_id = m.project_id and r.object_key = m.object_key);`,
  );
  expect(rows.length, "exactly one hand measurement stands").toBe(1);
  return rows[0]?.[0] ?? "";
}

async function codes(): Promise<Record<string, { code: string }>> {
  return (await productModule<{ REFUSALS: Record<string, { code: string }> }>(ERRORS_MODULE)).REFUSALS;
}

/** The act's preview refuses, by the registered code named. */
async function expectRefused(world: ManualWorld, input: Record<string, unknown>, code: string | undefined): Promise<void> {
  const acts = await productModule<Acts>(ACTS_MODULE);
  expect(code, "the register publishes the code").toBeDefined();
  expect(await refusalOf(() => acts.preview(actorOf(world.person), input)), `the preview answers ${String(code)}`).toBe(code);
}

describe("S1: a hand measurement, recorded live", () => {
  let first = "";
  let edit = "";

  test("one act row, one measurement row, one register row whose key the store's CHECK holds", async () => {
    const world = await staged();
    const actor = actorOf(world.person);
    const { consequence, actId } = await performAct(actor, tracing(world));
    const measured = (consequence as { measurement?: { objectKey: string; figure: unknown; drawnUnit: string } }).measurement;
    expect(measured?.figure, "the slab's 1 600 mm² with the pit's 100 mm² stated as a cut-out, exactly").toEqual({ measure: "AREA", gross: "1600", cutouts: [{ role: "OPENING", area: "100" }] });
    first = measured?.objectKey ?? "";
    expect(first).toMatch(/\|~m\.[0-9a-f]{16}\|0\.0,-50\.0@/u);

    expect(countOf("acts", `act_id = '${actId}'::uuid and act_type = '${RECORD_MANUAL_MEASUREMENT}'`), "one act row").toBe(1);
    const rows = sql(`select act_id::text, supersedes, drawn_unit, figure_unit, level_id::text from manual_measurements where object_key = '${first}';`);
    expect(rows, "one measurement row, written by that act").toEqual([[actId, "", "mm", "mm2", world.levelId]]);
    const register = sql(`select mark, standing, discipline, element_type, level_id::text, (object_key = placement_key || '@' || level_id::text)::text from register_objects where object_key = '${first}';`);
    expect(register.length, "one register row").toBe(1);
    const [mark, standing, discipline, elementType, levelId, keyed] = register[0] ?? [];
    expect([standing, discipline, elementType, levelId, keyed], "MEASURED, the sheet's discipline, the recipe's class, the stated level — and the key its placement and level segment").toEqual([
      "MEASURED",
      "STRUCTURAL",
      "slab",
      world.levelId,
      "true",
    ]);
    expect(mark).toMatch(/^~m\.[0-9a-f]{16}$/u);
  }, BUDGET_MS);

  test("the register names the hand object for its condition and level, never its `~m.` mark (s-measure I-666)", async () => {
    const world = await staged();
    expect(first, "the first measurement stands").not.toBe("");
    const scope = { tenantId: world.person.tenantId, projectId: world.projectId };
    const [conditionName = ""] = sql(`select condition_name from manual_measurements where object_key = '${first}';`)[0] ?? [];
    expect(conditionName, "the measurement names its condition").not.toBe("");

    const trace = await productModule<{ handObjectsOf(scope: unknown, keys: readonly string[]): Promise<Map<string, { conditionName: string; ring: readonly (readonly [number, number])[] }>> }>(
      "src/modules/takeoff/trace/index.ts",
    );
    const hand = await trace.handObjectsOf(scope, [first, "PLAN|not-a-hand-object"]);
    expect([...hand.keys()], "one read answers the hand objects among the keys asked, and only them").toEqual([first]);
    expect(hand.get(first)?.conditionName).toBe(conditionName);
    expect(hand.get(first)?.ring.length, "and the outer ring it traced, in the space its points were stated in").toBe(SLAB.length);

    const register = await productModule<{ registerViewOf(scope: unknown): Promise<{ objects: { objectKey: string; mark: string | null }[] }> }>("src/modules/takeoff/register-ui/server.ts");
    const named = (await register.registerViewOf(scope)).objects.find((object) => object.objectKey === first);
    expect(named?.mark, "the tree and Source column read the condition, never the placement's `~m.` mark").toMatch(new RegExp(`^${conditionName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}( · |$)`, "u"));
    expect(named?.mark).not.toContain("~m.");
  }, BUDGET_MS);

  test("the same trace again is DUPLICATE_IDENTITY, and nothing is written", async () => {
    const world = await staged();
    const before = countOf("register_objects", `project_id = '${world.projectId}'::uuid`);
    await expectRefused(world, tracing(world), (await codes())["DUPLICATE_IDENTITY"]?.code);
    expect(countOf("register_objects", `project_id = '${world.projectId}'::uuid`)).toBe(before);
  }, BUDGET_MS);

  test("an attribute-only edit supersedes: a new row naming its predecessor, which it strikes in the same act — never refused", async () => {
    const world = await staged();
    expect(first, "the first measurement stands").not.toBe("");
    const { consequence, actId } = await performAct(actorOf(world.person), tracing(world, { recipe: blindingRecipe("100"), replaces: first }));
    const measured = (consequence as { measurement?: { objectKey: string; supersedes: string | null; replaces: string | null } }).measurement;
    edit = measured?.objectKey ?? "";
    expect(edit).not.toBe(first);
    expect([measured?.supersedes, measured?.replaces]).toEqual([first, first]);
    expect(sql(`select supersedes from manual_measurements where object_key = '${edit}';`), "the new row names what it succeeds").toEqual([[first]]);
    expect(sql(`select act_id::text from repudiated_objects where object_key = '${first}';`), "the predecessor is struck by the edit's own act (I-379)").toEqual([[actId]]);
  }, BUDGET_MS);

  test("a delete (REPUDIATE) and a re-trace of the same scope work", async () => {
    const world = await staged();
    expect(edit, "the edit stands").not.toBe("");
    await performAct(actorOf(world.person), { type: REPUDIATE, projectId: world.projectId, objectKey: edit });
    const { consequence } = await performAct(actorOf(world.person), tracing(world));
    const measured = (consequence as { measurement?: { objectKey: string; supersedes: string | null; replaces: string | null } }).measurement;
    expect(measured?.objectKey, "a key of its own").not.toBe(first);
    expect(measured?.objectKey).not.toBe(edit);
    expect(measured?.supersedes, "it succeeds the struck key its own trace re-derives to").toBe(edit);
    expect(measured?.replaces, "and strikes nothing").toBeNull();
    expect(countOf("manual_measurements", `project_id = '${world.projectId}'::uuid`), "three measurements recorded, one standing").toBe(3);
  }, BUDGET_MS);

  test("ground already measured on the plan is MANUAL_OVERLAP by name; the same cell on the detail is MANUAL_CELL_OTHER_VIEW", async () => {
    const world = await staged();
    const REFUSALS = await codes();
    const overlapping = { geometry: "POLYGON", outer: free([[25, -45], [35, -45], [35, -35], [25, -35]]), cutouts: [] };
    await expectRefused(world, tracing(world, { geometry: overlapping }), REFUSALS["MANUAL_OVERLAP"]?.code);
    const detail = tracing(world, { viewKey: world.detailView, geometry: { geometry: "POLYGON", outer: snapped(FOOTING, world.footingKey), cutouts: [] } });
    await expectRefused(world, detail, REFUSALS["MANUAL_CELL_OTHER_VIEW"]?.code);
  }, BUDGET_MS);

  test("a point on the detail's outline is off the plan: MANUAL_RING_OFF_VIEW", async () => {
    const world = await staged();
    const outer = [...snapped(SLAB.slice(0, 3), world.slabKey), { x: 600, y: -50, cites: [world.footingKey] }];
    await expectRefused(world, tracing(world, { geometry: { geometry: "POLYGON", outer, cutouts: [] } }), (await codes())["MANUAL_RING_OFF_VIEW"]?.code);
  }, BUDGET_MS);

  test("a recipe naming a condition the chest does not hold standing is MANUAL_CONDITION_NOT_STANDING, and nothing is written; one it holds is recorded with its id", async () => {
    const world = await staged();
    const actor = actorOf(world.person);
    const acts = await productModule<Acts>(ACTS_MODULE);
    const code = (await codes())["MANUAL_CONDITION_NOT_STANDING"]?.code;
    expect(code, "the register publishes MANUAL_CONDITION_NOT_STANDING (Q-07)").toBeDefined();
    // The pairing MANUAL_RULES holds (I-539), applied from a condition; the recorded case is an edit of
    // the measurement standing on the slab, so the ground is the same and nothing overlaps.
    const applied = (conditionId: string, replaces: string | null = null): Record<string, unknown> =>
      tracing(world, { recipe: { ...blindingRecipe(), conditionId, conditionName: "SOG blinding" }, replaces });

    const other = await createProjectThroughDoor(world.person, unique("Manual other project"));
    const unheld = [
      ["one no chest holds", randomUUID()],
      ["one this project retired", stageCondition(world, { name: "SOG concrete (old)", retired: true })],
      ["another project's", stageCondition(world, { projectId: other, name: "SOG concrete" })],
    ] as const;
    const actsBefore = countOf("acts", `project_id = '${world.projectId}'::uuid and act_type = '${RECORD_MANUAL_MEASUREMENT}'`);
    const measuredBefore = countOf("manual_measurements", `project_id = '${world.projectId}'::uuid`);
    for (const [what, conditionId] of unheld) {
      expect(await refusalOf(() => acts.preview(actor, applied(conditionId))), `the preview names ${what}`).toBe(code);
      expect(await refusalOf(() => acts.commit(actor, applied(conditionId), "0".repeat(64))), `and so does the commit, before the store's key is ever asked (${what})`).toBe(code);
    }
    expect(countOf("acts", `project_id = '${world.projectId}'::uuid and act_type = '${RECORD_MANUAL_MEASUREMENT}'`), "no act row").toBe(actsBefore);
    expect(countOf("manual_measurements", `project_id = '${world.projectId}'::uuid`), "no measurement row").toBe(measuredBefore);

    const held = stageCondition(world, { name: "SOG concrete" });
    const { consequence } = await performAct(actor, applied(held, standingOn(world)));
    const objectKey = (consequence as { measurement?: { objectKey: string } }).measurement?.objectKey ?? "";
    expect(sql(`select condition_id::text from manual_measurements where object_key = '${objectKey}';`), "the measurement cites the condition it was applied from").toEqual([[held]]);
    // The store's own key is the belt under the act: the row, copied onto a register object that has
    // none, stands where it cites this project's condition and is refused where it cites another's —
    // each tried in a transaction rolled back, so the world is left as it was.
    const spare = await stageRegisterObject(world, "SOG0");
    const [, othersCondition] = unheld[2];
    const copyCiting = (conditionId: string): string =>
      `begin;
       insert into manual_measurements select tenant_id, set_revision_id, '${spare}', project_id, act_id, drawing_id, ingest_id, layout_name, partition_view_key, view_key,
              '${conditionId}'::uuid, condition_name, geometry, element_class, kinds, readings, level_id, level_slot, traced, figure, drawn_unit, figure_unit, calibration_key, supersedes, recorded_at
         from manual_measurements where object_key = '${objectKey}';
       select count(*)::text from manual_measurements where object_key = '${spare}';
       rollback;`;
    expect(sql(copyCiting(held)), "a row citing this project's condition is one the store takes").toEqual([["1"]]);
    expect(() => sql(copyCiting(othersCondition)), "a foreign key is checked past row-level security, so the project is in the key").toThrow(/23503[\s\S]*manual_measurements_condition_fk/u);
    expect(countOf("manual_measurements", `object_key = '${spare}'`), "both copies rolled back").toBe(0);
  }, BUDGET_MS);

  test("a machine line published in the cell is MANUAL_CELL_MACHINE_MEASURED — read live off the campaign's lines and their objects' levels — until its object is struck", async () => {
    const world = await staged();
    const actor = actorOf(world.person);
    // An edit of the blinding standing on the slab (the only pairing a hand measurement is offered
    // under, I-539), so the cell is the one question the preview is asked.
    const thicker = tracing(world, {
      recipe: blindingRecipe("100"),
      geometry: { geometry: "POLYGON", outer: snapped(SLAB, world.slabKey), cutouts: [{ role: "OPENING", ring: snapped(PIT, world.pitKey) }] },
      replaces: standingOn(world),
    });
    const acts = await productModule<Acts>(ACTS_MODULE);
    await expect(acts.preview(actor, thicker), "the cell is the hand's while the machine publishes nothing in it").resolves.toBeDefined();

    const machine = await stageMachineLine(world, "pcc.blinding");
    await expectRefused(world, thicker, (await codes())["MANUAL_CELL_MACHINE_MEASURED"]?.code);

    await performAct(actor, { type: REPUDIATE, projectId: world.projectId, objectKey: machine });
    await expect(acts.preview(actor, thicker), "a struck object's line claims nothing (I-382)").resolves.toBeDefined();
  }, BUDGET_MS);
});
