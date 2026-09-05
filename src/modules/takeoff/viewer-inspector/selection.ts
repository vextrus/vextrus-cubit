// R-UI-031's other half: the selection is part of the address, so reading and writing it is one
// module's business and no screen's (B-17). Pure functions over strings and world boxes — nothing
// here touches a DOM, a camera or a worker, so the screen, a jsdom mount and a server render all
// load it alike (ARCH-01).
//
// The atoms are the source keys L-CAD-03 names: a selection is a list of them, in the order a reader
// built it, and a derived record resolves to the instance key it was painted from before it ever
// reaches this file (Decision I-86).
import type { IndexBox } from "../viewer/client";

/** The parameter the address carries the selection in (Decision § 7). */
export const SELECTION_PARAM = "s";

/** The keys a selection is written from, joined by this in selection order. */
const KEY_SEPARATOR = ",";

/**
 * The shape a source key of this corpus takes: the scheme the reading keyed its atoms under, then
 * the handle in hex. A value of any other shape names nothing this sheet could hold, and is reported
 * as such rather than searched for (Decision I-88).
 */
const SOURCE_KEY = /^DXF_HANDLE:[0-9A-Fa-f]+$/;

/** A selection read off an address: the keys it named, and the values that are not keys at all. */
export type ParsedSelection = { keys: string[]; malformed: string[] };

/**
 * The `s` parameter read back. Keys keep the order the address named them in, a key named twice is
 * held once at its first occurrence — one selection has one spelling — and a value that is not of
 * the source-key shape is separated out rather than dropped, because a reader who followed a link
 * is owed the news that part of it named nothing (R-UI-050's partial).
 */
export function parseSelection(value: string | null): ParsedSelection {
  const keys: string[] = [];
  const malformed: string[] = [];
  const held = new Set<string>();
  for (const raw of (value ?? "").split(KEY_SEPARATOR)) {
    const offered = raw.trim();
    // An empty segment names nothing and reports nothing: `s=` and a trailing comma are absences,
    // not values a reader typed.
    if (offered === "") continue;
    if (!SOURCE_KEY.test(offered)) {
      if (!malformed.includes(offered)) malformed.push(offered);
      continue;
    }
    if (held.has(offered)) continue;
    held.add(offered);
    keys.push(offered);
  }
  return { keys, malformed };
}

/**
 * The selection as the address spells it, or null where nothing is held: an empty selection is the
 * absence of the parameter and never an empty one, so a shared link of nothing is the sheet itself.
 */
export function serialiseSelection(keys: readonly string[]): string | null {
  const held: string[] = [];
  for (const key of keys) if (!held.includes(key)) held.push(key);
  return held.length === 0 ? null : held.join(KEY_SEPARATOR);
}

/**
 * The least world box holding every box given — what a reveal is framed on (R-UI-022's fly-to). No
 * box unions to nothing: a reveal of an empty selection has nowhere to go, and says so.
 */
export function unionBox(boxes: readonly IndexBox[]): IndexBox | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    if (box.min[0] < minX) minX = box.min[0];
    if (box.min[1] < minY) minY = box.min[1];
    if (box.max[0] > maxX) maxX = box.max[0];
    if (box.max[1] > maxY) maxY = box.max[1];
  }
  return Number.isFinite(minX) ? { min: [minX, minY], max: [maxX, maxY] } : null;
}
