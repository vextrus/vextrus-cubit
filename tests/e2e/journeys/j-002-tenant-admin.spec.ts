// J-002 — tenant admin, end to end: invite, roles, and the removal the act log refuses.
//
// The workspace is settled the way a workspace is settled: an owner offers a membership, the person
// spends the mailed link, the owner moves their role from the roster, a second offer is left
// standing, and then the owner tries to remove somebody the log names — which R-SPINE-003 refuses
// with MEMBER_HAS_ACTS, in place, in the row that asked.
//
// The acts themselves are staged over psql against the journeys' additive database (the established
// staging precedent, and what the test contract admits): what is graded here is the browser-visible
// refusal, not how the log came to hold a row.
import { expect, test, type Page } from "@playwright/test";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_MIGRATE, TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit, run, scalar, withSession } from "../../../db/__tests__/support/live-sql";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SMembersPage, S_MEMBERS } from "../pages/s-members.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";

/** One run's identities: a journey brings its own accounts rather than leaning on the last run's. */
const RUN = Date.now().toString(36);
const OWNER = `j002-owner-${RUN}@cubit.test`;
const MEMBER = `j002-member-${RUN}@cubit.test`;
const NEVER_ACCEPTED = `j002-pending-${RUN}@cubit.test`;
const PASSWORD = `j002-password-${RUN}`;
const WORKSPACE = `Foundry ${RUN}`;
const MEMBER_WORKSPACE = `Slipway ${RUN}`;

/** The role this journey moves the member to, and then reads back off the roster. */
const PROMOTED_ROLE = "ADMIN";

/** The refusal a removal meets while the log names the membership (R-SPINE-003). */
const MEMBER_HAS_ACTS = "MEMBER_HAS_ACTS";

/** The regions a run's own identities land in, painted over so a baseline is about the layout. */
const VOLATILE = ["shell-topbar", "shell-tenant-switcher", "members-row", "invitations-row"] as const;

const masks = (page: Page) => VOLATILE.map((testId) => page.getByTestId(testId));

/** The reason every statement this journey stages is recorded under — attributable, like any other. */
const STAGE_REASON = "test: stage the acts a workspace's removal guard is refused by";

/** The journeys' own database, addressed as its owner — the role a stage speaks as (SEAM-TENANT). */
function ownerUrl(): string {
  const url = new URL(BOOTSTRAP_URL);
  url.username = ROLE_MIGRATE;
  url.password = ROLE_MIGRATE;
  url.pathname = "/cubit_e2e";
  return url.toString();
}

const sysRun = (script: string): string[][] => run(ownerUrl(), withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));
const sysScalar = (script: string): string => scalar(ownerUrl(), withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));

/**
 * One act on the log, authored by this member on a project of this workspace they stand on — the
 * coupling `memberHasActs` reads. Nothing about the removal guard is stubbed: the row is real.
 */
function stageActsFor(tenantId: string, userId: string): void {
  const projectId = sysScalar(
    `insert into projects (${ident(TENANT_COLUMN)}, name) values (${lit(tenantId)}, 'J-002 open campaign') returning project_id::text;`,
  );
  sysRun(
    `insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)}) on conflict do nothing;`,
  );
  sysRun(
    `insert into acts (${ident(TENANT_COLUMN)}, project_id, actor_id, act_type, subjects, consequence_digest)
       values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)}, 'STAGED_FOR_J002', '[]'::jsonb, ${lit(`j002-${RUN}`)});`,
  );
}

/** The account id behind an address, as the store holds it — what a roster row is found by. */
function accountIdOf(email: string): string {
  return sysScalar(`select user_id::text from users where email like ${lit(`%${email}%`)} limit 1;`);
}

/** One account, made through the doors a person uses: sign up naming the workspace, verify, sign in. */
async function enrol(screen: SAuthPage, email: string, workspace: string): Promise<void> {
  await screen.open(S_AUTH.signUp);
  await screen.signUpWith(email, PASSWORD, workspace);
  await screen.expectNotice();

  const verification = await newestMail(email, "verify-email");
  await screen.openWithToken(S_AUTH.verify, verification.token);
  await screen.expectNotice();

  await screen.open(S_AUTH.signIn);
  await screen.signInWith(email, PASSWORD);
  await screen.at().waitForURL((url) => url.pathname === S_AUTH.home, { timeout: 30_000 });
}

/** The workspace sign-up minted for this account, as the entry's own door addresses it. */
async function ownWorkspaceId(page: Page): Promise<string> {
  await page.goto(S_AUTH.home);
  const href = await page.getByTestId("root-home-workspace-door").getAttribute("href");
  return (href ?? "").replace("/t/", "");
}

test.describe("J-002 — tenant admin: invite, roles, and the removal the log refuses", () => {
  test("J-002: an invitation is spent, a role is moved, and a removal is refused with MEMBER_HAS_ACTS", async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";

    /* --- the owner and their workspace, and somebody to invite into it --- */
    await enrol(new SAuthPage(page), OWNER, WORKSPACE);
    const tenantId = await ownWorkspaceId(page);
    expect(tenantId.length, "sign-up minted the owner a workspace of their own (R-SPINE-002)").toBeGreaterThan(0);

    const joinerContext = await browser.newContext({ baseURL });
    const joiner = await joinerContext.newPage();
    await enrol(new SAuthPage(joiner), MEMBER, MEMBER_WORKSPACE);

    /* --- invite, and let the invitation be spent (R-SPINE-003) --- */
    const members = new SMembersPage(page);
    await page.goto(S_MEMBERS.settings(tenantId));
    await members.link.click();
    await expect(members.section, "the members roster is the screen the link lands on").toBeVisible();

    await members.invite(MEMBER);
    await expect(members.pendingRows, "the offer just made stands as one pending row").toHaveCount(1);

    const invitation = await newestMail(MEMBER, "invitation");
    await joiner.goto(new URL(invitation.url, origin).toString());
    await joiner.getByTestId("accept-invitation-submit").click();
    await joiner.waitForURL((url) => url.pathname.startsWith(`/t/${tenantId}`), { timeout: 60_000 });
    await joinerContext.close();

    /* --- a second offer, left standing, so the panel shows both halves of itself --- */
    await members.open(tenantId);
    await members.invite(NEVER_ACCEPTED);
    await expect(members.pendingRows, "the offer nobody has accepted is the one still pending").toHaveCount(1);

    /* --- the role move, from the roster's own form (R-SPINE-006) --- */
    const memberId = accountIdOf(MEMBER);
    expect(memberId.length, "the invitation that was spent left a membership to move").toBeGreaterThan(0);
    await expect(members.memberRows, "the roster now holds the owner and the member who joined").toHaveCount(2);

    await members.chooseRole(memberId, PROMOTED_ROLE);
    await expect
      .poll(async () => members.roleOf(memberId), { timeout: 60_000, interval: 500 })
      .toBe(PROMOTED_ROLE);
    expect(await members.roleOf(memberId), "members-row-role shows the role this journey set through the role form").toBe(PROMOTED_ROLE);
    await checkpoint(page, testInfo, "panel");
    await expect(page).toHaveScreenshot(["j-002-tenant-admin", "panel.png"], { mask: masks(page) });

    /* --- and the removal the act log refuses, answered in the row that asked (I-57) --- */
    stageActsFor(tenantId, memberId);
    await members.open(tenantId);
    await members.submitRemoval(memberId);

    await expect(members.refusal(memberId), "the refused row answers in members-refusal, in place").toBeVisible();
    expect(await members.refusalCode(memberId), "the refused row wears MEMBER_HAS_ACTS machine-readably (AC-4)").toBe(MEMBER_HAS_ACTS);
    await expect(members.memberRows, "nothing was removed: the roster is what it was").toHaveCount(2);
    await checkpoint(page, testInfo, "remove-refused");
    await expect(page).toHaveScreenshot(["j-002-tenant-admin", "remove-refused.png"], { mask: masks(page) });
  });
});
