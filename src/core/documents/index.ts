// SEAM-DOC: `renderDocument(kind, payload)` — the one way this product turns a structured payload
// into an issued document (R-SPINE-040, L-FMT-02, L-FMT-03).
//
// The order of work is the order the questions stop being answerable in, and every one of them is
// asked BEFORE the subprocess:
//
//   1. the kind          — a key the registry does not hold names no schema and no template;
//   2. the payload       — parsed by that kind's Zod schema, and by nothing else (L-FMT-03);
//   3. the presentation  — where every figure crosses `figure()`, so a quantity that is not at the
//                          kind's stated precision is refused rather than rounded (L-FMT-02);
//   4. the repertoire    — every string of the presented payload against the cmaps of the faces that
//                          will actually be embedded, so nothing ever prints as a blank box;
//   5. the payload bytes — canonical JSON, keys sorted, no whitespace. This is what is digested and
//                          what the template reads, so the digest on the stored row is a digest of
//                          the thing that was rendered and not of something near it.
//
// Only then is anything staged. That ordering is what the acceptance means by "the injected compile
// is never called": a refusal costs no subprocess, no temp directory and no wait.
//
// STRINGS CROSS AS DATA (L-FMT-03). The presented payload is written to `payload.json` and the
// template reads it with `json()`. Nothing is interpolated into markup anywhere in this seam, which
// is why a title of `#text(red)[x]` or `#import "/main.typ"` sets those characters and does not run
// them — a document is rendered FROM a payload, never BUILT as source around one.
//
// ARCH-03, B-21: a refusal is an answer and travels as one. Anything else that goes wrong under this
// door is OUR outage: it is recorded once at the fault seam and becomes `DOCUMENT_NOT_RENDERED`
// carrying the id of that record. A stack, a renderer's stderr and a temp path never reach the person
// who asked for a document.
import { createHash } from "node:crypto";
import { canonical } from "../acts/consequence";
import { REFUSALS, type RefusalCode } from "../errors";
import { refusal, refusalCodeOf } from "../faults/refusal-marker";
import { reportFault } from "../faults/report";
import type { RenderCtx, RenderedDocument } from "./contract";
import { assertCoveredByDocumentFonts, documentFonts, type EmbeddedFont } from "./fonts";
import { DOCUMENT_KINDS } from "./kinds";
import { compileTypst, discardRender, stageRender, rendererPin } from "./typst";

export type { RenderCtx, RenderedDocument } from "./contract";
export type { DocumentKind } from "./kinds";
export { DOCUMENT_KINDS } from "./kinds";
export { figure } from "./figures";
export { assertCoveredByDocumentFonts, documentFonts, DOCUMENT_FONT_FILES, DOCUMENT_FONT_LICENCES, type EmbeddedFont } from "./fonts";
export { compileTypst, stageRender, rendererPin, TYPST_ARGS, type StagedRender } from "./typst";

// `./store.ts` is deliberately NOT re-exported here. Rendering is a function of a payload and needs
// no database; storing is a function of a transaction and needs one. Keeping the two apart is what
// lets the render path be imported — by the V-DOCS lane, by a worker, by anything — without pulling
// the connection pool in behind it. Its callers name it: `@/core/documents/store`.

/**
 * The codes this seam answers with, READ from the closed register rather than spelled beside it: a
 * literal here would agree with the taxonomy by coincidence, and the day an entry moved this seam
 * would answer with a code nothing renders (R-SPINE-062, Q-07).
 */
const KIND_UNKNOWN: RefusalCode = REFUSALS.DOCUMENT_KIND_UNKNOWN.code;
const PAYLOAD_MALFORMED: RefusalCode = REFUSALS.DOCUMENT_PAYLOAD_MALFORMED.code;
const NOT_RENDERED: RefusalCode = REFUSALS.DOCUMENT_NOT_RENDERED.code;

/**
 * What a caller may put in place of the subprocess and the faces. Tests inject; production passes
 * nothing and gets the pinned renderer and the vendored faces.
 */
export interface RenderDeps {
  readonly compile?: typeof compileTypst;
  readonly fonts?: () => Promise<readonly EmbeddedFont[]>;
}

/**
 * Renders one document. The sole path to the renderer, and the sole reading of a payload.
 *
 * `kind` is a plain string rather than a union: it arrives from a route, a job payload or a screen,
 * which is to say from the far side, and a key the registry does not hold is a refusal this function
 * owes rather than a type error somebody else was supposed to have caught.
 */
export async function renderDocument(kind: string, payload: unknown, ctx: RenderCtx, deps?: RenderDeps): Promise<RenderedDocument> {
  const registered = Object.hasOwn(DOCUMENT_KINDS, kind) ? DOCUMENT_KINDS[kind] : undefined;
  if (registered === undefined) {
    throw refusal(KIND_UNKNOWN, `no document kind is registered under "${kind}" — the registry holds ${Object.keys(DOCUMENT_KINDS).join(", ")} (SEAM-DOC)`);
  }

  const read = registered.payloadSchema.safeParse(payload);
  if (!read.success) {
    // The schema's own account of what it could not read is OPERATOR detail and travels in the
    // refusal's properties. The message stays a sentence about the document: a zod issue list in a
    // message would be a second, unregistered copy of what the register already says (R-SPINE-062).
    throw refusal(PAYLOAD_MALFORMED, `the payload does not satisfy the "${kind}" kind's schema`, { issues: issuesOf(read.error) });
  }

  try {
    // `present` is the kind's, and `figure` inside it refuses a quantity that is not at the kind's
    // stated precision — so PRECISION_NOT_APPLIED surfaces HERE, before a directory is made.
    const presented = registered.present(read.data);

    const faces = await (deps?.fonts ?? documentFonts)();
    for (const text of stringsOf(presented)) assertCoveredByDocumentFonts(text, faces);

    const bytes = new TextEncoder().encode(canonical(presented));
    const staged = await stageRender({ template: registered.template, payload: bytes });
    try {
      const pdf = await (deps?.compile ?? compileTypst)(staged);
      return Object.freeze({
        kind,
        pdf,
        sha256: digest(pdf),
        payloadDigest: digest(bytes),
        rendererPin: rendererPin(),
        fontHashes: hashesOf(faces),
      });
    } finally {
      // The staging directory goes whether the compile answered or threw: a document's whole world is
      // laid down per invocation, and one left behind is a payload on the volume after the fact.
      await discardRender(staged.dir);
    }
  } catch (failure) {
    // A refusal is an answer and travels unchanged — the kind's own PRECISION_NOT_APPLIED and this
    // seam's CHARACTER_NOT_COVERED are what a caller must be able to read by name.
    if (refusalCodeOf(failure) !== null) throw failure;
    // Everything else is ours. Recorded ONCE, here, at the outermost point under this door, so a
    // single render never writes two records for one failure (ARCH-03).
    const { faultId } = reportFault({ requestId: ctx.requestId, actor: ctx.actor, route: `renderDocument/${kind}`, cause: failure });
    throw refusal(NOT_RENDERED, `the "${kind}" document could not be rendered; the failure is recorded as ${faultId}`, { faultId });
  }
}

/** The sha256 of some bytes, lowercase hex — the one spelling of an address in this product. */
function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Each embedded face's file name against the hash of its bytes, as the stored row records them. */
function hashesOf(faces: readonly EmbeddedFont[]): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(faces.map((face) => [face.file, face.sha256])));
}

/**
 * Every string the presented payload carries, keys included.
 *
 * Values because they are the document's words. Keys because a presenter is free to build one out of
 * the payload — a line's reference as a map key, say — and a key that reached the template through a
 * hole in this walk would print exactly the blank box L-FMT-02 forbids. Both are cheap: a key a
 * presenter wrote itself is ASCII and passes without a thought.
 */
function stringsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, held]) => [key, ...stringsOf(held)]);
  }
  return [];
}

/** A schema's own account of what it could not read, as plain data a fault record can hold. */
function issuesOf(error: unknown): unknown {
  const issues = (error as { issues?: unknown }).issues;
  return Array.isArray(issues) ? issues : [];
}
