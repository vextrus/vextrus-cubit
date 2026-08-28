// What a project's pinned rule-set edition looks like to a surface (R-SPINE-012): the identity it
// was pinned as, the digest of its content, the parameter values a measurement reads, and the chain
// it was forked along — platform → tenant → project — with every step naming itself.
//
// L-MEA-01 keeps identity and digest apart, so this view carries them as two fields and never lets
// one stand in for the other.
import { and, eq, forTenant, isUuid, tenantRulesetEditions, rulesetEditions, type TenantDb } from "../../db";
import type { EditionIdentity, EditionLineageStep, EditionParameter } from "./content";

/** A project with a pin: what it pinned, what that content digests to, and where it came from. */
export interface PinnedRulesetView {
  readonly pinned: true;
  readonly identity: EditionIdentity;
  readonly digest: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  /** Ordered platform → tenant → project: the head of the chain first (L-REG-07). */
  readonly lineage: readonly EditionLineageStep[];
}

/**
 * An address that names no pin. L-REG-07 makes an unpinned project unrepresentable, so this shape
 * means the address names no project of this workspace — an answer, never a fault: a segment that
 * is not a uuid would reach the database as a cast error (22P02) rather than as a row that is not
 * there, so it is judged here first.
 */
export interface UnpinnedRulesetView {
  readonly pinned: false;
  readonly tenantId: string;
}

export type ProjectRulesetView = PinnedRulesetView | UnpinnedRulesetView;

/** How far a lineage may be walked before the walk is taken to be a cycle rather than a chain. */
const LINEAGE_DEPTH_CAP = 8;

/** One stored edition, in the shape both tables answer it in. */
interface StoredEdition {
  readonly scope: EditionIdentity["scope"];
  readonly name: string;
  readonly version: string;
  readonly contentDigest: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  readonly parentEditionId: string | null;
}

/** The columns a surface reads off a tenant-scoped edition, with the parent it was forked from. */
const TENANT_COLUMNS = {
  scope: tenantRulesetEditions.scope,
  name: tenantRulesetEditions.name,
  version: tenantRulesetEditions.version,
  contentDigest: tenantRulesetEditions.contentDigest,
  parameters: tenantRulesetEditions.parameters,
  parentEditionId: tenantRulesetEditions.parentEditionId,
} as const;

/** The same columns off a platform edition, which is the head of a chain and so has no parent. */
const PLATFORM_COLUMNS = {
  scope: rulesetEditions.scope,
  name: rulesetEditions.name,
  version: rulesetEditions.version,
  contentDigest: rulesetEditions.contentDigest,
  parameters: rulesetEditions.parameters,
} as const;

/** The edition of this id, wherever it is held: a workspace's own first, then the platform's. */
async function editionById(db: TenantDb, editionId: string): Promise<StoredEdition | undefined> {
  const own = await db.select(TENANT_COLUMNS).from(tenantRulesetEditions).where(eq(tenantRulesetEditions.editionId, editionId)).limit(1);
  const held = own[0];
  if (held !== undefined) return held;
  const platform = await db.select(PLATFORM_COLUMNS).from(rulesetEditions).where(eq(rulesetEditions.editionId, editionId)).limit(1);
  const seeded = platform[0];
  return seeded === undefined ? undefined : { ...seeded, parentEditionId: null };
}

/** One step of the chain, as a surface shows it: an identity and the digest that step carries. */
function stepOf(edition: StoredEdition): EditionLineageStep {
  return { scope: edition.scope, name: edition.name, version: edition.version, digest: edition.contentDigest };
}

/**
 * The chain an edition was forked along, head first. The walk is capped: a parent link that came
 * back to a row already seen would otherwise be read forever, and a chain nothing terminates is not
 * a lineage.
 */
async function lineageOf(db: TenantDb, pin: StoredEdition): Promise<EditionLineageStep[]> {
  const chain: EditionLineageStep[] = [stepOf(pin)];
  let parentId = pin.parentEditionId;
  for (let step = 0; step < LINEAGE_DEPTH_CAP && parentId !== null; step += 1) {
    const parent: StoredEdition | undefined = await editionById(db, parentId);
    if (parent === undefined) break;
    chain.push(stepOf(parent));
    parentId = parent.parentEditionId;
  }
  return chain.reverse();
}

/**
 * The rule-set edition a project is pinned to, and the chain it was forked along (R-SPINE-012).
 * Answers the no-pin shape for any address that names no pin of this workspace — the settings
 * screen's honest absence (R-UI-020), never a throw.
 */
export async function projectRulesetView({ tenantId, projectId }: { tenantId: string; projectId: string }): Promise<ProjectRulesetView> {
  if (!isUuid(tenantId) || !isUuid(projectId)) return { pinned: false, tenantId };

  const db = forTenant({ tenantId });
  const pins = await db
    .select(TENANT_COLUMNS)
    .from(tenantRulesetEditions)
    .where(and(eq(tenantRulesetEditions.projectId, projectId), eq(tenantRulesetEditions.scope, "project")))
    .limit(1);
  const pin = pins[0];
  if (pin === undefined) return { pinned: false, tenantId };

  return {
    pinned: true,
    identity: { scope: pin.scope, name: pin.name, version: pin.version },
    digest: pin.contentDigest,
    parameters: pin.parameters,
    lineage: await lineageOf(db, pin),
  };
}
