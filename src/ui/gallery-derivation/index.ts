/**
 * The gallery's completeness surface, derived (R-UI-011, B-19). What `/design` must render is not
 * written down anywhere: the barrels are reflected over at runtime, the components each publishes
 * are computed from the namespace itself, and the entries the catalogue owes are their product. A
 * component joins the required set by existing, and an entry nobody wrote fails `missingEntries()`
 * rather than sliding past a frozen list.
 *
 * The roster below is spelled with static imports because a route's module graph is resolved
 * statically — a directory read cannot produce a bundled namespace. That is the one thing here that
 * a human hand touches, so it is the one thing the product suite beside this file checks against a
 * filesystem scan: `galleryBarrels`' keys must equal the barrel index files on disk.
 */
import * as patternsRefusalState from "../patterns/refusal-state";
import * as primitivesCore from "../primitives/core";
import * as primitivesData from "../primitives/data";
import * as primitivesOverlay from "../primitives/overlay";
import * as shell from "../shell";
import { galleryEntries } from "./entries";
import type { GalleryEntries } from "./types";

export { galleryChrome } from "./chrome";
export { galleryEntries } from "./entries";
export type { GalleryEntries, GalleryEntry, GalleryState } from "./types";

/**
 * Every barrel the tree publishes, keyed by its path under `src/ui`. Ordered by code point, which
 * is the order the gallery renders its sections in.
 */
export const galleryBarrels: Record<string, Record<string, unknown>> = {
  "patterns/refusal-state": patternsRefusalState,
  "primitives/core": primitivesCore,
  "primitives/data": primitivesData,
  "primitives/overlay": primitivesOverlay,
  shell,
};

/**
 * Is this export something the gallery can mount? A function covers every component written as one;
 * a React exotic object — `forwardRef`, `memo` — carries a symbol `$$typeof`, and nothing else a
 * barrel publishes does. Lowercase helpers are excluded by the caller's naming rule, and type-only
 * exports are not here at all: they vanish before this runs.
 */
function isComponentValue(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as { $$typeof?: unknown }).$$typeof === "symbol";
}

/**
 * The component exports of a barrel namespace: the uppercase names whose runtime value is
 * mountable, in code-point order — `Array#sort`'s own comparison, never `localeCompare`, whose
 * answer depends on the machine's locale.
 */
export function componentExports(ns: Record<string, unknown>): string[] {
  return Object.keys(ns)
    .filter((name) => /^[A-Z]/.test(name) && isComponentValue(ns[name]))
    .sort();
}

/** Every entry key the catalogue owes: each barrel crossed with the components it publishes. */
function requiredEntryKeys(): string[] {
  const keys: string[] = [];
  for (const [barrelId, ns] of Object.entries(galleryBarrels)) {
    for (const name of componentExports(ns)) keys.push(`${barrelId}/${name}`);
  }
  return keys.sort();
}

/**
 * The required keys a catalogue does not hold, code-point sorted. Extra keys are not reported: an
 * entry for something the barrels no longer publish is caught by the suite that binds every key to
 * a real export, and reporting it here would confuse "the gallery is incomplete" with "the gallery
 * is stale".
 */
export function missingEntries(entries: GalleryEntries = galleryEntries): string[] {
  return requiredEntryKeys().filter((key) => !Object.prototype.hasOwnProperty.call(entries, key));
}
