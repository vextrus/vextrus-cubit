// What S-Ask's page reads once on arrival (docs/design/s-ask.md I-403, §2 Empty): the campaign a
// question is read against, the STAMP every answer is kept with, and the one example question the
// empty state offers, built from this project's own register.
//
// The stamp is what makes a kept answer honest about its age (I-403): the pinned revision, the
// project's newest act and the register's newest published line. A kept answer whose stamp is not
// the page's says the drawings or the register have changed since it was answered. Every human
// change to what an answer reads — a level, a height, a transcribed note, a repudiation, a pin — is an
// act (L-ACT-01), and every measured figure is a published line, so these three are the whole of it.
import { createHash } from "node:crypto";
import { ELEMENT_TYPES, isElementType, type ElementType } from "@/core/catalogue/classes";
import { campaignsOf } from "@/core/campaigns";
import { acts, and, desc, eq, forTenant, quantityLines } from "@/core/db";
import { levelStackOf } from "@/modules/takeoff/levels";
import { registerObjectsOf } from "@/modules/takeoff/register";
import { markOrder } from "@/modules/takeoff/register-ui/order";
/** Which project is asked, in which workspace — the guard has already resolved both. */
type AskScope = { readonly tenantId: string; readonly projectId: string };

/** The question the empty state offers, in the register's own subjects (§2 Empty). */
export type AskExample = { readonly class: ElementType; readonly mark: string; readonly level: string };

/** What the page reads once. */
export type AskArrival = {
  readonly campaign: { readonly campaignId: string; readonly setRevisionId: string } | null;
  /** The stamp answers are kept with; equal stamps read the same register, stack and revision. */
  readonly stamp: string;
  /** A count the register can answer, or null where nothing is registered on a level of the stack. */
  readonly example: AskExample | null;
};

/** The stamp of a project with no campaign: nothing to have changed under. */
const NO_CAMPAIGN = "none";

/** The stamp over its three parts, short and opaque — it names no id a reader could read (§6). */
function stampOf(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 16);
}

/**
 * The first registered object standing on a level of the stack, in the register's own order — level
 * from the ground up, then class in the catalogue's order, then mark as a QS counts them (§2 Empty).
 */
function exampleOf(objects: readonly { elementType: string; mark: string; levelLabel: string | null }[], stack: readonly { label: string; ordinal: number }[]): AskExample | null {
  const rank = new Map(stack.map((level) => [level.label, level.ordinal]));
  const standing = objects.filter((object) => object.levelLabel !== null && rank.has(object.levelLabel) && isElementType(object.elementType) && object.mark.trim() !== "");
  standing.sort(
    (left, right) =>
      (rank.get(left.levelLabel as string) as number) - (rank.get(right.levelLabel as string) as number) ||
      ELEMENT_TYPES.indexOf(left.elementType as ElementType) - ELEMENT_TYPES.indexOf(right.elementType as ElementType) ||
      markOrder(left.mark, right.mark),
  );
  const first = standing[0];
  return first === undefined ? null : { class: first.elementType as ElementType, mark: first.mark, level: first.levelLabel as string };
}

/** Read what S-Ask's page stands on (test contract: `askArrivalOf`). */
export async function askArrivalOf(scope: AskScope): Promise<AskArrival> {
  const open = await campaignsOf(scope);
  const campaign = open[open.length - 1];
  if (campaign === undefined) return { campaign: null, stamp: NO_CAMPAIGN, example: null };

  const [objects, stack, newest] = await Promise.all([
    registerObjectsOf({ tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId: campaign.setRevisionId }),
    levelStackOf(scope),
    forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
      const [act] = await tx.select({ actId: acts.actId }).from(acts).where(eq(acts.projectId, scope.projectId)).orderBy(desc(acts.occurredAt), desc(acts.actId)).limit(1);
      const [line] = await tx
        .select({ lineId: quantityLines.lineId })
        .from(quantityLines)
        .where(and(eq(quantityLines.projectId, scope.projectId), eq(quantityLines.campaignId, campaign.campaignId)))
        .orderBy(desc(quantityLines.publishedAt), desc(quantityLines.lineId))
        .limit(1);
      return { act: act?.actId ?? "", line: line?.lineId ?? "" };
    }),
  ]);
  return {
    campaign: { campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId },
    stamp: stampOf([campaign.setRevisionId, newest.act, newest.line]),
    example: exampleOf(objects, stack),
  };
}
