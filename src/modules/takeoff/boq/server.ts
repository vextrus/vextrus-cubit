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
import { and, asc, desc, eq, forTenant, inArray, ingests, projects, quantityLines } from "@/core/db";
import type { ModelCallContext } from "@/core/model";
import { measurementStatementOf, residueOf } from "@/core/residue";
import { describeGroups, groupAsksOf, type GroupDescriptions } from "./descriptions";
import type { BoqDescriptionPort } from "./description-question";
import { boqDraftPayloadOf, type BoqReadingLine } from "./emission";
import { numberItems } from "./numbering";
import { BILL_TAXONOMY } from "./taxonomy";
import type { BoqView } from "./view";

/** Which project's draft is being read, in which workspace. */
export type BoqScope = { readonly tenantId: string; readonly projectId: string };

/**
 * What a caller hands to have the draft's item descriptions ASKED (L-BD-01, L-AI-02): the call
 * context a ledger row is written under, and — for a lane — the port the question goes through.
 *
 * Optional, and absent by default: a read that hands none asks nobody, spends nothing and carries
 * the plain descriptions the emission has always written. The ISSUE hands one, because that is
 * where a chosen description leaves the product in a document somebody reads.
 */
export type BoqAsking = { readonly ctx: ModelCallContext; readonly port?: BoqDescriptionPort };

/** The reading a project with no campaign, or no published line, answers with (R-UI-050's empty). */
const NOTHING_DRAFTED: Omit<BoqView, "campaignId" | "setRevisionId"> = {
  taxonomyVersion: BILL_TAXONOMY.version,
  coverage: "INCOMPLETE",
  payload: null,
  items: new Map<string, string>(),
  descriptions: new Map(),
};

/**
 * The whole reading one draft screen paints (test contract: `boqViewOf`).
 *
 * A project with no campaign open — or a campaign that published no line — answers the empty reading
 * rather than a fault: an absence is a state, and the screen teaches the next action from it.
 */
export async function boqViewOf(scope: BoqScope, asking?: BoqAsking): Promise<BoqView> {
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

  // The descriptions, where a caller asked for them (L-BD-01, I-298). A group the closed catalogue
  // holds one description for is never asked; a refusal leaves the plain description standing and
  // the draft reads on, because abstention is the caller's (L-AI-02).
  const descriptions = await descriptionsOf(scope, lines, residue.input, asking);

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
    descriptions,
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
    descriptions,
  };
}

/**
 * What a model proposes this campaign's groups are billed under, or an empty reading where nobody
 * asked (L-AI-02, I-298).
 *
 * The question's state is the published lines' own, and the artifact a citation resolves against is
 * the DRAWING the exemplar line was measured on: the ingest record that took its geometry states
 * the digest (L-CAD-02), so a key cited against a drawing this product never ingested resolves
 * against nothing.
 */
async function descriptionsOf(
  scope: BoqScope,
  lines: readonly (typeof quantityLines.$inferSelect)[],
  stack: {
    readonly levels: readonly { readonly levelId: string; readonly ordinal: number; readonly label: string }[];
    readonly lines: readonly { readonly lineId: string; readonly levelId: string }[];
  },
  asking: BoqAsking | undefined,
): Promise<GroupDescriptions> {
  if (asking === undefined) return new Map();
  const digests = await artifactDigestsOf(scope.tenantId, [...new Set(lines.map((line) => line.drawingId))]);
  const asks = groupAsksOf(
    lines.map((line) => ({
      class: line.class,
      kind: line.kind,
      unit: line.unit,
      levelId: levelIdOf(stack.lines, line.lineId),
      quantityBasis: line.quantityBasis,
      selectionBasis: line.selectionBasis,
      drawingId: line.drawingId,
      selectors: line.selectors,
    })),
    stack.levels,
    digests,
  );
  return describeGroups(asking.ctx, asks, asking.port);
}

/** Each drawing's artifact digest, off its newest ingest record — the identity a source key is scoped to. */
async function artifactDigestsOf(tenantId: string, drawingIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (drawingIds.length === 0) return new Map();
  const rows = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ drawingId: ingests.drawingId, artifactSha256: ingests.artifactSha256 })
      .from(ingests)
      .where(and(eq(ingests.tenantId, tenantId), inArray(ingests.drawingId, [...drawingIds])))
      .orderBy(desc(ingests.createdAt)),
  );
  const digests = new Map<string, string>();
  for (const row of rows) if (!digests.has(row.drawingId)) digests.set(row.drawingId, row.artifactSha256);
  return digests;
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

/**
 * What a document is a document OF, as a reader names it — the project's own name, never its id.
 * Published because the bar schedule's render asks the same question of the same project, and one
 * read is one answer (B-17).
 */
export async function projectNameOf(scope: BoqScope): Promise<string> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({ name: projects.name })
      .from(projects)
      .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.projectId, scope.projectId)))
      .limit(1),
  );
  return rows[0]?.name ?? scope.projectId;
}
