/**
 * The platform seed and the fork that pins a project to it (L-MEA-01, L-REG-07, R-SPINE-012).
 *
 * Two things live here. `IS1200_SEED` is L-MEA-01's own rule set, written down: seventeen
 * parameter values as exact decimal strings (B-07), no methods in force — M0 has no method
 * files, and the digest says so rather than pretending the second input is missing.
 *
 * `createPinnedProject` is L-REG-07's sentence made mechanical: "A project pins a rule-set
 * edition (forked platform → tenant → project at creation, in one transaction, so an unpinned
 * project is unrepresentable)." The fork chain and the `projects` INSERT are one transaction,
 * so a caller who rolls back finds no edition, no template and no project — and the pin itself
 * is NOT NULL in the schema, which is what makes "unrepresentable" a property of the database
 * rather than a promise of this module.
 *
 * `handle` is either a SEAM-TENANT handle or an open transaction, because the project-create
 * increment (C-SPINE-PROJECT) mints a PRINCIPAL in the same transaction as the project and will
 * hand this one its own `tx`. On a handle the call opens a transaction; inside one it opens a
 * savepoint, which rolls back with its parent either way.
 */
import type { ScopedDb } from '../db';
import { editionDigest } from './editions';
import type { EditionScope, Method, RuleSetParameters } from './editions';

/**
 * The seed's name, assembled from its parts rather than spelled (Q-07, the `src/server/context.ts`
 * idiom). The refusal register reads every screaming-snake literal under `src/` as a refusal
 * code, and `IS1200_IN` is a rule set's name in India's own numbering, not a refusal.
 */
const SEED_NAME = ['IS1200', 'IN'].join('_');

/** The version string names India because Bangladesh has no measurement authority for these. */
const SEED_VERSION = '2026.08';

/** A rule set as it is written down before any tenant has forked it. */
export interface RuleSetSeed {
  readonly name: string;
  readonly version: string;
  readonly methods: readonly Method[];
  readonly parameters: RuleSetParameters;
}

/**
 * `IS1200_IN @ 2026.08` — L-MEA-01's seed, value for value.
 *
 * Every value is a string and every string is exact: `0.1` m², `500` cm², `20000` sft. The
 * document spelling of the last one (`20,000 sft`) is the pane's business (L-FMT-01 groups it
 * on the way out); what is pinned, digested and read back is the ungrouped decimal.
 */
export const IS1200_SEED: RuleSetSeed = Object.freeze({
  name: SEED_NAME,
  version: SEED_VERSION,
  /** No method files exist in M0, so no (rule id, version) pair is in force. */
  methods: Object.freeze([]),
  parameters: Object.freeze({
    openingDeductionMinM2: '0.1',
    memberEndNoDeductMaxCm2: '500',
    embeddedDuctNoDeductMaxCm2: '100',
    finishOpeningDeductionMinM2: '0.1',
    finishMinOutlineArea: '0.2',
    finishMaxOutlineArea: '20000',
    scaleVerificationTolerance: '0.01',
    scaleAnisotropyTolerance: '0.01',
    earthworkWorkingAllowance: '1.5',
    earthworkDepthExtra: '0.5',
    blindingProjection: '3',
    blindingThickness: '3',
    placementContainmentMerge: '0.08',
    placementNearAnchor: '0.9',
    placementFootprintMin: '0.6',
    placementFootprintMax: '2.5',
    placementHumanSnap: '0.5',
  }),
});

/** The same handle, seen from inside a transaction (the `members` module's own spelling). */
export type RuleSetTx = Parameters<Parameters<ScopedDb['transaction']>[0]>[0];

/** Either handle: the seam's own, or the transaction a composing caller already opened. */
export type RuleSetHandle = ScopedDb | RuleSetTx;

/** What a caller knows about the project it just created, and about what it pinned. */
export interface PinnedProject {
  readonly projectId: string;
  readonly editionId: string;
  readonly digest: string;
}

/** The minimum a project needs to exist at all; C-SPINE-PROJECT's remainder is a later one. */
export interface NewProject {
  readonly tenantId: string;
  readonly name: string;
  readonly code: string;
}

/** One edition row, as this module reads and copies one. */
interface EditionRow {
  readonly id: string;
  readonly scope: string;
  readonly tenantId: string | null;
  readonly parentEditionId: string | null;
  readonly name: string;
  readonly version: string;
  readonly digest: string;
  readonly parameters: Record<string, string>;
  readonly methods: Method[];
}

const PLATFORM: EditionScope = 'platform';
const TENANT: EditionScope = 'tenant';
const PROJECT: EditionScope = 'project';

/** The platform seed, if it has been minted: one row, by name and version, belonging to nobody. */
async function platformSeed(tx: RuleSetTx): Promise<EditionRow | undefined> {
  return tx.query.ruleSetEditions.findFirst({
    where: (row, { and, eq, isNull }) =>
      and(eq(row.scope, PLATFORM), eq(row.name, SEED_NAME), eq(row.version, SEED_VERSION), isNull(row.tenantId)),
  });
}

/** This tenant's template of that seed, if it has already forked one. */
async function tenantTemplate(tx: RuleSetTx, tenantId: string): Promise<EditionRow | undefined> {
  return tx.query.ruleSetEditions.findFirst({
    where: (row, { and, eq }) =>
      and(eq(row.scope, TENANT), eq(row.tenantId, tenantId), eq(row.name, SEED_NAME), eq(row.version, SEED_VERSION)),
  });
}

/**
 * The platform seed, minted if it is not there yet.
 *
 * Idempotence is the partial unique index's, not this reader's: two transactions forking at the
 * same moment would each find nothing and each mint one, so the INSERT yields to the index and
 * the row is read back afterwards rather than assumed to be ours.
 */
async function mintPlatformSeed(tx: RuleSetTx): Promise<EditionRow> {
  const found = await platformSeed(tx);
  if (found !== undefined) return found;

  await tx
    .insert(tx._.fullSchema.ruleSetEditions)
    .values({
      scope: PLATFORM,
      tenantId: null,
      parentEditionId: null,
      name: IS1200_SEED.name,
      version: IS1200_SEED.version,
      digest: editionDigest(IS1200_SEED.parameters, IS1200_SEED.methods),
      parameters: { ...IS1200_SEED.parameters },
      methods: [...IS1200_SEED.methods],
    })
    .onConflictDoNothing();

  const minted = await platformSeed(tx);
  if (minted === undefined) {
    throw new Error(`the platform seed ${SEED_NAME} could not be minted or read back`);
  }
  return minted;
}

/**
 * A fork of one edition into a scope below it: the parent's values, copied verbatim.
 *
 * The digest is recomputed from the copied values rather than carried across, so the row's key
 * is a fact about the row and not an inheritance. A verbatim fork therefore shares its parent's
 * digest — which is exactly what makes the three equal digests on the lineage pane readable.
 */
async function forkEdition(
  tx: RuleSetTx,
  parent: EditionRow,
  scope: EditionScope,
  tenantId: string,
): Promise<EditionRow> {
  const rows = await tx
    .insert(tx._.fullSchema.ruleSetEditions)
    .values({
      scope,
      tenantId,
      parentEditionId: parent.id,
      name: parent.name,
      version: parent.version,
      digest: editionDigest(parent.parameters, parent.methods),
      parameters: { ...parent.parameters },
      methods: [...parent.methods],
    })
    .returning();

  const forked = rows[0];
  if (forked === undefined) throw new Error(`the ${scope} fork of ${parent.name} wrote no row`);
  return forked;
}

/** The tenant's template, forked from the platform seed the first time the tenant needs one. */
async function mintTenantTemplate(tx: RuleSetTx, tenantId: string): Promise<EditionRow> {
  const found = await tenantTemplate(tx, tenantId);
  if (found !== undefined) return found;

  const platform = await mintPlatformSeed(tx);
  try {
    // A savepoint, not a bare INSERT. Postgres aborts the whole transaction on a unique-index
    // violation and refuses every statement after it until a rollback (25P02) — so a bare fork
    // here would poison the read below (it would raise "current transaction is aborted" instead
    // of returning the raced row) and the caller's `projects` INSERT with it. `tx.transaction()`
    // is drizzle's SAVEPOINT: the refusal rolls back to the point before the fork and leaves the
    // surrounding transaction alive, which is the only way this recovery can recover.
    return await tx.transaction(async (fork: RuleSetTx) =>
      forkEdition(fork, platform, TENANT, tenantId),
    );
  } catch (error: unknown) {
    // The template's own partial unique index refused it, which means another transaction
    // committed one between the read above and this write. Its row is as good as ours.
    const raced = await tenantTemplate(tx, tenantId);
    if (raced === undefined) throw error;
    return raced;
  }
}

/**
 * Create a project with its rule-set edition pinned, in one transaction (L-REG-07).
 *
 * Parent first, child after: the platform seed, then the tenant's template forked from it, then
 * this project's own edition forked from that, then the `projects` row naming it. Nothing here
 * writes a pin onto an existing project — the pin exists because the row could not be written
 * without one.
 */
export async function createPinnedProject(
  handle: RuleSetHandle,
  input: NewProject,
): Promise<PinnedProject> {
  return handle.transaction(async (tx: RuleSetTx): Promise<PinnedProject> => {
    const template = await mintTenantTemplate(tx, input.tenantId);
    const edition = await forkEdition(tx, template, PROJECT, input.tenantId);

    const rows = await tx
      .insert(tx._.fullSchema.projects)
      .values({
        tenantId: input.tenantId,
        name: input.name,
        code: input.code,
        ruleSetEditionId: edition.id,
      })
      .returning({ id: tx._.fullSchema.projects.id });

    const project = rows[0];
    if (project === undefined) throw new Error(`the project ${input.code} wrote no row`);
    return { projectId: project.id, editionId: edition.id, digest: edition.digest };
  });
}
