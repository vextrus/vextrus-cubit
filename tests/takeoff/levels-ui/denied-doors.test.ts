// @vitest-environment jsdom
/**
 * AC-3's screen half — a door whose permission the reader lacks RENDERS, disabled, naming the
 * permission, while the stack reads on in full (R-UI-050's permission-denied, I-247).
 *
 * The pairs are the Design Decision's own: `levels-insert` and `levels-repudiate` need
 * AUTHOR_LEVEL_STACK, `levels-author-height` needs AUTHOR_PROJECT_FACT, `levels-author-range` needs
 * MEASURE. What is judged is that each door STATES the permission it wants and refuses the press —
 * never that it vanished, which teaches a reader nothing about what to ask for.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  AUTHOR_LEVEL_STACK,
  AUTHOR_PROJECT_FACT,
  ENTERED,
  MEASURE,
  RCC_CONCRETE,
  TESTID,
  TRANSCRIBED,
  attr,
  cleanup,
  doorBank,
  fireEvent,
  hook,
  hooks,
  levelFixture,
  mountLevels,
  rollup,
  unstatedRange,
  viewFixture,
  type LevelsViewShape,
} from "./support/levels-ui-view";

afterEach(() => {
  cleanup();
});

/** The three doors of the tabs row and the rail, and the permission each one needs. */
const DOORS: readonly { testid: string; permission: string }[] = Object.freeze([
  { testid: TESTID.insert, permission: AUTHOR_LEVEL_STACK },
  { testid: TESTID.authorHeight, permission: AUTHOR_PROJECT_FACT },
  { testid: TESTID.authorRange, permission: MEASURE },
]);

async function viewOf(): Promise<LevelsViewShape> {
  return viewFixture({
    stack: [
      await levelFixture({
        label: "GF",
        ordinal: 0,
        readings: [{ basis: TRANSCRIBED, sourceKey: "S-102:e:7", value: "3048", unit: "mm" }],
        rollups: [rollup({ kind: RCC_CONCRETE, lines: 2, value: "1.2" })],
      }),
      await levelFixture({ label: "L1", ordinal: 1 }),
    ],
    unstatedRanges: [unstatedRange({ viewKey: "PLAN:S-102:t:4" })],
  });
}

describe("AC-3: a door whose permission the reader lacks renders, disabled, naming it", () => {
  test("AC-3: each door states its own permission and is disabled while the reader holds none", async () => {
    const view = await viewOf();
    const bank = doorBank({ actType: ENTERED });
    const mounted = await mountLevels({
      view,
      level: (view.stack[0] as { levelId: string }).levelId,
      permitted: { [AUTHOR_LEVEL_STACK]: false, [AUTHOR_PROJECT_FACT]: false, [MEASURE]: false },
      doors: bank,
    });

    for (const shut of DOORS) {
      const element = hook(mounted.container, shut.testid);
      expect(attr(element, "aria-disabled"), `${shut.testid} renders and refuses the press, rather than vanishing (I-247)`).toBe("true");
      expect(attr(element, "data-permission"), `${shut.testid} names the permission that would have carried it`).toBe(shut.permission);
      fireEvent.click(element);
    }
    expect(bank.calls, "and a shut door presses nothing at all").toEqual([]);

    const rows = hooks(mounted.root, TESTID.row);
    expect(rows.length, "while the grid reads in full: a denial shuts the doors, never the stack").toBe(view.stack.length);
    expect(hooks(rows[0] as HTMLElement, TESTID.rollup).length, "roll-ups included").toBe((view.stack[0] as { rollups: unknown[] }).rollups.length);
  });

  test("AC-3: a reader holding one permission keeps that door open and the others shut", async () => {
    const view = await viewOf();
    const mounted = await mountLevels({
      view,
      level: (view.stack[0] as { levelId: string }).levelId,
      permitted: { [AUTHOR_LEVEL_STACK]: true, [AUTHOR_PROJECT_FACT]: false, [MEASURE]: false },
    });

    expect(attr(hook(mounted.container, TESTID.insert), "aria-disabled"), "a door whose permission the reader holds is not disabled").not.toBe("true");
    for (const shut of DOORS.filter((held) => held.permission !== AUTHOR_LEVEL_STACK)) {
      expect(attr(hook(mounted.container, shut.testid), "aria-disabled"), `${shut.testid} stays shut, and says why`).toBe("true");
    }
  });
});
