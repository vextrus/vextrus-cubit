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
import { expect, type Locator, type Page } from "@playwright/test";

/** The selectors and attributes the product publishes for this lane. One home (ARCH-02). */
export const SETTLE_CONTRACT = Object.freeze({
  /** An element that is still working. Anything wearing it holds the screen unsettled. */
  busy: '[aria-busy="true"]',
  /** A screen's outermost element. It publishes what it is showing through `state`. */
  screenRoot: "[data-screen-root]",
  /** What a screen root is showing (R-UI-050's vocabulary). Empty or "loading" is not settled. */
  screenState: "data-state",
  /**
   * A REGION that publishes its own rendered state the way a screen root does — a list, a panel, a
   * grid that a journey reads a count or a label out of (v22 speed, decision 3). It is a marker of
   * its own rather than a bare `data-state`, because `data-state` is Radix's word too: a menu wears
   * `data-state="open"`, and a read that climbed to the nearest `data-state` would take a popover's
   * openness for a list's having rendered. Wearing this attribute is a region SAYING that its
   * `data-state` is the rendered contract.
   */
  region: "[data-rendered-region]",
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
  /** `<img>` elements that have not finished loading. A decoded one is not counted. */
  readonly imagesLoading: number;
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
  const unrendered = renderedFault(reading);
  if (unrendered !== null) return unrendered;
  // The images sit on the CAPTURE path, not on the rendered-state one: a retrying read of a row
  // count owes the table's own publication and no more (see `renderedFault` below), while a picture
  // owes every pixel it is about to photograph. `sheet-card.tsx` and `auth-frame.tsx` render raw
  // `<img>` and nothing read their `complete` flag or awaited `decode()`, so a capture could be
  // taken of a thumbnail that had arrived but had not been painted.
  if (reading.imagesLoading > 0) return `${reading.imagesLoading} <img> element(s) have not finished loading (a capture of a half-decoded sheet thumbnail is a capture of nothing)`;
  if (reading.running > 0) return `${reading.running} animation(s)/transition(s) still running`;
  return null;
}

/**
 * Has the screen PUBLISHED what it is showing — or what is still unpublished?
 *
 * The half of `settleFault` that is about CONTENT rather than about motion: every screen root states
 * a settled `data-state`, and every virtualised table states the row count it actually drew. It is
 * split out because a RETRYING READ owes this much and no more (tests/e2e/support/retrying-read.ts):
 * counting the rows of a table that has not said it painted is counting the paint, not the table —
 * two agreeing readings of zero are what a table that has not begun looks like — while waiting on
 * fonts, images and animations for a count would make every read of a number pay a capture's price.
 */
export function renderedFault(reading: SettleReading): string | null {
  const blank = reading.screenRoots.filter((state) => state === null || UNSETTLED_STATES.includes(state));
  if (blank.length > 0) {
    return `${blank.length} of ${reading.screenRoots.length} screen root(s) publish no settled ${SETTLE_CONTRACT.screenState} (saw ${blank.map((state) => (state === null ? "absent" : `"${state}"`)).join(", ")})`;
  }
  const unpainted = reading.tables.filter((rows) => rows === null || !/^\d+$/.test(rows));
  if (unpainted.length > 0) {
    return `${unpainted.length} of ${reading.tables.length} virtualised table(s) publish no ${SETTLE_CONTRACT.rowsRendered} count (saw ${unpainted.map((rows) => (rows === null ? "absent" : `"${rows}"`)).join(", ")})`;
  }
  return null;
}

/** How long a screen is given to settle before the wait is a failure with a named cause. */
export const SETTLE_TIMEOUT_MS = 15_000;

/**
 * Wait until the screen has stopped arriving. Retrying only: one `expect.poll` over one `evaluate`,
 * no sleeps, and a failure message that names what was still moving (B-19 — a flake is a defect
 * with a cause). Each reading crosses two animation frames first, so a transition fired by the
 * action immediately before this call is already registered when the reading is taken.
 *
 * WHAT IT STILL CANNOT SEE, stated so the next reader does not have to find out the hard way:
 *   · Animations inside a SHADOW ROOT or an IFRAME. `document.getAnimations()` returns this
 *     document's animations only; a shadow root's are reachable from the root's own
 *     `getAnimations()` and an iframe's are in another document entirely. Nothing in the product
 *     mounts either today, which is why this is a note rather than a wait.
 *   · Images that are not `<img>`: a CSS `background-image`, an `<svg><image>`, a `<video>` poster,
 *     anything drawn into a `<canvas>`. The viewer's sheet is a canvas and publishes its readiness
 *     through `data-state` instead — which is the contract this file asks a screen to keep.
 *   · A BROKEN `<img>`: it reports `complete` and rejects `decode()`, and this settles rather than
 *     hanging. The broken picture is what the capture exists to show.
 *   · An animation that starts AFTER the reading returns — a hover the test itself triggers, a
 *     delayed `animation-delay`. The poll re-reads, so a long one is caught on the next pass; a
 *     transition whose delay exceeds the settle timeout is not.
 *   · `prefers-reduced-motion` is NOT set by `playwright.config.ts`, so motion is live in the lane
 *     and every one of these waits is load-bearing rather than a formality.
 */
export async function settled(page: Page, timeout: number = SETTLE_TIMEOUT_MS, within?: string): Promise<void> {
  // The face load is a promise the browser already holds, so it is awaited once rather than polled.
  // Everything after it is a reading that can change under us, so everything after it is polled.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect
    .poll(async () => settleFault(await readSettle(page, within)), {
      timeout,
      message: `settled(): the screen never stopped arriving within ${timeout} ms`,
    })
    .toBeNull();
}

/** One reading, taken in the page. Exported so a diagnosis can print what settled() was looking at. */
export async function readSettle(page: Page, within?: string): Promise<SettleReading> {
  return await page.evaluate(async ({ contract, within: scope }) => {
    const root: ParentNode = (scope === undefined ? null : document.querySelector(scope)) ?? document;
    // THE rAF BARRIER, and why the reading cannot be taken without it.
    //
    // `expect.poll` evaluates its first reading IMMEDIATELY. A CSS transition fired by the click
    // just before — a rail widening over `--motion-panel` 240 ms, a reticle ring over
    // `--motion-reticle` 120 ms — is not in `document.getAnimations()` until the style change has
    // been recalculated, which happens at the next frame. So the first reading saw `running: 0`,
    // `busy: 0` and a `data-state` that was already settled before the click, and settled() returned
    // at t ≈ 0 with the screen mid-transition. Two frames, because one only guarantees that the
    // style recalculation has been SCHEDULED; the second guarantees it has happened and that the
    // animations it started are registered.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    // THE IMAGES. `sheet-card.tsx` and `auth-frame.tsx` render raw `<img>`; nothing here read their
    // `complete` flag or awaited `decode()`, so a capture could be taken of a thumbnail that had
    // arrived but had not been painted. A BROKEN image reports `complete` and rejects `decode()`:
    // it settles, deliberately, because a wait that never ends is not a check — the broken picture
    // is what the capture is for.
    const images = [...root.querySelectorAll("img")];
    const loading = images.filter((image) => !image.complete);
    await Promise.all(images.filter((image) => image.complete).map(async (image) => image.decode().catch(() => undefined)));
    const animations = document.getAnimations();
    const live = animations.filter((animation) => animation.playState === "running");
    const endless = live.filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return timing === undefined || timing.iterations === Infinity || timing.endTime === Infinity;
    });
    return {
      fontsStatus: document.fonts.status as string,
      busy: document.querySelectorAll(contract.busy).length,
      imagesLoading: loading.length,
      screenRoots: [...root.querySelectorAll(contract.screenRoot)].map((element) => element.getAttribute(contract.screenState)),
      tables: [...root.querySelectorAll(contract.virtualTable)].map((element) => element.getAttribute(contract.rowsRendered)),
      running: live.length - endless.length,
      endless: endless.length,
    };
  }, { contract: SETTLE_CONTRACT, within });
}

/**
 * READ ONCE, AFTER THE SCREEN HAS SAID IT STOPPED ARRIVING (AM-09 §4, P4b §4).
 *
 * Some answers a journey needs have no retrying verb and cannot be polled for: `history.length`
 * either grew or it did not, an axe run costs a second and must not be paid three times, a computed
 * custom property is whatever the cascade says. Those are single readings, and what makes a single
 * reading lawful is not that it is retried — it is that the screen has already PUBLISHED that it is
 * done arriving. That is what this states, at the site, in one call: `settled(page)` first, then the
 * one reading. `cubit/no-unretried-read` knows this wrapper by name, exactly as it knows the poll.
 *
 * It takes the page or any locator on it, so a page object that holds only a locator can use it.
 */
export async function afterSettled<T>(on: Page | Locator, read: () => Promise<T>, timeout: number = SETTLE_TIMEOUT_MS): Promise<T> {
  const page = "goto" in on ? on : on.page();
  await settled(page, timeout);
  return await read();
}


/* ---------------------------------------------- THE RENDERED CONTRACT, READ AT ONE REGION (v22) */

/**
 * What a region — or the screen root above it — published about having rendered.
 *
 * The founder's third decision for v22's speed pass: "one read when the screen says it's rendered".
 * A three-agreeing loop is three round trips to the browser per answer and it is a PROXY; a region
 * that publishes `data-state="settled"` or `data-rows-rendered="<n>"` has stated the thing the proxy
 * was estimating, and one reading after that statement is the answer. Where nothing publishes, the
 * loop stays — and says so, by name, so the contract gets added rather than assumed.
 */
export interface ContractReading {
  /** Did anything from this region up to the document publish a rendered contract? */
  readonly published: boolean;
  /** Which attribute published it — for the message, and for the line that names what is missing. */
  readonly by: string | null;
  /** The value it published, or null when it published none. */
  readonly value: string | null;
}

/** Nothing published anything: the caller falls back to agreeing readings, and says so. */
export const NO_CONTRACT: ContractReading = Object.freeze({ published: false, by: null, value: null });

/**
 * Does this reading say the region has RENDERED — or what is it still saying instead?
 *
 * `null` means "rendered, read it once". A string is the reason it is not, for the poll's message.
 * A reading that published nothing is not a fault: it is the caller's cue to fall back, and
 * `contractFault` answers `null` for it so a caller never polls on a contract that does not exist.
 */
export function contractFault(reading: ContractReading): string | null {
  if (!reading.published) return null;
  if (reading.by === SETTLE_CONTRACT.rowsRendered) {
    return /^\d+$/.test(reading.value ?? "") ? null : `it publishes ${SETTLE_CONTRACT.rowsRendered}="${reading.value ?? ""}", which is not a row count`;
  }
  const state = reading.value;
  if (state === null || UNSETTLED_STATES.includes(state)) {
    return `it publishes ${SETTLE_CONTRACT.screenState}=${state === null ? "nothing" : `"${state}"`}, which is a screen still arriving`;
  }
  return null;
}

/**
 * ONE reading of the rendered contract that governs this locator.
 *
 * The search climbs from the region's own first element to the document: a virtualised table's
 * `data-rows-rendered`, a region that wears `data-rendered-region`, or the screen root it sits in —
 * whichever is met FIRST, because the nearest publisher is the one that is about these elements.
 * A locator that matches nothing yet falls back to the document's screen roots, so a read taken
 * before the region exists is still governed by the screen that will hold it.
 *
 * `evaluateAll` rather than `evaluate`, deliberately: it runs with an empty array where `evaluate`
 * throws, and "the region is not there yet" is the exact state this has to be able to report.
 */
/**
 * THE PAGE SIDE OF THE SEARCH, as a function of its arguments alone.
 *
 * It is a top-level, self-contained function on purpose: Playwright ships the SOURCE of an
 * `evaluateAll` callback to the browser, so a callback that closed over a module's scope would
 * arrive with nothing in it — and a callback written inline could not be unit-tested at all. This
 * one takes the elements it matched and the contract, reads `document` only where there are no
 * elements to climb from, and answers a plain object. `tests/journeys/rendered-contract.test.ts`
 * runs it over a jsdom tree.
 */
export function contractIn(elements: Element[], contract: typeof SETTLE_CONTRACT): ContractReading {
  const publisherOn = (element: Element): ContractReading | null => {
    if (element.hasAttribute(contract.rowsRendered) || element.matches(contract.virtualTable)) {
      return { published: true, by: contract.rowsRendered, value: element.getAttribute(contract.rowsRendered) };
    }
    if (element.matches(contract.region) || element.matches(contract.screenRoot)) {
      return { published: true, by: contract.screenState, value: element.getAttribute(contract.screenState) };
    }
    return null;
  };
  const first = elements[0];
  if (first !== undefined) {
    for (let element: Element | null = first; element !== null; element = element.parentElement) {
      const found = publisherOn(element);
      if (found !== null) return found;
    }
    return { published: false, by: null, value: null };
  }
  // The region has not arrived. The screen that will hold it is the contract that governs it — and
  // the LEAST settled of them, because a read is of the whole screen the region is coming into.
  const roots = [...document.querySelectorAll(contract.screenRoot)];
  const root = roots[0];
  if (root === undefined) return { published: false, by: null, value: null };
  const unsettled = roots.find((each) => {
    const state = each.getAttribute(contract.screenState);
    return state === null || state === "" || state === "loading" || state === "pending";
  });
  return { published: true, by: contract.screenState, value: (unsettled ?? root).getAttribute(contract.screenState) };
}

/**
 * ONE reading of the rendered contract that governs this locator.
 *
 * The search climbs from the region's own first element to the document: a virtualised table's
 * `data-rows-rendered`, a region that wears `data-rendered-region`, or the screen root it sits in —
 * whichever is met FIRST, because the nearest publisher is the one that is about these elements.
 * A locator that matches nothing yet falls back to the document's screen roots, so a read taken
 * before the region exists is still governed by the screen that will hold it.
 *
 * `evaluateAll` rather than `evaluate`, deliberately: it runs with an empty array where `evaluate`
 * throws, and "the region is not there yet" is the exact state this has to be able to report.
 */
export async function readContract(locator: Locator): Promise<ContractReading> {
  const held = (locator as unknown as { evaluateAll?: unknown }).evaluateAll;
  // A unit double carries no `evaluateAll`: it publishes nothing, and the caller falls back to the
  // agreeing loop — which is what every reader did before a contract existed.
  if (typeof held !== "function") return NO_CONTRACT;
  return await locator.evaluateAll(contractIn, SETTLE_CONTRACT);
}
