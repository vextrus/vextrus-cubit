// THE RETRYING READS (AM-09 §4, B-19).
//
// `cubit/no-unretried-read` bans the one-shot readers — `.count()`, `.all()`, `.textContent()`,
// `.innerText()` — outside an `expect.poll` callback, because a single reading of a screen that is
// still arriving is true for one frame and true in no frame a person ever sees. But a journey does
// sometimes need an ANSWER rather than an assertion: which of two doors the sign-up answered with,
// how many rows the register actually painted, what digest the dialog computed. `expect.poll`
// asserts and returns nothing, so this module is the small set of readers that poll AND answer.
//
// Every one of them re-reads. None of them sleeps. And each one says, in its failure, what it was
// waiting for — a timeout that reads "the screen never settled" costs a session to diagnose, and
// B-19's "a flake is a defect with a cause" is only enforceable if the cause is printed.
import { expect, type Locator, type Page } from "@playwright/test";
import { readSettle, renderedFault } from "./settled";

/** How long a retrying read waits before it is a failure with a named cause. */
export const READ_TIMEOUT_MS = 15_000;

/**
 * Poll `read` until `accept` takes its answer, then hand that answer back.
 *
 * This is the general case the other helpers are written in terms of: the one-shot read happens
 * INSIDE the poll's callback, which is the one place a single reading is lawful, because the retry
 * is the poll's.
 */
export async function readWhen<T>(read: () => Promise<T>, accept: (value: T) => boolean, message: string, timeout: number = READ_TIMEOUT_MS): Promise<T> {
  let last: T | undefined;
  await expect
    .poll(
      async () => {
        last = await read();
        return accept(last);
      },
      { timeout, message },
    )
    .toBe(true);
  return last as T;
}

/**
 * Is this locator on the page within `timeout` — answered, not asserted.
 *
 * The lawful shape for a BRANCH. A journey that is idempotent across runs has to ask questions like
 * "did this account already exist?", and the answer is a fact about the world, not a defect: the
 * sign-up door answered a notice or it answered ACCOUNT_ALREADY_EXISTS, and both are correct. The
 * read is `locator.waitFor`, which retries; the absence is a real answer rather than a thrown error,
 * and the caller decides what it means. It is NOT a way to make a failing assertion optional —
 * every caller here has already asserted, with a retrying matcher, that the screen answered SOMETHING.
 */
export async function appears(locator: Locator, timeout = 2_000): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: "attached", timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * HOW MANY AGREEING READINGS ARE A SETTLED SCREEN (P4b §3).
 *
 * Two were not. A table that has not begun painting reads 0, reads 0 again a poll later, and is
 * "settled" in about 100 ms — and a premature 0 SATISFIES every at-most assertion in the lane
 * unconditionally (`expect(rows).toBeLessThanOrEqual(5)` is true of a screen that is not there).
 * Three is not a magic number either; what makes these reads honest is the two conditions around it:
 * the region has PUBLISHED that it rendered, and the caller's floor is met.
 */
export const AGREEING_READS = 3;

/** The page this locator belongs to, or null for a double that carries none (a unit probe's). */
function pageOf(locator: Locator): Page | null {
  const held = (locator as unknown as { page?: () => Page }).page;
  return typeof held === "function" ? held.call(locator) : null;
}

/**
 * Wait until the region this read is about has PUBLISHED that it rendered.
 *
 * `settled()`'s contract, minus fonts and motion: every screen root states a settled `data-state`
 * and every virtualised table states the `data-rows-rendered` it drew (src/ui/primitives/data/data-table.tsx
 * publishes the pair). This is the contract `steadyCount`'s comment has owed since it was written —
 * "agreement is the honest proxy until the tables publish it". They publish it; this reads it.
 */
async function rendered(locator: Locator, what: string, timeout: number): Promise<void> {
  const page = pageOf(locator);
  if (page === null) return;
  await expect
    .poll(async () => renderedFault(await readSettle(page)), {
      timeout,
      message: `${what}: the region never published that it had rendered — a count taken now is a count of the paint`,
    })
    .toBeNull();
}

/** What a caller expects of a count, beyond that it has stopped moving. */
export interface SteadyCountOptions {
  /**
   * The fewest rows the caller expects. ONE by default: a journey that asks "how many" is normally
   * asking about something it has just made, and zero is then the reading of a screen that has not
   * arrived rather than an answer. A caller for whom zero is a lawful answer — "the none line is
   * there or it is not" — says `{ min: 0 }`, and is then held by the rendered contract alone.
   */
  readonly min?: number;
  readonly timeout?: number;
}

/**
 * How many of these there are, once the region has said it rendered and the number has stopped
 * changing — `AGREEING_READS` readings that agree, and none of them below the caller's floor.
 */
export async function steadyCount(locator: Locator, what: string, options: SteadyCountOptions = {}): Promise<number> {
  const timeout = options.timeout ?? READ_TIMEOUT_MS;
  const min = options.min ?? 1;
  await rendered(locator, what, timeout);

  let seen: number[] = [];
  await expect
    .poll(
      async () => {
        seen = [...seen, await locator.count()].slice(-AGREEING_READS);
        return seen.length === AGREEING_READS && seen.every((count) => count === seen[0]) && (seen[0] ?? 0) >= min;
      },
      {
        timeout,
        message: `${what}: no ${AGREEING_READS} readings agreed on a count of at least ${min} — it is still painting (last read ${JSON.stringify(seen)})`,
      },
    )
    .toBe(true);
  return seen[0] ?? 0;
}

/**
 * Every one of these, as addressable locators, once the count has stopped changing.
 *
 * The lawful replacement for `.all()`: `.all()` freezes a list of element handles taken at one
 * instant, and each handle then goes stale the moment the row it pointed at re-renders. `nth(i)` is
 * re-resolved on every use, so a list built this way survives the row underneath it being redrawn.
 *
 * The floor is ZERO here and one for `steadyCount`, because the two questions differ: "how many are
 * there" is asked about something the caller believes it made, while "give me each of them" is the
 * shape a caller uses when it will then assert over the list — including that it is empty. The
 * rendered contract still holds, so an empty list is a published emptiness, never an unpainted one.
 */
export async function everyRow(locator: Locator, what: string, options: SteadyCountOptions = {}): Promise<Locator[]> {
  const total = await steadyCount(locator, what, { min: 0, ...options });
  return Array.from({ length: total }, (_, at) => locator.nth(at));
}

/** What a caller knows about a text before it reads it. */
export interface SteadyTextOptions {
  /**
   * A reading that would be the PREVIOUS state's — the label the screen carried before the act this
   * read is about. `steadyText` took the first non-empty text it saw, which is exactly that label:
   * "0 lines" was accepted where "5,412 lines" was a frame away, and the caller then branched on it.
   * A caller that holds the old value says so and is never handed it back.
   */
  readonly not?: string;
  readonly timeout?: number;
}

/**
 * The trimmed text this element settles on: non-empty, not the value the caller already had, and the
 * same across `AGREEING_READS` readings once the region has published that it rendered.
 */
export async function steadyText(locator: Locator, what: string, options: SteadyTextOptions = {}): Promise<string> {
  const timeout = options.timeout ?? READ_TIMEOUT_MS;
  const stale = options.not;
  await rendered(locator, what, timeout);

  let seen: string[] = [];
  await expect
    .poll(
      async () => {
        seen = [...seen, ((await locator.textContent()) ?? "").trim()].slice(-AGREEING_READS);
        const held = seen[0] ?? "";
        return seen.length === AGREEING_READS && seen.every((text) => text === held) && held !== "" && (stale === undefined || held !== stale);
      },
      {
        timeout,
        message: `${what}: no ${AGREEING_READS} readings agreed on a text${stale === undefined ? "" : ` other than "${stale}"`} — it is still arriving (last read ${JSON.stringify(seen)})`,
      },
    )
    .toBe(true);
  return seen[0] ?? "";
}

/**
 * The attribute this element settles on — the lawful spelling of a BRANCH on `getAttribute`.
 *
 * `locator.getAttribute()` is one reading, and the lane branched on it in five places (P4b §4): the
 * discipline a group carries, the scale a panel proposed, the project id a card names. A screen that
 * is still hydrating carries the attribute it was server-rendered with, or none at all, so the branch
 * was taken on the frame the runner happened to arrive in.
 */
export async function steadyAttribute(locator: Locator, attribute: string, what: string, options: SteadyTextOptions = {}): Promise<string> {
  const timeout = options.timeout ?? READ_TIMEOUT_MS;
  const stale = options.not;
  let seen: (string | null)[] = [];
  await expect
    .poll(
      async () => {
        seen = [...seen, await locator.getAttribute(attribute)].slice(-AGREEING_READS);
        const held = seen[0];
        return seen.length === AGREEING_READS && seen.every((value) => value === held) && typeof held === "string" && held !== "" && (stale === undefined || held !== stale);
      },
      {
        timeout,
        message: `${what}: \`${attribute}\` never held one non-empty value across ${AGREEING_READS} readings (last read ${JSON.stringify(seen)})`,
      },
    )
    .toBe(true);
  return (seen[0] ?? "") as string;
}

/**
 * The attribute of every one of these rows, read the retrying way — the shape five call sites in the
 * lane spell by hand as `everyRow(...)` and then `getAttribute` on each, which is one reading per row.
 */
export async function everyAttribute(locator: Locator, attribute: string, what: string, options: SteadyCountOptions = {}): Promise<string[]> {
  const rows = await everyRow(locator, what, options);
  const held: string[] = [];
  for (const row of rows) held.push(await steadyAttribute(row, attribute, `${what}: \`${attribute}\``));
  return held;
}

/**
 * Let the browser paint once, and answer when it has.
 *
 * The lawful replacement for a small `waitForTimeout` used to PACE INPUT — a wheel or a drag that
 * wants the viewer to have drawn between steps. A sleep guesses how long a frame takes; this waits
 * for the frame itself, which is what the guess was standing in for.
 */
export async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}
