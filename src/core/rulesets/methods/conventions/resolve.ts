// L-CAD-08's convention profile: which layers carry linework, outlines, text and dimensions, which
// caption grammars name views, and which UNIT the drawing declares its dimensions in — resolved per
// drawing from an entity census, and from nothing else.
//
// A pure method over core types (L-MEA-01's sense of one): no store, no clock, no model, no module.
// The same census resolves the same profile forever, which is what lets the stored partition rebuild
// it and what lets an edition cite it by (rule id, version).
//
// The seed is L-CAD-08's "replaceable seed": it "may corroborate but never add, drop or re-assign a
// role". That is read here as total independence of the answer — `resolve(census, seed)` is
// `resolve(census)` for every seed there is — so the seed is a typed argument this method accepts
// and never reads. A field a seed populated would be a field a seed changed, and the clause's own
// CI-enforced equality would not hold of it.
//
// Layer names and grammar ids are opaque strings: what a drawing calls its layers is the drawing's
// business, and the classes a caption grammar reads are spelled once in the view law (L-CAD-06 bans
// a second home for those literals). This method compares tallies and sorts names, and knows the
// meaning of neither.
import type { SectionUnit } from "@/core/db";
import { REFUSALS, type RefusalCode } from "@/core/errors";

/** L-MEA-01's citation form: an edition holds a method as (rule id, version) and by nothing else. */
export const CONVENTIONS_METHOD = { ruleId: "conventions.resolve", version: "1" } as const;

/** The four roles L-CAD-08 asks a drawing's conventions for, in the order it asks them. */
export const CONVENTION_ROLES = ["linework", "outlines", "text", "dimensions"] as const;

/** One of the four. */
export type ConventionRole = (typeof CONVENTION_ROLES)[number];

/** What one layer was drawn with: the tally of each kind of entity standing on it. */
export type LayerCensus = {
  readonly layer: string;
  readonly paths: number;
  readonly rings: number;
  readonly texts: number;
  readonly dimensions: number;
};

/** What one caption grammar read: how many views it named. */
export type GrammarCensus = { readonly grammar: string; readonly captions: number };

/**
 * What one UNIT the drawing declared its dimensions in was read from: how many of its texts declare
 * it, and the first entity that does, in code-point order of source key (I-302).
 *
 * The census counts; this method decides. A drawing declaring one unit ten times has declared it
 * once, and a drawing declaring two has declared neither — which is a comparison of counted
 * readings, and needs no reading of any text here (L-CAD-08 keeps this method pure over a census).
 */
export type UnitDeclarationCensus = {
  readonly unit: SectionUnit;
  readonly sourceKey: string;
  readonly declarations: number;
};

/**
 * The whole reading a drawing offers about its own conventions.
 *
 * `unitDeclarations` is OPTIONAL because a census stored before the drawing's declared unit was read
 * at all carries none, and a row an older reading left is a record of what that reading took rather
 * than a drawing that was examined and found to declare nothing (L-QTY-04). A census this method's
 * own counter takes always carries the field, empty where the drawing declares nothing.
 */
export type EntityCensus = {
  readonly layers: readonly LayerCensus[];
  readonly grammars: readonly GrammarCensus[];
  readonly unitDeclarations?: readonly UnitDeclarationCensus[];
};

/**
 * The unit a drawing DECLARES its dimensions in, and the entity that declares it (I-302, L-CAD-08).
 *
 * The source key is part of the reading and not a convenience: a unit read off S-01 is evidence from
 * S-01, and a figure measured under it cites the note that gave it one (L-QTY-03).
 */
export type DeclaredDimensionUnit = { readonly unit: SectionUnit; readonly sourceKey: string };

/**
 * A corroborating seed: what somebody else believes each role's layers are. Accepted and never read
 * — see the note at the head of this file.
 */
export type ConventionSeed = { readonly roles?: Readonly<Partial<Record<ConventionRole, readonly string[]>>> };

/** A role the census does not resolve: deferred by name, never defaulted to a layer (L-QTY-04). */
export type ConventionDeferral = {
  readonly code: Extract<RefusalCode, "CONVENTION_ROLE_UNRESOLVED">;
  readonly role: ConventionRole;
};

/** The profile a census resolves to: who carries what, which grammars named views, what is deferred. */
export type ConventionProfile = {
  readonly roles: Readonly<Record<ConventionRole, readonly string[]>>;
  readonly captionGrammars: readonly string[];
  readonly deferrals: readonly ConventionDeferral[];
  /**
   * The unit this drawing declares its dimensions in, `null` where it declares none or declares two
   * that disagree (I-302). Optional for the reason the census's own field is: a profile stored before
   * the declaration was read carries no such reading, and `undefined` says that where `null` says the
   * drawing was read and found silent.
   */
  readonly dimensionUnit?: DeclaredDimensionUnit | null;
};

/**
 * Whether some value really is a profile this method answered — the type's own judgement, standing
 * beside the type so a reader that stored one and a reader that reads one back cannot come to hold
 * two ideas of what a profile is (ARCH-02).
 *
 * A stored profile arrives as whatever json the column holds. Cast rather than judged, a row written
 * by another shape reaches placement and is only discovered when something dereferences it; judged
 * by a second, local spelling of the shape, the two spellings drift. So it is asked here, of the
 * one home.
 */
export function isConventionProfile(value: unknown): value is ConventionProfile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { roles?: unknown; captionGrammars?: unknown; deferrals?: unknown };
  if (typeof candidate.roles !== "object" || candidate.roles === null) return false;
  const roles = candidate.roles as Record<string, unknown>;
  if (!CONVENTION_ROLES.every((role) => isStringList(roles[role]))) return false;
  if (!isStringList(candidate.captionGrammars)) return false;
  if (!isDeclaredDimensionUnit((value as { dimensionUnit?: unknown }).dimensionUnit)) return false;
  return (
    Array.isArray(candidate.deferrals) &&
    candidate.deferrals.every((deferral) => {
      if (typeof deferral !== "object" || deferral === null) return false;
      const stated = deferral as { code?: unknown; role?: unknown };
      return stated.code === REFUSALS.CONVENTION_ROLE_UNRESOLVED.code && CONVENTION_ROLES.some((role) => role === stated.role);
    })
  );
}

/** A list of layer names, as every role of a profile carries one. */
function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/**
 * Whether a value is what this method answers for the drawing's declared unit: a reading, the `null`
 * that says the drawing declares none, or ABSENT — which is what a profile stored before the
 * declaration was read at all carries, and a record this method still recognises as its own.
 *
 * The unit is judged against nothing here but its being a string: the roster is the store's
 * (`SECTION_UNITS`), the column's own check closes it, and a second closed list in this file would
 * be a second answer to which units a drawing may be measured in (B-17).
 */
function isDeclaredDimensionUnit(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object") return false;
  const stated = value as { unit?: unknown; sourceKey?: unknown };
  return typeof stated.unit === "string" && typeof stated.sourceKey === "string";
}

/** Which tally of a layer's census decides each role — the geometry statistic the role is read from. */
const ROLE_TALLY: Readonly<Record<ConventionRole, (layer: LayerCensus) => number>> = Object.freeze({
  linework: (layer) => layer.paths,
  outlines: (layer) => layer.rings,
  text: (layer) => layer.texts,
  dimensions: (layer) => layer.dimensions,
});

/** Code-point order, which is the only order a derivation sorts by: no locale reaches a stored row. */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The unit the drawing declares its dimensions in, read off the counted declarations alone (I-302).
 *
 * ONE unit declared, however many texts declare it, is the drawing's convention: a set that prints
 * `ALL DIMENSIONS ARE IN MILLIMETRES` on every sheet has said one thing many times. TWO units
 * declared is no convention at all — a disagreement is not a reading, and nothing here is in a
 * position to decide which sheet the office meant (L-QTY-04, and `parseSizePair`'s own refusal of a
 * pair whose two sides disagree). NONE declared is `null`: a number nobody gave a unit to is not a
 * millimetre (L-MEA-01).
 *
 * The census counts a declaration only where a text really declares one, so a census that carries
 * none and a census that was taken before this was read at all resolve alike — to nothing.
 */
function declaredUnitOf(census: EntityCensus): DeclaredDimensionUnit | null {
  const declared = census.unitDeclarations ?? [];
  const stated = declared.filter((reading) => reading.declarations > 0);
  const only = stated.length === 1 ? stated[0] : undefined;
  return only === undefined ? null : { unit: only.unit, sourceKey: only.sourceKey };
}

/**
 * The role a layer carries, or null where its own geometry does not say. The plurality is STRICT:
 * the deciding tally must outnumber each of the other three, so a layer drawn half in paths and half
 * in rings carries neither role, and a layer nothing was drawn on carries none at all. A drawing
 * that does not say is not a drawing to guess about (L-QTY-04).
 */
function roleOf(layer: LayerCensus): ConventionRole | null {
  for (const role of CONVENTION_ROLES) {
    const tally = ROLE_TALLY[role](layer);
    if (tally > 0 && CONVENTION_ROLES.every((other) => other === role || ROLE_TALLY[other](layer) < tally)) return role;
  }
  return null;
}

/**
 * One drawing's conventions, resolved (L-CAD-08). Every list is in code-point order so that the same
 * census resolves to the identical profile however the census was assembled (L-REG-04), a grammar
 * names views only where it really read a caption, a role no layer carries is deferred by the
 * register's own code rather than defaulted to a layer, and the unit the drawing declares for its
 * dimensions is the one unit its texts declare — or nothing at all (I-302).
 */
export function resolve(census: EntityCensus, seed?: ConventionSeed): ConventionProfile;
// The implementation takes the census and nothing else: the seed stands in the published signature
// above because L-CAD-08 gives a caller one to hand in, and it is absent here because the clause
// forbids it from acting. This is that clause, stated in the type system rather than in prose.
export function resolve(census: EntityCensus): ConventionProfile {
  const carried: Record<ConventionRole, string[]> = { linework: [], outlines: [], text: [], dimensions: [] };
  for (const layer of census.layers) {
    const role = roleOf(layer);
    if (role !== null) carried[role].push(layer.layer);
  }
  for (const role of CONVENTION_ROLES) carried[role].sort(byCodePoint);

  return {
    roles: carried,
    dimensionUnit: declaredUnitOf(census),
    captionGrammars: census.grammars
      .filter((grammar) => grammar.captions > 0)
      .map((grammar) => grammar.grammar)
      .sort(byCodePoint),
    deferrals: CONVENTION_ROLES.filter((role) => carried[role].length === 0).map((role) => ({
      code: REFUSALS.CONVENTION_ROLE_UNRESOLVED.code,
      role,
    })),
  };
}
