// S-BOQ's reading, composed once (ARCH-02): the residue answers what was sighted and what stack the
// project stands on, the register's own lines answer what was published, and the emission beside
// this file places them into L-BD-08's sections as the owner ruled a bill is shaped — one item per
// description, the member lines behind it (s-boq I-528).
//
// IT COMPOSES RATHER THAN COMPUTES. The taxonomy is `taxonomy.ts`'s, the placing is `resolver.ts`'s,
// the payload is `emission.ts`'s and the numbering is the DOCUMENT's (I-269) — this file asks each of
// them once and lays the answers side by side, so the screen and the PDF read one draft (B-17). What
// a member line's details say — its mark, its grid, the sheet its evidence stands on — are the
// register's, the partition's and the Trace's own answers, asked here and never re-derived.
//
// A DECLARATION OVER A CELL REMOVES NO LINE. Published lines take precedence over a declaration made
// about the same cell (s-coverage I-192), so the draft lists what the gate published and the coverage
// statement states what is still missing beside it — never one editing the other.
//
// A REPUDIATION DOES. A person who struck an object judged it to be nothing (R-TO-051); the lines
// measured off it stay on record (L-ACT-01) and are withheld from every bill reader, so nothing is
// priced off an object the register itself says is nothing (I-173, I-449). The draft asks the
// register's own reader which objects stand struck in the campaign's revision and reads past their
// lines — the screen, the PDF and the workbook alike, because all three read this one reading.
import { and, asc, desc, drawingSetRevisions, drawingSets, eq, forTenant, inArray, ingests, projects, quantityLines } from "@/core/db";
import { notMeasuredRowsOf, setRevisionInWords, type BoqDraftFront } from "@/core/documents/kinds/boq-draft";
import { dhakaDateParts, formatDate } from "@/core/format";
import type { ModelCallContext } from "@/core/model";
import { measurementStatementOf, residueOf } from "@/core/residue";
import { registerObjectsOf, repudiatedObjectsOf } from "@/modules/takeoff/register";
import { pinnedRecordsOf, tracedLineOf, variablesOf, type PinnedGrid } from "@/modules/takeoff/trace";
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
 * the catalogue's sentences the emission has always written. The ISSUE hands one, because that is
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

/** One published line, as the store holds it. */
type StoredLine = typeof quantityLines.$inferSelect;

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

  const registerScope = { tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId: campaign.setRevisionId };
  const [lines, front, registered] = await Promise.all([billableLinesOf(registerScope, campaign.campaignId), frontOf(scope, campaign.setRevisionId), registerObjectsOf(registerScope)]);
  if (lines.length === 0) {
    return { campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId, ...NOTHING_DRAFTED };
  }

  // The coverage statement, asked of the one arm that answers it (L-QTY-05, L-QTY-07): a class
  // sighted that no rail measured leaves a row here, and that row is why the draft states no figure
  // for the project (L-QTY-04). The draft CARRIES it — what it leaves out, stated on its own closing
  // page (I-451) — and its being empty is what a complete coverage means. The bill-boundary
  // statement is a decision rather than a gap and is not read into either answer.
  const statement = measurementStatementOf(residue.cells);
  const coverageComplete = statement.length === 0;

  // The descriptions, where a caller asked for them (L-BD-01, I-298). A group the closed catalogue
  // holds one description for is never asked; a refusal leaves the catalogue's sentence standing and
  // the draft reads on, because abstention is the caller's (L-AI-02).
  const [descriptions, details] = await Promise.all([descriptionsOf(scope, lines, residue.input, asking), detailsOf(scope, campaign.setRevisionId, lines, registered)]);

  const payload = boqDraftPayloadOf({
    project: front.project,
    campaignId: campaign.campaignId,
    setRevisionId: campaign.setRevisionId,
    levels: residue.input.levels,
    lines: lines.map((row): BoqReadingLine => {
      const detail = details.get(row.lineId);
      const variables = variablesOf(row.bindings);
      return {
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
        omitted: omittedOf(row.omitted).map((held) => held.code),
        omittedVariables: omittedOf(row.omitted).map((held) => held.variable),
        formula: row.formula,
        // Each reading with what it rests on and where it is cited: a description states a figure bare
        // only where the drawings state it (I-533).
        variables: Object.fromEntries(
          Object.entries(variables).map(([name, binding]) => [name, { value: binding.value, unit: binding.unit, canonical: binding.canonical, basis: binding.basis, source: binding.source }]),
        ),
        selectors: row.selectors,
        mark: detail?.mark ?? null,
        slot: detail?.slot ?? null,
        grid: detail?.grid ?? null,
        sheet: detail?.sheet ?? null,
      };
    }),
    coverageComplete,
    descriptions,
    // What the draft leaves out says WHY in the certificate's own words (s-coverage I-480):
    // the registered reason read beside the writerless fall-through where the row carries one — so
    // the draft never prints that nothing explains an absence — and the row's cause everywhere else.
    notMeasured: notMeasuredRowsOf(statement),
    front: front.facts,
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

/** What the details of measurement print about one member, where the register and the drawing say it. */
type MemberDetail = { readonly mark: string; readonly slot: string | null; readonly grid: string | null; readonly sheet: string | null };

/**
 * Each line's details of measurement (I-528): the mark and lawful-null slot the register filed
 * its member under (L-REG-04), the grid intersection the member's placement reads nearest — read off
 * the plan's grid by the partition, never invented (L-CAD-07) — and the sheet its evidence stands on,
 * by the number the Trace names it with (I-179, I-421).
 *
 * The grid and the sheet are both read off the PINNED record — the ingest of the very bytes the line
 * was measured on — and never the drawing's current one, which a later upload moves while the line
 * stands where it was read (I-422). A member the register no longer holds, a placement the pinned
 * record does not carry and a record the Trace cannot read each leave their fact absent rather than
 * guessed (B-17, I-181).
 */
async function detailsOf(
  scope: BoqScope,
  setRevisionId: string,
  lines: readonly StoredLine[],
  registered: readonly { readonly objectKey: string; readonly mark: string; readonly levelSlot: string | null; readonly placementKey: string }[],
): Promise<ReadonlyMap<string, MemberDetail>> {
  const drawingIds = [...new Set(lines.map((line) => line.drawingId))];
  const records = await pinnedRecordsOf(scope, setRevisionId, drawingIds);
  const byObject = new Map(registered.map((row) => [row.objectKey, row]));
  const details = new Map<string, MemberDetail>();
  for (const line of lines) {
    const object = byObject.get(line.objectKey);
    const record = records.get(line.drawingId);
    const traced = tracedLineOf(line, record);
    details.set(line.lineId, {
      mark: object?.mark ?? "",
      slot: object?.levelSlot ?? null,
      grid: object === undefined || record === undefined ? null : gridReferenceOf(record.gridOf(object.placementKey)),
      sheet: traced.layoutName === null || record === undefined ? null : record.labelOf(traced.layoutName),
    });
  }
  return details;
}

/**
 * A placement's grid reading as a checker finds it on the plan, `C/2`: the letter family's nearest
 * axis, then the numeral family's. A family the plan's grid carries no axis of is left out of the
 * reference rather than filled, and a placement with neither reads no grid at all (L-CAD-07).
 */
function gridReferenceOf(grid: PinnedGrid | null): string | null {
  if (grid === null) return null;
  const reference = [grid.letter, grid.numeral].filter((part): part is string => part !== null && part !== "").join("/");
  return reference === "" ? null : reference;
}

/**
 * The components a line enumerated as omitted, as the store holds them (`quantity_lines.omitted`):
 * each entry read for the variable and the code it carries, and an entry carrying no code is not
 * invented into one (L-QTY-02). The codes are said once each, in the line's own order.
 */
function omittedOf(stored: readonly unknown[]): { readonly variable: string; readonly code: string }[] {
  const held: { variable: string; code: string }[] = [];
  for (const component of stored) {
    const code = (component as { code?: unknown } | null)?.code;
    const variable = (component as { variable?: unknown } | null)?.variable;
    if (typeof code !== "string" || code === "") continue;
    held.push({ variable: typeof variable === "string" ? variable : "", code });
  }
  return held;
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
  lines: readonly StoredLine[],
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

/**
 * Every line one campaign published that a bill may read, in the order they were published: all of
 * them, less the lines of each object a person has struck in the campaign's revision (I-173,
 * I-449). The struck lines stand in the store untouched — L-ACT-01 deletes nothing — and are read
 * past here, by the register's own answer to which objects stand struck, never by a second one.
 */
async function billableLinesOf(scope: { readonly tenantId: string; readonly projectId: string; readonly setRevisionId: string }, campaignId: string) {
  const [published, struck] = await Promise.all([linesOfCampaign(scope.tenantId, campaignId), repudiatedObjectsOf(scope)]);
  if (struck.length === 0) return published;
  const withheld = new Set(struck.map((row) => row.objectKey));
  return published.filter((line) => !withheld.has(line.objectKey));
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
 * What the document's front page states about the project, IN WORDS (I-530): its name, its
 * client and site as the project holds them, and the pinned drawing set — the set's own name, which
 * revision of it this is, the day it was pinned and the drawings it pins. Never an id. `issued` is
 * the ISSUE's to stamp (`runBoqDraftJob`); a reading is not an issue, so it states none.
 */
async function frontOf(scope: BoqScope, setRevisionId: string): Promise<{ readonly project: string; readonly facts: BoqDraftFront }> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const project = (
      await tx
        .select({ name: projects.name, client: projects.client, site: projects.siteAddress })
        .from(projects)
        .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.projectId, scope.projectId)))
        .limit(1)
    )[0];
    const revision = (
      await tx
        .select({ setId: drawingSetRevisions.setId, manifest: drawingSetRevisions.manifest, createdAt: drawingSetRevisions.createdAt, appendSeq: drawingSetRevisions.appendSeq, name: drawingSets.name })
        .from(drawingSetRevisions)
        .innerJoin(drawingSets, eq(drawingSets.setId, drawingSetRevisions.setId))
        .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
        .limit(1)
    )[0];
    // Which revision of its set this is: the set's revisions in the order the store wrote them
    // (`append_seq`, R-TO-005), counted up to this one.
    const siblings =
      revision === undefined
        ? []
        : await tx
            .select({ appendSeq: drawingSetRevisions.appendSeq })
            .from(drawingSetRevisions)
            .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setId, revision.setId)));
    const said = (value: string | null | undefined): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
    return {
      project: project?.name ?? scope.projectId,
      facts: {
        client: said(project?.client),
        site: said(project?.site),
        drawingSet:
          revision === undefined
            ? null
            : setRevisionInWords({
                name: revision.name,
                ordinal: siblings.filter((sibling) => sibling.appendSeq <= revision.appendSeq).length,
                pinnedOn: formatDate(dhakaDateParts(revision.createdAt)),
              }),
        drawings: (revision?.manifest ?? []).map((member) => member.name).filter((name) => name !== ""),
        issued: null,
      },
    };
  });
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
