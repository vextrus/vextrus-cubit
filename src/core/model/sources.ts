// L-CAD-02: a source key is `scheme:key`, the scheme one of a closed set and split per key, never
// per drawing. L-AI-02 resolves a model's citations against the artifact before a proposal is
// returned, so the seam needs the key grammar and a membership question — and nothing of ingest:
// the resolver is a typed seam the caller supplies over whatever artifact it holds (B-23).
import type { JsonValue } from "./types";

/** The closed scheme set, in the law's order: who minted the key (L-CAD-02). */
export const SOURCE_SCHEMES = ["DXF_HANDLE", "PDF_OBJECT", "RASTER_TRACE"] as const;

export type SourceScheme = (typeof SOURCE_SCHEMES)[number];

/** A source key as an original entity carries it: a closed scheme, one colon, the extractor's key. */
export type SourceKey = `${SourceScheme}:${string}`;

/** The membership question a proposal's citations are resolved against, and the artifact it answers for. */
export type SourceKeyResolver = {
  readonly artifactDigest: string;
  has(key: SourceKey): boolean;
};

/**
 * The text as a source key, or null: the scheme is one of the closed set, exactly one colon splits
 * it from the key, and the key is non-empty with no whitespace — an extractor's handle or digest
 * never contains any (L-CAD-02).
 */
export function parseSourceKey(text: string): SourceKey | null {
  const parts = text.split(":");
  if (parts.length !== 2) return null;
  const [scheme, key] = parts;
  if (scheme === undefined || key === undefined || !isScheme(scheme)) return null;
  if (key.length === 0 || /\s/u.test(key)) return null;
  return `${scheme}:${key}`;
}

/** A resolver over a known key set: membership is by exact string, the digest is the caller's word. */
export function sourceKeyResolver(artifactDigest: string, keys: Iterable<string>): SourceKeyResolver {
  const members = new Set<string>(keys);
  return Object.freeze({
    artifactDigest,
    has: (key: SourceKey): boolean => members.has(key),
  });
}

/** True iff the text is one of the closed schemes — a guard, so a parsed key is typed by its scheme. */
function isScheme(text: string): text is SourceScheme {
  return (SOURCE_SCHEMES as readonly string[]).includes(text);
}

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
