// L-ACT-02's Consequence and its digest, which has exactly one home (ARCH-02, B-17): every act
// type's preview computes one of these, and every commit carries the digest of the one it was shown.
// A digest that is not the one the current state produces is `CONSEQUENCES_NOT_CARRIED`.
import { createHash } from "node:crypto";
import type { GeometryFigure, HandLevel, MeasuredGeometry, Recipe } from "../manual/law";
import type { QuantityBasis } from "../offers/law";
import type { Discipline } from "../sheets/law";
import type { ActType } from "./law";

/**
 * One fact the act judges, and what it would do to it. The subject is named because L-ACT-01 records
 * an act "at the granularity performed (a confirm-all is one act with N subjects)"; `before` is the
 * state the digest binds, so a commit computed against different state carries a different digest.
 */
export type ConsequenceSubject = {
  readonly subjectId: string;
  /**
   * What a reader recognises the subject by, when the layer that answered the Consequence could
   * resolve one — an address, a name. It is presentation, never a fact the act judges: only the
   * layer that may read the identity store can fill it (the fold's one home is above this seam), so
   * a Consequence computed inside the seam carries none and the id is what a surface then shows.
   * The digest is deliberately blind to it: what an act would do cannot change because the surface
   * showing it learned a better word for the same person.
   */
  readonly subjectLabel?: string;
  readonly before: readonly string[];
  readonly after: readonly string[];
  /**
   * How the subject STANDS before and after the act, where the act's kind judges a standing over
   * competing readings — a storey height AGREED, SUSPENDED or unstated (L-MEA-07, R-TO-051). `before`
   * and `after` above say what the act's own key holds, which is what the act writes; this says what
   * the person is actually deciding: whether GF stays agreed at 3.3528 m or suspends because a third
   * reading disagrees. Only an act whose kind reads a standing fills it (I-445).
   *
   * Unlike the label it is BOUND by the digest: it is derived from every reading of the subject, so
   * a reading another person adds between preview and commit changes what this act does to the
   * standing without changing its own key's before and after — and the person confirmed the
   * standing they were shown, so that state is a different consequence (L-ACT-02, I-44).
   */
  readonly standing?: ConsequenceStanding;
  /**
   * What `before` and `after` MEAN, where they are not words a person reads — a discipline enum, a
   * drawing's content sha-256 (I-560). It names the vocabulary the two values are said in, and
   * the fact each stands for, so a surface says "Unassigned → Structural" or "Not cited → Revision 2"
   * and can count the subjects that make the same change together ("29 sheets from Unassigned to
   * Structural"). Presentation, and digest-blind exactly as the label is: it is read off the same
   * state the values were, and the values are what the act writes and the digest binds.
   */
  readonly held?: ConsequenceHeld;
  /**
   * The scale the subject — a view — stands at before and after an affirmation, in the words a QS
   * reads a scale by: the rank it stood on and the millimetres one drawing unit is, per axis
   * (I-566). `before` and `after` above still carry the calibration keys the act moves, and
   * the dialog keeps them behind Details, as it keeps the digest.
   *
   * BOUND by the digest, as a standing is: the rank a view stands at is not part of its calibration
   * key, so a later affirmation at another rank with the same factors would change what the person
   * was shown without changing a key — and what they confirmed is what they were shown (L-ACT-02).
   */
  readonly scale?: ConsequenceScale;
};

/**
 * One view's scale as a reader weighs it: the rank of L-MEA-05's precedence it stands on, the
 * factor pair as the 12-place strings the calibration is keyed over, and the same pair as the
 * millimetres one drawing unit is along each axis — exact, with no trailing zeros (B-07).
 */
export type ScaleOfSubject = {
  readonly rank: string;
  readonly factorX: string;
  readonly factorY: string;
  readonly millimetresX: string;
  readonly millimetresY: string;
};

/** A view's scale before an affirmation (null where none stood) and the one the act takes it to. */
export type ConsequenceScale = {
  readonly before: ScaleOfSubject | null;
  readonly after: ScaleOfSubject;
};

/**
 * The vocabularies a subject's values are said in (I-560), a closed union so a surface says each
 * in words off a table keyed by its roster, and a vocabulary added here without words there is a
 * compile error. A null side is the absence the act's own values state by an empty list.
 *
 * - DISCIPLINE — a sheet's confirmed discipline (L-REG-03): none before a first confirmation.
 * - DRAWING_REVISION — the revision ordinal a pinned set cites a drawing at (L-REG-06): none before
 *   the drawing was first cited, none after where the set no longer names it.
 * - LEVEL_POSITION — where a level stands in the project's stack, as its ordinal (L-REG-04): none
 *   before a level the act authors (consequence-dialog I-664).
 * - LEVEL_CARRIED — the label of the live level a placeholder object is carried onto: none before,
 *   where it waited under the placeholder (consequence-dialog I-664).
 */
export type ConsequenceHeld =
  | { readonly kind: "DISCIPLINE"; readonly before: Discipline | null; readonly after: Discipline | null }
  | { readonly kind: "DRAWING_REVISION"; readonly before: number | null; readonly after: number | null }
  | { readonly kind: "LEVEL_POSITION"; readonly before: number | null; readonly after: number | null }
  | { readonly kind: "LEVEL_CARRIED"; readonly before: string | null; readonly after: string | null };

/**
 * What a pin records, as a reader names it (I-561): the set, the revision of it this pin would
 * become (the set's first is 1), the revision standing now (null where it was never pinned), and how
 * many drawings the new revision cites. Presentation, digest-blind: the subjects' content addresses
 * are what the pin records and what the digest binds; this is what they add up to.
 */
export type ConsequencePinning = {
  readonly setName: string;
  readonly revision: number;
  readonly standing: number | null;
  readonly drawings: number;
};

/**
 * One standing, as a reader weighs it: its name off the roster that judges it, the figure it stands
 * at where it stands at one, the unit that figure is in, and how many current readings it is judged
 * over. The figure is a decimal string at the precision it is carried at (B-07, L-QTY-03).
 */
export type StandingOfSubject = {
  readonly standing: string;
  readonly value: string | null;
  readonly unit: string;
  readonly readings: number;
};

/** The standing a subject holds now, the one it would hold, and the figure the act records to move it. */
export type ConsequenceStanding = {
  readonly before: StandingOfSubject;
  readonly after: StandingOfSubject;
  readonly recorded: { readonly value: string; readonly unit: string };
};

/**
 * How a Consequence renders (L-ACT-02: "a type without a rendering is a compile error"). The arms
 * are a closed union and the act pattern switches over it exhaustively, so an act whose Consequence
 * says something a different shape — L-ACT-02's offered groups, say — adds its arm here and its
 * rendering there, or fails to compile.
 */
export type ConsequenceRendering = "SUBJECTS" | "MEASUREMENT";

/**
 * The MEASUREMENT arm's payload (I-373): what a hand measurement would record, whole — the recipe as
 * applied, where it was traced and at what scale, the geometry as the act judged each point of it,
 * and the exact figure that geometry measures. The card renders it; the digest BINDS it, so the
 * recipe and the figure a QS confirmed are what the act records, and a different figure between
 * preview and the write is a different consequence (R-UI-021, I-44).
 *
 * The per-kind quantity the gate's own `judgeOffer` would publish joins this payload when the manual
 * offer builder stands (I-384): until then the figure a person confirms is the geometry's own.
 */
export type ConsequenceMeasurement = {
  readonly objectKey: string;
  /** The object key the new row's key succeeds (I-379), or null for a first measurement. */
  readonly supersedes: string | null;
  /** The standing measurement this act strikes, where it edits one (I-379). */
  readonly replaces: string | null;
  readonly recipe: Recipe;
  readonly level: HandLevel;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly partitionViewKey: string;
  readonly viewKey: string;
  readonly calibrationKey: string;
  readonly factorX: string;
  readonly factorY: string;
  readonly drawnUnit: string;
  readonly figureUnit: string;
  readonly traced: MeasuredGeometry;
  readonly figure: GeometryFigure;
  /** The geometry's own basis: the weakest over its points (I-387). */
  readonly basis: QuantityBasis;
  /** How many snapped points the act could not reproduce on the drawing, and so counted as placed by hand. */
  readonly demoted: number;
  /** The campaign the measurement stands in, whose measure run publishes it (I-384). */
  readonly campaignId?: string;
  /**
   * What the gate answers for each kind of the recipe, asked of the gate's own `judgeOffer` over the
   * one offer builder the run offers through (s-measure I-373, I-384): the figure the card shows is
   * the figure the bill publishes, and the digest binds it.
   */
  readonly offered?: readonly OfferedFigure[];
};

/**
 * One kind of a hand measurement, as the gate would answer it (I-384): published with its figure, unit,
 * formula and basis; queued as a declared exclusion (INTERPRETED geometry nothing corroborates,
 * L-QTY-04); or not offered, where no pairing holds the kind for this geometry and class (I-539).
 */
export type OfferedFigure =
  | {
      readonly kind: string;
      readonly arm: "published";
      readonly ruleId: string;
      readonly ruleVersion: string;
      readonly value: string | null;
      readonly unit: string;
      readonly formula: string;
      readonly coverage: string;
      readonly quantityBasis: string;
    }
  | { readonly kind: string; readonly arm: "queued"; readonly cause: string }
  | { readonly kind: string; readonly arm: "not-offered" };

/**
 * What an act would do BEYOND its subjects: the derived state that follows from moving them
 * (R-TO-020: an affirmation "previews consequences (lines that re-derive, signatures that void)").
 * Typed slots, each a list of the ids that would move, so an empty slot is a stated nothing rather
 * than an absent field. Both are filled by the code path that owns the state they name — the
 * quantity lines' and the signatures' — and stand empty until it exists.
 */
export type ConsequenceEffects = {
  readonly linesRederiving: readonly string[];
  readonly signaturesVoiding: readonly string[];
  /**
   * The same lines as a quantity surveyor counts them: by class, kind and the level their objects
   * stand on — "Column · Concrete, GF, 26 lines" rather than 26 identifiers (R-UI-021's "counts of
   * rows affected", R-UI-082). Presentation, filled by the act seam's preview from the ids above and
   * the register they were measured off (I-446), and digest-blind exactly as a subject's label
   * is: the ids are what the person confirms, and a line's class and kind never change under its
   * id. Absent where nothing grouped them — a reader then states the count of the ids.
   */
  readonly lineGroups?: readonly ConsequenceLineGroup[];
};

/**
 * One group of the lines an act would re-derive. `description` is what the bill calls the (class,
 * kind) pair (`descriptionOf`: "Column · Concrete"); the level is the label of the level the objects
 * stand on or the placeholder they stand under, and the slot is the lawful-null slot they stand in
 * (L-REG-04) — both null where the register states neither. `count` is how many of the effect's ids
 * the group holds, so the groups' counts sum to the ids' length.
 */
export type ConsequenceLineGroup = {
  readonly elementClass: string;
  readonly kind: string;
  readonly description: string;
  readonly levelLabel: string | null;
  readonly levelSlot: string | null;
  readonly count: number;
};

/** What an act would do, computed by the committing code path from the state it read (L-ACT-02). */
export type Consequence = {
  readonly actType: ActType;
  readonly tenantId: string;
  readonly projectId: string;
  /**
   * Named, never defaulted: L-ACT-02 makes a type without a rendering a compile error, and an
   * optional field would let the act that arrives with the second arm's shape compile as the first
   * one — rendering its groups as a subject list nobody wrote.
   */
  readonly rendering: ConsequenceRendering;
  readonly subjects: readonly ConsequenceSubject[];
  /** The derived consequences an act previews, where its kind has any (R-TO-020); absent for the rest. */
  readonly effects?: ConsequenceEffects;
  /** The MEASUREMENT arm's payload, present exactly where the rendering is that arm (I-373). */
  readonly measurement?: ConsequenceMeasurement;
  /** What a PIN_DRAWING_SET act records, in words a reader names it by (I-561); absent for every other act. */
  readonly pinning?: ConsequencePinning;
};

/**
 * The digest of a consequence: sha-256 over its canonical form, so two consequences agree here iff
 * they say the same thing. Hex, because the digest is written to the act log and read back by
 * people as well as by this seam.
 */
export function consequenceDigest(consequence: Consequence): string {
  return createHash("sha256").update(canonical(judged(consequence)), "utf8").digest("hex");
}

/**
 * What the digest binds: the facts the act would move, and the arm they are judged as. A subject's
 * label is presentation — a surface that resolved a nicer word for the same person — and a digest
 * that changed with it would refuse `CONSEQUENCES_NOT_CARRIED` for a state that never moved. The
 * rendering arm is not presentation in that sense: it says WHAT KIND of thing the subjects are
 * (L-ACT-02's offered groups are not a subject list), so a preview shown as one arm and a commit
 * recomputed as another are not the same consequence, and R-UI-021 makes the digest the thing the
 * operator confirmed. The effects are bound for the same reason: what a person confirmed includes
 * which lines would re-derive and which signatures would void (R-TO-020), and a state in which a
 * different set would move is a different consequence. An act whose kind carries no effects
 * digests as it always has — `canonical` writes nothing for an absent field.
 *
 * A subject's standing is bound for the reason its own field states (I-445), and a view's scale for
 * the reason its own states (I-566); a subject whose act reads neither carries no field and
 * digests exactly as before. A hand measurement's payload is
 * bound whole (I-373): the recipe and the figure the person read are what they confirmed, and an act
 * with no such arm carries no field and digests exactly as before. The effects are bound as their
 * two id lists and nothing more: the lines' grouping is the seam's presentation of those same ids
 * (I-446), and a commit recomputes the ids, not the words a surface counted them in. A subject's
 * `held` vocabulary and a pin's `pinning` are presentation of the values bound here (I-560,
 * I-561), so neither is bound, and a pin or a discipline confirmation digests exactly as before.
 */
function judged(consequence: Consequence): unknown {
  const effects = consequence.effects;
  return {
    actType: consequence.actType,
    tenantId: consequence.tenantId,
    projectId: consequence.projectId,
    rendering: consequence.rendering,
    subjects: consequence.subjects.map((subject) => ({ subjectId: subject.subjectId, before: subject.before, after: subject.after, standing: subject.standing, scale: subject.scale })),
    effects: effects === undefined ? undefined : { linesRederiving: effects.linesRederiving, signaturesVoiding: effects.signaturesVoiding },
    measurement: consequence.measurement,
  };
}

/**
 * Whether the act would move anything at all. L-ACT-01's act is "a human write that changes what the
 * machine would derive", so a Consequence whose every subject ends as it began records nothing — the
 * seam refuses it by name instead of writing an act row the state write cannot follow.
 */
export function movesNothing(consequence: Consequence): boolean {
  return consequence.subjects.every((subject) => same(subject.before, subject.after));
}

/**
 * Two readings of one subject's state, compared by what they say rather than by the order a reader
 * happened to build them in. Order is a property of a query's sort, not of what somebody holds, so
 * the same roles read back two ways are the same state and an act over them moves nothing (L-ACT-01)
 * — the reading `canonical` already applies to a digest's keys, applied to a subject's own lists.
 */
function same(before: readonly string[], after: readonly string[]): boolean {
  if (before.length !== after.length) return false;
  const held = new Map<string, number>();
  for (const entry of before) held.set(entry, (held.get(entry) ?? 0) + 1);
  for (const entry of after) {
    const standing = held.get(entry);
    if (standing === undefined) return false;
    if (standing === 1) held.delete(entry);
    else held.set(entry, standing - 1);
  }
  return held.size === 0;
}

/**
 * The canonical form a digest is taken over: object keys in code-point order, arrays in their own
 * order, nothing else. Key order is a property of how a value was built, never of what it says, so
 * it is removed before hashing — otherwise the same consequence would digest two ways. This is the
 * one canonical-JSON home (B-17): the model seam's request hash is taken over it too.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, held]) => held !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, held]) => `${JSON.stringify(key)}:${canonical(held)}`).join(",")}}`;
  }
  throw new Error(`a consequence holds ${typeof value}, which nothing can digest — a Consequence is data (L-ACT-02)`);
}
