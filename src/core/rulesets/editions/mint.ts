// L-MEA-01: "Authoring mints a new edition, never updates one, and is its own permission." This is
// the mint — the only writer of an authored edition, and the reason there is no second store beside
// the immutable ledger `tenant_ruleset_editions` already is.
//
// ONE insert. The row is a project-scope edition whose `parent_edition_id` is the edition the
// project read a moment ago, so the fork chain L-REG-07 draws grows by a step rather than having a
// step replaced; the digest is taken over the CONTENT, here, from the parameters and methods being
// written — which is what makes a verbatim fork share its parent's digest by construction rather
// than by a caller remembering to copy the old one.
// Beside the write stand the two pure functions that decide WHAT is written: `diffParameters`, what
// authoring moves, and `authoredContent`, what the fork holds. They are here rather than in the
// authoring module because the ACT reads them and core imports nothing above it (ARCH-01) — the
// module's barrel re-exports them so the screen and the seam share one computation (B-17).
import { exact } from "../../units/canon";
import { tenantRulesetEditions, type TenantTx } from "../../db";
import { editionDigest } from "./content";
import type { EditionContent, EditionParameter, MethodPair } from "./content";

/** The shape every parameter value a rule-set edition holds is written in (B-07: never a float). */
const DECIMAL = /^-?\d+(\.\d+)?$/;

/** One line of the diff: the pin's key and unit, the two decimals, and whether they differ. */
export interface ParameterDiffRow {
  readonly key: string;
  readonly unit: string;
  readonly before: string;
  readonly after: string;
  readonly changed: boolean;
}

/**
 * Whether two decimal strings say the same figure. The comparison is arithmetic, not textual, and it
 * goes through the tree's one exact-decimal arithmetic (`../../units/canon`): `0.10` and `0.1` are
 * one allowance, so a reader who retypes a value in another form has authored nothing and the seam
 * says `ACT_CHANGES_NOTHING` rather than minting an edition whose digest never moved.
 */
export function sameDecimal(left: string, right: string): boolean {
  return decimal(left).equals(decimal(right));
}

/**
 * The whole pin as rows, in the pin's OWN key order, with the reader's stated values beside it. A
 * key the values omit stands at the pinned decimal — an unstated value is the value in force, never
 * a blank — and a key the pin does not hold is a caller mistake rather than an answer anyone gets:
 * the screen offers exactly the pin's keys, so a statement naming another one was not made on it.
 */
export function diffParameters(pin: Readonly<Record<string, EditionParameter>>, values: Readonly<Record<string, string>>): readonly ParameterDiffRow[] {
  for (const key of Object.keys(values)) {
    if (!Object.hasOwn(pin, key)) {
      throw new Error(`the pinned rule-set edition holds no parameter "${key}", so authoring cannot state a value for it (L-MEA-01)`);
    }
  }
  return Object.entries(pin).map(([key, parameter]) => {
    const stated = values[key];
    const after = stated === undefined ? parameter.value : stated;
    return { key, unit: parameter.unit, before: parameter.value, after, changed: !sameDecimal(parameter.value, after) };
  });
}

/**
 * The content an authored edition holds: the pin's keys in the pin's order, each carrying the stated
 * decimal and the PIN's unit, and the pin's methods verbatim.
 *
 * Units, keys and the (rule id, version) pairs in force are the pin's and are never authored: what a
 * figure MEASURES, and which method reads it, are a different act from stating a different
 * allowance, and this edition is the second of those (L-MEA-01).
 */
export function authoredContent(
  pin: Readonly<Record<string, EditionParameter>>,
  values: Readonly<Record<string, string>>,
  methods: readonly MethodPair[],
): EditionContent {
  const parameters: Record<string, EditionParameter> = {};
  for (const row of diffParameters(pin, values)) {
    parameters[row.key] = { value: row.after, unit: row.unit };
  }
  return { parameters, methods };
}

/** A decimal this seam will work in, or a fault naming what was written instead of one. */
function decimal(value: string): ReturnType<typeof exact> {
  if (!DECIMAL.test(value)) {
    throw new Error(`"${value}" is not a decimal, and a rule-set parameter value is one from the store to the page (B-07)`);
  }
  return exact(value);
}

/** What an authored edition is made of: whose project, what it forks, its identity, its content. */
export interface MintedProjectEdition {
  readonly tenantId: string;
  readonly projectId: string;
  /** The edition this one was forked from — the project's current pin at the moment of the mint. */
  readonly parentEditionId: string;
  readonly name: string;
  readonly version: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  readonly methods: readonly MethodPair[];
}

/** The row the mint wrote, as its caller reads it back: what to point at, and what it keys. */
export interface MintedEdition {
  readonly editionId: string;
  readonly digest: string;
}

/**
 * Mint a project-scope edition on the transaction the caller is already in (L-ACT-01: the act row
 * and the state change land together or not at all).
 *
 * Nothing here judges the identity or the values: whether this project already holds the version is
 * the act's question, answered as a registered refusal before the write is reached, and what a
 * parameter may hold is the authored content's. This function's whole claim is the one the store
 * cannot make for itself — that the digest on the row is the digest of the content on the row.
 */
export async function mintProjectEdition(tx: TenantTx, minted: MintedProjectEdition): Promise<MintedEdition> {
  const digest = editionDigest({ parameters: minted.parameters, methods: minted.methods });
  const written = await tx
    .insert(tenantRulesetEditions)
    .values({
      tenantId: minted.tenantId,
      scope: "project",
      projectId: minted.projectId,
      parentEditionId: minted.parentEditionId,
      name: minted.name,
      version: minted.version,
      contentDigest: digest,
      parameters: minted.parameters,
      methods: minted.methods,
    })
    .returning({ editionId: tenantRulesetEditions.editionId });
  const row = written[0];
  if (row === undefined) {
    throw new Error(
      `the rule-set edition store accepted no row for ${minted.name} @ ${minted.version} — an edition nobody can point at is not an edition a project can read (L-MEA-01)`,
    );
  }
  return { editionId: row.editionId, digest };
}
