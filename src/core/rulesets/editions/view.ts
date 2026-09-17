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
  /** The row the project reads today — what an authored fork of it names as its parent (L-MEA-01). */
  readonly editionId: string;
  readonly identity: EditionIdentity;
  readonly digest: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  /** The (rule id, version) pairs in force. Authoring copies them verbatim and never states them. */
  readonly methods: readonly MethodPair[];
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

/** A project-scope row whole: the stored edition, plus the id and the methods a fork needs. */
export interface StoredProjectEdition extends StoredEdition {
  readonly editionId: string;
  readonly methods: readonly MethodPair[];
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

/** A project-scope row as a fork of it reads one: the view's columns, plus the id and the methods. */
const PROJECT_COLUMNS = {
  ...TENANT_COLUMNS,
  editionId: tenantRulesetEditions.editionId,
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
  const pin = await currentProjectEdition(db, { tenantId, projectId });
  if (pin === undefined) return { pinned: false, tenantId };

  return {
    pinned: true,
    editionId: pin.editionId,
    identity: { scope: pin.scope, name: pin.name, version: pin.version },
    digest: pin.contentDigest,
    parameters: pin.parameters,
    methods: pin.methods,
    lineage: await lineageOf(db, pin),
  };
}

/**
 * The edition a project reads RIGHT NOW: the newest project-scope row it holds (L-MEA-01, AM-04).
 *
 * L-REG-07's creation pin is the first such row and is never touched; authoring appends another with
 * the pin as its parent, so "which edition is in force" is a question about recency rather than
 * about a mutable column — `created_at` desc, with the edition id as the tiebreak, because two rows
 * written inside one transaction carry the same `now()` and a project's current edition may not
 * depend on which of two equal timestamps the planner happened to return first.
 *
 * This is the ONE reading of that question: the settings screen asks it through `projectRulesetView`
 * and the authoring act asks it on its own transaction, so a screen and a commit can never disagree
 * about what is being forked (B-17).
 */
export async function currentProjectEdition(
  db: TenantDb | TenantTx,
  { tenantId, projectId }: { tenantId: string; projectId: string },
): Promise<StoredProjectEdition | undefined> {
  const rows = await db
    .select(PROJECT_COLUMNS)
    .from(tenantRulesetEditions)
    .where(and(eq(tenantRulesetEditions.tenantId, tenantId), eq(tenantRulesetEditions.projectId, projectId), eq(tenantRulesetEditions.scope, "project")))
    .orderBy(desc(tenantRulesetEditions.createdAt), desc(tenantRulesetEditions.editionId))
    .limit(1);
  return rows[0];
}
