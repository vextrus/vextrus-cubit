// L-CAD-02's key grammar as the model seam knows it, and the one JSON reading L-AI-02 needs beside
// it. The grammar itself lives in `src/core/sources.ts` — a source key is judged wherever a key is
// read, including in the browser, where this directory's barrel may never be loaded because it
// reaches the store (B-17, ARCH-01). It is re-exported here so the seam's own callers, its barrel
// and the acceptance that names this file all keep the surface they had.
import type { JsonValue } from "./types";

export { SOURCE_SCHEMES, parseSourceKey, sourceKeyResolver } from "../sources";
export type { SourceKey, SourceKeyResolver, SourceScheme } from "../sources";

/** The strings of a JSON array, or null when the value is not an array of strings only. */
export function stringsOf(value: JsonValue): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    strings.push(item);
  }
  return strings;
}
