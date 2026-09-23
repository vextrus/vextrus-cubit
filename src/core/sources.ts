// L-CAD-02: a source key is `scheme:key`, the scheme one of a closed set and split per key, never
// per drawing. The grammar is a fact about a CAD entity, not about the model seam that happens to
// have needed it first, and it is judged wherever a key is read: L-AI-02 resolves a proposal's
// citations against the artifact, and L-MEA-05 refuses a calibration point that cites nothing — the
// second of those is judged in the browser, where the seam's barrel (which reaches the store) may
// never be loaded. One home, reachable from both sides (B-17, ARCH-01); `src/core/model/sources.ts`
// re-exports it, so every caller that knows it as the seam's own keeps its import.

/** The closed scheme set, in the law's order: who minted the key (L-CAD-02). */
export const SOURCE_SCHEMES = ["DXF_HANDLE", "PDF_OBJECT", "RASTER_TRACE"] as const;

export type SourceScheme = (typeof SOURCE_SCHEMES)[number];

/** A source key as an original entity carries it: a closed scheme, one colon, the extractor's key. */
export type SourceKey = `${SourceScheme}:${string}`;

/**
 * The schemes whose key is a content digest rather than a handle the file states — pdfium's over a
 * PDF page object, the vectoriser's over a traced primitive (L-CAD-02). Their key half is a whole
 * sha256, uppercase: the EntityGraph mirror refuses anything shorter, and a card shows it by its short
 * form rather than whole (I-519). One home for both readings (B-17).
 */
export const DIGEST_SCHEMES = ["PDF_OBJECT", "RASTER_TRACE"] as const satisfies readonly SourceScheme[];

/** A digest scheme's own half: the whole sha256, uppercase — never a prefix of one (L-CAD-02). */
const WHOLE_DIGEST = /^[0-9A-F]{64}$/;

/** True iff the key half is a whole content digest, as a digest scheme's key must be. */
export function isWholeDigest(key: string): boolean {
  return WHOLE_DIGEST.test(key);
}

/** True iff the scheme is one whose keys are content digests (L-CAD-02). */
export function isDigestScheme(scheme: string): boolean {
  return (DIGEST_SCHEMES as readonly string[]).includes(scheme);
}

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
