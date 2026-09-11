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
import { and, campaigns, eq, forTenant, holdStateLock, inArray, isUuid, quantityLines, queueItems, railObservations, registerObjects, type TenantTx } from "../db";
import { writeInBatches } from "../db/batch";
import { REFUSALS, type RefusalCode } from "../errors";
import type { GateRefusal, GateScope, GateVerdict, Measure, Offer, RailBatch, RailObservation } from "../offers/contract";
import { COVERAGES, ENGINES, GEOMETRY_TYPES, QUANTITY_BASES, weakestBasis, type QuantityBasis } from "../offers/law";
import type { MethodPair } from "../rulesets/editions/content";
import { implementationOf, type FormulaMethod, type NormalisedBindings } from "../rulesets/methods/registry";
import { CANONICAL_UNIT, exact } from "../units/canon";
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
 * L-QTY-01's two roll-ups, derived weakest-wins and never stored as the record of truth: the basis
 * of every determining attribute together with the geometry's own, and the basis of every selecting
 * attribute. The per-attribute bases stay on the line beside them (`bindings`, `selectors`), so the
 * record is still per attribute and these two are readings of it.
 *
 * A selecting attribute nobody stated rolls up to DEFAULTED — "config where the drawing was silent;
 * nobody looked, nobody decided" — rather than inheriting the strength of the numbers beside it
 * (riskNotes (5)). A wrong selecting attribute is the right number at the wrong rate, and saying it
 * was MEASURED because the geometry was would hide exactly that.
 */
function rollUps(offer: Offer): { readonly quantityBasis: QuantityBasis; readonly selectionBasis: QuantityBasis } {
  const determining = Object.values(offer.bindings).map((reading) => reading.basis);
  return {
    quantityBasis: weakestBasis([offer.geometry.basis, ...determining]),
    selectionBasis: weakestBasis(Object.values(offer.selectors).map((reading) => reading.basis)),
  };
}

/** Every reading this offer carries: what it is bound by, what it is selected by, what it deducts. */
function readingsOf(offer: Offer): readonly Measure[] {
  return [...Object.values(offer.bindings), ...Object.values(offer.selectors), ...offer.deductions.map((candidate) => candidate.measure)];
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
    // A line states the quantity basis of what it carries (L-QTY-03), and the basis is a closed
    // roster: a reading spelling one outside it is the rail and the gate disagreeing about what an
    // offer IS, which the gate answers rather than recording verbatim on a line.
    // L-QTY-03 has a line always carry the provenance of what it states, per attribute: a reading
    // names the entity it was read from, and a reading naming nothing is one no reader can go back
    // to and re-read. The recourse the basis promises — "re-read the drawing text", "re-run the
    // pinned rule" — is only a promise if the line says WHERE, so an unprovenanced reading is
    // refused here rather than published as a figure standing on nothing (L-QTY-01, L-QTY-03).
    readingsOf(offer).every((reading) => inRoster(QUANTITY_BASES, reading.basis) && reading.source.length > 0) &&
    // L-QTY-02: COMPLETE, or PARTIAL_DECLARED with EVERY omitted component enumerated on the row.
    // The two halves are one statement: a row claiming COMPLETE while enumerating an omission, and
    // one claiming partiality while enumerating none, are both PARTIAL_UNDECLARED spelled sideways
    // — which the clause makes unrepresentable, so the gate answers rather than storing it.
    (offer.coverage === "COMPLETE") === (offer.omitted.length === 0) &&
    // An omission is declared by NAME and by registered code, so a reader learns which component of
    // the description is missing and why (R-SPINE-062: the taxonomy is closed).
    offer.omitted.every((component) => component.variable.length > 0 && Object.hasOwn(REFUSALS, component.code)) &&
    offer.register.objectKey.length > 0 &&
    offer.register.setRevisionId === under.setRevisionId &&
    isUuid(offer.drawing.drawingId) &&
    offer.drawing.viewKey.length > 0
  );
}

/**
 * Does this observation stand to the same contract? A rail's observation is the same rail's DATA as
 * its offers are, and the stores it lands in close their class and kind against the catalogue — so
 * it is judged before it is written, or one malformed report would cost a whole batch its lines by
 * failing the transaction they share (L-MEA-08, ARCH-03).
 */
function observationToContract(observation: RailObservation): boolean {
  return isElementType(observation.class) && isKind(observation.kind) && observation.code.length > 0;
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
 * force, can the tree compute it, is the object one the register holds, is its geometry corroborated,
 * are its readings carryable, does it stand on a calibration reference, do its deduction candidates
 * stand in channels the method declares. Each answer is final for that offer — nothing is judged
 * twice and nothing falls through.
 */
export function judgeOffer(offer: Offer, under: MeasuredUnder, edition: PinnedEdition, registered: ReadonlySet<string>): Judgement {
  if (!toContract(offer, under)) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

  const pair = versionInForce(edition, offer.ruleId);
  if (pair === undefined) return refuse(offer, REFUSALS.METHOD_NOT_IN_EDITION.code);

  const implementation = implementationOf(pair);
  // A pair the tree implements with a resolver publishes no quantity, so there is no formula of this
  // version to measure the offer by — the same fact as no implementation at all, from the gate's side.
  if (implementation === undefined || implementation.role !== "formula") return refuse(offer, REFUSALS.METHOD_IMPLEMENTATION_MISSING.code);
  const method: FormulaMethod = implementation;
  if (method.kind !== offer.kind) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

  // The object the offer is about, asked of the register itself: a line carries "provenance to a
  // register row as a reference" (L-QTY-03), so a key no row of this campaign's own revision holds is
  // a key nothing can be traced through — and a quantity for an object nothing registered would be
  // severed from the object it claims to measure, which is neither a line nor a deferral.
  if (!registered.has(offer.register.objectKey)) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

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

  // An omission is of a variable this METHOD declares, and of one the offer does not also bind: a
  // row cannot both carry a component and enumerate it as left out, and a row cannot declare away
  // something the rule never asked for.
  const left = new Map(offer.omitted.map((component) => [component.variable, component.code]));
  if (offer.omitted.some((component) => !declared.has(component.variable) || Object.hasOwn(offer.bindings, component.variable))) {
    return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  }
  if (left.size !== offer.omitted.length) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

  const normalised: Record<string, { value: string; unit: string }> = {};
  const recorded: Record<string, RecordedBinding> = {};
  for (const variable of method.variables) {
    // A variable the row declared omitted is carried by nothing, because nobody read it: the row is
    // kept and states the omission, rather than a quantity over a number the machine invented
    // (L-QTY-02, L-MEA-07's "never defaulted").
    if (left.has(variable.name)) continue;
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

  // L-QTY-03 has a line always carry "a non-empty set of affirmed calibration references", and
  // L-QTY-04 makes a missing mandatory publishable attribute a hard block: an offer standing on no
  // affirmed reference at all publishes nothing, rather than a quantity nobody can say what the
  // drawing it was read from was scaled by ("the drawing was silent → never a silent default").
  const calibrationKeys = calibrationKeysOf(offer);
  if (calibrationKeys.length === 0) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

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
      ...rollUps(offer),
      coverage: offer.coverage,
      // "A row kept with no quantity carries no quantity" — never a zero, never a guess (L-QTY-02).
      // The unit stands even so: it is what this rule measures in, not a property of the figure.
      value: offer.omitted.length === 0 ? method.evaluate(bound) : null,
      unit: CANONICAL_UNIT[method.dimension],
      formula: renderFormula(method, bound, offer.omitted),
      bindings: recorded,
      selectors: offer.selectors,
      deductions,
      omitted: offer.omitted,
      calibrationKeys,
    },
  };
}

/** What a line and a queue item are both keyed on: one object, under one kind. */
function naturalKeyOf(objectKey: string, kind: string): string {
  return canonical([objectKey, kind]);
}

/** The state two runs of one campaign are serialised on: everything that campaign's stores hold. */
function campaignStateKey(tenantId: string, campaignId: string): string {
  return `gate/campaign:${tenantId}:${campaignId}`;
}

/**
 * L-QTY-04: "over-measurement → hard block, never a disclosure".
 *
 * Two offers of one batch that would both write under one natural key are two statements about one
 * object under one kind, and nothing in the batch says which of them the drawing meant. Neither is
 * written and both are answered: a store keyed on the fact would otherwise keep the first and lose
 * the second in silence, which is the "silent default" the clause forbids. It is the same fact
 * whether the two would land in one store or in two — an object is a published line or a declared
 * exclusion, never both.
 */
function withoutOverMeasurement(judged: readonly Judged[]): Judged[] {
  const writers = new Map<string, number>();
  for (const { offer, judgement } of judged) {
    if (judgement.arm === "refused") continue;
    const key = naturalKeyOf(offer.register.objectKey, offer.kind);
    writers.set(key, (writers.get(key) ?? 0) + 1);
  }
  return judged.map(({ offer, judgement }) =>
    judgement.arm !== "refused" && (writers.get(naturalKeyOf(offer.register.objectKey, offer.kind)) ?? 0) > 1
      ? { offer, judgement: refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code) }
      : { offer, judgement },
  );
}

/** One offer beside the arm it landed on, so a write can answer about the offer it was for. */
type Judged = { readonly offer: Offer; readonly judgement: Judgement };

/** What a standing line states, as the columns a re-measurement would have to state identically. */
type StandingClaim = {
  readonly value: string | null;
  readonly unit: string;
  readonly formula: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly editionDigest: string;
  readonly engine: string;
  readonly quantityBasis: string;
  readonly selectionBasis: string;
  readonly coverage: string;
  readonly class: string;
  readonly drawingId: string;
  readonly viewKey: string;
  readonly calibrationKeys: readonly string[];
};

/**
 * Is the line this offer would publish the one already standing under its key?
 *
 * The value is compared as an exact decimal and everything else as it is written, so a second run of
 * the same rail over the same revision recognises its own line — and a DIFFERENT reading of the same
 * object is seen for what it is rather than disappearing into the natural key (B-07, L-QTY-04).
 */
function sameClaim(standing: StandingClaim, line: PublishedLine): boolean {
  const quantity =
    standing.value === null || line.value === null || line.value === undefined
      ? // A row kept with no quantity recognises its own re-run only against another with none: a
        // figure standing where a declared exclusion did is a DIFFERENT statement about the object.
        standing.value === null && (line.value === null || line.value === undefined)
      : exact(standing.value).eq(exact(line.value));
  return (
    quantity &&
    standing.unit === line.unit &&
    standing.formula === line.formula &&
    standing.ruleId === line.ruleId &&
    standing.ruleVersion === line.ruleVersion &&
    standing.editionDigest === line.editionDigest &&
    standing.engine === line.engine &&
    standing.quantityBasis === line.quantityBasis &&
    standing.selectionBasis === line.selectionBasis &&
    standing.coverage === line.coverage &&
    // The claim is everything L-QTY-03 has a line always state, not the quantity alone: the (drawing,
    // view) it was read from, the class it was measured under, and the set of references it was
    // affirmed against. A run that affirmed another scale bar has made a different statement about
    // the object, and answering it with the standing line would count it published for an affirmation
    // it never stood on.
    standing.class === line.class &&
    standing.drawingId === line.drawingId &&
    standing.viewKey === line.viewKey &&
    canonical(standing.calibrationKeys) === canonical(line.calibrationKeys)
  );
}

/** The object keys of this batch the register really holds on the campaign's own revision. */
async function registeredObjects(tx: TenantTx, tenantId: string, setRevisionId: string, offers: readonly Offer[]): Promise<ReadonlySet<string>> {
  const offered = offeredKeys(offers);
  if (offered.length === 0) return new Set<string>();
  const held = await tx
    .select({ objectKey: registerObjects.objectKey })
    .from(registerObjects)
    .where(and(eq(registerObjects.tenantId, tenantId), eq(registerObjects.setRevisionId, setRevisionId), inArray(registerObjects.objectKey, offered)));
  return new Set(held.map((row) => row.objectKey));
}

/** The object keys this batch is about, each once — what every read of the stores is bounded by. */
function offeredKeys(offers: readonly Offer[]): string[] {
  return [...new Set(offers.map((offer) => offer.register.objectKey).filter((key) => key.length > 0))];
}

/** What the campaign's own stores already hold for the objects this batch is about. */
type Standing = {
  readonly lines: ReadonlyMap<string, StandingClaim>;
  readonly deferred: ReadonlyMap<string, string>;
};

/**
 * The standing records this batch could collide with, read once for the whole batch: after the
 * over-measurement block no two offers write under one key, so one reading stays true for the run.
 */
async function standingFor(tx: TenantTx, tenantId: string, campaignId: string, offers: readonly Offer[]): Promise<Standing> {
  const offered = offeredKeys(offers);
  if (offered.length === 0) return { lines: new Map(), deferred: new Map() };
  const lines = await tx
    .select({
      objectKey: quantityLines.objectKey,
      kind: quantityLines.kind,
      value: quantityLines.value,
      unit: quantityLines.unit,
      formula: quantityLines.formula,
      ruleId: quantityLines.ruleId,
      ruleVersion: quantityLines.ruleVersion,
      editionDigest: quantityLines.editionDigest,
      engine: quantityLines.engine,
      quantityBasis: quantityLines.quantityBasis,
      selectionBasis: quantityLines.selectionBasis,
      coverage: quantityLines.coverage,
      class: quantityLines.class,
      drawingId: quantityLines.drawingId,
      viewKey: quantityLines.viewKey,
      calibrationKeys: quantityLines.calibrationKeys,
    })
    .from(quantityLines)
    .where(and(eq(quantityLines.tenantId, tenantId), eq(quantityLines.campaignId, campaignId), inArray(quantityLines.objectKey, offered)));
  const deferred = await tx
    .select({ objectKey: queueItems.objectKey, kind: queueItems.kind, cause: queueItems.cause })
    .from(queueItems)
    .where(and(eq(queueItems.tenantId, tenantId), eq(queueItems.campaignId, campaignId), inArray(queueItems.objectKey, offered)));
  return {
    lines: new Map(lines.map((row) => [naturalKeyOf(row.objectKey, row.kind), row])),
    deferred: new Map(deferred.map((row) => [naturalKeyOf(row.objectKey, row.kind), row.cause])),
  };
}

/**
 * Publish one line, and answer what the store then holds for its object.
 *
 * A key a queue item already stands under is refused rather than published: an object is a measured
 * line or a declared exclusion and never both (L-QTY-04). A key this very line already stands under
 * is the re-run the natural key exists for, and is reported as published without writing again; a
 * key a DIFFERENT line stands under is the over-measurement across batches, and is answered.
 */
async function publish(tx: TenantTx, tenantId: string, offer: Offer, line: PublishedLine, standing: Standing): Promise<Judgement> {
  const key = naturalKeyOf(line.objectKey, line.kind);
  if (standing.deferred.has(key)) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  const held = standing.lines.get(key);
  if (held !== undefined) return sameClaim(held, line) ? { arm: "published", line } : refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

  // The insert itself is the last word on whether the line landed: a row the natural key swallowed is
  // a measurement the store did not take, and counting it published would be exactly the silent
  // default L-QTY-04 forbids — the run would be told its line stands where another's does.
  const written = await tx.insert(quantityLines).values({ ...line, tenantId }).onConflictDoNothing().returning({ lineId: quantityLines.lineId });
  if (written.length === 0) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  return { arm: "published", line };
}

/**
 * Defer one offer, and answer what the store then holds for its object. The mirror of publishing: a
 * key a line already stands under cannot also be a declared exclusion, and a queue item already
 * standing for the same cause is the same deferral rather than a second one.
 */
async function defer(tx: TenantTx, tenantId: string, offer: Offer, item: QueuedItem, standing: Standing): Promise<Judgement> {
  const key = naturalKeyOf(item.objectKey, item.kind);
  if (standing.lines.has(key)) return refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  const held = standing.deferred.get(key);
  if (held !== undefined) return held === item.cause ? { arm: "queued", item } : refuse(offer, REFUSALS.OFFER_NOT_TO_CONTRACT.code);

  await tx.insert(queueItems).values({ ...item, tenantId }).onConflictDoNothing();
  return { arm: "queued", item };
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

    // Every guard below reads what this campaign's stores already hold and then writes against that
    // reading, so the reading is held true to the commit by locking the campaign's own state. Two
    // runs of one campaign are ordinary — the measure key deduplicates an ask only while one still
    // stands queued — and unserialised they both read an empty store: one object would stand as a
    // published line AND a declared exclusion, and two readings of one object would both be counted
    // published while the store keeps one (L-QTY-04, SEAM-GATE).
    await holdStateLock(tx, campaignStateKey(scope.tenantId, under.campaignId));

    // The edition the CAMPAIGN was opened under, never the one the project is pinned to now: a
    // campaign is measured under what it snapshotted, and a pin that has moved makes it stale rather
    // than retroactively re-measuring it (L-REG-07).
    const edition = await editionOf(tx, scope.tenantId, under.editionId);
    if (edition === null) {
      throw new Error(`the campaign ${under.campaignId} cites the rule-set edition ${under.editionId}, which this workspace does not hold — a campaign measures under the edition it copied (L-REG-07)`);
    }

    // The register is read once for the whole batch: an offer's provenance is a fact about the
    // campaign's own revision, and asking it per offer would ask the store the same question twice.
    const registered = await registeredObjects(tx, scope.tenantId, under.setRevisionId, batch.offers);
    const judged = withoutOverMeasurement(batch.offers.map((offer) => ({ offer, judgement: judgeOffer(offer, under, edition, registered) })));

    const standing = await standingFor(tx, scope.tenantId, under.campaignId, batch.offers);
    const answers: Judgement[] = [];
    for (const { offer, judgement } of judged) {
      if (judgement.arm === "published") answers.push(await publish(tx, scope.tenantId, offer, judgement.line, standing));
      else if (judgement.arm === "queued") answers.push(await defer(tx, scope.tenantId, offer, judgement.item, standing));
      else answers.push(judgement);
    }
    const refusals: GateRefusal[] = answers.flatMap((answer) => (answer.arm === "refused" ? [answer.refusal] : []));

    // The batch's observations go in TOGETHER. An observation the closed rosters do not admit is not
    // written at all: the stores close their class and kind against the catalogue, and an unjudged
    // report would fail the transaction its own batch's sound offers publish in (ARCH-03).
    //
    // One statement per chunk, never one per row (SEAM-DB): the unit of work is the batch the rail
    // handed over — a drawing on a rail — and a drawing with two thousand observations used to pay
    // for two thousand round trips inside this transaction.
    const observed = batch.observations.filter(observationToContract).map((observation) => ({
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
    }));
    await writeInBatches(observed, (chunk) => tx.insert(railObservations).values([...chunk]).onConflictDoNothing());

    // The verdict counts what the store HOLDS for this batch, not what was written on this call: a
    // second run of the same batch finds its own lines and reports them published, because reporting
    // nothing for them would say the offers had vanished — while a count that outran the store would
    // let a measurement disappear behind a natural key (L-QTY-04).
    return {
      published: answers.filter((answer) => answer.arm === "published").length,
      refused: refusals.length,
      queued: answers.filter((answer) => answer.arm === "queued").length,
      refusals: Object.freeze(refusals),
    };
  });
}
