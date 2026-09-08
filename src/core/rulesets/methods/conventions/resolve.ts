// L-CAD-08's convention profile: which layers carry linework, outlines, text and dimensions, and
// which caption grammars name views — resolved per drawing from an entity census by geometry
// statistics, and from nothing else.
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

/** The whole reading a drawing offers about its own conventions. */
export type EntityCensus = { readonly layers: readonly LayerCensus[]; readonly grammars: readonly GrammarCensus[] };

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
};

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
 * names views only where it really read a caption, and a role no layer carries is deferred by the
 * register's own code rather than defaulted to a layer.
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
