// L-REG-07: a project pins a rule-set edition at creation — forked platform → tenant → project, in
// one transaction, so an unpinned project is unrepresentable. This is that fork, and it runs
// entirely inside the transaction its caller is already in: a pin committed apart from the project
// it belongs to would be exactly the unpinned project the clause forbids.
//
// The fork is verbatim (L-MEA-01): content is copied, never re-derived, so every step of the chain
// carries the same digest by construction. Only the identity moves — the scope, which is what tells
// a workspace's template from the platform edition it came from.
import { and, eq, holdStateLock, isNull, rulesetEditions, tenantRulesetEditions, type TenantTx } from "../../../core/db";
import type { EditionParameter, MethodPair } from "../../../core/rulesets/editions";
import { SEED_EDITION_IDENTITY } from "../../../core/rulesets/seed";

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

/** Copy an edition into this workspace under a new scope: same content, same digest, new row. */
async function fork(
  tx: TenantTx,
  tenantId: string,
  parent: ForkSource,
  scope: "tenant" | "project",
  projectId: string | null,
): Promise<ForkSource> {
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
    .returning({ editionId: tenantRulesetEditions.editionId });
  const row = written[0];
  if (row === undefined) throw new Error(`forking the ${scope} rule-set edition wrote no row (L-REG-07)`);
  return { ...parent, editionId: row.editionId };
}

/**
 * The workspace's template, minted on first use. Only the minting path takes the tenant-wide lock:
 * once the template is there nothing can race, and a lock held for the rest of every
 * project-creation transaction would serialise creations that have nothing to settle between them.
 * Under the lock the read is taken again, because the transaction waited on is the one that minted
 * it — and behind both stands `tenant_ruleset_editions_template_once`, so a workspace holds one
 * template whatever the isolation level.
 */
async function workspaceTemplate(tx: TenantTx, tenantId: string): Promise<ForkSource> {
  const held = await ownEdition(tx, tenantId, "tenant", null);
  if (held !== undefined) return held;

  await holdStateLock(tx, templateLockKey(tenantId));
  return (await ownEdition(tx, tenantId, "tenant", null)) ?? (await fork(tx, tenantId, await platformSeed(tx), "tenant", null));
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

  const pin = await fork(tx, tenantId, await workspaceTemplate(tx, tenantId), "project", projectId);
  return { editionId: pin.editionId, digest: pin.contentDigest };
}
