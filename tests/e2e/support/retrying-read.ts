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
 * How many of these there are, once the number has stopped changing.
 *
 * A virtualised table's row count climbs as its body paints, so ONE reading of it is a reading of
 * the paint, not of the table. Two readings that agree, taken a poll apart, are a table that has
 * finished arriving (this is what `settled()`'s `data-rows-rendered` contract will make explicit
 * once the tables publish it; until then, agreement is the honest proxy).
 */
export async function steadyCount(locator: Locator, what: string, timeout: number = READ_TIMEOUT_MS): Promise<number> {
  let previous = -1;
  let held = 0;
  await expect
    .poll(
      async () => {
        const seen = await locator.count();
        const settled = seen === previous;
        previous = seen;
        held = seen;
        return settled;
      },
      { timeout, message: `${what}: the count never held still — it is still painting` },
    )
    .toBe(true);
  return held;
}

/**
 * Every one of these, as addressable locators, once the count has stopped changing.
 *
 * The lawful replacement for `.all()`: `.all()` freezes a list of element handles taken at one
 * instant, and each handle then goes stale the moment the row it pointed at re-renders. `nth(i)` is
 * re-resolved on every use, so a list built this way survives the row underneath it being redrawn.
 */
export async function everyRow(locator: Locator, what: string, timeout: number = READ_TIMEOUT_MS): Promise<Locator[]> {
  const total = await steadyCount(locator, what, timeout);
  return Array.from({ length: total }, (_, at) => locator.nth(at));
}

/** The trimmed text this element settles on, once it is not empty. */
export async function steadyText(locator: Locator, what: string, timeout: number = READ_TIMEOUT_MS): Promise<string> {
  let held = "";
  await expect
    .poll(
      async () => {
        held = ((await locator.textContent()) ?? "").trim();
        return held !== "";
      },
      { timeout, message: `${what}: the element never carried text` },
    )
    .toBe(true);
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
