// S-BOQ's reading, composed once (ARCH-02): the residue answers what was sighted and what stack the
// project stands on, the register's own lines answer what was published, and the emission beside
// this file places them into L-BD-08's sections.
//
// IT COMPOSES RATHER THAN COMPUTES. The taxonomy is `taxonomy.ts`'s, the placing is `resolver.ts`'s,
// the payload is `emission.ts`'s and the numbering is the DOCUMENT's (I-269) — this file asks each of
// them once and lays the answers side by side, so the screen and the PDF read one draft (B-17).
//
// A DECLARATION OVER A CELL REMOVES NO LINE. Published lines take precedence over a declaration made
// about the same cell (s-coverage I-192), so the draft lists what the gate published and the coverage
// statement states what is still missing beside it — never one editing the other.
import { and, asc, eq, forTenant, projects, quantityLines } from "@/core/db";
import { measurementStatementOf, residueOf } from "@/core/residue";
import { boqDraftPayloadOf, type BoqReadingLine } from "./emission";
import { numberItems } from "./numbering";
import { BILL_TAXONOMY } from "./taxonomy";
import type { BoqView } from "./view";

/** Which project's draft is being read, in which workspace. */
export type BoqScope = { readonly tenantId: string; readonly projectId: string };

/** The reading a project with no campaign, or no published line, answers with (R-UI-050's empty). */
const NOTHING_DRAFTED: Omit<BoqView, "campaignId" | "setRevisionId"> = {
  taxonomyVersion: BILL_TAXONOMY.version,
  coverage: "INCOMPLETE",
  payload: null,
  items: new Map<string, string>(),
};

/**
 * The whole reading one draft screen paints (test contract: `boqViewOf`).
 *
 * A project with no campaign open — or a campaign that published no line — answers the empty reading
 * rather than a fault: an absence is a state, and the screen teaches the next action from it.
 */
export async function boqViewOf(scope: BoqScope): Promise<BoqView> {
  const residue = await residueOf(scope);
  const campaign = residue.campaign;
  if (campaign === null) return { campaignId: null, setRevisionId: null, ...NOTHING_DRAFTED };

  const [lines, project] = await Promise.all([linesOfCampaign(scope.tenantId, campaign.campaignId), projectNameOf(scope)]);
  if (lines.length === 0) {
    return { campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId, ...NOTHING_DRAFTED };
  }

  // Whether the coverage statement is EMPTY, asked of the one arm that answers it (L-QTY-05,
  // L-QTY-07): a class sighted that no rail measured leaves a row here, and that row is why each
  // section may state only what it measured (L-QTY-04). The bill-boundary statement is a decision
  // rather than a gap and is not read into this answer.
  const coverageComplete = measurementStatementOf(residue.cells).length === 0;

  const payload = boqDraftPayloadOf({
    project,
    campaignId: campaign.campaignId,
    setRevisionId: campaign.setRevisionId,
    levels: residue.input.levels,
    lines: lines.map(
      (row): BoqReadingLine => ({
        lineId: row.lineId,
        objectKey: row.objectKey,
        class: row.class,
        kind: row.kind,
        levelId: levelIdOf(residue.input.lines, row.lineId),
        value: row.value,
        unit: row.unit,
        quantityBasis: row.quantityBasis,
        selectionBasis: row.selectionBasis,
        coverage: row.coverage,
      }),
    ),
    coverageComplete,
  });

  return {
    campaignId: campaign.campaignId,
    setRevisionId: campaign.setRevisionId,
    taxonomyVersion: payload.taxonomyVersion,
    coverage: payload.coverage === "COMPLETE" ? "COMPLETE" : "INCOMPLETE",
    payload,
    // The SAME numbering the document derives (I-269): a number a reader sees and a number the PDF
    // prints cannot differ, because there is only one derivation of them.
    items: numberItems(payload.sections),
  };
}

/**
 * Which level a published line stands on, read off the residue's own reading of the campaign's lines
 * (L-QTY-03). The register writes the level into the residue's line rows, so the draft asks there
 * rather than re-deriving a storey from an object key (B-17).
 */
function levelIdOf(lines: readonly { readonly lineId: string; readonly levelId: string }[], lineId: string): string | null {
  return lines.find((line) => line.lineId === lineId)?.levelId ?? null;
}

/** Every line one campaign published, in the order they were published (L-QTY-03). */
async function linesOfCampaign(tenantId: string, campaignId: string) {
  return forTenant({ tenantId }).transaction((tx) =>
    tx
      .select()
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, tenantId), eq(quantityLines.campaignId, campaignId)))
      .orderBy(asc(quantityLines.publishedAt), asc(quantityLines.lineId)),
  );
}

/** What the draft is a draft OF, as a reader names it — the project's own name, never its id. */
async function projectNameOf(scope: BoqScope): Promise<string> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({ name: projects.name })
      .from(projects)
      .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.projectId, scope.projectId)))
      .limit(1),
  );
  return rows[0]?.name ?? scope.projectId;
}
