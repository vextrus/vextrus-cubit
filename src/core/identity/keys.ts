// L-REG-04's key grammars, whole: "every derived row key is content-derived with zero minted ids (no
// UUIDs, sequences or timestamps), so an identical re-derivation reproduces the identical key
// multiset". Nothing here reads a clock, a sequence or a random source — a key is a pure function of
// what was seen, and that is the property the whole register rests on.
//
// The four grammars the law names, in the order they compose:
//   view key      = view class + caption-anchor source key
//   placement key = view key + mark + world coordinates quantised to 0.1 drawing unit
//   instance key  = placement key + level surrogate id (lawful-null slot FOUNDATION | UNRESOLVED)
//   bar key       = member key + role + diameter + sequence
//
// L-REG-02 binds what may enter one: no coordinates beyond the quantised placement, and no labels or
// mutable attributes — "a level is referenced by surrogate id; its label, ordinal and height never
// enter a key". The one exception the law itself writes is the `@unregistered:<label>` placeholder,
// which stands in for a level nobody has authored yet and is carried onto its surrogate exactly once
// (`carryLevel`).
import Decimal from "decimal.js";
import { parseSourceKey, type SourceKey } from "../sources";
import { exact } from "../units/canon";

/**
 * The separator between the fields of a key. One character, spelled once: a grammar whose parts are
 * joined two ways is two grammars (B-17).
 */
const FIELD = "|";

/**
 * What a level segment opens with, in every one of its four forms. Published because the store
 * spells the same segment in the CHECK that binds a row's level columns to its key — one grammar,
 * one home (B-17).
 */
export const LEVEL_MARKER = "@";

/** The placeholder a level nobody has authored yet stands under (L-REG-04's one-hop carry). */
export const UNREGISTERED_PREFIX = `${LEVEL_MARKER}unregistered:`;

/**
 * The lawful-null level slots (L-REG-04). A sighting whose level is not a level — a foundation, or
 * one the drawing does not resolve — stands in a named slot rather than under a null, so the key
 * says which absence it is.
 */
export const LEVEL_SLOTS = ["FOUNDATION", "UNRESOLVED"] as const;

/** One lawful-null slot, drawn from the closed roster above. */
export type LevelSlot = (typeof LEVEL_SLOTS)[number];

/** Is this value one of the lawful-null slots? */
export function isLevelSlot(value: unknown): value is LevelSlot {
  return typeof value === "string" && (LEVEL_SLOTS as readonly string[]).includes(value);
}

/** Everything a mark or a level label is compared without: case, whitespace, dots and hyphens. */
const LABEL_NOISE = /[\s.\-–—_]/g;

/**
 * L-CAD-07's comparison form: "label normalisation compares dotless-uppercase". `C-1`, `c1.` and
 * `C 1` are one mark, and `2nd` and `2ND` are one storey — so the placeholder a level's own label
 * retires (L-REG-04's one-hop carry) is found by the same rule the drawing's marks are read by.
 *
 * It lives here, at the layer every reader can reach, because a comparison spelled twice is two
 * comparisons: the case a person types their stack in fell between them (B-17).
 */
export function dotlessUpper(text: string): string {
  return text.toUpperCase().replace(LABEL_NOISE, "");
}

/** A view, as a key is derived from one: its class and the caption anchor it was read at. */
export type ViewRef = { readonly viewClass: string; readonly captionAnchorSourceKey: string };

/** A placement, as a key is derived from one: a view, a mark and a point in the drawing's world. */
export type PlacementRef = { readonly view: ViewRef; readonly mark: string; readonly x: number; readonly y: number };

/**
 * Where a sighting stands vertically, in each of the three lawful forms: on an authored level (by
 * surrogate id, never by label), in a lawful-null slot, or under the placeholder for a level the
 * drawing names but nobody has authored yet.
 */
export type LevelRef = { readonly levelId: string } | { readonly slot: LevelSlot } | { readonly unregistered: string };

/** An instance row, as its key is derived: where it is placed and which level it stands on. */
export type InstanceRef = { readonly placement: PlacementRef; readonly level: LevelRef };

/** One bar of a member, as its key is derived (L-REG-04: member key + role + diameter + sequence). */
export type BarRef = { readonly memberKey: string; readonly role: string; readonly diameter: string; readonly sequence: number };

/** What a carry answered: whether the placeholder moved, and the key as it stands afterwards. */
export type CarriedKey = { readonly carried: boolean; readonly key: string };

/**
 * A field of a key, as it is written into one. An empty field would make two different contents
 * derive one key, and a key that two things share is not an identity — so it is a mistake in the
 * caller and says so, rather than being written and colliding later (ARCH-03).
 */
function part(value: string, what: string): string {
  if (value.length === 0) throw new Error(`a derived key has no empty ${what}: an empty field collides two identities into one key (L-REG-04)`);
  return value;
}

/** How many parts of a drawing unit the lattice a placement is quantised onto is divided into. */
const LATTICE_PARTS = 10;

/**
 * A world coordinate on the 0.1-drawing-unit lattice, as the fixed one-decimal string a key carries
 * (L-REG-04). Rounded half away from zero on `n × 10`, so a coordinate exactly between two lattice
 * points lands on the same one whichever side of zero it stands.
 *
 * Zero is spelled once. `-0.0` and `0.0` are the same lattice point, and two spellings of one point
 * would be two keys for one placement.
 */
export function quantise(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`a placement at ${String(n)} is no point of the drawing, so it quantises to nothing (L-REG-04)`);
  // The lattice point is decided on the coordinate's own decimal spelling, in the canon's exact
  // arithmetic (B-17): 4.35 is held as the double 4.3499999999999996, and `Math.round(n * 10)` would
  // answer the lattice point of THAT number rather than of the coordinate the drawing states. Half
  // goes away from zero, which is why the magnitude is what is rounded.
  const tenths = exact(String(n)).abs().times(LATTICE_PARTS).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  // Beyond the exactly-representable integers there is no lattice: `n × 10` either overflows to
  // infinity or lands on a decade whose neighbours a double cannot tell apart, and two coordinates
  // far apart would then spell one key. A coordinate that big is no point of a drawing either.
  if (!Number.isSafeInteger(tenths)) throw new Error(`a placement at ${String(n)} is off the 0.1 lattice a key is derived on, so it quantises to nothing (L-REG-04)`);
  const sign = tenths === 0 || n >= 0 ? "" : "-";
  return `${sign}${Math.floor(tenths / LATTICE_PARTS)}.${tenths % LATTICE_PARTS}`;
}

/** What every view key opens with (L-REG-04: `v:{class}:{anchorSourceKey}`), spelled once. */
const VIEW_PREFIX = "v:";

/** L-REG-04's view key: the class of the view and the caption anchor its source key names. */
export function viewKey(v: ViewRef): string {
  return `${VIEW_PREFIX}${part(v.viewClass, "view class")}:${part(v.captionAnchorSourceKey, "caption-anchor source key")}`;
}

/** L-REG-04's placement key: the view, the mark, and the point quantised onto the lattice. */
export function placementKey(p: PlacementRef): string {
  return `${viewKey(p.view)}${FIELD}${part(p.mark, "mark")}${FIELD}${quantise(p.x)},${quantise(p.y)}`;
}

/**
 * Which of the three lawful forms a level is stated in: on an authored level (`surrogate`), in a
 * lawful-null slot (`slot`), or under the placeholder for a level nobody has authored yet
 * (`unregistered`).
 */
export type LevelForm = "surrogate" | "slot" | "unregistered";

/**
 * The one reading of which form a level is stated in, validation included (B-17). A key derived from
 * a level and the columns a row spells the same level across are two renderings of ONE
 * discrimination: read apart, a slot no vocabulary holds could be written into the columns while the
 * key derived from it refused — so both ask here, and an unlawful slot is refused wherever it
 * arrives (L-REG-04).
 */
export function levelFormOf(level: LevelRef): LevelForm {
  if ("levelId" in level) return "surrogate";
  if ("slot" in level) {
    if (!isLevelSlot(level.slot)) throw new Error(`"${String(level.slot)}" is no lawful-null level slot — the slots are ${LEVEL_SLOTS.join(" | ")} (L-REG-04)`);
    return "slot";
  }
  return "unregistered";
}

/**
 * The level segment of an instance key: a surrogate id, a lawful-null slot, or the placeholder for a
 * level authored later. A level's label, ordinal and height never enter a key (L-REG-02) — the one
 * label a key may carry is the placeholder's, and it is there precisely to be carried away.
 *
 * The surrogate is spelled the way the store renders a uuid, in lower case: one uuid is one level
 * however it was typed, and two spellings of one surrogate would derive two keys for one instance —
 * which the store's own CHECK over a row's level columns then refuses (L-REG-04, B-17).
 */
export function levelSegment(level: LevelRef): string {
  switch (levelFormOf(level)) {
    case "surrogate":
      return `${LEVEL_MARKER}${part((level as { readonly levelId: string }).levelId, "level surrogate id").toLowerCase()}`;
    case "slot":
      return `${LEVEL_MARKER}${(level as { readonly slot: LevelSlot }).slot}`;
    case "unregistered":
      return `${UNREGISTERED_PREFIX}${part((level as { readonly unregistered: string }).unregistered, "unregistered level label")}`;
  }
}

/** L-REG-04's instance row key: where the member is placed, and which level it stands on. */
export function instanceKey(i: InstanceRef): string {
  return `${placementKey(i.placement)}${levelSegment(i.level)}`;
}

/** L-REG-04's bar row key: the member the bar is in, its role, its diameter and its sequence. */
export function barKey(b: BarRef): string {
  if (!Number.isInteger(b.sequence)) throw new Error(`a bar's sequence is a whole number, not ${String(b.sequence)} (L-REG-04)`);
  return `${part(b.memberKey, "member key")}${FIELD}${part(b.role, "bar role")}${FIELD}${part(b.diameter, "bar diameter")}${FIELD}${b.sequence}`;
}

/**
 * L-REG-04's one-hop carry: "authoring a level moves an instance key exactly once
 * (`@unregistered:<label>` → `<levelId>`)".
 *
 * Exactly once is a property of the grammar rather than of a caller's bookkeeping: only a key still
 * standing under this label's placeholder is moved, and the key it becomes carries a surrogate, which
 * no placeholder matches. So a second carry of the same key answers `carried: false` and the key
 * unchanged, and a key under another label is left where it stands.
 */
export function carryLevel(key: string, level: { readonly label: string; readonly levelId: string }): CarriedKey {
  const placeholder = levelSegment({ unregistered: level.label });
  if (!key.endsWith(placeholder)) return { carried: false, key };
  return { carried: true, key: `${key.slice(0, key.length - placeholder.length)}${levelSegment({ levelId: level.levelId })}` };
}

/* ---------------------------------------------------------------------- the grammar, read back */

/**
 * The suffix a member's reinforcement is cited under: a rebar line's `net`, `lap` and `ties` are read
 * off the member's bar schedule as a whole, so the key they cite is the member's own instance key
 * with this suffix (`<objectKey>#bars`). Spelled here, beside the grammar it extends, so the rail that
 * mints it and the Trace that reads it back hold one spelling (B-17).
 */
const BARS_SUFFIX = "#bars";

/** What a figure an EDITION states is cited under: `edition:<digest>#<parameter>` (L-MEA-01). */
const EDITION_PREFIX = "edition:";

/** What a figure a PERSON entered is cited under: the act that entered it, `act:<actId>` (L-ACT-01). */
const ACT_PREFIX = "act:";

// The three spellings below are CITATIONS a rail writes, not identities a row is keyed by: they are
// spelled exactly as the rails always spelled them, and what a rail hands in is the rail's to judge.

/** The key a member's reinforcement is cited at: the member's own key, whole, then `#bars`. */
export function barsSourceOf(memberKey: string): string {
  return `${memberKey}${BARS_SUFFIX}`;
}

/** The key a figure the edition states is cited at: its content digest and the parameter's name. */
export function editionSourceOf(digest: string, parameter: string): string {
  return `${EDITION_PREFIX}${digest}#${parameter}`;
}

/** The key a figure a person entered is cited at: the act that entered it. */
export function actSourceOf(actId: string): string {
  return `${ACT_PREFIX}${actId}`;
}

/**
 * The two fixed-point coordinates a placement key ends in — `quantise`'s own spelling, `-?N.D`, twice
 * and comma-joined — read at the START of what follows the mark, so whatever a longer key appends
 * (an instance's level segment, a bar set's suffix) is left where it stands.
 */
const PLACED_AT = /^(-?\d+\.\d),(-?\d+\.\d)/u;

/**
 * The view a key was derived from, read back (L-REG-04's grammar, inverted): the class and the caption
 * anchor of a view key, or of the view key every placement, instance and bar-set key OPENS with. Null
 * for anything else — and for a view key whose anchor is not a source key of the closed schemes
 * (L-CAD-02), because a caption nobody can cite is no anchor a reader could be sent to.
 *
 * The one reading of the grammar's inverse (B-17): the Trace, the register's Source chip and the
 * coverage cause question all ask here rather than each splitting a key its own way.
 */
export function viewRefOf(key: string): { readonly viewClass: string; readonly captionAnchorSourceKey: SourceKey } | null {
  if (!key.startsWith(VIEW_PREFIX)) return null;
  const view = key.split(FIELD)[0] ?? "";
  const rest = view.slice(VIEW_PREFIX.length);
  const cut = rest.indexOf(":");
  if (cut <= 0) return null;
  const anchor = parseSourceKey(rest.slice(cut + 1));
  return anchor === null ? null : { viewClass: rest.slice(0, cut), captionAnchorSourceKey: anchor };
}

/**
 * The placement key a cited key names, or null where it names none: a placement key itself, the
 * instance key of a member placed there (its level segment dropped — the member is one entity on the
 * plan whatever storeys it stands on), and a bar set cited as `<instanceKey>#bars` (L-REG-04). The
 * view it opens with must read back (`viewRefOf`), the mark must be there, and the coordinates must be
 * the lattice's own spelling: a key that fails any of the three is not taken apart on a guess.
 */
export function placementKeyOf(key: string): string | null {
  if (viewRefOf(key) === null) return null;
  const first = key.indexOf(FIELD);
  if (first < 0) return null;
  const second = key.indexOf(FIELD, first + 1);
  if (second < 0 || second === first + 1) return null;
  const tail = key.slice(second + FIELD.length);
  const placed = PLACED_AT.exec(tail);
  if (placed === null) return null;
  const rest = tail.slice(placed[0].length);
  // Nothing may follow the point but an instance's level segment and, after it, a bar set's suffix.
  const unsuffixed = rest.endsWith(BARS_SUFFIX) ? rest.slice(0, rest.length - BARS_SUFFIX.length) : rest;
  if (unsuffixed !== "" && !unsuffixed.startsWith(LEVEL_MARKER)) return null;
  return key.slice(0, second + FIELD.length + placed[0].length);
}

/**
 * The closed roster of what a key a line cites can be (L-QTY-03's source, read back):
 * - `view`      — a view key: the view it was read in, which is a region and never an entity;
 * - `placement` — a placement or instance key: the member itself, as the plan placed it;
 * - `bars`      — a member's bar set, `<instanceKey>#bars`: the member again, through its schedule;
 * - `source`    — a source key of the closed schemes (L-CAD-02): one entity of the drawing;
 * - `edition`   — a figure the method edition states: a clause, on no sheet;
 * - `act`       — a figure a person entered: an act, on no sheet;
 * - `unread`    — none of these: a key of no grammar, stated whole and never taken apart (I-234).
 */
export const CITED_KEY_SCHEMES = ["view", "placement", "bars", "source", "edition", "act", "unread"] as const;

/** One scheme of the roster above. */
export type CitedKeyScheme = (typeof CITED_KEY_SCHEMES)[number];

/** A cited key, read: which scheme it is, and — for the two that name a member — the placement. */
export type CitedKey =
  | { readonly scheme: "view"; readonly key: string; readonly anchor: SourceKey }
  | { readonly scheme: "placement" | "bars"; readonly key: string; readonly placementKey: string; readonly anchor: SourceKey }
  | { readonly scheme: "source"; readonly key: SourceKey }
  | { readonly scheme: "edition" | "act" | "unread"; readonly key: string };

/**
 * One cited key, read by the grammar that minted it. The order of the questions is the grammar's: a
 * bar set is a placement key's extension and a placement key a view key's, so the longest reading is
 * asked first and a key is never read as less than it is.
 */
export function readCitedKey(key: string): CitedKey {
  const view = viewRefOf(key);
  if (view !== null) {
    const placed = placementKeyOf(key);
    if (placed !== null) return { scheme: key.endsWith(BARS_SUFFIX) ? "bars" : "placement", key, placementKey: placed, anchor: view.captionAnchorSourceKey };
    // A key that opens with a view and carries more fields, none of which read, is no view key.
    return key.includes(FIELD) ? { scheme: "unread", key } : { scheme: "view", key, anchor: view.captionAnchorSourceKey };
  }
  const source = parseSourceKey(key);
  if (source !== null) return { scheme: "source", key: source };
  if (key.startsWith(EDITION_PREFIX) && key.length > EDITION_PREFIX.length) return { scheme: "edition", key };
  if (key.startsWith(ACT_PREFIX) && key.length > ACT_PREFIX.length) return { scheme: "act", key };
  return { scheme: "unread", key };
}
