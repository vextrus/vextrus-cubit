// V-E2E's settle marker (AM-09 §4, Design Direction 00 §9.3). A checkpoint judges the screen a
// reader stands on, which means the SETTLED screen — so every axe run and every capture waits here
// first, and the wait is a RETRYING one. `waitForTimeout` is unlawful in this lane: a sleep is a
// guess that is either too short (a flake) or too long (the 6 s tax the old checkpoint paid on
// every green page). This module states what "settled" MEANS as data, reads it out of the page in
// one `evaluate`, and polls that reading until the predicate holds.
//
// THE CONTRACT THIS FILE DEFINES, AND WHO PUBLISHES IT
// ----------------------------------------------------
// settled() cannot make a screen announce itself; it can only read what the screen publishes. The
// four things it reads are named once, here, in `SETTLE_CONTRACT`, and src/ui + src/modules adopt
// them. Until an element adopts its attribute the wait is TOLERANT: it waits on the elements that
// exist and never on the ones that do not, so this file lands green against today's tree and gets
// stricter for free as the publishing side arrives. A screen that publishes nothing is settled the
// moment its fonts, its busy flags and its animations are — which is exactly today's behaviour.
import { expect, type Page } from "@playwright/test";

/** The selectors and attributes the product publishes for this lane. One home (ARCH-02). */
export const SETTLE_CONTRACT = Object.freeze({
  /** An element that is still working. Anything wearing it holds the screen unsettled. */
  busy: '[aria-busy="true"]',
  /** A screen's outermost element. It publishes what it is showing through `state`. */
  screenRoot: "[data-screen-root]",
  /** What a screen root is showing (R-UI-050's vocabulary). Empty or "loading" is not settled. */
  screenState: "data-state",
  /** A table that renders a window over its rows rather than all of them. */
  virtualTable: "[data-virtualised]",
  /** How many rows that table has actually put in the DOM. Absent means it has not painted yet. */
  rowsRendered: "data-rows-rendered",
});

/** A `data-state` value that means the screen is still arriving, not that it has arrived. */
export const UNSETTLED_STATES: readonly string[] = Object.freeze(["", "loading", "pending"]);

/** One reading of the page, taken in the browser and judged in node. Plain JSON, so it is testable. */
export interface SettleReading {
  /** `document.fonts.status` — "loaded" once every face the frame needs has arrived. */
  readonly fontsStatus: string;
  /** How many elements wear `aria-busy="true"`. */
  readonly busy: number;
  /** Every screen root that EXISTS, and the `data-state` it publishes (null when it has none). */
  readonly screenRoots: readonly (string | null)[];
  /** Every virtualised table that EXISTS, and the row count it publishes (null when it has none). */
  readonly tables: readonly (string | null)[];
  /** Running animations with a finite end — the ones that will stop on their own. */
  readonly running: number;
  /**
   * Running animations that never end (the skeleton pulse, `core.css`). They are NOT waited on:
   * an infinite animation has no settled moment, so blocking on one would hang every checkpoint on
   * every screen that renders a bone — the gallery renders one deliberately. A bone that is still
   * on screen is caught by `aria-busy` and by the screen root's `data-state` instead, which is the
   * signal that actually means "still arriving". This count is carried so a reader of a failure can
   * see what was moving.
   */
  readonly endless: number;
}

/**
 * Why this reading is not settled yet — or `null` when it is. One sentence, naming what was still
 * moving, because a settle timeout that says only "timed out" costs a session to diagnose.
 */
export function settleFault(reading: SettleReading): string | null {
  if (reading.fontsStatus !== "loaded") return `document.fonts.status is "${reading.fontsStatus}", not "loaded"`;
  if (reading.busy > 0) return `${reading.busy} element(s) still wear ${SETTLE_CONTRACT.busy}`;
  const blank = reading.screenRoots.filter((state) => state === null || UNSETTLED_STATES.includes(state));
  if (blank.length > 0) {
    return `${blank.length} of ${reading.screenRoots.length} screen root(s) publish no settled ${SETTLE_CONTRACT.screenState} (saw ${blank.map((state) => (state === null ? "absent" : `"${state}"`)).join(", ")})`;
  }
  const unpainted = reading.tables.filter((rows) => rows === null || !/^\d+$/.test(rows));
  if (unpainted.length > 0) {
    return `${unpainted.length} of ${reading.tables.length} virtualised table(s) publish no ${SETTLE_CONTRACT.rowsRendered} count (saw ${unpainted.map((rows) => (rows === null ? "absent" : `"${rows}"`)).join(", ")})`;
  }
  if (reading.running > 0) return `${reading.running} animation(s)/transition(s) still running`;
  return null;
}

/** How long a screen is given to settle before the wait is a failure with a named cause. */
export const SETTLE_TIMEOUT_MS = 15_000;

/**
 * Wait until the screen has stopped arriving. Retrying only: one `expect.poll` over one `evaluate`,
 * no sleeps, and a failure message that names what was still moving (B-19 — a flake is a defect
 * with a cause).
 */
export async function settled(page: Page, timeout: number = SETTLE_TIMEOUT_MS): Promise<void> {
  // The face load is a promise the browser already holds, so it is awaited once rather than polled.
  // Everything after it is a reading that can change under us, so everything after it is polled.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect
    .poll(async () => settleFault(await readSettle(page)), {
      timeout,
      message: `settled(): the screen never stopped arriving within ${timeout} ms`,
    })
    .toBeNull();
}

/** One reading, taken in the page. Exported so a diagnosis can print what settled() was looking at. */
export async function readSettle(page: Page): Promise<SettleReading> {
  return await page.evaluate((contract) => {
    const animations = document.getAnimations();
    const live = animations.filter((animation) => animation.playState === "running");
    const endless = live.filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return timing === undefined || timing.iterations === Infinity || timing.endTime === Infinity;
    });
    return {
      fontsStatus: document.fonts.status as string,
      busy: document.querySelectorAll(contract.busy).length,
      screenRoots: [...document.querySelectorAll(contract.screenRoot)].map((element) => element.getAttribute(contract.screenState)),
      tables: [...document.querySelectorAll(contract.virtualTable)].map((element) => element.getAttribute(contract.rowsRendered)),
      running: live.length - endless.length,
      endless: endless.length,
    };
  }, SETTLE_CONTRACT);
}
