/**
 * The browser mechanics the invitation acceptance is driven with — a real chromium, a session the
 * product issued worn as a cookie, and readings of a page by the `data-testid` names the contract
 * fixes. Mechanics only: nothing here judges a surface.
 *
 * The invitations panel and the accept screen answer through server actions, so a form submitted by
 * `fetch` is not the door a person uses; every assertion about them is made in a browser.
 *
 * The outbox is read here too, because the mail kind this increment adds is not in the shipped
 * `MailKind` union yet — the reader is typed loosely on purpose, so this lane's typecheck (which
 * `next build` also runs) does not need a product change to compile.
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { newestMail } from "../../e2e/support/outbox";
import { outboxDir } from "../../../src/server/auth/mail";

/** One mail as the outbox spells it, without the closed kind union this increment appends to. */
export interface Mail {
  to: string;
  kind: string;
  url: string;
  token: string;
}

/** The mail kind an invitation travels as (the interfaces line). */
export const INVITATION_KIND = "invitation";

/** The link an invitation mail carries (the test contract) — what makes the mail spendable. */
export const ACCEPT_LINK = "/accept-invitation?token=";

/**
 * The newest invitation mailed to an address, waited for rather than assumed. The mechanics assert
 * their own precondition: a "mail" carrying no accept link is not an invitation a suite can go on to
 * spend, and every case downstream of it would be measuring nothing.
 */
export async function newestInvitation(to: string): Promise<Mail> {
  const read = newestMail as unknown as (to: string, kind: string) => Promise<Mail>;
  const mail = await read(to, INVITATION_KIND);
  assert.ok(
    typeof mail.url === "string" && mail.url.includes(ACCEPT_LINK),
    `the invitation mailed to ${to} carries no ${ACCEPT_LINK}<token> link, so there is nothing for the invitee to spend — it answered ${JSON.stringify(mail.url)}`,
  );
  return mail;
}

/** Every invitation the outbox holds for an address — how a resend is told from a first send. */
export function invitationsMailed(to: string): Mail[] {
  const directory = outboxDir();
  let names: string[];
  try {
    names = readdirSync(directory).filter((name) => name.endsWith(".json"));
  } catch {
    // Nothing has been mailed at all yet: the outbox directory is written on the first delivery.
    return [];
  }
  return names
    .sort()
    .map((name) => JSON.parse(readFileSync(`${directory}/${name}`, "utf8")) as Mail)
    .filter((mail) => mail.to === to.toLowerCase() && mail.kind === INVITATION_KIND);
}

/* --------------------------------------------------------------------------- the browser */

let browser: Browser | undefined;

/**
 * One chromium for the whole file, launched on first use. The launcher is reached by a DYNAMIC
 * import so that merely loading this module needs no playwright resolution — the held-out mount
 * loads it out of the checkout, and a bare specifier resolved at load time is the trap that kills a
 * mounted suite.
 */
export async function openBrowser(): Promise<Browser> {
  if (browser === undefined) {
    const { chromium } = (await import("@playwright/test")) as unknown as { chromium: { launch(options: { headless: boolean }): Promise<Browser> } };
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

/** Close whatever this file launched, whether or not staging got past it. */
export async function closeBrowser(): Promise<void> {
  const held = browser;
  browser = undefined;
  await held?.close();
}

/** A context wearing a session the product issued — one per person, as a device is one per person. */
export async function deviceFor(origin: string, cookie: string): Promise<BrowserContext> {
  const context = await (await openBrowser()).newContext({ baseURL: origin });
  const [name = "", value = ""] = cookie.split("=");
  await context.addCookies([{ name, value, url: origin }]);
  return context;
}

/** The selector one testid is found by — spelled once. */
export const testId = (name: string): string => `[data-testid="${name}"]`;

/** How many elements carry a testid right now. */
export const countOf = async (page: Page, name: string): Promise<number> => page.locator(testId(name)).count();

/**
 * The text a person reads out of the one element carrying a testid, whitespace collapsed. An absent
 * element is asserted against rather than read as the empty string: "" contains every substring a
 * caller might have been about to look for, so a silent miss here would pass a case that proved
 * nothing.
 */
export async function textOf(page: Page, name: string): Promise<string> {
  assert.ok(await countOf(page, name), `nothing on this page carries data-testid="${name}", so there is no text to read out of it`);
  const text = await page.locator(testId(name)).first().textContent();
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Every refusal code published machine-readably inside a testid's subtree, in document order. */
export async function codesIn(page: Page, name: string): Promise<string[]> {
  return page.locator(`${testId(name)} [data-code], ${testId(name)}[data-code]`).evaluateAll((nodes) =>
    nodes.map((node) => (node as Element).getAttribute("data-code") ?? "").filter((code) => code.length > 0),
  );
}

/** The identities of the pending rows the panel is showing, in the order it renders them. */
export async function pendingRows(page: Page, rowTestId: string, attribute: string): Promise<string[]> {
  return page.locator(testId(rowTestId)).evaluateAll((nodes, name) => nodes.map((node) => (node as Element).getAttribute(name) ?? ""), attribute);
}

/** Where two testids stand relative to one another in the document — I-61's frozen order. */
export async function documentOrder(page: Page, first: string, second: string): Promise<{ first: number; second: number }> {
  const html = await page.content();
  return { first: html.indexOf(`data-testid="${first}"`), second: html.indexOf(`data-testid="${second}"`) };
}

/** The workspaces the shell's switcher offers, read by opening the menu a person opens. */
export async function switcherWorkspaces(page: Page, switcherTestId: string): Promise<string[]> {
  const trigger = page.locator(testId(switcherTestId));
  await trigger.waitFor({ state: "visible", timeout: 30_000 });
  await trigger.click();
  const menu = page.locator('[role="menu"]');
  await menu.first().waitFor({ state: "visible", timeout: 30_000 });
  const items = await menu.locator('[role="menuitem"]').allTextContents();
  const offered = items.map((text) => text.replace(/\s+/g, " ").trim()).filter((text) => text.length > 0);
  await page.keyboard.press("Escape");
  return offered;
}

/** Submit a form's field and control by their contract ids, and wait for the answer to settle. */
export async function submitField(page: Page, fieldTestId: string, value: string, submitTestId: string): Promise<void> {
  await page.locator(testId(fieldTestId)).fill(value);
  await Promise.all([page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined), page.locator(testId(submitTestId)).click()]);
}

export type { Browser, BrowserContext, Page };
