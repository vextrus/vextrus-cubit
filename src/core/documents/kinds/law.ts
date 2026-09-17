// What a document kind IS, and where its template stands (SEAM-DOC, AM-11).
//
// The shape lives in its own file because every kind file declares itself against it and the barrel
// `./index.ts` — which enumerates those kinds — reads the same shape. A shape imported from the
// barrel would be a cycle; a shape each kind re-spelled would be the drift B-17 exists to prevent.
//
// Nothing here knows which kinds exist. The kinds are their own files' (AM-11), and `DOCUMENT_KINDS`
// is what the barrel gets by enumerating them.
import { join } from "node:path";
import { documentKindsPath } from "../tree";

/**
 * A document kind: its key, the schema its payload is parsed by, its template and its presenter.
 *
 * Four things and no more. The key is what `renderDocument` is asked for; the schema is the ONLY
 * reading of a payload (L-FMT-03: a document is generated from a structured payload); the template is
 * the `.typ` standing beside the kind file; and `present` turns the parsed payload into the plain
 * JSON the template reads — which is where every figure crosses `figure()`, so a value not at the
 * kind's stated precision is refused before anything is staged (L-FMT-02).
 */
export interface DocumentKind {
  /** The key this kind is asked for by, and the key the barrel files it under. */
  readonly kind: string;
  /**
   * The payload's one reading. Typed structurally rather than as a `z.ZodType` so the barrel and its
   * tests can hold every kind in one map without every kind's payload type leaking into it — what the
   * seam needs of a schema is that it parses, and `safeParse` is that.
   */
  readonly payloadSchema: { safeParse(value: unknown): { success: boolean; error?: unknown; data?: unknown } };
  /** The absolute path of this kind's `.typ`, which stands beside its kind file. */
  readonly template: string;
  /** The parsed payload as the template receives it: plain JSON, figures already formatted. */
  present(payload: unknown): Record<string, unknown>;
}

/**
 * The template standing beside a kind file. Kinds name their template by FILE NAME and never by
 * path: the directory is one fact, stated in `../tree.ts`, and a kind that spelled its own way to the
 * checkout would be a second answer to where the checkout is (B-17).
 */
export function kindTemplate(file: string): string {
  return join(documentKindsPath(), file);
}

/**
 * The roster, built by ENUMERATION (AM-11). The barrel hands this the kinds it imported and gets back
 * the map keyed by what each kind calls itself — so the barrel never re-declares a key, and a kind
 * that was renamed in its own file is renamed in the roster with it.
 *
 * A duplicate key THROWS rather than winning or losing silently. That is the failure this shape
 * exists to make impossible: a second kind quietly taking `proof`'s key would send every proof
 * document through somebody else's template and schema, and nothing downstream would notice. It
 * fires at import, so a tree that holds one is a tree that will not start.
 */
export function enumerateKinds(kinds: readonly DocumentKind[]): Readonly<Record<string, DocumentKind>> {
  const roster: Record<string, DocumentKind> = {};
  for (const kind of kinds) {
    if (Object.hasOwn(roster, kind.kind)) {
      throw new Error(`"${kind.kind}" is declared by two document kinds — the barrel enumerates kinds and never re-declares one (AM-11, B-19)`);
    }
    roster[kind.kind] = kind;
  }
  return Object.freeze(roster);
}
