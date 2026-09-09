// The one key grammar this leaf adds: what makes two storey-height readings the SAME reading, and
// what makes them two competing ones. L-REG-04's rule binds it — content-derived, zero minted ids —
// so the key a preview names is the key a re-affirmation lands under, with nothing remembered
// between them.

/** The separator between the fields of a reading key. One character, spelled once (B-17). */
const FIELD = "|";

/**
 * The slot a reading with no source key stands in. A reading somebody entered cites no drawing
 * entity, and an empty field would collide it with a reading that cites one — so the absence is
 * named rather than left blank (L-REG-04, the shape `LEVEL_SLOTS` takes for a level).
 */
export const NO_SOURCE_SLOT = "@unsourced";

/** What a storey-height reading is keyed on (L-MEA-07): the level, who read it, how, and off what. */
export type ReadingRef = {
  readonly levelId: string;
  readonly actorId: string;
  readonly basis: string;
  readonly sourceKey: string | null;
};

/**
 * A field of a key, as it is written into one. An empty field would make two different readings
 * derive one key, and a key two readings share is not an identity (L-REG-04).
 */
function part(value: string, what: string): string {
  if (value.length === 0) throw new Error(`a reading key has no empty ${what}: an empty field collides two readings into one key (L-REG-04)`);
  return value;
}

/**
 * The key a storey-height reading stands under: (level, actor, basis, source key).
 *
 * Two readings under one key are the same person saying the same thing off the same evidence twice,
 * so the later one supersedes the earlier — which is how a contest "clears only by re-affirmation
 * under the same key" (L-MEA-07). Two readings under different keys compete, and where they
 * disagree the height is suspended rather than silently resolved (L-REG-03).
 */
export function readingKey(of: ReadingRef): string {
  return [
    `h:${part(of.levelId, "level surrogate id")}`,
    part(of.actorId, "actor id"),
    part(of.basis, "basis"),
    of.sourceKey === null ? NO_SOURCE_SLOT : part(of.sourceKey, "source key"),
  ].join(FIELD);
}
