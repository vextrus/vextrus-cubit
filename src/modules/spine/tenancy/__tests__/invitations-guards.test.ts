// R-SPINE-006's guards on R-SPINE-003's invitations, each proved the only way a guard can be
// proved: by asking, and being told no.
//
// Every case drives the shipped guarded entry — the one every tenant-administration mutation comes
// through — and grades what came back, so what is judged here is the sequence a browser meets: the
// origin claim first, then the door's allowance, then the module's own law. A case that named a
// refusal without making a request would name a refusal nobody made.
//
// The store is doubled rather than reached: the four guards below all refuse BEFORE a row is read or
// written, and a unit lane that opened a database to prove that would be proving something else. The
// behaviour these doors have against a real store is graded live, by the acceptance that drives them
// in a browser.
import { describe, expect, test, vi } from "vitest";
import type { WorkspaceRole } from "../../../../core/db";
import { refusalOf } from "../../../../core/errors";
import { guardTenancyMutation } from "../guard";

/** The role the doubled store says the acting membership holds, set per case. */
let heldRole: WorkspaceRole | null = "OWNER";

vi.mock("../roles/store", () => ({
  actingWorkspaceOf: async (): Promise<string> => "",
  membershipsOf: async (): Promise<readonly never[]> => [],
  roleHeld: async (): Promise<WorkspaceRole | null> => heldRole,
  movingWorkspaceRoles: async (): Promise<never> => {
    throw new Error("no role move is made in this file");
  },
}));

vi.mock("../invitations/store", () => ({
  writeInvitation: async (): Promise<never> => {
    throw new Error("no invitation is written in this file");
  },
  standingInvitations: async (): Promise<readonly never[]> => [],
  standingInvitation: async (): Promise<null> => null,
  withdrawInvitation: async (): Promise<null> => null,
  reissueToken: async (): Promise<null> => null,
  // No invitation was ever minted for anything this file presents, which is one of the four ways an
  // offer is not claimable — and the one a stranger holding a made-up token meets.
  invitationByDigest: async (): Promise<null> => null,
  accountKey: async (): Promise<string> => "as presented invitee@cubit.test",
  workspaceName: async (): Promise<string> => "",
  claimInvitation: async (): Promise<null> => null,
}));

/** The workspace and the account every case below acts as — real uuids, so nothing is malformed. */
const ACTOR = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as const;

/** The address this deployment states it answers at, and the page a lawful request comes from. */
const ORIGIN = "https://cubit.example";

/** The counting the server injects, refusing the way the shipped limiter refuses (R-SPINE-006). */
let allowance: "open" | "spent" = "open";

/** The mail machinery the server injects. Nothing here sends: every case is refused before it could. */
const machinery = {
  mintToken: (): string => "a-token-nobody-was-mailed",
  digestToken: (secret: string): string => `digest of ${secret}`,
  storedKey: (address: string): string => `as presented ${address}`,
  mailedAddress: (address: string): string => address,
  addressForKey: (key: string): string | null => key.replace("as presented ", ""),
  send: (): void => {
    throw new Error("no mail leaves this file");
  },
};

/**
 * The guarded entry, bound exactly as a transport binds it: the door's allowance, and the invitation
 * machinery the module may not import for itself (ARCH-01).
 */
const guarded = guardTenancyMutation({
  admit: async (): Promise<void> => {
    if (allowance === "spent") throw Object.assign(new Error("the window is full"), { refusalCode: refusalOf("RATE_LIMITED").code });
  },
  invitations: machinery,
});

/** One request at the entry, from a page this deployment serves unless a case says otherwise. */
const requestFrom = (statedOrigin: string | null) => ({
  actor: ACTOR,
  identity: ACTOR.userId,
  statedOrigin,
  requestOrigin: ORIGIN,
  configuredOrigin: ORIGIN,
});

describe("R-SPINE-006: every invitation move is judged by the guarded entry, and each guard refuses", () => {
  test("a page this deployment does not serve cannot mint an invitation with somebody's cookie", async () => {
    allowance = "open";
    heldRole = "OWNER";
    await expect(
      guarded(requestFrom("https://attacker.example"), { kind: "createInvitation", email: "invitee@cubit.test" }),
      "the origin claim is judged before anything moves, and a foreign page is answered ORIGIN_NOT_VERIFIED",
    ).rejects.toMatchObject({ refusalCode: refusalOf("ORIGIN_NOT_VERIFIED").code });
  });

  test("a forged Host does not make a foreign page's origin one this deployment answers at", async () => {
    allowance = "open";
    heldRole = "OWNER";
    const forged = "https://attacker.example";
    await expect(
      // Everything a caller writes says the same thing: the `Origin` the page stated, and the `Host`
      // the address the request "arrived at" is composed from (src/server/context.ts). Only the
      // deployment's own statement of where it answers is not the caller's to write, so only it
      // decides — R-SPINE-001's ban on judging by client-written headers, on R-SPINE-006's question.
      guarded({ actor: ACTOR, identity: ACTOR.userId, statedOrigin: forged, requestOrigin: forged, configuredOrigin: ORIGIN }, { kind: "createInvitation", email: "invitee@cubit.test" }),
      "a stated origin that matches only a Host the caller wrote is still a foreign page: ORIGIN_NOT_VERIFIED, before anything is written or mailed",
    ).rejects.toMatchObject({ refusalCode: refusalOf("ORIGIN_NOT_VERIFIED").code });
  });

  test("a deployment that stated no address does not admit a foreign page by the Host it was reached at", async () => {
    allowance = "open";
    heldRole = "OWNER";
    const forged = "https://attacker.example";
    await expect(
      // Nothing configured and a request that did not arrive on this machine's own address: there is
      // no fact left that the caller did not write, so there is nothing to admit the claim against.
      guarded({ actor: ACTOR, identity: ACTOR.userId, statedOrigin: forged, requestOrigin: forged, configuredOrigin: "" }, { kind: "createInvitation", email: "invitee@cubit.test" }),
      "an unconfigured deployment answering on a real hostname refuses ORIGIN_NOT_VERIFIED: absence is not permission (R-SPINE-001, R-SPINE-006)",
    ).rejects.toMatchObject({ refusalCode: refusalOf("ORIGIN_NOT_VERIFIED").code });
  });

  test("an allowance already spent refuses the invitation before the workspace is read", async () => {
    allowance = "spent";
    heldRole = "OWNER";
    await expect(
      guarded(requestFrom(ORIGIN), { kind: "createInvitation", email: "invitee@cubit.test" }),
      "the door's allowance is spent second, and a full window is answered RATE_LIMITED",
    ).rejects.toMatchObject({ refusalCode: refusalOf("RATE_LIMITED").code });
  });

  test("a member whose role does not administer the workspace may offer nobody a membership of it", async () => {
    allowance = "open";
    heldRole = "MEMBER";
    await expect(
      guarded(requestFrom(ORIGIN), { kind: "createInvitation", email: "invitee@cubit.test" }),
      "the two-sided law is judged third, and a role that carries no administration is answered WORKSPACE_PERMISSION_NOT_HELD",
    ).rejects.toMatchObject({ refusalCode: refusalOf("WORKSPACE_PERMISSION_NOT_HELD").code });
  });

  test("an ADMIN cannot mail out an OWNER's rank", async () => {
    allowance = "open";
    heldRole = "ADMIN";
    await expect(
      guarded(requestFrom(ORIGIN), { kind: "createInvitation", email: "invitee@cubit.test", role: "OWNER" }),
      "nobody offers a rank above their own — the granted side of R-SPINE-006, refused as WORKSPACE_PERMISSION_NOT_HELD",
    ).rejects.toMatchObject({ refusalCode: refusalOf("WORKSPACE_PERMISSION_NOT_HELD").code });
  });

  test("a token no invitation was ever minted for grants nothing", async () => {
    allowance = "open";
    heldRole = null;
    await expect(
      guarded(requestFrom(ORIGIN), { kind: "acceptInvitation", token: "a-token-no-invitation-was-ever-minted-for" }),
      "an unknown, spent, withdrawn or differently addressed offer is one answer: INVITATION_NOT_CLAIMABLE",
    ).rejects.toMatchObject({ refusalCode: refusalOf("INVITATION_NOT_CLAIMABLE").code });
  });
});
