// L-MEA-01's other half: "authoring mints a new edition, never updates one". This is the one mint
// function — a project-scope row written beside the pin it was forked from, never an UPDATE of it —
// so the store stays the immutable ledger R-SPINE-012 reads a lineage out of.
//
// What authoring moves is VALUES. The keys, the units and the (rule id, version) pairs of the
// methods in force are the parent's and are copied verbatim (I-265), which is what makes a verbatim
// fork share its parent's digest by construction: `authoredContent` over unmoved values produces the
// parent's own content, and `editionDigest` is a function of content alone.
import { and, eq, tenantRulesetEditions, type TenantTx } from "../../db";
import { violatesConstraint } from "../../db/violations";
import { REFUSALS } from "../../errors";
import { refusal } from "../../faults/refusal-marker";
import { editionDigest } from "./content";
import type { EditionContent, EditionParameter } from "./content";

/** What a mint is asked for: whose project, what it is forked from, and the identity it takes. */
export interface MintProjectEdition {
  readonly tenantId: string;
  readonly projectId: string;
  /** The row this edition is forked from — the project's current pin (L-REG-07's chain). */
  readonly parentEditionId: string;
  /** Identity is (scope, name, version); the scope is `project` and the name is the parent's. */
  readonly name: string;
  readonly version: string;
  readonly content: EditionContent;
}

/** The edition a mint wrote: the row it is, and the digest its content keys. */
export interface MintedEdition {
  readonly editionId: string;
  readonly digest: string;
}

/**
 * The content an author states, built from the parent's: every parameter the parent holds, under the
 * parent's own key order, with the authored decimal where one was stated and the pinned decimal
 * where none was. A key the parent does not hold is not a parameter of this edition and is dropped —
 * authoring states values, it does not widen the roster (I-265).
 */
export function authoredContent(parent: EditionContent, values: Readonly<Record<string, string>>): EditionContent {
  const parameters: Record<string, EditionParameter> = {};
  for (const [key, parameter] of Object.entries(parent.parameters)) {
    const stated = values[key];
    parameters[key] = stated === undefined || stated === "" ? parameter : { value: stated, unit: parameter.unit };
  }
  return { parameters, methods: parent.methods };
}

/**
 * Whether this project has already minted an edition under this version. Identity is
 * (scope, name, version) and a project's editions all share the first two, so the version alone is
 * what a second edition would collide on — and the store cannot say so for itself: the pin index is
 * `tenant_ruleset_editions_pin_newest`, a plain index over a column authoring appends to.
 */
/** The index that holds L-MEA-01's identity apart, named once so a caller can answer what it refused. */
const IDENTITY_ONCE = "tenant_ruleset_editions_identity_once";

/**
 * A version this project's rule set already carries, refused by name — the one sentence, whether it
 * was the read below that saw the row or the store itself that refused the write (B-17).
 */
export function editionVersionTaken(version: string): Error {
  return refusal(REFUSALS.EDITION_VERSION_TAKEN.code, `this project already holds a rule-set edition at version ${version} (L-MEA-01: identity is (scope, name, version))`);
}

export async function projectHoldsVersion(tx: TenantTx, { tenantId, projectId, version }: { tenantId: string; projectId: string; version: string }): Promise<boolean> {
  const held = await tx
    .select({ editionId: tenantRulesetEditions.editionId })
    .from(tenantRulesetEditions)
    .where(
      and(
        eq(tenantRulesetEditions.tenantId, tenantId),
        eq(tenantRulesetEditions.projectId, projectId),
        eq(tenantRulesetEditions.scope, "project"),
        eq(tenantRulesetEditions.version, version),
      ),
    )
    .limit(1);
  return held.length > 0;
}

/**
 * Mint one project-scope edition. Runs on the transaction its caller is already in, so the act row
 * and the edition land together or neither does (L-ACT-01), and it writes a NEW row every time: the
 * project's current edition is the newest project-scope row, which is what makes authoring an
 * append rather than an edit of the creation pin (L-REG-07's pin is never touched).
 */
export async function mintProjectEdition(tx: TenantTx, mint: MintProjectEdition): Promise<MintedEdition> {
  const digest = editionDigest(mint.content);
  const written = await insertEdition(tx, mint, digest);
  const row = written[0];
  if (row === undefined) {
    throw new Error(`the rule-set edition store accepted no row for ${mint.name} @ ${mint.version} — an edition nobody can point at is not an edition (L-MEA-01)`);
  }
  return { editionId: row.editionId, digest };
}

/**
 * The write itself, with the one thing the store may refuse read as the answer it is: the identity
 * index judging a version this project already holds. Two commits racing on one project each read a
 * store with no such row and both reach here, so the second is told what the first made true —
 * `EDITION_VERSION_TAKEN`, the same sentence the read before it speaks, never a 500 (ARCH-03, B-21).
 */
async function insertEdition(tx: TenantTx, mint: MintProjectEdition, digest: string): Promise<{ editionId: string }[]> {
  try {
    return await writeEdition(tx, mint, digest);
  } catch (thrown: unknown) {
    if (violatesConstraint(thrown, IDENTITY_ONCE)) throw editionVersionTaken(mint.version);
    throw thrown;
  }
}

async function writeEdition(tx: TenantTx, mint: MintProjectEdition, digest: string): Promise<{ editionId: string }[]> {
  return tx
    .insert(tenantRulesetEditions)
    .values({
      tenantId: mint.tenantId,
      scope: "project",
      projectId: mint.projectId,
      parentEditionId: mint.parentEditionId,
      name: mint.name,
      version: mint.version,
      contentDigest: digest,
      parameters: mint.content.parameters,
      methods: mint.content.methods,
    })
    .returning({ editionId: tenantRulesetEditions.editionId });
}
