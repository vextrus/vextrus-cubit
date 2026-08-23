/**
 * J-002 — Tenant admin: invite, roles, remove refused with `MEMBER_HAS_ACTS`
 * (R-SPINE-003, S-Settings, P-ADMIN, R-UI-050).
 *
 * Six named checkpoints, in the order an administrator meets them: invite-pending,
 * resend-outbox-grows, revoke-clears-pending, role-persists, remove-succeeds, remove-refused.
 * They are one walk through one screen, so they are one test: the roster is seeded once per
 * lane run and each step is the state the next one starts from — split apart, every one of
 * them would have to rebuild the last one's work before it could begin.
 *
 * A second test drives the other side of P-ADMIN: a MEMBER opening the same address meets the
 * R-UI-050 permission-denied state instead of the controls (Interpretation 1).
 *
 * `J-002` is on the describe because `pnpm e2e --journey J-002` is Playwright's `--grep` over
 * the full title path, so a spec that never says it is a spec nothing selects.
 */
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './axe';
import {
  ADMIN_ROLE,
  IDLE_EMAIL,
  INVITEE_EMAIL,
  MEMBER_ROLE,
  OWNER_EMAIL,
  SETTINGS_ROUTE,
  WORKER_EMAIL,
  emptyState,
  emptyStateAction,
  invitationResend,
  invitationRevoke,
  invitationRow,
  inviteEmail,
  inviteRole,
  inviteSubmit,
  memberRemove,
  memberRole,
  memberRow,
  membersSection,
  openSettings,
  outboxCount,
  outboxGrewPast,
  permissionDenied,
  refusalCode,
  refusalRemedy,
  settingsRefusal,
  settled,
  signIn,
  tenantSettings,
} from './pages/settings';

/** The code R-SPINE-003 names for a removal the ledger refuses. */
const MEMBER_HAS_ACTS = 'MEMBER_HAS_ACTS';

test.describe('J-002', () => {
  test('J-002 invite-pending → resend-outbox-grows → revoke-clears-pending → role-persists → remove-succeeds → remove-refused: tenant administration end to end', async ({
    page,
  }) => {
    await signIn(page, OWNER_EMAIL);
    await openSettings(page);

    // The screen as it is seeded: three members, and nothing awaiting an answer — so the
    // invitations section teaches the next action rather than showing an empty list.
    await expect(membersSection(page)).toBeVisible();
    await expect(memberRow(page, OWNER_EMAIL)).toBeVisible();
    await expect(memberRow(page, WORKER_EMAIL)).toBeVisible();
    await expect(memberRow(page, IDLE_EMAIL)).toBeVisible();
    await expect(emptyState(page)).toBeVisible();
    await expect(emptyStateAction(page)).toBeVisible();
    await settled(tenantSettings(page));
    await expectNoAxeViolations(page);

    // Checkpoint "invite-pending": the address is listed pending, and its mail is in the
    // outbox — the M0 mail seam is a table, exactly as J-001 reads auth mail.
    const before = await outboxCount(INVITEE_EMAIL);
    await inviteEmail(page).fill(INVITEE_EMAIL);
    await inviteRole(page).selectOption(MEMBER_ROLE);
    await inviteSubmit(page).click();
    await expect(invitationRow(page, INVITEE_EMAIL)).toBeVisible();
    const invited = await outboxGrewPast(INVITEE_EMAIL, before);

    // Checkpoint "resend-outbox-grows": the same invitation, sent again — a further mail, and
    // still one row in the pending list.
    await invitationResend(page, INVITEE_EMAIL).click();
    await outboxGrewPast(INVITEE_EMAIL, invited);
    await expect(invitationRow(page, INVITEE_EMAIL)).toHaveCount(1);

    // Checkpoint "revoke-clears-pending": the row leaves the pending list (the invitation
    // itself is kept — history is not deleted, which is the seam's claim, not the screen's).
    await invitationRevoke(page, INVITEE_EMAIL).click();
    await expect(invitationRow(page, INVITEE_EMAIL)).toHaveCount(0);
    await expect(emptyState(page)).toBeVisible();

    // Checkpoint "role-persists": MEMBER → ADMIN on idle@, and a reload still says ADMIN —
    // the screen holds nothing of its own, the row is read from the database each time.
    await expect(memberRole(page, IDLE_EMAIL)).toHaveValue(MEMBER_ROLE);
    await memberRole(page, IDLE_EMAIL).selectOption(ADMIN_ROLE);
    await expect(memberRole(page, IDLE_EMAIL)).toHaveValue(ADMIN_ROLE);
    await page.reload();
    await expect(tenantSettings(page)).toBeVisible();
    await expect(memberRole(page, IDLE_EMAIL)).toHaveValue(ADMIN_ROLE);

    // Checkpoint "remove-succeeds": idle@ holds no acts, so their row goes.
    await memberRemove(page, IDLE_EMAIL).click();
    await expect(memberRow(page, IDLE_EMAIL)).toHaveCount(0);
    await expect(settingsRefusal(page)).toHaveCount(0);

    // Checkpoint "remove-refused": worker@ holds a seeded act on an open campaign, so the
    // removal is refused by code — and the refused row is shown, never hidden (R-UI-050).
    await memberRemove(page, WORKER_EMAIL).click();
    await expect(settingsRefusal(page)).toBeVisible();
    await settled(settingsRefusal(page));
    await expect(refusalCode(page)).toHaveText(MEMBER_HAS_ACTS);
    await expect(refusalRemedy(page)).not.toBeEmpty();
    await expect(memberRow(page, WORKER_EMAIL)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('J-002 permission-denied: a MEMBER meets the state that names the permission, not the controls (P-ADMIN)', async ({
    page,
  }) => {
    await signIn(page, WORKER_EMAIL);
    await page.goto(SETTINGS_ROUTE);

    await expect(tenantSettings(page)).toBeVisible();
    await expect(permissionDenied(page)).toBeVisible();
    await expect(membersSection(page)).toHaveCount(0);
    await expect(inviteSubmit(page)).toHaveCount(0);
    await settled(tenantSettings(page));
    await expectNoAxeViolations(page);
  });
});
