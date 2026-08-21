/**
 * The tokens module's strings — the accessible names of the seven basis marks (R-SPINE-060).
 *
 * A BasisMark paints a glyph and a colour; neither is a name a screen reader can speak, so
 * R-UI-002's pair is only complete once the label is registered copy. Sentence case, one word
 * each: these are labels announced inside a table cell, not sentences.
 *
 * Frozen, as SPINE_STRINGS is: a table an importer can edit at run time is a default, not the
 * one string table.
 */
export const TOKENS_STRINGS = Object.freeze({
  'tokens.basis.measured': 'Measured',
  'tokens.basis.transcribed': 'Transcribed',
  'tokens.basis.derived': 'Derived',
  'tokens.basis.imported': 'Imported',
  'tokens.basis.entered': 'Entered',
  'tokens.basis.interpreted': 'Interpreted',
  'tokens.basis.defaulted': 'Defaulted',
} as const);
