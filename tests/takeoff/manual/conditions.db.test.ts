/**
 * S5, live: the condition chest at its doors (`takeoffConditions.list`, `.author`, `.retire`;
 * docs/design/s-measure.md §2.6, §2.11, I-374, I-573 … I-575).
 *
 * Every entry point resolves actor, tenant, project, participation and permission through the one
 * `authorize()` and carries a live-database test that a caller without the permission is refused BY
 * NAME. So:
 *   · a MEASURER authors "75 CC blinding under SOG" and reads it back — its recipe judged by the chest
 *     (the rule id read off the manual roster, the thickness ENTERED), its hotkey its place;
 *   · a name a standing condition holds, a kind the class does not bear, a kind no manual method
 *     measures from the shape are each refused by the register's own code; a statement the doors
 *     cannot read is REQUEST_MALFORMED;
 *   · a REVIEWER reads the chest read-only and is refused PERMISSION_NOT_HELD at both writing doors; a
 *     person on no role of the project reads nothing;
 *   · a condition leaves the chest by being retired, once;
 *   · the running total is the campaign's own COMPLETE lines of the standing measurements citing the
 *     condition — never a figure the chest computes, never a struck measurement's.
 *
 * The people, workspaces and projects are real: accounts enrolled through the shipped sign-up door,
 * the doors called through the router's own caller with a context the shipped `createContext` mints
 * off a request carrying the person's real session cookie.
 */
import { afterAll, describe, expect, test } from "vitest";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { enrol, openStage, stageProject, type Person as UploadPerson } from "../../spine/uploads/support/upload-stage";
import { ERRORS_MODULE, REFUSAL_MARKER_MODULE, REPUDIATE, actorOf, campaignOf, closeStage, countOf, performAct, productModule, sql, stageManualWorld, tracing, blindingRecipe, type ManualWorld } from "./support/manual-stage";

const ROUTER_MODULE = "src/server/routers/takeoff-conditions.ts";
const CONTEXT_MODULE = "src/server/context.ts";

const BUDGET_MS = 600_000;

const MEASURER = "MEASURER";
const REVIEWER = "REVIEWER";

type Chest = {
  conditions: {
    conditionId: string;
    name: string;
    geometry: string;
    elementClass: string;
    kinds: { kind: string; ruleId: string }[];
    readings: { attribute: string; valueAsWritten: string; unitAsWritten: string; basis: string; sourceKey: string | null }[];
    colour: string;
    hatch: string;
    hotkey: number | null;
    measured: number;
    billed: number;
    totals: { kind: string; unit: string; value: string }[];
  }[];
  catalogue: { geometry: string; classes: { elementClass: string; colour: string; kinds: { kind: string; ruleId: string; readings: { attribute: string; dimension: string; units: string[] }[] }[] }[] }[];
  canAuthor: boolean;
};

type Door = {
  list(input: unknown): Promise<Chest>;
  author(input: unknown): Promise<{ conditionId: string }>;
  retire(input: unknown): Promise<{ retired: true }>;
};

afterAll(async () => {
  await closeStage();
}, 120_000);

/** A project of the person's own workspace, with this role on it for them. */
function projectFor(person: UploadPerson, name: string, role: string): string {
  const projectId = stageProject(person.tenantId, name);
  sql(
    `insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}) on conflict do nothing;
     insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}, ${lit(role)}) on conflict do nothing;`,
  );
  return projectId;
}

/** The shipped doors, as this person's live session reaches them. */
async function doorFor(person: { cookie: string }): Promise<Door> {
  const { createContext } = await productModule<{ createContext(opts: { req: Request }): Promise<unknown> }>(CONTEXT_MODULE);
  const { takeoffConditionsRouter } = await productModule<{ takeoffConditionsRouter: { createCaller(ctx: unknown): Door; _def?: { procedures?: Record<string, unknown> } } }>(ROUTER_MODULE);
  expect(Object.keys(takeoffConditionsRouter._def?.procedures ?? {}).sort(), "takeoffConditions.list, .author and .retire are on the wire (s-measure §2.11)").toEqual(["author", "list", "retire"]);
  const request = new Request("http://127.0.0.1/api/trpc/takeoffConditions.list", { method: "POST", headers: { cookie: person.cookie } });
  return takeoffConditionsRouter.createCaller(await createContext({ req: request }));
}

/** The condition the QS outcome names: a slab blinded 75 mm, painted as a slab, hatched diagonally. */
function blinding(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "75 CC blinding under SOG",
    geometry: "POLYGON",
    elementClass: "slab",
    kinds: ["pcc.blinding"],
    readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm" }],
    colour: "slab",
    hatch: "diagonal",
    ...over,
  };
}

async function refusalFrom(work: () => Promise<unknown>, what: string): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf(error: unknown): string | null }>(REFUSAL_MARKER_MODULE);
  let answered: unknown;
  let thrown: unknown;
  let refused = false;
  try {
    answered = await work();
  } catch (caught) {
    thrown = caught;
    refused = true;
  }
  if (!refused) expect.fail(`${what} must be refused, and the door answered with ${JSON.stringify(answered)}`);
  return refusalCodeOf(thrown);
}

async function code(name: string): Promise<string> {
  const held = (await productModule<{ REFUSALS: Record<string, { code: string } | undefined> }>(ERRORS_MODULE)).REFUSALS[name]?.code;
  expect(held, `the register publishes ${name} (Q-07)`).toBeDefined();
  return held as string;
}

describe("the condition chest, at its doors", () => {
  test("a MEASURER authors '75 CC blinding under SOG' and reads it back: the recipe judged by the chest, hotkey 1, nothing measured yet", async () => {
    await openStage();
    const measurer = await enrol("chest-author");
    const projectId = projectFor(measurer, "Chest — author", MEASURER);
    const door = await doorFor(measurer);

    const empty = await door.list({ projectId });
    expect(empty.conditions, "a new project's chest holds nothing").toEqual([]);
    expect(empty.canAuthor, "a MEASURER may author").toBe(true);
    const polygon = empty.catalogue.find((entry) => entry.geometry === "POLYGON");
    expect(polygon?.classes, "the form offers what MANUAL_RULES pairs with an area, and the reading the rule takes from the recipe").toEqual([
      { elementClass: "slab", colour: "slab", kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding.area", readings: [expect.objectContaining({ attribute: "t", dimension: "LENGTH" })] }] },
    ]);
    expect(polygon?.classes[0]?.kinds[0]?.readings[0]?.units, "a thickness is stated in a unit of length").toContain("mm");

    const { conditionId } = await door.author({ projectId, condition: blinding({ name: "  75 CC blinding under SOG  " }) });
    const chest = await door.list({ projectId });
    expect(chest.conditions).toEqual([
      {
        conditionId,
        name: "75 CC blinding under SOG",
        geometry: "POLYGON",
        elementClass: "slab",
        kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding.area" }],
        readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm", basis: "ENTERED", sourceKey: null }],
        colour: "slab",
        hatch: "diagonal",
        hotkey: 1,
        measured: 0,
        billed: 0,
        totals: [],
      },
    ]);
    expect(countOf("conditions", `project_id = '${projectId}'::uuid and authored_by = '${measurer.userId}'::uuid`), "written as the person who stated it").toBe(1);
  }, BUDGET_MS);

  test("refuses by name: a name a standing condition holds, a kind the class does not bear, a kind no manual method measures from the shape — and writes nothing", async () => {
    await openStage();
    const measurer = await enrol("chest-refusals");
    const projectId = projectFor(measurer, "Chest — refusals", MEASURER);
    const door = await doorFor(measurer);
    await door.author({ projectId, condition: blinding() });

    expect(await refusalFrom(() => door.author({ projectId, condition: blinding({ hatch: "cross" }) }), "a second '75 CC blinding under SOG'"), "one standing condition per name").toBe(await code("CONDITION_NAME_TAKEN"));
    expect(await refusalFrom(() => door.author({ projectId, condition: blinding({ name: "Bored piles", kinds: ["piling.bored"] }) }), "a slab measured for bored piles"), "a slab bears no bored pile (L-MEA-04)").toBe(
      await code("CONDITION_KIND_NOT_BORNE"),
    );
    expect(
      await refusalFrom(() => door.author({ projectId, condition: blinding({ name: "SOG 125", kinds: ["rcc.concrete"], readings: [] }) }), "a slab's concrete by hand"),
      "a slab bears concrete, but no manual method measures it from an outline yet (I-539)",
    ).toBe(await code("CONDITION_KIND_NOT_OFFERED"));
    expect(await refusalFrom(() => door.author({ projectId, condition: blinding({ name: "Blinding, thin", readings: [{ attribute: "t", valueAsWritten: "seventy", unitAsWritten: "mm" }] }) }), "a thickness that is no number")).toBe(
      await code("READING_NOT_NUMERIC"),
    );
    expect(countOf("conditions", `project_id = '${projectId}'::uuid`), "only the first condition was written").toBe(1);
  }, BUDGET_MS);

  test("answers a statement it cannot read with REQUEST_MALFORMED: a blank name, a colour off the palette, a missing or an extra reading, a reading in a unit of area, a size of nothing", async () => {
    await openStage();
    const measurer = await enrol("chest-malformed");
    const projectId = projectFor(measurer, "Chest — malformed", MEASURER);
    const door = await doorFor(measurer);
    const malformed = await code("REQUEST_MALFORMED");
    const cases: [string, Record<string, unknown>][] = [
      ["a blank name", blinding({ name: "   " })],
      ["a colour off the palette", blinding({ colour: "copper" })],
      ["no thickness", blinding({ readings: [] })],
      ["a reading the rule does not take", blinding({ readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm" }, { attribute: "d", valueAsWritten: "600", unitAsWritten: "mm" }] })],
      ["a thickness in square metres", blinding({ readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "m2" }] })],
      ["a thickness of nothing", blinding({ readings: [{ attribute: "t", valueAsWritten: "0", unitAsWritten: "mm" }] })],
      ["no kind at all", blinding({ kinds: [] })],
    ];
    for (const [what, condition] of cases) expect(await refusalFrom(() => door.author({ projectId, condition }), what), what).toBe(malformed);
    expect(await refusalFrom(() => door.retire({ projectId, conditionId: "not-an-id" }), "a retire naming no id")).toBe(malformed);
    expect(countOf("conditions", `project_id = '${projectId}'::uuid`), "nothing was written").toBe(0);
  }, BUDGET_MS);

  test("a REVIEWER reads the chest read-only and is refused PERMISSION_NOT_HELD at author and retire; a person on no role of the project reads nothing", async () => {
    await openStage();
    const owner = await enrol("chest-owner");
    const projectId = projectFor(owner, "Chest — roles", MEASURER);
    const { conditionId } = await (await doorFor(owner)).author({ projectId, condition: blinding() });
    const permission = await code("PERMISSION_NOT_HELD");

    // A reviewer on the same project, in the same workspace.
    const reviewer = await enrol("chest-reviewer");
    sql(
      `insert into memberships (${ident(TENANT_COLUMN)}, user_id) values (${lit(owner.tenantId)}, ${lit(reviewer.userId)}) on conflict do nothing;
       insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id) values (${lit(owner.tenantId)}, ${lit(projectId)}, ${lit(reviewer.userId)}) on conflict do nothing;
       insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role) values (${lit(owner.tenantId)}, ${lit(projectId)}, ${lit(reviewer.userId)}, ${lit(REVIEWER)}) on conflict do nothing;`,
    );
    const door = await doorFor(reviewer);
    const chest = await door.list({ projectId });
    expect(chest.conditions.map((condition) => condition.name), "a participant reads what the chest holds").toEqual(["75 CC blinding under SOG"]);
    expect(chest.canAuthor, "and is told the chest is read-only for them (§3's permission-denied cell)").toBe(false);
    expect(await refusalFrom(() => door.author({ projectId, condition: blinding({ name: "Another" }) }), `a ${REVIEWER} authoring`)).toBe(permission);
    expect(await refusalFrom(() => door.retire({ projectId, conditionId }), `a ${REVIEWER} retiring`)).toBe(permission);
    expect(countOf("conditions", `project_id = '${projectId}'::uuid and retired_at is null`), "the refused doors wrote nothing").toBe(1);

    // A stranger — a workspace of their own, on no role of this project.
    const stranger = await enrol("chest-stranger");
    const refused = await refusalFrom(() => doorFor(stranger).then((strangers) => strangers.list({ projectId })), "a stranger reading the chest");
    expect(refused === permission || refused === (await code("WORKSPACE_PERMISSION_NOT_HELD")), `a stranger reads nothing, refused by name (answered ${String(refused)})`).toBe(true);
  }, BUDGET_MS);

  test("a condition leaves the chest by being retired, once; its name is free again; another project's condition cannot be retired from this one", async () => {
    await openStage();
    const measurer = await enrol("chest-retire");
    const projectId = projectFor(measurer, "Chest — retire", MEASURER);
    const otherProject = projectFor(measurer, "Chest — other", MEASURER);
    const door = await doorFor(measurer);
    const { conditionId } = await door.author({ projectId, condition: blinding() });
    const { conditionId: second } = await door.author({ projectId, condition: blinding({ name: "100 CC blinding under footings" }) });
    expect((await door.list({ projectId })).conditions.map((condition) => [condition.name, condition.hotkey]), "hotkeys are the chest's order").toEqual([
      ["75 CC blinding under SOG", 1],
      ["100 CC blinding under footings", 2],
    ]);
    const notInChest = "CONDITION_NOT_IN_CHEST";
    expect(await code(notInChest), "the register publishes the chest's own refusal for a condition it does not hold").toBe(notInChest);
    expect(await refusalFrom(() => door.retire({ projectId: otherProject, conditionId }), "retiring it from another project"), "another project's chest holds no such condition").toBe(notInChest);

    expect(await door.retire({ projectId, conditionId })).toEqual({ retired: true });
    expect(await refusalFrom(() => door.retire({ projectId, conditionId }), "retiring it again"), "it is no longer in the chest").toBe(notInChest);
    expect((await door.list({ projectId })).conditions.map((condition) => [condition.conditionId, condition.hotkey]), "the rest move up a digit").toEqual([[second, 1]]);
    expect(countOf("conditions", `condition_id = '${conditionId}'::uuid and retired_by = '${measurer.userId}'::uuid`), "retired, by whom — never deleted").toBe(1);
    await door.author({ projectId, condition: blinding() });
    expect((await door.list({ projectId })).conditions.map((condition) => condition.name), "a retired condition's name is free for a new one").toEqual(["100 CC blinding under footings", "75 CC blinding under SOG"]);
  }, BUDGET_MS);
});

describe("the chest's running totals are the campaign's own lines", () => {
  let staging: Promise<ManualWorld> | undefined;
  const staged = (): Promise<ManualWorld> => (staging ??= stageManualWorld("chest", 93));

  test("a standing measurement citing the condition counts as measured; a COMPLETE line of it is totalled per kind; a struck one counts for nothing", async () => {
    const world = await staged();
    const door = await doorFor(world.person as unknown as { cookie: string });
    const { conditionId } = await door.author({ projectId: world.projectId, condition: blinding() });

    const { consequence } = await performAct(actorOf(world.person), tracing(world, { recipe: { ...blindingRecipe(), conditionId } }));
    const objectKey = (consequence as { measurement?: { objectKey: string } }).measurement?.objectKey ?? "";
    expect(objectKey, "the measurement registered a row").not.toBe("");
    const measuredOnly = (await door.list({ projectId: world.projectId })).conditions[0];
    expect([measuredOnly?.measured, measuredOnly?.billed, measuredOnly?.totals], "measured, not billed: the gate has published no line of it yet, and nothing is totalled").toEqual([1, 0, []]);

    // The line the gate would publish for it — written under the stage's system reason, as the gate
    // would publish it; the chest must total what the campaign holds and nothing else.
    const { campaignId } = campaignOf(world);
    sql(
      `insert into quantity_lines (tenant_id, campaign_id, project_id, set_revision_id, object_key, drawing_id, view_key, class, kind, rule_id, rule_version,
                                   edition_digest, engine, quantity_basis, selection_basis, coverage, value, unit, formula, bindings, selectors, deductions, omitted, calibration_keys)
       select c.tenant_id, c.campaign_id, c.project_id, c.set_revision_id, '${objectKey}', '${world.drawingId}'::uuid, 'v:manual', 'slab', 'pcc.blinding', 'pcc.blinding.area', '1',
              c.edition_digest, 'VECTOR', 'MEASURED', 'MEASURED', 'COMPLETE', 0.1125, 'm3', 'count × (A − openings − junctions) × t', '{}', '{}', '[]', '[]', '[]'
         from campaigns c where c.campaign_id = '${campaignId}'::uuid;`,
    );
    const billed = (await door.list({ projectId: world.projectId })).conditions[0];
    expect([billed?.measured, billed?.billed, billed?.totals], "billed, and the kind's total is the line's own figure").toEqual([1, 1, [{ kind: "pcc.blinding", unit: "m3", value: "0.1125" }]]);

    await performAct(actorOf(world.person), { type: REPUDIATE, projectId: world.projectId, objectKey });
    const struck = (await door.list({ projectId: world.projectId })).conditions[0];
    expect([struck?.measured, struck?.billed, struck?.totals], "a struck measurement stands for nothing in the chest").toEqual([0, 0, []]);
  }, BUDGET_MS);
});
