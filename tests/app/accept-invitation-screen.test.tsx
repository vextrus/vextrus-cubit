// @vitest-environment jsdom
// The ACCEPT screen's door (src/app/(app)/accept-invitation/page.tsx): a mailed token is read
// through a limited door, so a stranger holding an address cannot walk the token space, and a
// refused read answers with the register's own words instead of an offer.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { refusal } from "../../src/core/faults/refusal-marker";

const seams = vi.hoisted(() => ({
  admitAttempt: vi.fn(async () => {}),
  offeredInvitation: vi.fn(async () => ({ workspaceName: "Ashuganj Works", workspaceRole: "member" })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../../src/server/auth/rate-limit", () => ({ admitAttempt: seams.admitAttempt }));
vi.mock("../../src/modules/spine/tenancy", () => ({ offeredInvitation: seams.offeredInvitation }));
vi.mock("../../src/server/auth/invitation-mail", () => ({ invitationMachinery: {} }));
// The accept itself is another screen's door; this criterion is about the read that renders the
// offer, and standing in for the action keeps the tenancy module out of the mount.
vi.mock("../../src/app/(app)/accept-invitation/actions", () => ({ acceptInvitationAction: vi.fn(async () => ({ accepted: true })) }));
vi.mock("../../src/server/shell/session", () => ({ presentedSessionToken: vi.fn(async () => "presented-token") }));
vi.mock("../../src/server/shell/resolve", () => ({ sessionOf: vi.fn(async () => ({ userId: "user-7", email: "invitee@example.com" })) }));

const AcceptInvitation = (await import("../../src/app/(app)/accept-invitation/page")).default;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

/** The screen, rendered for the address a mailed link produces. */
async function screenFor(token: string): Promise<void> {
  render(await AcceptInvitation({ searchParams: Promise.resolve({ token }) }));
}

test("AC-1(b): the token read spends the tenancy door on the account before it reads anything", async () => {
  await screenFor("mailed-token");

  expect(seams.admitAttempt, "the accept read is limited on the account that presented the session").toHaveBeenCalledWith("tenancyAdmin", "user-7");
  const admitted = seams.admitAttempt.mock.invocationCallOrder[0];
  const read = seams.offeredInvitation.mock.invocationCallOrder[0];
  expect(admitted, "the door is spent at all").toBeDefined();
  expect(read, "the offer is still read once the door admits the attempt").toBeDefined();
  expect(admitted as number).toBeLessThan(read as number);
});

test("AC-1(b): a refused door answers with RATE_LIMITED and offers nothing to submit", async () => {
  seams.admitAttempt.mockRejectedValueOnce(refusal("RATE_LIMITED", "Too many attempts."));

  await screenFor("mailed-token");

  const answer = screen.getByTestId("accept-invitation-refusal");
  const coded = answer.matches('[data-code="RATE_LIMITED"]') ? answer : answer.querySelector('[data-code="RATE_LIMITED"]');
  expect(coded, "the refusal travels machine-readably, as the register's own code").not.toBeNull();
  expect(screen.queryByTestId("accept-invitation-form"), "nothing is offered to submit over a read that was refused").toBeNull();
  expect(seams.offeredInvitation, "a refused door reads no offer").not.toHaveBeenCalled();
});
