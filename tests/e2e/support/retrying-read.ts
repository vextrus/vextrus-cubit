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
import { contractFault, readContract, type ContractReading } from "./settled";

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

/**
 * WAIT FOR THE REGION'S OWN STATEMENT THAT IT RENDERED — then the caller reads ONCE.
 *
 * The founder's third decision for v22's speed pass: "one read when the screen says it's rendered".
 * `AGREEING_READS` readings are three round trips to the browser per answer and they are a PROXY for
 * a statement the product can make and, on a virtualised table, already makes. So this waits for
 * the contract (`data-rows-rendered="<n>"`, or a settled `data-state` on a region or its screen
 * root) and answers TRUE — the caller then takes one reading and that reading is the answer.
 *
 * Where nothing on the path publishes anything it answers FALSE and SAYS SO, once, naming the
 * selector: the three-agreeing loop is still correct there, and the line is how the missing contract
 * gets added rather than assumed (B-19 — the cause is printed to be a cause).
 */
async function renderedContract(locator: Locator, what: string, timeout: number): Promise<boolean> {
  let reading: ContractReading;
  try {
    reading = await readContract(locator);
  } catch {
    // A double, a detached frame, a page that navigated under the read: the loop is the safe answer.
    return announceMissing(locator, what);
  }
  if (!reading.published) return announceMissing(locator, what);
  await expect
    .poll(
      async () => {
        reading = await readContract(locator);
        // A region that STOPS publishing mid-read (it unmounted, the screen navigated) is not a
        // held contract; the poll keeps asking, and the caller's own timeout is what ends it.
        return reading.published ? contractFault(reading) : `it no longer publishes a rendered contract`;
      },
      { timeout, message: `${what}: the region published a rendered contract and it never held — a reading taken now is a reading of the paint` },
    )
    .toBeNull();
  return true;
}

/** The regions that have already said, in this process, that they publish nothing. Said once each. */
const announced = new Set<string>();

/** Name the region that owes a rendered contract — once per selector per process, never per read. */
function announceMissing(locator: Locator, what: string): false {
  const selector = String(locator);
  if (!announced.has(selector)) {
    announced.add(selector);
    process.stdout.write(`read: no rendered contract on ${selector} — ${AGREEING_READS} readings (${what})\n`);
  }
  return false;
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
  // ONE READING, when the region has said it rendered. The contract is the statement the loop below
  // was estimating; a first reading that already meets the caller's floor is the answer, and there
  // is nothing three more round trips could add to it.
  if (await renderedContract(locator, what, timeout)) {
    const once = await locator.count();
    if (once >= min) return once;
    process.stdout.write(`read: ${what} published that it rendered and held ${once}, below the caller's floor of ${min} — ${AGREEING_READS} readings\n`);
  }

  let seen: number[] = [];
  await expect
    .poll(
      async () => {
        seen = [...seen, await locator.count()].slice(-AGREEING_READS);
        return seen.length === AGREEING_READS && seen.every((count) => count === seen[0]) && (seen[0] ?? 0) >= min;
      },
      {
        timeout,
        message: `${what}: no ${AGREEING_READS} readings agreed on a count of at least ${min} — the region is still painting, or it holds fewer than the caller expects (a caller for which zero is an answer passes { min: 0 })`,
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
  if (await renderedContract(locator, what, timeout)) {
    const once = ((await locator.textContent()) ?? "").trim();
    if (once !== "" && (stale === undefined || once !== stale)) return once;
    process.stdout.write(`read: ${what} published that it rendered and held ${once === "" ? "nothing" : `"${once}"`} — ${AGREEING_READS} readings\n`);
  }

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
        message: `${what}: no ${AGREEING_READS} readings agreed on one non-empty text${stale === undefined ? "" : ` other than "${stale}"`} — it is still arriving`,
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
  if (await renderedContract(locator, what, timeout)) {
    const once = await locator.getAttribute(attribute);
    if (typeof once === "string" && once !== "" && (stale === undefined || once !== stale)) return once;
    process.stdout.write(`read: ${what} published that it rendered and \`${attribute}\` held ${once === null ? "nothing" : `"${once}"`} — ${AGREEING_READS} readings\n`);
  }
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
        message: `${what}: \`${attribute}\` never held one non-empty value across ${AGREEING_READS} readings`,
      },
    )
    .toBe(true);
  return (seen[0] ?? "") as string;
}

/**
 * The attribute this element HOLDS STILL at — the drop-in for `locator.getAttribute()` (P4b §4).
 *
 * `getAttribute` is one reading, and the lane took it in eighty-four places: the discipline a group
 * carries, the project a card names, the id a row was drawn for. A screen that is still hydrating
 * carries the attribute it was server-rendered with, or none at all, so a branch taken on one
 * reading is a branch taken on the frame the runner happened to arrive in.
 *
 * ABSENCE IS AN ANSWER HERE, which is what separates this from `steadyAttribute`: a journey asserts
 * that a disabled tab is `href`-less as readily as it reads the href of one that is not, so this
 * answers `null` when the element holds no such attribute — it only insists that the answer was the
 * same across `AGREEING_READS` readings. `steadyAttribute` is the stricter spelling for a caller
 * that is waiting for a value to ARRIVE.
 */
export async function heldAttribute(locator: Locator, attribute: string, what?: string): Promise<string | null> {
  const named = what ?? `\`${attribute}\``;
  // Absence IS an answer here, so the contract holding is the whole of what this read was waiting
  // for: one reading after it, and no loop can make that answer truer.
  if (await renderedContract(locator, named, READ_TIMEOUT_MS)) return await locator.getAttribute(attribute);
  let seen: (string | null)[] = [];
  await expect
    .poll(
      async () => {
        seen = [...seen, await locator.getAttribute(attribute)].slice(-AGREEING_READS);
        return seen.length === AGREEING_READS && seen.every((value) => value === seen[0]);
      },
      { timeout: READ_TIMEOUT_MS, message: `${named}: the attribute never held one value across ${AGREEING_READS} readings — it is still hydrating` },
    )
    .toBe(true);
  return seen[0] ?? null;
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
