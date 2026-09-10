/**
 * AC-4 — HOLD_OUT_OF_BILL and DECLARE_NOT_IN_PROJECT_SCOPE are acts with consequences
 * (L-ACT-02, L-ACT-03, R-TO-052, risk notes 1 and 2).
 *
 * The law half is read off the closed rosters themselves — the act types, the permission map and the
 * total ACT_MAP — so a roster that grows is judged as it stands (B-19). The carrying half is driven
 * over a real staged campaign through the takeoff lane's own doors, exactly as a reader presses them,
 * and the cell acted on is taken from the product's OWN residue rather than assumed: the catalogue
 * bears what it bears, and an acceptance that transcribed a kind roster would freeze it.
 *
 * Nothing here reads product source.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACT_CHANGES_NOTHING,
  ACTS_LAW_MODULE,
  ACTS_MODULE,
  ACTS_TABLE,
  PERMISSION_NOT_HELD,
  actIdOf,
  closeStage,
  codeOf,
  door,
  field,
  previewed,
  principalOf,
  productModule,
  rejection,
  rowsOf,
  stagePerson,
  stageRegisterCampaign,
  subjectsOf,
  takeoffCaller,
  type Person,
  type StagedRegisterCampaign,
} from "../register-ui/support/register-ui-stage";
import { grantRole, joinWorkspace } from "../support/sheets-stage";
import { DECLARE_NOT_IN_PROJECT_SCOPE, HOLD_OUT_OF_BILL, QUANTITY_BEARING, RESIDUE_MODULE, SET_BILL_BOUNDARY, levelIdOf, rowsOf as cellsOf, type Cell } from "./support/coverage-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

/** The store the two acts write their one row into (AC-4). */
const SCOPE_DECLARATIONS = "scope_declarations";

/** The role that holds MEASURE and not SET_BILL_BOUNDARY — the boundary is a LEAD's to move. */
const MEASURER = "MEASURER";

/** The two acts, by act type, the rendering ACT_MAP holds them under, and the cause each writes. */
const ACTS: readonly { actType: string; rendering: string; cause: string; preview: string; commit: string }[] = [
  { actType: HOLD_OUT_OF_BILL, rendering: "holdOutOfBill", cause: "NOT_IN_THIS_BILL", preview: "previewHoldOutOfBill", commit: "commitHoldOutOfBill" },
  { actType: DECLARE_NOT_IN_PROJECT_SCOPE, rendering: "declareNotInProjectScope", cause: "NOT_IN_PROJECT_SCOPE", preview: "previewDeclareNotInProjectScope", commit: "commitDeclareNotInProjectScope" },
];

afterAll(async () => {
  await closeStage();
}, 120_000);

let staging: Promise<StagedRegisterCampaign> | undefined;
const staged = (): Promise<StagedRegisterCampaign> => (staging ??= stageRegisterCampaign("coverage"));

/** A second person on the project holding MEASURER and nothing else (AC-4's denial). */
async function stageMeasurer(campaign: StagedRegisterCampaign): Promise<Person> {
  const { person } = await stagePerson(`measurer-${campaign.projectId.slice(0, 8)}`);
  joinWorkspace(campaign.tenantId, person.userId);
  grantRole(campaign.tenantId, campaign.projectId, person.userId, MEASURER);
  return person;
}

/**
 * The cell the acts are carried over, taken from the product's own residue: the first cell the
 * campaign left unmeasured, or — where the catalogue bears nothing else — the cell it measured, over
 * which a declaration still stands and is beaten by arm order (risk note 3).
 */
async function cellOf(campaign: StagedRegisterCampaign): Promise<{ class: string; kind: string; levelId: string }> {
  const residue = await productModule<{ residueOf?: (scope: { tenantId: string; projectId: string; campaignId: string }) => Promise<unknown> }>(RESIDUE_MODULE);
  expect(typeof residue.residueOf, `${RESIDUE_MODULE} publishes \`residueOf\` — the campaign's residue, read as a query (the increment's interfaces)`).toBe("function");
  const cells = cellsOf(await (residue.residueOf as (scope: { tenantId: string; projectId: string; campaignId: string }) => Promise<unknown>)({ tenantId: campaign.tenantId, projectId: campaign.projectId, campaignId: campaign.campaignId }), "residueOf");

  const grid = cells.filter((cell: Cell) => (cell["class"] ?? null) !== null);
  expect(grid.length, "the staged campaign's residue bears cells of the borne grid to act over").toBeGreaterThan(0);
  const chosen = (grid.find((cell: Cell) => cell["measurement"] !== QUANTITY_BEARING) ?? grid[0]) as Cell;
  return { class: String(chosen["class"]), kind: String(chosen["kind"]), levelId: String(levelIdOf(chosen)) };
}

function input(actType: string, campaign: StagedRegisterCampaign, cell: { class: string; kind: string; levelId: string }): Record<string, unknown> {
  return { type: actType, projectId: campaign.projectId, campaignId: campaign.campaignId, class: cell.class, kind: cell.kind, levelId: cell.levelId };
}

/** Every declaration row this workspace holds. */
function declarations(tenantId: string): Record<string, unknown>[] {
  return rowsOf(SCOPE_DECLARATIONS, tenantId) as Record<string, unknown>[];
}

describe("AC-4 — the two acts join the closed law", () => {
  test("AC-4: both are act types, both move SET_BILL_BOUNDARY, and both are rendered as preview/commit pairs", async () => {
    const law = await productModule<{ ACT_TYPES: readonly string[]; ACT_PERMISSION: Readonly<Record<string, string>>; ROLE_PERMISSIONS: Readonly<Record<string, readonly string[]>> }>(ACTS_LAW_MODULE);
    const acts = await productModule<{ ACT_MAP: Readonly<Record<string, { preview?: unknown; commit?: unknown }>> }>(ACTS_MODULE);

    for (const { actType, rendering } of ACTS) {
      expect(law.ACT_TYPES, `${actType} is a member of the closed act-type enum (L-ACT-03)`).toContain(actType);
      expect(law.ACT_PERMISSION[actType], `${actType} cuts on ${SET_BILL_BOUNDARY} — the boundary a LEAD sets, never a new permission (risk note 1)`).toBe(SET_BILL_BOUNDARY);
      expect(typeof acts.ACT_MAP[actType]?.preview, `${actType} is rendered in ACT_MAP as \`${rendering}\`, with a preview (L-ACT-02: a type without a rendering is a compile error)`).toBe("function");
      expect(typeof acts.ACT_MAP[actType]?.commit, `and a commit beside it`).toBe("function");
    }

    expect(law.ROLE_PERMISSIONS["LEAD"], `${SET_BILL_BOUNDARY} is held by the LEAD`).toContain(SET_BILL_BOUNDARY);
    expect(law.ROLE_PERMISSIONS[MEASURER], `and not by a ${MEASURER}, which is what makes AC-4's denial a denial`).not.toContain(SET_BILL_BOUNDARY);
  });

  test("AC-4: the two act modules publish the renderings ACT_MAP holds them under", async () => {
    for (const { rendering } of ACTS) {
      const module = await productModule<Record<string, unknown>>(`src/core/acts/${rendering === "holdOutOfBill" ? "hold-out-of-bill" : "declare-not-in-project-scope"}.ts`);
      const held = module[rendering] as { preview?: unknown; commit?: unknown } | undefined;
      expect(typeof held?.preview, `the act module publishes \`${rendering}\` with its own preview (the increment's interfaces)`).toBe("function");
      expect(typeof held?.commit, `and its own commit — the pair L-ACT-02 asks for`).toBe("function");
    }
  });
});

describe("AC-4 — each act previews a cell, carries one declaration row, and refuses a repeat", () => {
  test.each(ACTS)("AC-4: $actType names the cell it moves, writes one $cause row with its act, and refuses the same ask twice", async ({ actType, cause, preview, commit }) => {
    const campaign = await staged();
    const caller = await takeoffCaller(principalOf(campaign));
    const cell = await cellOf(campaign);
    const asked = input(actType, campaign, cell);
    const before = declarations(campaign.tenantId).length;

    /* --- the preview: a Consequence that names the cell, with what it reads before and after --- */
    const shown = previewed(await door(caller, preview)({ input: asked }), `takeoff.${preview}`);
    expect(shown.consequence["actType"], `the Consequence answers under ${actType}`).toBe(actType);
    const subjects = subjectsOf(shown.consequence);
    expect(subjects.length, "one cell, one subject — a declaration is one act over one cell (out of scope: bulk)").toBe(1);

    const subject = subjects[0] as { subjectId: string; before: string[]; after: string[] };
    const said = `${subject.subjectId} ${subject.before.join(" ")} ${subject.after.join(" ")}`;
    for (const part of [cell.kind, cell.class]) expect(said, `the subject names the cell this act moves — ${part} is not in ${said}`).toContain(part);
    expect(subject.before.length, "and states what the cell reads today").toBeGreaterThan(0);
    expect(subject.after.length, "and what it will read once this is carried (L-ACT-02)").toBeGreaterThan(0);
    expect(subject.after.join(" "), `whose after-reading is this act's own cause, ${cause}`).toContain(cause);

    /* --- the commit: one row, in the same transaction as the act it cites --- */
    const actId = actIdOf(await door(caller, commit)({ input: asked, consequenceDigest: shown.consequenceDigest }), `takeoff.${commit}`);
    const written = declarations(campaign.tenantId).filter((row) => String(field(row, "actId", "act_id")) === actId);
    expect(written.length, `${actType} writes exactly one ${SCOPE_DECLARATIONS} row, carrying the act that declared it`).toBe(1);
    expect(declarations(campaign.tenantId).length - before, "and one row in all — nothing else is written on the way").toBe(1);

    const row = written[0] as Record<string, unknown>;
    expect(String(field(row, "tenantId", "tenant_id")), "the row is scoped to the workspace it was declared in (SEAM-TENANT)").toBe(campaign.tenantId);
    expect(String(field(row, "projectId", "project_id")), "and to the project").toBe(campaign.projectId);
    expect(String(field(row, "campaignId", "campaign_id")), "and to the campaign whose residue it answers for").toBe(campaign.campaignId);
    expect(String(field(row, "class", "class")), "and it names the cell's class").toBe(cell.class);
    expect(String(field(row, "kind", "kind")), "its kind").toBe(cell.kind);
    expect(String(field(row, "levelId", "level_id")), "and its level").toBe(cell.levelId);
    expect(String(field(row, "cause", "cause")), `under this act's own cause on its own axis (risk note 2)`).toBe(cause);
    expect(String(field(row, "inForce", "in_force")), "standing in force, which is the only way it is ever written here (recorded IOU)").toMatch(/^(?:true|t|1)$/iu);

    const acts = rowsOf(ACTS_TABLE, campaign.tenantId).filter((held) => String(field(held as Record<string, unknown>, "actId", "act_id")) === actId);
    expect(acts.length, "and the act row it cites is in the ledger — the declaration and the act land together or not at all").toBe(1);
    expect(String(field(acts[0] as Record<string, unknown>, "actType", "act_type")), `under ${actType}`).toBe(actType);

    /* --- and the same ask again changes nothing --- */
    const again = previewed(await door(caller, preview)({ input: asked }), `takeoff.${preview}`).consequenceDigest;
    const refused = await rejection(door(caller, commit)({ input: asked, consequenceDigest: again }));
    expect(await codeOf(refused), `a second identical declaration over the same cell asks for what already stands, and is refused ${ACT_CHANGES_NOTHING}`).toBe(ACT_CHANGES_NOTHING);
    expect(declarations(campaign.tenantId).length - before, "and writes no second row").toBe(1);
  }, BUDGET_MS);
});

describe("AC-4 — the boundary is a permission, and a MEASURER does not hold it", () => {
  test.each(ACTS)("AC-4: a MEASURER asking for $actType is refused PERMISSION_NOT_HELD, naming the act", async ({ actType, preview }) => {
    const campaign = await staged();
    const measurer = await stageMeasurer(campaign);
    const caller = await takeoffCaller(measurer);
    const cell = await cellOf(campaign);
    const before = declarations(campaign.tenantId).length;

    const refused = (await rejection(door(caller, preview)({ input: input(actType, campaign, cell) }))) as Error;
    expect(await codeOf(refused), `${SET_BILL_BOUNDARY} is not a ${MEASURER}'s to move, and the refusal is the registered one`).toBe(PERMISSION_NOT_HELD);
    expect(`${refused.message} ${JSON.stringify(refused)}`, "which names the act type that was asked for, so a reader learns what they were refused").toContain(actType);
    expect(declarations(campaign.tenantId).length, "and nothing is written").toBe(before);
  }, BUDGET_MS);
});

describe("AC-4 — the four doors the screen presses are on the wire", () => {
  test("AC-4: the takeoff lane answers at every procedure this screen's acts are carried through", async () => {
    const campaign = await staged();
    const caller = await takeoffCaller(principalOf(campaign));

    for (const { preview, commit } of ACTS) {
      expect(typeof door(caller, preview), `takeoff.${preview} is on the wire (test contract)`).toBe("function");
      expect(typeof door(caller, commit), `takeoff.${commit} is on the wire (test contract)`).toBe("function");
    }
  }, BUDGET_MS);
});
