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
  const tenths = Math.round(Math.abs(n) * LATTICE_PARTS);
  // Beyond the exactly-representable integers there is no lattice: `n × 10` either overflows to
  // infinity or lands on a decade whose neighbours a double cannot tell apart, and two coordinates
  // far apart would then spell one key. A coordinate that big is no point of a drawing either.
  if (!Number.isSafeInteger(tenths)) throw new Error(`a placement at ${String(n)} is off the 0.1 lattice a key is derived on, so it quantises to nothing (L-REG-04)`);
  const sign = tenths === 0 || n >= 0 ? "" : "-";
  return `${sign}${Math.floor(tenths / LATTICE_PARTS)}.${tenths % LATTICE_PARTS}`;
}

/** L-REG-04's view key: the class of the view and the caption anchor its source key names. */
export function viewKey(v: ViewRef): string {
  return `v:${part(v.viewClass, "view class")}:${part(v.captionAnchorSourceKey, "caption-anchor source key")}`;
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
 */
export function levelSegment(level: LevelRef): string {
  switch (levelFormOf(level)) {
    case "surrogate":
      return `${LEVEL_MARKER}${part((level as { readonly levelId: string }).levelId, "level surrogate id")}`;
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
