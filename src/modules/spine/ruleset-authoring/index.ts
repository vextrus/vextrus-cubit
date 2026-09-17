// The rule-set authoring module: what the Author edition screen reads to draw its diff, and what
// the AUTHOR_RULESET_EDITION act reads to build the content it mints — one home for "what changed"
// (B-17), so the reading an author confirms in the dialog is the reading they were shown.
//
// The reading itself lives in `@/core/rulesets/editions/authored.ts` and this module publishes it.
// It cannot live here: the act seam is core and core imports nothing above it (the import matrix,
// ARCH-01), so a reading BOTH the act and the screen take has to sit in core or be spelled twice —
// and two spellings of "what changed" is the one defect this module exists to prevent. This file is
// the module's face on that reading, never a second copy of it.
// Reached past the barrel on purpose: the barrel also publishes the MINT, which opens the database,
// and this reading is pure — a consumer of it may not be made to pull the driver in (ARCH-01).
export { authoredContent, diffParameters, sameDecimal } from "@/core/rulesets/editions/authored";
export type { ParameterDiffRow } from "@/core/rulesets/editions/authored";
