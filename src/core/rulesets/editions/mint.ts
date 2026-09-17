// Minting a project-scope rule-set edition (L-MEA-01, AM-04): "authoring mints a new edition, never
// updates one". This is the one mint function, and it is ONE insert — there is no update path here
// to reach for, and `tenant_ruleset_editions` is append-only by trigger besides.
//
// The store is inc-015's, not a second one: the minted row sits in the same table the creation pin
// sits in, carrying the pin it was forked from as its `parent_edition_id`, so the lineage the
// settings screen already walks gains a step rather than a new mechanism. The project's current
// edition is the newest project-scope row, which is what `projectRulesetView` reads.
//
// The digest is taken here from the content that is stored, never carried in by a caller: L-MEA-01
// makes the digest the key of CONTENT, so a verbatim fork sharing its parent's digest has to be a
// property of what was written rather than of what somebody said about it.
import { tenantRulesetEditions, type TenantTx } from "../../db";
import { editionDigest, type EditionParameter, type MethodPair } from "./content";

/** What a mint is given: where it belongs, what it forks, and the content it carries. */
export interface MintedProjectEdition {
  readonly tenantId: string;
  readonly projectId: string;
  /** The edition this one was forked from — the pin the author was shown (L-REG-07's chain). */
  readonly parentEditionId: string;
  readonly name: string;
  readonly version: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  readonly methods: readonly MethodPair[];
}

/** The row the mint wrote: what to point at, and the digest its content keys under (L-MEA-01). */
export interface ProjectEditionMinted {
  readonly editionId: string;
  readonly digest: string;
}

/**
 * Mint a project-scope edition. Runs on the transaction it is handed, so the edition and the act
 * row that records its authoring land together or not at all (L-ACT-01).
 */
export async function mintProjectEdition(tx: TenantTx, minted: MintedProjectEdition): Promise<ProjectEditionMinted> {
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
      `the rule-set edition store accepted no row for ${minted.name} @ ${minted.version} — an edition nobody can point at is not an edition (L-MEA-01)`,
    );
  }
  return { editionId: row.editionId, digest };
}
