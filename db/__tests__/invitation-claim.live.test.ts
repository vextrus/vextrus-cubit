/**
 * AC-1(d), AC-1(e) — which invitation a digest names, and what spending one actually granted.
 *
 * `token_hash` is indexed and not unique, so `invitationByDigest` takes an ARBITRARY row of however
 * many carry the digest (debt-src-modules-1n1kswe): two live offers colliding on one digest would be
 * spent as whichever row the planner reached first, in whichever workspace. A digest names one
 * claimable offer or none.
 *
 * And `claimInvitation` writes the membership `on conflict do nothing`, then answers the OFFERED
 * role whether or not that insert wrote anything (debt-src-modules-1q5qn9b): an account that already
 * belongs to the workspace is told it now holds the offered rank while it still holds the one it
 * had. What the claim answers is whether a membership was granted, and the role the account HOLDS
 * afterwards.
 *
 * Driven at the shipped doors against a real store, staged through the shipped sign-up door.
 */
import { createHash, randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { closeStage, enrol, openStage, productModule, sql, sqlValue, type Person } from "../../tests/spine/uploads/support/upload-stage";

const BUDGET_MS = 600_000;

const INVITATIONS_STORE = "src/modules/spine/tenancy/invitations/store.ts";
const TENANCY_MODULE = "src/modules/spine/tenancy/index.ts";

/** Every offer this file makes carries the same digest: the collision the row is about. */
const ONE_DIGEST = createHash("sha256").update("one digest, two offers").digest("hex");

type InvitationRow = { invitationId: string; tenantId: string; workspaceRole: string };
type ClaimedInvitation = { invitation: InvitationRow; membershipGranted: boolean; workspaceRole: string };

type StoreSeam = {
  invitationByDigest: (tokenHash: string) => Promise<InvitationRow | null>;
  claimInvitation: (invitationId: string, userId: string) => Promise<ClaimedInvitation | null>;
};

type TenancySeam = {
  createInvitation: (actor: { tenantId: string; userId: string }, request: { email: string; role?: string }, ports: unknown) => Promise<{ invitationId: string }>;
  acceptInvitation: (claim: { userId: string; token: string }, ports: unknown) => Promise<Record<string, unknown>>;
};

/** The machinery an invitation door is handed: one digest for every token, and nothing mailed. */
function ports(): Record<string, unknown> {
  return {
    origin: "https://cubit.example",
    mintToken: () => randomUUID(),
    digestToken: () => ONE_DIGEST,
    storedKey: (address: string) => address.trim().toLowerCase(),
    mailedAddress: (address: string) => address.trim(),
    addressForKey: (key: string) => key,
    send: async () => undefined,
  };
}

interface Staged {
  store: StoreSeam;
  tenancy: TenancySeam;
  owner: Person;
  invitee: Person;
  roles: readonly string[];
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openStage();
    const owner = await enrol("inviting-owner");
    const invitee = await enrol("invited-account");
    const store = await productModule<StoreSeam>(INVITATIONS_STORE);
    const tenancy = await productModule<TenancySeam>(TENANCY_MODULE);
    const db = await productModule<{ WORKSPACE_ROLES: readonly string[] }>("src/core/db.ts");
    return { store, tenancy, owner, invitee, roles: db.WORKSPACE_ROLES };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** One standing offer of the owner's workspace to the invitee, carrying the one digest. */
async function offer(stage: Staged): Promise<string> {
  const made = await stage.tenancy.createInvitation({ tenantId: stage.owner.tenantId, userId: stage.owner.userId }, { email: stage.invitee.email }, ports());
  expect(typeof made.invitationId, "the shipped door made an offer").toBe("string");
  return made.invitationId;
}

/** The role a membership row holds, read from the store rather than transcribed. */
function roleHeld(tenantId: string, userId: string): string {
  return sqlValue(`select workspace_role from memberships where tenant_id = '${tenantId}'::uuid and user_id = '${userId}'::uuid limit 1;`);
}

test(
  "AC-1(d): a digest two claimable offers carry names neither of them",
  async () => {
    const stage = await staged();
    const first = await offer(stage);
    const second = await offer(stage);

    await expect(
      stage.store.invitationByDigest(ONE_DIGEST),
      "two live offers under one digest: spending 'the' invitation would spend whichever row was reached first",
    ).resolves.toBeNull();

    // Take one of them out of the running the way a withdrawal does, and the digest names the other.
    sql(`update invitations set revoked_at = now() where invitation_id = '${first}'::uuid;`);
    const found = await stage.store.invitationByDigest(ONE_DIGEST);
    expect(found?.invitationId, "one claimable offer under the digest is the offer the digest names").toBe(second);
  },
  BUDGET_MS,
);

test(
  "AC-1(e): a claim that granted a membership says so, and names the role now held",
  async () => {
    const stage = await staged();
    const invitationId = await offer(stage);

    const claimed = await stage.store.claimInvitation(invitationId, stage.invitee.userId);

    expect(claimed, "the offer was claimable").toBeTruthy();
    expect(claimed?.membershipGranted, "the insert wrote the row that admits this account to the workspace").toBe(true);
    expect(claimed?.workspaceRole, "and the role held afterwards is the store's own answer").toBe(roleHeld(stage.owner.tenantId, stage.invitee.userId));
  },
  BUDGET_MS,
);

test(
  "AC-1(e): a claim by an account that already belongs answers the role it holds, not the one offered",
  async () => {
    const stage = await staged();
    const held = roleHeld(stage.owner.tenantId, stage.invitee.userId);
    const other = stage.roles.find((role) => role !== held);
    expect(typeof other, "the workspace-role vocabulary holds more than one rank").toBe("string");

    // The membership stands at a different rank from the one an offer grants: a claim that changed
    // it would be a promotion nobody asked for, and one that reported it would be a lie.
    sql(`update memberships set workspace_role = '${other}' where tenant_id = '${stage.owner.tenantId}'::uuid and user_id = '${stage.invitee.userId}'::uuid;`);
    const invitationId = await offer(stage);

    const claimed = await stage.store.claimInvitation(invitationId, stage.invitee.userId);

    expect(claimed?.membershipGranted, "the insert wrote nothing: this account already belonged").toBe(false);
    expect(claimed?.workspaceRole, "so the role it holds is the role it had").toBe(other);
    expect(roleHeld(stage.owner.tenantId, stage.invitee.userId), "and the stored membership is untouched").toBe(other);
  },
  BUDGET_MS,
);

test(
  "AC-1(e): and the accept door carries the same two facts",
  async () => {
    const stage = await staged();
    const held = roleHeld(stage.owner.tenantId, stage.invitee.userId);
    await offer(stage);

    const accepted = await stage.tenancy.acceptInvitation({ userId: stage.invitee.userId, token: "any token this stage minted" }, ports());

    expect(accepted["membershipGranted"], "the account already belonged, and the answer says so").toBe(false);
    expect(accepted["workspaceRole"], "the role it holds — the same fact the store answered with").toBe(held);
  },
  BUDGET_MS,
);
