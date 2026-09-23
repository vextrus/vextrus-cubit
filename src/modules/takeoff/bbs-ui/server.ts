// S-BBS's reading, composed once (ARCH-02): the residue answers which campaign this project has
// open, the ONE door answers that campaign's bill of bars, and the campaign's own published lines
// answer whether any of its reinforcement was only partly declared.
//
// IT COMPOSES RATHER THAN COMPUTES. `bbsOf` is inc-309's door and the bill is its answer, carried
// across whole: no figure of this screen's own is added to it, and none is taken away (goal, B-17).
import { and, asc, drawingSetRevisions, drawingSets, eq, forTenant, projects, quantityLines } from "@/core/db";
import { dhakaDateParts } from "@/core/format";
import { residueOf } from "@/core/residue";
import { bbsOf } from "@/modules/takeoff/rebar";
import type { BbsParticulars } from "./emission";
import type { BbsOmission, BbsView } from "./view";

/** Which project's schedule is being read, in which workspace (SEAM-TENANT). */
export type BbsScope = { readonly tenantId: string; readonly projectId: string };

/** The kind whose lines say whether this campaign's reinforcement was wholly read (L-QTY-03). */
const RCC_REBAR = "rcc.rebar";

/** What a line says about what it could not measure (L-QTY-02). */
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The reading a project with no campaign answers with (R-UI-050's empty cell). */
const NOTHING_SCHEDULED: BbsView = { campaignId: null, setRevisionId: null, document: null, partial: false, omitted: [] };

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

  const [document_, declared] = await Promise.all([
    bbsOf({ tenantId: scope.tenantId, projectId: scope.projectId, campaignId: campaign.campaignId }),
    partlyDeclared(scope.tenantId, campaign.campaignId),
  ]);

  return { campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId, document: document_, partial: declared.partial, omitted: declared.omitted };
}

/**
 * Whether any `rcc.rebar` line of this campaign stands PARTLY DECLARED — a tie zone nobody
 * transcribed, say (L-QTY-02, REBAR_TIE_ZONE_UNSTATED) — and the registered codes those lines state
 * for what they left out, each once, in the order the lines first state it, with the components of
 * the line each was stated for (I-354).
 *
 * It is READ from the published lines rather than defaulted: a flag hard-coded false would draw a
 * whole schedule over a campaign whose bars are only part of the story, and the reader would never
 * learn what is missing from the figures in front of them (Decision §2).
 */
async function partlyDeclared(tenantId: string, campaignId: string): Promise<{ partial: boolean; omitted: BbsOmission[] }> {
  const lines = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ coverage: quantityLines.coverage, omitted: quantityLines.omitted })
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, tenantId), eq(quantityLines.campaignId, campaignId), eq(quantityLines.kind, RCC_REBAR)))
      .orderBy(asc(quantityLines.publishedAt), asc(quantityLines.lineId)),
  );
  const partly = lines.filter((line) => line.coverage === PARTIAL_DECLARED);
  const byCode = new Map<string, string[]>();
  for (const line of partly) {
    for (const { code, variable } of omittedComponentsOf(line.omitted)) {
      const held = byCode.get(code) ?? [];
      if (!byCode.has(code)) byCode.set(code, held);
      if (variable !== null && !held.includes(variable)) held.push(variable);
    }
  }
  return { partial: partly.length > 0, omitted: [...byCode.entries()].map(([code, components]) => ({ code, components })) };
}

/**
 * What one line's `omitted` states, read off the store's own shape (L-QTY-02): each component's
 * registered code, and the line variable it was declared for where the line names one.
 */
function omittedComponentsOf(omitted: readonly unknown[]): { code: string; variable: string | null }[] {
  return omitted.flatMap((component) => {
    const held = component as { code?: unknown; variable?: unknown } | null;
    const code = held?.code;
    const variable = held?.variable;
    return typeof code === "string" && code !== "" ? [{ code, variable: typeof variable === "string" && variable !== "" ? variable : null }] : [];
  });
}

/** What an issued schedule is ABOUT, read from the project and the pin its campaign measured. */
export type BbsAbout = {
  /** The project's own name — what the schedule is a schedule OF. */
  readonly project: string;
  /** Everything the particulars block says but the day it was issued, which is the issue's own. */
  readonly particulars: Omit<BbsParticulars, "issuedOn">;
};

/** A recorded text, or nothing where the project recorded none — an empty field is not a statement. */
function recorded(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value.trim();
}

/**
 * The particulars an issued schedule states in words (s-bbs I-535): the project's name, code, client
 * and site as the project records them, and the drawing set the campaign's pinned revision belongs to
 * — its name, WHICH of its pins this is (counted from the first in the store's own write order,
 * `appendSeq`, never by a random surrogate), and the day it was pinned in the document's zone.
 *
 * Read, never composed: a particular the project does not record is answered as nothing, and the page
 * says so. A pin the store cannot find for a campaign that names it is not a gap in the paper but a
 * store that contradicts itself, and it is raised as the outage it is (ARCH-03).
 */
export async function bbsParticularsOf(scope: BbsScope, setRevisionId: string): Promise<BbsAbout> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const [project] = await tx
      .select({ name: projects.name, code: projects.code, client: projects.client, site: projects.siteAddress })
      .from(projects)
      .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.projectId, scope.projectId)))
      .limit(1);
    const [pinned] = await tx
      .select({ setId: drawingSetRevisions.setId, pinnedAt: drawingSetRevisions.createdAt, set: drawingSets.name })
      .from(drawingSetRevisions)
      .innerJoin(drawingSets, eq(drawingSets.setId, drawingSetRevisions.setId))
      .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
      .limit(1);
    if (project === undefined || pinned === undefined) {
      throw new Error(`the schedule's particulars cannot be read: project ${scope.projectId} or its pinned revision ${setRevisionId} is not in the store`);
    }
    const pins = await tx
      .select({ setRevisionId: drawingSetRevisions.setRevisionId })
      .from(drawingSetRevisions)
      .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setId, pinned.setId)))
      .orderBy(asc(drawingSetRevisions.appendSeq));
    const revision = pins.findIndex((pin) => pin.setRevisionId === setRevisionId) + 1;
    return {
      project: project.name,
      particulars: {
        code: recorded(project.code),
        client: recorded(project.client),
        site: recorded(project.site),
        drawingSet: pinned.set,
        revision,
        pinnedOn: dhakaDateParts(pinned.pinnedAt),
      },
    };
  });
}
