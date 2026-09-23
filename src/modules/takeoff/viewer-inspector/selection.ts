// R-UI-031's other half: the selection is part of the address, so reading and writing it is one
// module's business and no screen's (B-17). Pure functions over strings and world boxes — nothing
// here touches a DOM, a camera or a worker, so the screen, a jsdom mount and a server render all
// load it alike (ARCH-01).
//
// The atoms are the source keys L-CAD-03 names: a selection is a list of them, in the order a reader
// built it, and a derived record resolves to the instance key it was painted from before it ever
// reaches this file (Decision I-86).
import { parseSourceKey, type SourceScheme } from "@/core/sources";
import type { IndexBox } from "../viewer/client";

/** The parameter the address carries the selection in (Decision § 7). */
export const SELECTION_PARAM = "s";

/** The keys a selection is written from, joined by this in selection order. */
const KEY_SEPARATOR = ",";

/**
 * The two characters a key must not carry into the joined value as themselves: the separator, and
 * the escape that spells it. A key is ANY string of a registered grammar — a placement key carries
 * its point as `x,y` — so the value is written lossless rather than on a hope that no key holds a
 * comma (walk-0: `…|P1|599250.0,0.0` arrived as two keys). A handle holds neither, so a selection of
 * handles reads exactly as it always did (I-423).
 */
const ESCAPED = /[%,]/gu;
const UNESCAPED = /%(25|2C)/giu;

/** One key as the joined value carries it. */
function escapeKey(key: string): string {
  return key.replace(ESCAPED, (held) => (held === "%" ? "%25" : "%2C"));
}

/** One segment of the joined value, as the key it spells. */
function unescapeKey(segment: string): string {
  return segment.replace(UNESCAPED, (_held, code: string) => (code === "25" ? "%" : ","));
}

/**
 * The shape an extractor's own key takes under its scheme, where the scheme states one: a DXF handle
 * is hexadecimal (L-CAD-02), so `DXF_HANDLE:ZZZ` names nothing any drawing could hold. A scheme with
 * no shape stated here is read by the closed grammar alone.
 */
const KEY_SHAPES: Readonly<Partial<Record<SourceScheme, RegExp>>> = Object.freeze({ DXF_HANDLE: /^[0-9A-Fa-f]+$/u });

/**
 * Whether a value names an entity at all: a source key of the closed schemes (L-CAD-02) — whatever
 * extractor minted it, not only a DXF handle — in its scheme's own shape. A value of any other shape
 * names nothing a sheet could hold, and is reported as such rather than searched for (Decision I-88).
 */
function isSourceKey(value: string): boolean {
  const parsed = parseSourceKey(value);
  if (parsed === null) return false;
  const cut = parsed.indexOf(":");
  const shape = KEY_SHAPES[parsed.slice(0, cut) as SourceScheme];
  return shape === undefined || shape.test(parsed.slice(cut + 1));
}

/** A selection read off an address: the keys it named, and the values that are not keys at all. */
export type ParsedSelection = { keys: string[]; malformed: string[] };

/**
 * The joined value read back into the values it names, in order, each whole: segments split at the
 * separator, trimmed, emptied ones dropped, and each unescaped — the exact inverse of
 * `serialiseSelection` for any key at all.
 */
export function splitSelection(value: string | null): string[] {
  const values: string[] = [];
  for (const raw of (value ?? "").split(KEY_SEPARATOR)) {
    const offered = raw.trim();
    // An empty segment names nothing and reports nothing: `s=` and a trailing comma are absences,
    // not values a reader typed.
    if (offered !== "") values.push(unescapeKey(offered));
  }
  return values;
}

/**
 * The `s` parameter read back. Keys keep the order the address named them in, a key named twice is
 * held once at its first occurrence — one selection has one spelling — and a value that is not of
 * the source-key shape is separated out rather than dropped, because a reader who followed a link
 * is owed the news that part of it named nothing (R-UI-050's partial).
 */
export function parseSelection(value: string | null): ParsedSelection {
  const keys: string[] = [];
  const malformed: string[] = [];
  // Both sets are what keeps this linear: a whole layer's Select is a hundred thousand keys, and
  // `includes` inside the loop would be that squared, on the main thread (PB-3).
  const held = new Set<string>();
  const refused = new Set<string>();
  for (const offered of splitSelection(value)) {
    if (!isSourceKey(offered)) {
      if (!refused.has(offered)) {
        refused.add(offered);
        malformed.push(offered);
      }
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
  const seen = new Set<string>();
  const held: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    held.push(escapeKey(key));
  }
  return held.length === 0 ? null : held.join(KEY_SEPARATOR);
}

/**
 * The selection as a LINK spells it in its query: each key escaped and then percent-encoded, joined
 * by the separator — so the value a browser hands back for `s` is `serialiseSelection`'s exactly.
 * Nothing selected is the empty value. The Trace and every "open in the sheet" link compose their
 * addresses through this, so the viewer and the links into it hold one spelling (B-17).
 */
export function selectionQueryValue(keys: readonly string[]): string {
  const spelled = serialiseSelection(keys);
  return spelled === null ? "" : spelled.split(KEY_SEPARATOR).map((segment) => encodeURIComponent(segment)).join(KEY_SEPARATOR);
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
