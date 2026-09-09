// L-REG-07: a project pins a rule-set edition at creation — forked platform → tenant → project, in
// one transaction, so an unpinned project is unrepresentable. This is that fork, and it runs
// entirely inside the transaction its caller is already in: a pin committed apart from the project
// it belongs to would be exactly the unpinned project the clause forbids.
//
// The fork is verbatim (L-MEA-01): content is copied, never re-derived, so every step of the chain
// carries the same digest by construction. Only the identity moves — the scope, which is what tells
// a workspace's template from the platform edition it came from.
import { and, eq, holdStateLock, isNull, rulesetEditions, tenantRulesetEditions, type TenantTx } from "@/core/db";
import type { EditionParameter, MethodPair } from "@/core/rulesets/editions";
import { SEED_EDITION_IDENTITY } from "@/core/rulesets/seed";

/** What a pin is a fork of: the content, and the row it was copied from. */
interface ForkSource {
  readonly editionId: string;
  readonly name: string;
  readonly version: string;
  readonly contentDigest: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  readonly methods: readonly MethodPair[];
}

/** The edition a project ends up pinned to. */
export interface PinnedEdition {
  readonly editionId: string;
  readonly digest: string;
}

/**
 * The state a second concurrent project creation must wait behind: two transactions that both found
 * no template would otherwise both mint one, and a workspace holds one template however many
 * projects fork from it. The lock is on the name of that state rather than on rows that do not
 * exist yet, and it is released when the caller's transaction ends, whichever way it ends.
 */
const templateLockKey = (tenantId: string): string => `ruleset-template:${tenantId}`;

/** The platform seed, found by the identity L-MEA-01 gives it. */
async function platformSeed(tx: TenantTx): Promise<ForkSource> {
  const rows = await tx
    .select({
      editionId: rulesetEditions.editionId,
      name: rulesetEditions.name,
      version: rulesetEditions.version,
      contentDigest: rulesetEditions.contentDigest,
      parameters: rulesetEditions.parameters,
      methods: rulesetEditions.methods,
    })
    .from(rulesetEditions)
    .where(
      and(
        eq(rulesetEditions.scope, SEED_EDITION_IDENTITY.scope),
        eq(rulesetEditions.name, SEED_EDITION_IDENTITY.name),
        eq(rulesetEditions.version, SEED_EDITION_IDENTITY.version),
      ),
    )
    .limit(1);
  const seed = rows[0];
  if (seed === undefined) {
    throw new Error(
      `no platform rule-set edition ${SEED_EDITION_IDENTITY.name} @ ${SEED_EDITION_IDENTITY.version} is in the store — a project cannot pin a fork of an edition that is not there (L-REG-07)`,
    );
  }
  return seed;
}

/** A workspace's own edition of the given scope, when it already holds one. */
async function ownEdition(tx: TenantTx, tenantId: string, scope: "tenant" | "project", projectId: string | null): Promise<ForkSource | undefined> {
  const rows = await tx
    .select({
      editionId: tenantRulesetEditions.editionId,
      name: tenantRulesetEditions.name,
      version: tenantRulesetEditions.version,
      contentDigest: tenantRulesetEditions.contentDigest,
      parameters: tenantRulesetEditions.parameters,
      methods: tenantRulesetEditions.methods,
    })
    .from(tenantRulesetEditions)
    .where(
      and(
        eq(tenantRulesetEditions.tenantId, tenantId),
        eq(tenantRulesetEditions.scope, scope),
        projectId === null ? isNull(tenantRulesetEditions.projectId) : eq(tenantRulesetEditions.projectId, projectId),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * The isolation this transaction runs at, as Postgres names it. Asked on the two paths whose
 * correctness depends on it — the mint behind the lock, and a mint observed from another
 * transaction — so the answer names the condition in the sentence that reports it rather than being
 * carried around by every pin.
 */
async function isolationOf(tx: TenantTx): Promise<string> {
  const rows = await tx.execute<Record<string, string>>(`show transaction_isolation`);
  const answered = (rows as unknown as Record<string, string>[])[0];
  const isolation = answered === undefined ? undefined : Object.values(answered)[0];
  return isolation ?? "an isolation this transaction did not answer";
}

/**
 * Copy an edition into this workspace under a new scope: same content, same digest, new row — or
 * nothing, where the row this offer would write already stands.
 *
 * The offer is made rather than assumed: the store's own uniqueness (one template per workspace, one
 * pin per project) is what actually settles two concurrent creations, and a transaction that loses
 * that race must find the winner's row rather than raise a driver error out of an ordinary
 * simultaneity (ARCH-03).
 */
async function fork(
  tx: TenantTx,
  tenantId: string,
  parent: ForkSource,
  scope: "tenant" | "project",
  projectId: string | null,
): Promise<ForkSource | undefined> {
  const written = await tx
    .insert(tenantRulesetEditions)
    .values({
      tenantId,
      scope,
      projectId,
      parentEditionId: parent.editionId,
      name: parent.name,
      version: parent.version,
      contentDigest: parent.contentDigest,
      parameters: parent.parameters,
      methods: parent.methods,
    })
    .onConflictDoNothing()
    .returning({ editionId: tenantRulesetEditions.editionId });
  const row = written[0];
  return row === undefined ? undefined : { ...parent, editionId: row.editionId };
}

/**
 * The row this workspace ends up holding under one scope: the fork this transaction wrote, or — when
 * a concurrent creation wrote it first — the row that concurrent creation left.
 *
 * The second read is the whole point. At READ COMMITTED it sees the winner's committed row and the
 * loser pins the same edition, which is what makes two simultaneous first creations answer one
 * template. At a stricter isolation the loser's snapshot predates that commit and no read inside
 * this transaction can ever see the row, so nothing here can pin: it says exactly that, naming the
 * isolation it is running at, and the caller retries the transaction (ARCH-03, B-21). It never
 * spins, and it never dresses the condition as a driver fault.
 */
async function forkOrFindStanding(tx: TenantTx, tenantId: string, parent: ForkSource, scope: "tenant" | "project", projectId: string | null): Promise<ForkSource> {
  const written = await fork(tx, tenantId, parent, scope, projectId);
  if (written !== undefined) return written;

  const standing = await ownEdition(tx, tenantId, scope, projectId);
  if (standing !== undefined) return standing;

  const isolation = await isolationOf(tx);
  throw new Error(
    `another transaction minted this workspace's ${scope} rule-set edition and this one, running at ${isolation}, cannot see it — the narrowed template lock settles a race at read committed only, so this creation must be retried (L-REG-07)`,
  );
}

/**
 * The workspace's template, minted on first use. Only the minting path takes the tenant-wide lock:
 * once the template is there nothing can race, and a lock held for the rest of every
 * project-creation transaction would serialise creations that have nothing to settle between them.
 *
 * The narrowed lock is sound under READ COMMITTED and only there: under the lock the read is taken
 * again, because the transaction waited on is the one that minted the template, and that re-read
 * sees the minted row only where each statement takes its own snapshot — which is READ COMMITTED.
 * `tenant_ruleset_editions_template_once` guarantees uniqueness, never re-readability: at a stricter
 * isolation it still holds the workspace to one template, but the waiting transaction's snapshot
 * predates the commit, so no read of its own can ever find what it must not duplicate. That premise
 * is therefore enforced where the lock is taken rather than claimed here (B-21): a mint at a
 * stricter isolation says so and is retried, it does not proceed on a lock that cannot carry it.
 */
async function workspaceTemplate(tx: TenantTx, tenantId: string): Promise<ForkSource> {
  const held = await ownEdition(tx, tenantId, "tenant", null);
  if (held !== undefined) return held;

  await holdStateLock(tx, templateLockKey(tenantId));
  const behindTheLock = await ownEdition(tx, tenantId, "tenant", null);
  if (behindTheLock !== undefined) return behindTheLock;

  const isolation = await isolationOf(tx);
  if (isolation.trim().toLowerCase() !== "read committed") {
    throw new Error(
      `this workspace holds no rule-set template and this transaction, running at ${isolation}, would mint one behind the narrowed template lock — that lock is sound under READ COMMITTED only, because tenant_ruleset_editions_template_once guarantees uniqueness and never re-readability, so this creation must be retried at READ COMMITTED (L-REG-07)`,
    );
  }
  return await forkOrFindStanding(tx, tenantId, await platformSeed(tx), "tenant", null);
}

/**
 * Pin the project to its own edition, forking the workspace's template — and the platform seed
 * behind it — on first use (L-REG-07). Runs on the transaction it is handed, so the pin and the
 * project it belongs to commit together or not at all.
 *
 * A project already pinned keeps the edition it has: an edition is immutable, and re-pinning is an
 * authored act with its own permission (L-MEA-01), never something a repeated creation does quietly.
 */
export async function pinRulesetForProject(tx: TenantTx, { tenantId, projectId }: { tenantId: string; projectId: string }): Promise<PinnedEdition> {
  const existing = await ownEdition(tx, tenantId, "project", projectId);
  if (existing !== undefined) return { editionId: existing.editionId, digest: existing.contentDigest };

  const pin = await forkOrFindStanding(tx, tenantId, await workspaceTemplate(tx, tenantId), "project", projectId);
  return { editionId: pin.editionId, digest: pin.contentDigest };
}
