// SEAM-GATE: "the gate is the sole writer of quantity lines and rail observations (L-MEA-08)".
//
// One batch in, one verdict out. Every offer is judged on its own and lands on exactly one of three
// arms — published, queued or refused — so the three sum to the offers handed in and one bad offer
// never costs the others their answer. A refusal is RETURNED with the registered code it answers
// with, never thrown: a rail's batch is data, and data that does not hold is an answer about the
// data rather than a fault of the machine (ARCH-03, B-21).
//
// The three arms are L-QTY-04's, not this file's invention: interpreted geometry nothing corroborates
// is "a declared exclusion + queue item, never a line", a method the edition does not cite or that
// nothing implements is a refusal by name, and what publishes publishes with everything L-QTY-03
// says a line always carries.
//
// Everything lands in ONE transaction and idempotently on natural keys: a line is keyed (campaign,
// object, kind), a queue item the same, an observation on what the observation IS. So a second run
// of the same rail over the same revision reports what it found and writes nothing further — which
// is what makes re-measuring safe rather than a way to double-count (L-QTY-04's over-measurement is
// a hard block).
import { createHash } from "node:crypto";
import { canonical } from "../acts/consequence";
import { isElementType } from "../catalogue/classes";
import { isKind } from "../catalogue/kinds";
import { editionOf, type PinnedEdition } from "../campaigns";
import { and, campaigns, eq, forTenant, isUuid, quantityLines, queueItems, railObservations, type TenantTx } from "../db";
import { REFUSALS, type RefusalCode } from "../errors";
import type { GateRefusal, GateScope, GateVerdict, Measure, Offer, RailBatch, RailObservation } from "../offers/contract";
import { COVERAGES, ENGINES, GEOMETRY_TYPES, QUANTITY_BASES } from "../offers/law";
import type { MethodPair } from "../rulesets/editions/content";
import { implementationOf, type FormulaMethod, type NormalisedBindings } from "../rulesets/methods/registry";
import { CANONICAL_UNIT } from "../units/canon";
import { partitionDeductions } from "./deductions";
import { renderFormula } from "./template";
import { normaliseMeasure } from "./units";

/** The campaign a batch is judged under — what it was opened over, and what it measures against. */
export type MeasuredUnder = {
  readonly campaignId: string;
  readonly projectId: string;
  readonly setRevisionId: string;
  readonly editionId: string;
  readonly editionDigest: string;
};

/** One reading as the line records it: what the drawing said, and what the canon made of it. */
type RecordedBinding = {
  readonly value: string;
  readonly unit: string;
  readonly basis: string;
  readonly source: string;
  readonly calibration?: string;
  readonly canonical: { readonly value: string; readonly unit: string };
};

/** One candidate as the line records it, with the side the edition's threshold put it on. */
type RecordedDeduction = { readonly channel: string; readonly measure: Measure; readonly side: "deducted" | "kept" };

// The workspace is the scope's, not the offer's, and it is stamped on at the write — so a judgement
// is a statement about an offer and cannot carry a workspace of its own (SEAM-TENANT).
/** The row a published offer becomes (L-QTY-03's "always" list, column by column). */
type PublishedLine = Omit<typeof quantityLines.$inferInsert, "tenantId">;

/** The row a deferred offer becomes (L-QTY-04's declared exclusion). */
type QueuedItem = Omit<typeof queueItems.$inferInsert, "tenantId">;

/** Which arm one offer landed on, and what it left behind. */
export type Judgement =
  | { readonly arm: "published"; readonly line: PublishedLine }
  | { readonly arm: "queued"; readonly item: QueuedItem }
  | { readonly arm: "refused"; readonly refusal: GateRefusal };

/** A refusal about this offer, by the registered code it answers with (R-SPINE-062). */
function refuse(offer: Offer, code: RefusalCode): Judgement {
  return { arm: "refused", refusal: { objectKey: offer.register.objectKey, code } };
}

/** Is this spelling a member of the closed roster the contract publishes? */
function inRoster(roster: readonly string[], value: string): boolean {
  return roster.includes(value);
}

/**
 * Does this offer stand to the rail↔gate contract at all — is every closed-roster value one of the
 * roster's, does it provenance to a register object of the campaign's own revision, and does it name
 * the view it was read from?
 *
 * A contract violation is one code (riskNotes (4)): the rail and the gate disagree about what an
 * offer IS, which is not a measurement question and tells a reader nothing about the drawing.
 */
function toContract(offer: Offer, under: MeasuredUnder): boolean {
  return (
    offer.ruleId.length > 0 &&
    isElementType(offer.class) &&
    isKind(offer.kind) &&
    inRoster(ENGINES, offer.engine) &&
    inRoster(GEOMETRY_TYPES, offer.geometry.type) &&
    inRoster(QUANTITY_BASES, offer.geometry.basis) &&
    inRoster(COVERAGES, offer.coverage) &&
    offer.register.objectKey.length > 0 &&
    offer.register.setRevisionId === under.setRevisionId &&
    isUuid(offer.drawing.drawingId) &&
    offer.drawing.viewKey.length > 0
  );
}

/**
 * The version of this offer's rule the edition puts in force. An offer names a rule and never a
 * version — which version is in force is the pinned edition's to say (L-MEA-08) — and an edition
 * cites its pairs in the order it was authored, so the first it cites for this rule is the one it
 * puts in force.
 */
function versionInForce(edition: PinnedEdition, ruleId: string): MethodPair | undefined {
  return edition.methods.find((pair) => pair.ruleId === ruleId);
}

/** Every calibration reference this offer's readings stand on, deduplicated (L-QTY-03). */
function calibrationKeysOf(offer: Offer): string[] {
  const affirmed = [offer.geometry.calibration, ...Object.values(offer.bindings).map((reading) => reading.calibration)];
  return [...new Set(affirmed.filter((key): key is string => key !== undefined && key.length > 0))].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/**
 * What makes two reports the same observation: what the observation IS — the class and kind it is
 * keyed on, the rail-local code, and the object and source entity it is about where it is about one.
 * Digested through the tree's one canonical form, so a value carrying the separator cannot spell
 * another observation's key (B-17).
 */
function observationKeyOf(observation: RailObservation): string {
  const said = [observation.class, observation.kind, observation.code, observation.objectKey ?? "", observation.sourceEntity ?? ""];
  return createHash("sha256").update(canonical(said), "utf8").digest("hex");
}

/**
 * Judge one offer against the campaign's edition, and answer which arm it lands on.
 *
 * The order is the order a reader would ask the questions in: is this an offer at all, is its rule in
 * force, can the tree compute it, is its geometry corroborated, are its readings carryable, do its
 * deduction candidates stand in channels the method declares. Each answer is final for that offer —
 * nothing is judged twice and nothing falls through.
 */
export function judgeOffer(offer: Offer, under: MeasuredUnder, edition: PinnedEdition): Judgement {
  if (!toContract(offer, under)) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

  const pair = versionInForce(edition, offer.ruleId);
  if (pair === undefined) return refuse(offer, REFUSALS.METHOD_NOT_IN_EDITION.code);

  const implementation = implementationOf(pair);
  // A pair the tree implements with a resolver publishes no quantity, so there is no formula of this
  // version to measure the offer by — the same fact as no implementation at all, from the gate's side.
  if (implementation === undefined || implementation.role !== "formula") return refuse(offer, REFUSALS.METHOD_IMPLEMENTATION_MISSING.code);
  const method: FormulaMethod = implementation;
  if (method.kind !== offer.kind) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

  // L-QTY-04: "interpreted geometry uncorroborated → declared exclusion + queue item, never a line".
  // The deferral carries a registered code, because the same taxonomy serves machine refusals and
  // human deferrals (riskNotes (3)).
  if (offer.geometry.basis === "INTERPRETED") {
    return {
      arm: "queued",
      item: {
        campaignId: under.campaignId,
        projectId: under.projectId,
        objectKey: offer.register.objectKey,
        kind: offer.kind,
        cause: REFUSALS.INTERPRETED_UNCORROBORATED.code,
        detail: { ruleId: offer.ruleId, ruleVersion: pair.version, geometry: offer.geometry.type },
      },
    };
  }

  // Every declared variable, and only the declared variables: a binding the method does not name is
  // the rail and the method disagreeing about the declaration, and dropping it silently would be the
  // gate deciding what a drawing said.
  const declared = new Set(method.variables.map((variable) => variable.name));
  if (Object.keys(offer.bindings).some((name) => !declared.has(name))) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

  const normalised: Record<string, { value: string; unit: string }> = {};
  const recorded: Record<string, RecordedBinding> = {};
  for (const variable of method.variables) {
    const reading = offer.bindings[variable.name];
    if (reading === undefined) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);
    const carried = normaliseMeasure(reading, variable.dimension);
    if (!carried.ok) return refuse(offer, carried.code);
    normalised[variable.name] = { value: carried.value, unit: carried.unit };
    recorded[variable.name] = {
      value: reading.value,
      unit: reading.unit,
      basis: reading.basis,
      source: reading.source,
      ...(reading.calibration === undefined ? {} : { calibration: reading.calibration }),
      canonical: { value: carried.value, unit: carried.unit },
    };
  }

  // A candidate in a channel this method does not declare is an offer to deduct through something
  // the rule does not deduct through — a contract violation, not a threshold question.
  if (offer.deductions.some((candidate) => !method.deductionChannels.includes(candidate.channel))) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  const partition = partitionDeductions(offer.deductions, edition.parameters);
  if (!partition.ok) return refuse(offer, partition.code);

  const bound = normalised as NormalisedBindings;
  const deductions: RecordedDeduction[] = [
    ...partition.deducted.map((candidate) => ({ channel: candidate.channel, measure: candidate.measure, side: "deducted" as const })),
    ...partition.kept.map((candidate) => ({ channel: candidate.channel, measure: candidate.measure, side: "kept" as const })),
  ];

  return {
    arm: "published",
    line: {
      campaignId: under.campaignId,
      projectId: under.projectId,
      setRevisionId: under.setRevisionId,
      objectKey: offer.register.objectKey,
      drawingId: offer.drawing.drawingId,
      viewKey: offer.drawing.viewKey,
      class: offer.class,
      kind: offer.kind,
      ruleId: method.ruleId,
      ruleVersion: method.version,
      editionDigest: under.editionDigest,
      engine: offer.engine,
      quantityBasis: offer.geometry.basis,
      coverage: offer.coverage,
      value: method.evaluate(bound),
      unit: CANONICAL_UNIT[method.dimension],
      formula: renderFormula(method, bound),
      bindings: recorded,
      selectors: offer.selectors,
      deductions,
      calibrationKeys: calibrationKeysOf(offer),
    },
  };
}

/** The campaign this scope names, read on the caller's transaction — or nothing where it holds none. */
async function campaignUnder(tx: TenantTx, scope: GateScope): Promise<MeasuredUnder | null> {
  if (!isUuid(scope.tenantId) || !isUuid(scope.projectId) || !isUuid(scope.campaignId)) return null;
  const held = await tx
    .select({
      campaignId: campaigns.campaignId,
      projectId: campaigns.projectId,
      setRevisionId: campaigns.setRevisionId,
      editionId: campaigns.editionId,
      editionDigest: campaigns.editionDigest,
    })
    .from(campaigns)
    .where(and(eq(campaigns.tenantId, scope.tenantId), eq(campaigns.projectId, scope.projectId), eq(campaigns.campaignId, scope.campaignId)))
    .limit(1);
  return held[0] ?? null;
}

/**
 * Judge one rail's batch for one campaign and write what it publishes, defers and observes.
 *
 * A campaign this project does not hold is refused for every offer of the batch rather than thrown:
 * the caller asked what would be published and the answer is "nothing, because there is no campaign
 * to publish under" — an answer, in the closed taxonomy, one refusal per offer (ARCH-03, B-21).
 */
export async function evaluateOffers(scope: GateScope, batch: RailBatch): Promise<GateVerdict> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const under = await campaignUnder(tx, scope);
    if (under === null) {
      const refusals = batch.offers.map((offer) => ({ objectKey: offer.register.objectKey, code: REFUSALS.CAMPAIGN_NOT_FOUND.code }));
      return { published: 0, refused: refusals.length, queued: 0, refusals: Object.freeze(refusals) };
    }

    // The edition the CAMPAIGN was opened under, never the one the project is pinned to now: a
    // campaign is measured under what it snapshotted, and a pin that has moved makes it stale rather
    // than retroactively re-measuring it (L-REG-07).
    const edition = await editionOf(tx, scope.tenantId, under.editionId);
    if (edition === null) {
      throw new Error(`the campaign ${under.campaignId} cites the rule-set edition ${under.editionId}, which this workspace does not hold — a campaign measures under the edition it copied (L-REG-07)`);
    }

    const judged = batch.offers.map((offer) => judgeOffer(offer, under, edition));
    const refusals: GateRefusal[] = judged.flatMap((answer) => (answer.arm === "refused" ? [answer.refusal] : []));

    for (const answer of judged) {
      if (answer.arm === "published") {
        await tx.insert(quantityLines).values({ ...answer.line, tenantId: scope.tenantId }).onConflictDoNothing();
      } else if (answer.arm === "queued") {
        await tx.insert(queueItems).values({ ...answer.item, tenantId: scope.tenantId }).onConflictDoNothing();
      }
    }

    for (const observation of batch.observations) {
      await tx
        .insert(railObservations)
        .values({
          tenantId: scope.tenantId,
          campaignId: under.campaignId,
          projectId: under.projectId,
          class: observation.class,
          kind: observation.kind,
          code: observation.code,
          objectKey: observation.objectKey ?? null,
          sourceEntity: observation.sourceEntity ?? null,
          observationKey: observationKeyOf(observation),
          detail: observation.detail ?? null,
        })
        .onConflictDoNothing();
    }

    // The verdict counts what was JUDGED, not what the store accepted: a second run of the same batch
    // is the same judgement, and reporting nothing for it would say the offers had vanished.
    return {
      published: judged.filter((answer) => answer.arm === "published").length,
      refused: refusals.length,
      queued: judged.filter((answer) => answer.arm === "queued").length,
      refusals: Object.freeze(refusals),
    };
  });
}
