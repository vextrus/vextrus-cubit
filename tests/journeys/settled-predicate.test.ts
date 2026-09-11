// AM-09 §4 — what "settled" MEANS, judged as data.
//
// `settled(page)` is two parts: one reading taken in the browser, and one predicate over that
// reading. The predicate is the part that can be wrong in a way no journey would notice — a
// tolerance that silently passes everything, a missing case that blocks forever — and it is the part
// that needs no browser to judge. So it is a pure function of a plain object (`settleFault`), and
// this suite is its truth table. Nothing here starts Playwright.
//
// The tolerance is the point of half these cases. Screen roots and virtualised tables have not
// adopted their attributes yet (src/ui and src/modules belong to other nodes this week), so the wait
// must hold for the elements that EXIST and never for the ones that do not — and it must get
// stricter for free the day they arrive, rather than needing an edit.
import { describe, expect, test } from "vitest";
import { SETTLE_CONTRACT, settleFault, UNSETTLED_STATES, type SettleReading } from "../e2e/support/settled";

/** A screen that has arrived: fonts in, nothing busy, nothing moving, nothing published. */
const SETTLED: SettleReading = { fontsStatus: "loaded", busy: 0, screenRoots: [], tables: [], running: 0, endless: 0 };

/** @returns that same screen with one thing changed. */
function reading(patch: Partial<SettleReading>): SettleReading {
  return { ...SETTLED, ...patch };
}

describe("settleFault: the predicate settled() polls", () => {
  test("a screen with nothing left to do is settled", () => {
    expect(settleFault(SETTLED)).toBeNull();
  });

  test("a face that has not arrived holds the screen", () => {
    expect(settleFault(reading({ fontsStatus: "loading" }))).toContain("document.fonts.status");
  });

  test("anything still aria-busy holds the screen, and the fault names the selector", () => {
    const fault = settleFault(reading({ busy: 2 }));
    expect(fault).toContain("2 element(s)");
    expect(fault).toContain(SETTLE_CONTRACT.busy);
  });

  test.each(UNSETTLED_STATES)("a screen root publishing %j is not settled", (state) => {
    expect(settleFault(reading({ screenRoots: [state] }))).toContain(SETTLE_CONTRACT.screenState);
  });

  test("a screen root that has not adopted the attribute at all is not settled", () => {
    expect(settleFault(reading({ screenRoots: [null] }))).toContain("absent");
  });

  test("a screen root past its loading state is settled", () => {
    expect(settleFault(reading({ screenRoots: ["ready", "empty", "denied"] }))).toBeNull();
  });

  test("one unsettled root among settled ones still holds the screen", () => {
    const fault = settleFault(reading({ screenRoots: ["ready", "loading", "ready"] }));
    expect(fault).toContain("1 of 3");
  });

  test("a virtualised table that has not published its row count is not settled", () => {
    expect(settleFault(reading({ tables: [null] }))).toContain(SETTLE_CONTRACT.rowsRendered);
  });

  test("a table that has painted no rows IS settled — zero is a count", () => {
    expect(settleFault(reading({ tables: ["0"] }))).toBeNull();
  });

  test("a row count that is not a number is not a count", () => {
    expect(settleFault(reading({ tables: ["", "many"] }))).toContain(SETTLE_CONTRACT.rowsRendered);
  });

  test("a running animation holds the screen", () => {
    expect(settleFault(reading({ running: 1 }))).toContain("still running");
  });

  test("an endless animation does NOT hold the screen — a skeleton pulse has no settled moment", () => {
    // core.css's `cx-skeleton-pulse` runs `infinite`, and the gallery renders a bone deliberately.
    // Blocking on one would hang every checkpoint on every screen that shows a bone; a bone that is
    // still on screen is caught by aria-busy and by the screen root's state instead.
    expect(settleFault(reading({ endless: 3 }))).toBeNull();
  });

  test("THE TOLERANCE: a tree that publishes neither contract is settled on the rest", () => {
    // This is what makes settled() landable against today's src/ui, and it is deliberately narrow:
    // the empty list is what is tolerated, never an element that exists and stays silent.
    expect(settleFault(reading({ screenRoots: [], tables: [] }))).toBeNull();
    expect(settleFault(reading({ screenRoots: [null], tables: [] }))).not.toBeNull();
    expect(settleFault(reading({ screenRoots: [], tables: [null] }))).not.toBeNull();
  });

  test("the fault names the first unmet condition, in the order they are checked", () => {
    const everything = reading({ fontsStatus: "loading", busy: 4, screenRoots: [null], tables: [null], running: 9 });
    expect(settleFault(everything)).toContain("document.fonts.status");
    expect(settleFault({ ...everything, fontsStatus: "loaded" })).toContain(SETTLE_CONTRACT.busy);
  });

  test("the contract names the four selectors src/ui has to publish", () => {
    expect(SETTLE_CONTRACT).toEqual({
      busy: '[aria-busy="true"]',
      screenRoot: "[data-screen-root]",
      screenState: "data-state",
      virtualTable: "[data-virtualised]",
      rowsRendered: "data-rows-rendered",
    });
  });
});
