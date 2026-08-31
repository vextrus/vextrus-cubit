// @vitest-environment node
/**
 * AC-2 and AC-3, driven the way a person drives them: a scratch database built by the tree's own
 * migration lane, accounts made through the shipped sign-up door, the product BUILT and SERVED, and
 * every move made in a real browser through the `data-testid` names the contract fixes.
 *
 * Nothing is mocked. The panel and the accept screen answer through server actions, so a form posted
 * by `fetch` would not be the door a person uses.
 *
 * B-19: no roster, count or name is frozen here. The workspace the accept screen must name is read
 * back out of the store the screen reads it from; the pending rows are counted against the
 * invitations this file created, not against a number written down; the mail is found by the address
 * it was sent to.
 */
import { afterAll, describe, expect, test } from "vitest";
import { GUC_SYSTEM_REASON } from "../../db/__tests__/support/fixtures";
import { lit, scalar, withSession } from "../../db/__tests__/support/live-sql";
import {
  dropDatabase,
  enrol,
  fetchPage,
  openDatabase,
  rosterOf,
  serveApp,
  stopApp,
  type Person,
} from "../members/support/members-stage";
import {
  ACCEPT_DECISION,
  ACCEPT_LINK,
  ACCEPT_ROUTE,
  CODE,
  INVITATION_ATTRIBUTE,
  SIGN_IN_ROUTE,
  TESTIDS,
  decision,
  decisionEntry,
  membersPath,
  workspacePath,
} from "./support/invitations-contract";
import { closeBrowser, codesIn, countOf, deviceFor, documentOrder, invitationsMailed, newestInvitation, pendingRows, submitField, testId, textOf, type Page } from "./support/browser";

/** A live stage of this shape costs minutes to build; every test states its own budget. */
const LIVE = 900_000;

/** The dist directory this suite's build lands in: regenerable output under a gitignored name. */
const DIST = ".next-invitations";

/** The reason the one read this file makes of the store is recorded under. */
const READ_REASON = "test: read the inviting workspace's own name for the accept screen's assertion";

interface Stage {
  origin: string;
  inviter: Person;
  scratch: { urlMigrate: string };
}

let pending: Promise<Stage> | undefined;

/**
 * Staged lazily and memoised: every test then fails on its own with the staging error rather than
 * being skipped by a throwing hook, and a skipped test reports no criterion.
 */
function staged(): Promise<Stage> {
  pending ??= (async (): Promise<Stage> => {
    const scratch = await openDatabase();
    const inviter = await enrol("inviter");
    const served = await serveApp(DIST);
    return { origin: served.origin, inviter, scratch };
  })();
  return pending;
}

afterAll(async () => {
  await closeBrowser();
  stopApp();
  await dropDatabase();
}, 120_000);

/** The workspace's own name, as the store holds it — what the accept screen must name. */
function workspaceName(scratch: { urlMigrate: string }, tenantId: string): string {
  return scalar(scratch.urlMigrate, withSession({ [GUC_SYSTEM_REASON]: READ_REASON }, `select name from tenants where tenant_id = ${lit(tenantId)};`));
}

/** The inviter's members screen, open in their own browser. */
async function membersScreen(stage: Stage): Promise<Page> {
  const context = await deviceFor(stage.origin, stage.inviter.cookie);
  const page = await context.newPage();
  await page.goto(`${stage.origin}${membersPath(stage.inviter.tenantId)}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(testId(TESTIDS.membersSection)).waitFor({ state: "visible", timeout: 60_000 });
  return page;
}

/** Invite an address through the panel, and wait for its row to stand. */
async function invite(page: Page, email: string): Promise<void> {
  await submitField(page, TESTIDS.email, email, TESTIDS.submit);
  await page.locator(`${testId(TESTIDS.row)}[${INVITATION_ATTRIBUTE}]`).first().waitFor({ state: "visible", timeout: 60_000 });
}

describe("AC-2: the invitations panel stands in I-61's slots and moves invitations", () => {
  test(
    "AC-2: the panel mounts in the fixed slots, in order, and never answers with silence",
    async () => {
      const stage = await staged();
      const page = await membersScreen(stage);

      expect(await countOf(page, TESTIDS.inviteForm), `the members screen mounts ${TESTIDS.inviteForm} (I-61's first slot)`).toBe(1);
      expect(await countOf(page, TESTIDS.pendingInvitations), `the members screen mounts ${TESTIDS.pendingInvitations} (I-61's second slot)`).toBe(1);
      expect(await countOf(page, TESTIDS.email), `${TESTIDS.email} stands inside the invite form`).toBe(1);
      expect(await countOf(page, TESTIDS.submit), `${TESTIDS.submit} stands inside the invite form`).toBe(1);

      const order = await documentOrder(page, TESTIDS.inviteForm, TESTIDS.pendingInvitations);
      expect(order.first, "the invite form is rendered").toBeGreaterThanOrEqual(0);
      expect(order.second, "the pending list is rendered").toBeGreaterThanOrEqual(0);
      expect(order.first, "the invite form comes first and the pending list after it — I-61 fixed the order (AC-2)").toBeLessThan(order.second);

      // A workspace nobody has invited anyone to says so, rather than showing an empty box (R-UI-020).
      expect(await countOf(page, TESTIDS.row), "a fresh workspace has no pending invitation").toBe(0);
      expect(await countOf(page, TESTIDS.none), `${TESTIDS.none} stands where the pending rows would be — the panel is never silent (R-UI-020)`).toBe(1);
      await page.context().close();
    },
    LIVE,
  );

  test(
    "AC-2: a valid email becomes a pending row and reaches the invitee as a mailed accept link",
    async () => {
      const stage = await staged();
      const invitee = await enrol("invitee-mailed");
      const page = await membersScreen(stage);

      await invite(page, invitee.email);

      const rows = await pendingRows(page, TESTIDS.row, INVITATION_ATTRIBUTE);
      expect(rows.length, "the invitation just made stands as one pending row").toBe(1);
      expect(rows[0]?.length ?? 0, `the row carries ${INVITATION_ATTRIBUTE} so one invitation can be told from another (AC-2)`).toBeGreaterThan(0);
      expect(await countOf(page, TESTIDS.resend), `each pending row carries ${TESTIDS.resend}`).toBe(1);
      expect(await countOf(page, TESTIDS.revoke), `each pending row carries ${TESTIDS.revoke}`).toBe(1);
      expect(await countOf(page, TESTIDS.none), `${TESTIDS.none} steps aside once a row stands`).toBe(0);
      expect(await codesIn(page, TESTIDS.refusal), "a valid invitation is not refused").toEqual([]);

      const mail = await newestInvitation(invitee.email);
      expect(mail.kind, "the invitation leaves as its own mail kind through the one mail home (AC-1)").toBe("invitation");
      expect(mail.url, `the mailed link is ${ACCEPT_LINK}<token> (the test contract)`).toContain(ACCEPT_LINK);
      await page.context().close();
    },
    LIVE,
  );

  test(
    "AC-2: resend re-mails the invitee, and revoke takes the row away",
    async () => {
      const stage = await staged();
      const invitee = await enrol("invitee-resend");
      const page = await membersScreen(stage);

      // Which row this case revokes is read off the panel, not assumed: the offers other cases made
      // in this same workspace lawfully still stand, and R-SPINE-003 schedules them all. The identity
      // that appears between the two readings is the one this case just created.
      const standingBefore = await pendingRows(page, TESTIDS.row, INVITATION_ATTRIBUTE);
      await invite(page, invitee.email);
      const revokedId = (await pendingRows(page, TESTIDS.row, INVITATION_ATTRIBUTE)).find((id) => id.length > 0 && !standingBefore.includes(id));
      expect(revokedId, `the invitation just made stands as a pending row of its own, told apart by ${INVITATION_ATTRIBUTE} (AC-2)`).toBeTruthy();

      const afterInvite = invitationsMailed(invitee.email).length;
      expect(afterInvite, "the first send reached the invitee").toBeGreaterThan(0);

      await page.locator(testId(TESTIDS.resend)).first().click();
      await expect
        .poll(() => invitationsMailed(invitee.email).length, { timeout: 60_000, interval: 250 })
        .toBeGreaterThan(afterInvite);

      // Revoke takes THAT invitation away (R-SPINE-003) — the row it was aimed at, not the panel.
      // Whether any other offer still stands is that offer's business, so nothing here is asserted
      // about the panel's emptiness; `invitations-none` is owed only where no offer stands, which is
      // the fresh workspace the first case reads.
      await page.locator(`${testId(TESTIDS.row)}[${INVITATION_ATTRIBUTE}="${revokedId}"] ${testId(TESTIDS.revoke)}`).click();
      await expect
        .poll(() => pendingRows(page, TESTIDS.row, INVITATION_ATTRIBUTE), { timeout: 60_000, interval: 250 })
        .not.toContain(revokedId);
      await page.context().close();
    },
    LIVE,
  );
});

describe("AC-3: the ACCEPT flow grants the invitee membership of the inviting workspace", () => {
  test(
    "AC-3: a signed-out request for the accept route meets the sign-in door",
    async () => {
      const stage = await staged();
      const answer = await fetchPage(stage.origin, `${ACCEPT_ROUTE}?token=whatever-a-stranger-holds`, null);
      expect(answer.url.includes(SIGN_IN_ROUTE), `a request carrying no session is redirected to ${SIGN_IN_ROUTE} by the (app) door (AC-3) — it answered from ${answer.url}`).toBe(true);
    },
    LIVE,
  );

  test(
    "AC-3: a token this deployment cannot claim is answered in place, with the registered entry",
    async () => {
      const stage = await staged();
      const stranger = await enrol("stranger-holding-a-token");
      const ruled = decisionEntry(decision(ACCEPT_DECISION), CODE);

      const device = await deviceFor(stage.origin, stranger.cookie);
      const page = await device.newPage();
      await page.goto(`${stage.origin}${ACCEPT_ROUTE}?token=a-token-no-invitation-was-ever-minted-for`, { waitUntil: "domcontentloaded", timeout: 60_000 });

      await page.locator(testId(TESTIDS.acceptRefusal)).waitFor({ state: "visible", timeout: 60_000 });
      expect(await codesIn(page, TESTIDS.acceptRefusal), `an unknown token answers ${CODE} in ${TESTIDS.acceptRefusal}, machine-readably (AC-3)`).toContain(CODE);
      const answered = await textOf(page, TESTIDS.acceptRefusal);
      expect(answered, "the refusal says what was refused, in the registered words").toContain(ruled.message);
      expect(answered, "and what resolves it — the registered remedy, never a code alone (R-UI-020)").toContain(ruled.remedy);
      expect(await countOf(page, TESTIDS.acceptSubmit), "nothing is left to submit over a token no accept can claim (I-65), and no disabled control stands in its place").toBe(0);

      // It grants nothing: a refusal that quietly joined the stranger to something would be worse
      // than silence. The only workspace they hold is the one sign-up minted for them.
      expect(rosterOf(stage.inviter.tenantId).has(stranger.userId), "a refused accept grants no membership (AC-3)").toBe(false);
      await device.close();
    },
    LIVE,
  );

  test(
    "AC-3: the invitee spends the mailed token and holds a second membership",
    async () => {
      const stage = await staged();
      const invitee = await enrol("invitee-accepts");
      const inviting = stage.inviter.tenantId;

      const before = rosterOf(inviting);
      expect(before.has(invitee.userId), "the invitee is a stranger to the inviting workspace before they accept").toBe(false);

      const panel = await membersScreen(stage);
      await invite(panel, invitee.email);
      await panel.context().close();

      const mail = await newestInvitation(invitee.email);
      const device = await deviceFor(stage.origin, invitee.cookie);
      const page = await device.newPage();
      await page.goto(new URL(mail.url, stage.origin).toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });

      await page.locator(testId(TESTIDS.acceptForm)).waitFor({ state: "visible", timeout: 60_000 });
      expect(await codesIn(page, TESTIDS.acceptRefusal), "a token straight out of the invitee's own mail is claimable").toEqual([]);
      expect(await textOf(page, TESTIDS.acceptWorkspace), "the screen names the inviting workspace the invitee is deciding about (AC-3)").toContain(
        workspaceName(stage.scratch, inviting),
      );

      await page.locator(testId(TESTIDS.acceptSubmit)).click();
      await expect.poll(() => rosterOf(inviting).has(invitee.userId), { timeout: 60_000, interval: 500 }).toBe(true);

      // One user, two tenants (R-SPINE-002): the workspace sign-up minted for them is untouched.
      expect(rosterOf(invitee.tenantId).has(invitee.userId), "the invitee keeps the workspace they already had").toBe(true);

      // And the door of the joined workspace opens to the same session, without another sign-in.
      const inside = await fetchPage(stage.origin, workspacePath(inviting), invitee.cookie);
      expect(inside.url.includes(SIGN_IN_ROUTE), "the joined workspace opens to the session that accepted, with no re-authentication").toBe(false);
      await device.close();
    },
    LIVE,
  );
});
