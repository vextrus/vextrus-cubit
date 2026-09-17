// What a project's pinned rule-set edition looks like to a surface (R-SPINE-012): the identity it
// was pinned as, the digest of its content, the parameter values a measurement reads, and the chain
// it was forked along — platform → tenant → project — with every step naming itself.
//
// L-MEA-01 keeps identity and digest apart, so this view carries them as two fields and never lets
// one stand in for the other.
import { and, desc, eq, forTenant, isUuid, tenantRulesetEditions, rulesetEditions, type TenantDb, type TenantTx } from "../../db";
import type { EditionIdentity, EditionLineageStep, EditionParameter, MethodPair } from "./content";

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

/**
 * The current project-scope edition, whole — what the authoring act forks from (AM-04). The view
 * above shows a reader identity, digest, parameters and lineage; an author needs the row itself:
 * the id the new edition names as its parent, and the methods in force, which are copied verbatim
 * and never authored (L-MEA-01 keys the digest over values × the (rule id, version) pairs).
 */
export interface CurrentProjectEdition {
  readonly editionId: string;
  readonly name: string;
  readonly version: string;
  readonly digest: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  readonly methods: readonly MethodPair[];
}

/** The columns the authoring read takes, which is the whole stored edition bar its scope. */
const AUTHORING_COLUMNS = {
  editionId: tenantRulesetEditions.editionId,
  name: tenantRulesetEditions.name,
  version: tenantRulesetEditions.version,
  digest: tenantRulesetEditions.contentDigest,
  parameters: tenantRulesetEditions.parameters,
  methods: tenantRulesetEditions.methods,
} as const;

/** The same columns off a platform edition, which is the head of a chain and so has no parent. */
const PLATFORM_COLUMNS = {
  scope: rulesetEditions.scope,
  name: rulesetEditions.name,
  version: rulesetEditions.version,
  contentDigest: rulesetEditions.contentDigest,
  parameters: rulesetEditions.parameters,
} as const;

/** Every project-scope edition this project has ever held — the creation pin and each one authored. */
function pinOf(tenantId: string, projectId: string) {
  return and(eq(tenantRulesetEditions.tenantId, tenantId), eq(tenantRulesetEditions.projectId, projectId), eq(tenantRulesetEditions.scope, "project"));
}

/**
 * The order the CURRENT edition is read in (AM-04's reading): newest first. `created_at` is the
 * fact, and `edition_id` breaks a tie — two rows minted inside one clock tick would otherwise be
 * ordered by whatever the plan happened to return, and "the project's current edition" cannot be a
 * property of a query plan.
 */
const NEWEST_FIRST = [desc(tenantRulesetEditions.createdAt), desc(tenantRulesetEditions.editionId)] as const;

/**
 * The project's current edition as the authoring act reads it, on the transaction the act runs in
 * (L-ACT-01: the preview reads the state the write will see). `undefined` means no project-scope
 * row at all, which is the no-pin shape the view above answers a reader with.
 */
export async function currentProjectEdition(tx: TenantTx, { tenantId, projectId }: { tenantId: string; projectId: string }): Promise<CurrentProjectEdition | undefined> {
  if (!isUuid(tenantId) || !isUuid(projectId)) return undefined;
  const rows = await tx.select(AUTHORING_COLUMNS).from(tenantRulesetEditions).where(pinOf(tenantId, projectId)).orderBy(...NEWEST_FIRST).limit(1);
  return rows[0];
}

/** Every version this project's rule set has already been minted under (L-MEA-01's identity). */
export async function projectEditionVersions(tx: TenantTx, { tenantId, projectId }: { tenantId: string; projectId: string }): Promise<readonly string[]> {
  if (!isUuid(tenantId) || !isUuid(projectId)) return [];
  const rows = await tx.select({ version: tenantRulesetEditions.version }).from(tenantRulesetEditions).where(pinOf(tenantId, projectId));
  return rows.map((row) => row.version);
}

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
 * The chain an edition was forked along, head first. A lineage is shown whole or not at all
 * (R-SPINE-012): a parent id naming no stored edition, and a chain that runs past the cap, are both
 * inconsistencies of the store — a shortened chain rendered as if it were the whole one would tell a
 * reader the edition came from somewhere it did not. Neither is swallowed (ARCH-03).
 */
async function lineageOf(db: TenantDb, pin: StoredEdition): Promise<EditionLineageStep[]> {
  const chain: EditionLineageStep[] = [stepOf(pin)];
  let parentId = pin.parentEditionId;
  while (parentId !== null) {
    if (chain.length > LINEAGE_DEPTH_CAP) {
      throw new Error(`the lineage of the pinned rule-set edition runs past ${LINEAGE_DEPTH_CAP} steps — a parent chain that does not end is a cycle, not a lineage (R-SPINE-012)`);
    }
    const parent: StoredEdition | undefined = await editionById(db, parentId);
    if (parent === undefined) {
      throw new Error(`the rule-set edition ${parentId} is named as a parent but is not in the store — a lineage with a step missing is an inconsistency, never a shorter chain (R-SPINE-012)`);
    }
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
    .where(pinOf(tenantId, projectId))
    .orderBy(...NEWEST_FIRST)
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
