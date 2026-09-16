// The SITE-fact ledger's store: append one entry, and read a project's entries back.
//
// Two calls and nothing else. There is no update and no delete here, and the runtime role holds
// neither privilege on the table: "every human change is an act adding a competing observation with
// declared precedence; nothing overwrites" (R-TO-051), so restating a fact is another entry and a
// correction is another entry (L-ACT-01, AM-06 §1).
//
// The store computes nothing. What an entry IS — including every way one can be malformed — is the
// law's (`./law.ts`), and what it stands at afterwards is derived from the rows at read time; this
// file moves the columns that law names and adds no second opinion of any of them (B-17, ARCH-02).
import { and, asc, eq, siteFacts, type TenantTx } from "../db";
import type { SiteFactWrite } from "./law";

/** One project's site, in the workspace whose ledger it is — a site fact is a fact about a project. */
export type SiteFactScope = {
  readonly tenantId: string;
  readonly projectId: string;
};

/** One appended entry, whole, as the store holds it. */
export type SiteFactRow = typeof siteFacts.$inferSelect;

/**
 * Append one entry, citing the act that entered it (AM-06 §1: every entry is an act with a source
 * note). The write was made — and, if malformed, refused — before it reached here.
 */
export async function writeSiteFact(tx: TenantTx, scope: SiteFactScope, actId: string, write: SiteFactWrite): Promise<void> {
  await tx.insert(siteFacts).values({
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    fact: write.fact,
    valueAsWritten: write.valueAsWritten,
    unitAsWritten: write.unitAsWritten,
    canonicalMetres: write.canonicalMetres,
    factor: write.factor,
    sourceNote: write.sourceNote,
    actId,
  });
}

/**
 * Every entry of one project's ledger, oldest first — the order a standing is derived in.
 *
 * The tie-break is the entry's own id, so two entries the clock cannot separate still have ONE order
 * and every reader derives the same standing from them (L-REG-05).
 */
export async function siteFactRowsOf(tx: TenantTx, scope: SiteFactScope): Promise<SiteFactRow[]> {
  return tx
    .select()
    .from(siteFacts)
    .where(and(eq(siteFacts.tenantId, scope.tenantId), eq(siteFacts.projectId, scope.projectId)))
    .orderBy(asc(siteFacts.enteredAt), asc(siteFacts.siteFactId));
}
