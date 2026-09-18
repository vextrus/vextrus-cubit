// S-BBS's reading, composed once (ARCH-02): the residue answers which campaign this project has
// open, the ONE door answers that campaign's bill of bars, and the campaign's own published lines
// answer whether any of its reinforcement was only partly declared.
//
// IT COMPOSES RATHER THAN COMPUTES. `bbsOf` is inc-309's door and the bill is its answer, carried
// across whole: no figure of this screen's own is added to it, and none is taken away (goal, B-17).
import { and, eq, forTenant, quantityLines } from "@/core/db";
import { residueOf } from "@/core/residue";
import { bbsOf } from "@/modules/takeoff/rebar";
import type { BbsView } from "./view";

/** Which project's schedule is being read, in which workspace (SEAM-TENANT). */
export type BbsScope = { readonly tenantId: string; readonly projectId: string };

/** The kind whose lines say whether this campaign's reinforcement was wholly read (L-QTY-03). */
const RCC_REBAR = "rcc.rebar";

/** What a line says about what it could not measure (L-QTY-02). */
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The reading a project with no campaign answers with (R-UI-050's empty cell). */
const NOTHING_SCHEDULED: BbsView = { campaignId: null, setRevisionId: null, document: null, partial: false };

/**
 * The whole reading one bar-schedule screen paints (test contract: `bbsViewOf`).
 *
 * A project with no campaign open answers the empty reading rather than a fault: an absence is a
 * state, and the screen teaches the next action from it (R-UI-050). The campaign is resolved exactly
 * as `boqViewOf` resolves one — the residue's own answer — so the draft and the schedule can never
 * be read off two different campaigns (B-17).
 */
export async function bbsViewOf(scope: BbsScope): Promise<BbsView> {
  const residue = await residueOf(scope);
  const campaign = residue.campaign;
  if (campaign === null) return NOTHING_SCHEDULED;

  const [document_, partial] = await Promise.all([
    bbsOf({ tenantId: scope.tenantId, projectId: scope.projectId, campaignId: campaign.campaignId }),
    anythingPartlyDeclared(scope.tenantId, campaign.campaignId),
  ]);

  return { campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId, document: document_, partial };
}

/**
 * Whether any `rcc.rebar` line of this campaign stands PARTLY DECLARED — a tie zone nobody
 * transcribed, say (L-QTY-02, REBAR_TIE_ZONE_UNSTATED).
 *
 * It is READ from the published lines rather than defaulted: a flag hard-coded false would draw a
 * whole schedule over a campaign whose bars are only part of the story, and the reader would never
 * learn what is missing from the figures in front of them (Decision §2).
 */
async function anythingPartlyDeclared(tenantId: string, campaignId: string): Promise<boolean> {
  const lines = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ coverage: quantityLines.coverage })
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, tenantId), eq(quantityLines.campaignId, campaignId), eq(quantityLines.kind, RCC_REBAR))),
  );
  return lines.some((line) => line.coverage === PARTIAL_DECLARED);
}
