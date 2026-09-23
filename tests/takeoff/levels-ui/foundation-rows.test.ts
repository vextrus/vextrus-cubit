/**
 * I-433 through the door the screen reads (docs/design/s-levels.md): the reading lays every line
 * the campaign published on exactly one row of the grid — a live level, the Foundation beneath the
 * stack, or the row of lines whose object stands on no live level. Session 8's walk found F-RCC6-BNBC's
 * FDN row reading `26 lines 3.060 m³ 100%` while its 89 piles and 26 caps (about 500 m³) stood in the
 * FOUNDATION slot and on no row at all, because the reading dropped every line whose object carried
 * no surrogate.
 *
 * Live database: the objects are sighted at the register's own door on a real level, in the
 * FOUNDATION slot and under a placeholder no level was authored for; the rail offers them and the
 * gate publishes them; and the reading is asked for as a signed-in person asks for it.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  COLUMN_CLASS,
  COLUMN_CONCRETE_PAIR,
  HEIGHT_SOURCE,
  columnRailDoor,
  gateSeam,
  levelStanding,
  railInput,
  setupForRows,
  stageCampaign,
} from "../rails/support/column-rail-stage";
import { COLUMN_C1, registerSeam } from "../register/support/register-stage";
import { closeStage, door, field, lineRow, linesOf, liveStack, takeoffCaller } from "./support/levels-ui-stage";
import { RCC_CONCRETE } from "./support/levels-ui-view";

const BUDGET_MS = 900_000;

afterAll(async () => {
  await closeStage();
}, 120_000);

/** One roll-up of the answered reading. */
type Answered = { kind: string; lines: number };

function rollupsOf(row: Record<string, unknown>): Answered[] {
  return ((field(row, "rollups", "rollups") ?? []) as Record<string, unknown>[]).map((held) => ({
    kind: String(field(held, "kind", "kind")),
    lines: Number(field(held, "lines", "lines")),
  }));
}

describe("I-433: the levels reading leaves no published line off the grid", () => {
  test("I-433: a line in the FOUNDATION slot rolls up on the Foundation row, one on no live level on the unplaced row", async () => {
    const staged = await stageCampaign("levels-ui-foundation-rows", { methods: [COLUMN_CONCRETE_PAIR], objects: 0 });
    const stack = await liveStack(staged);
    expect(stack.length, `the staged project stands on one level: ${JSON.stringify(stack)}`).toBe(1);
    const bearing = stack[0] as { levelId: string; label: string; ordinal: number };

    /* --- four columns: two on the level, one in the FOUNDATION slot, one under a placeholder --- */
    const register = await registerSeam();
    const sightings: { mark: string; level: Record<string, string> }[] = [
      { mark: "C1", level: { levelId: bearing.levelId } },
      { mark: "C2", level: { levelId: bearing.levelId } },
      { mark: "C3", level: { slot: "FOUNDATION" } },
      { mark: "C4", level: { unregistered: "MEZZ" } },
    ];
    for (const [at, sighting] of sightings.entries()) {
      const answer = await register.registerSighting(staged.registerScope, {
        ...(COLUMN_C1 as unknown as Record<string, unknown>),
        elementType: COLUMN_CLASS,
        label: `foundation-rows-${sighting.mark}`,
        mark: sighting.mark,
        x: 1000 + at * 100,
        level: sighting.level,
      } as never);
      expect(field(answer as Record<string, unknown>, "registered", "registered"), `the sighting of ${sighting.mark} registered: ${JSON.stringify(answer)}`).toBe(true);
    }

    /* --- the rail's offers over them, published by the gate --- */
    const rows = (await register.registerObjectsOf(staged.registerScope)) as unknown as Record<string, unknown>[];
    expect(rows.length, "the four staged rows").toBe(4);
    const setup = setupForRows(rows);
    const rail = await columnRailDoor();
    const offers = rail.columnConcreteRail(
      railInput({
        campaignId: staged.campaignId,
        setRevisionId: staged.setRevisionId,
        objects: rows,
        placements: setup.placements,
        memberTypes: setup.memberTypes,
        calibrations: setup.calibrations,
        levels: [levelStanding({ levelId: bearing.levelId, label: bearing.label, ordinal: bearing.ordinal, value: "3", unit: "M", sourceKey: HEIGHT_SOURCE })],
      }),
    ).offers;
    expect(offers.length, "the rail offers every staged column, on a level or not (L-QTY-02 keeps the row)").toBe(4);
    const gate = await gateSeam();
    const verdict = await gate.evaluateOffers(staged.gateScope, { offers, observations: [] });
    expect(JSON.stringify(verdict.refusals ?? []), "the FOUNDATION slot and a placeholder both publish (I-368)").toBe("[]");
    const published = linesOf(staged).map(lineRow);
    expect(published.length, "four lines stand in the campaign").toBe(4);

    /* --- the reading, as the screen asks for it --- */
    const caller = await takeoffCaller(staged.person);
    const answer = (await door(caller, "levels")({ projectId: staged.projectId })) as Record<string, unknown>;
    const levels = (answer["stack"] ?? []) as Record<string, unknown>[];
    const slots = (answer["slots"] ?? null) as Record<string, unknown>[] | null;
    expect(Array.isArray(slots), `the reading answers the rows that are no level as a list: ${JSON.stringify(answer["slots"])}`).toBe(true);

    const onLevel = levels.flatMap(rollupsOf);
    expect(onLevel, "the level holds its own two columns and nothing else").toEqual([{ kind: RCC_CONCRETE, lines: 2 }]);
    expect(
      (slots ?? []).map((slot) => [String(field(slot, "slot", "slot")), rollupsOf(slot)]),
      "the Foundation's column on its own row, and the placeholder's on the row of lines no live level carries",
    ).toEqual([
      ["FOUNDATION", [{ kind: RCC_CONCRETE, lines: 1 }]],
      ["UNPLACED", [{ kind: RCC_CONCRETE, lines: 1 }]],
    ]);

    const onGrid = [...onLevel, ...(slots ?? []).flatMap(rollupsOf)].reduce((total, held) => total + held.lines, 0);
    expect(onGrid, "every published line stands on exactly one row of the grid").toBe(published.length);
  }, BUDGET_MS);
});
