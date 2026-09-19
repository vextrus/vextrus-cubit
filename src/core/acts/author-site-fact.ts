// AUTHOR_SITE_FACT (AM-06 §1: "its facts are L-MEA-06's ENTERED set … every entry is an act with a
// source note"), rendered as L-ACT-02's pair.
//
// One act enters one fact. What an entry IS — the closed roster, the source note it has to carry and
// the unit the canon can carry it to metres by — is the ledger's own law (`../site-facts/law.ts`),
// asked here rather than restated, so a malformed entry is refused by the same name at the panel, at
// the seam and at the store (B-17, ARCH-02). Nothing is overwritten: a fact is restated by entering
// it again and the standing is derived from the rows at read time (L-ACT-01, R-TO-051).
import { and, eq, inArray, quantityLines, type TenantTx } from "../db";
import type { Kind } from "../catalogue/kinds";
import { siteFactWrite, standingSiteFacts, type SiteFactWrite } from "../site-facts/law";
import { siteFactRowsOf, writeSiteFact, type SiteFactScope } from "../site-facts/store";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const AUTHOR_SITE_FACT = "AUTHOR_SITE_FACT" as const;

/**
 * The kinds whose bindings read a site fact: the pit measured from the existing ground down, and the
 * blinding under it (L-FRM-04, `src/modules/takeoff/rails/foundations.ts`). They are the rail's own
 * spellings, typed as `Kind` so a word the closed roster does not hold is a compile error rather than
 * a filter that silently matches nothing (L-MEA-04).
 */
const EARTHWORK_KINDS: readonly Kind[] = Object.freeze(["earthwork.excavation", "pcc.blinding"]);

/** The act's input: whose project, which fact, what was read, in what unit, and off what note. */
export type AuthorSiteFactInput = {
  readonly type: typeof AUTHOR_SITE_FACT;
  readonly projectId: string;
  readonly fact: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly sourceNote: string;
};

/** Code-point order — the only order this tree sorts a roster by (L-REG-05). */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/**
 * R-TO-020's `effects` for a site fact: the project's STORED quantity lines that would be measured
 * again, which are its earthwork lines and nothing else — a site fact reaches a figure only through
 * the gate, so nothing re-derives here.
 *
 * The lines are named off the line's own `kind`: a site fact is a fact of the PROJECT, not of one
 * register object, so every earthwork line the project holds stands to move and no join through the
 * register narrows that. Code-point sorted, so one state digests one way (L-ACT-02).
 */
export async function earthworkLinesRederiving(tx: TenantTx, scope: SiteFactScope): Promise<string[]> {
  const rows = await tx
    .select({ lineId: quantityLines.lineId })
    .from(quantityLines)
    .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.projectId, scope.projectId), inArray(quantityLines.kind, [...EARTHWORK_KINDS])));
  return rows.map((row) => row.lineId).sort(byCodePoint);
}

/** What the act would do: the entry it makes, and what that fact stood at when it was previewed. */
type Derived = {
  readonly write: SiteFactWrite;
  readonly before: readonly string[];
};

/**
 * The act, judged against the state this transaction read.
 *
 * `siteFactWrite` runs FIRST and before anything is read: an entry outside the roster, one with no
 * source note and one in a unit the canon carries no length factor for are refused by name before a
 * row is looked at, let alone written (AM-06 §1, L-FRM-06).
 */
async function derive(ctx: ActorCtx, input: AuthorSiteFactInput, tx: TenantTx): Promise<Derived> {
  const write = siteFactWrite(input);
  const scope: SiteFactScope = { tenantId: ctx.tenantId, projectId: input.projectId };
  // What the fact stands at is the LATEST entry of it, in the metres the canon made of that reading:
  // a `before` carried in the unit somebody happened to write in would compare two different things
  // the next time the fact is restated (L-QTY-03).
  const standing = standingSiteFacts(await siteFactRowsOf(tx, scope));
  const held = standing[write.fact];
  return { write, before: held === undefined ? [] : [held.canonicalMetres] };
}

export const authorSiteFact: ActRendering<AuthorSiteFactInput> = {
  // The ledger is append-only (R-TO-051): a fact is restated by entering it again, and the second
  // entry stands whether or not the canon carries it to the metres the first one did — what the
  // reader gains is the reading's own source note and the act that made it (AM-06 §1, L-ACT-01).
  appendsObservation: true,

  async preview(ctx: ActorCtx, input: AuthorSiteFactInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: AUTHOR_SITE_FACT,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      // One fact judged is one subject (AM-06 §1: one act per fact, with the note it was read from).
      rendering: "SUBJECTS",
      subjects: [{ subjectId: derived.write.fact, before: derived.before, after: [derived.write.canonicalMetres] }],
      effects: {
        linesRederiving: await earthworkLinesRederiving(tx, { tenantId: ctx.tenantId, projectId: input.projectId }),
        // An entered fact voids no signature: the slot is stated empty rather than left absent, so a
        // reader is told that nothing signed moves (R-UI-021).
        signaturesVoiding: [],
      },
    };
  },

  async commit(ctx: ActorCtx, input: AuthorSiteFactInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    // The act row and the entry land in the seam's own transaction — both or neither (L-ACT-01).
    await writeSiteFact(tx, { tenantId: ctx.tenantId, projectId: input.projectId }, act.actId, derived.write);
  },
};
