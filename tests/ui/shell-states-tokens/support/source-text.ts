/**
 * The source questions this suite asks — what a file's COMMENTS say (Q-17), and what its STRING
 * LITERALS spell (B-17's "one spelling") — are answered by the ONE lexical machine in
 * `tests/support/source-lex.ts`, which every suite that reads a source walks (B-17: one invariant,
 * one home; this file keeps no quote, template, escape, comment or regular-expression state of its
 * own). It exists so the suite names its own vocabulary; the reading behind it is shared.
 *
 * `lexFile` is what a scan over the tree should use: it picks the dialect from the extension — `.tsx`
 * is its own, never folded into `.ts`, because a quote in JSX text is ordinary copy and not a
 * literal — and it throws naming file and line where the scan cannot decide, so a blinded file goes
 * red instead of passing by not looking (B-19).
 */
export type { Dialect, LexDiagnostic, Lexed } from "../../../support/source-lex";
export { dialectOf, lex, lexFile, normalise } from "../../../support/source-lex";
