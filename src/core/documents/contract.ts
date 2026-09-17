// What a render answers, and who asked for it (R-SPINE-040, L-FMT-03).
//
// It stands in its own file because both sides of the seam need it and neither is the other's: the
// renderer produces a `RenderedDocument` and the store consumes one, so a shape imported from either
// would make the two depend on each other in a circle. The pattern `src/core/exports/contract.ts`
// records for the export seam, for the same reason.

/**
 * One rendered document. Everything here is a fact about THIS render, and all of it travels onto the
 * stored row: the bytes, their address, the digest of the payload they were rendered from, the pin
 * they were rendered by, and the hash of every face they embedded. That set is what makes
 * "the same payload renders byte-identically" a claim a reader can check rather than a promise.
 */
export interface RenderedDocument {
  readonly kind: string;
  readonly pdf: Uint8Array;
  readonly sha256: string;
  readonly payloadDigest: string;
  readonly rendererPin: string;
  readonly fontHashes: Readonly<Record<string, string>>;
}

/** Who asked for the document — what a fault raised under the render is recorded against (ARCH-03). */
export interface RenderCtx {
  readonly requestId: string;
  readonly actor: string;
}
