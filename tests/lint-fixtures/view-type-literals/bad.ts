// L-CAD-06's payload: a view-type spelling written as a STRING LITERAL somewhere other than the one
// module that declares the vocabulary. Every shape below is a way a second home for the law creeps
// back in — a bare constant, a record value, an array member and a comparison — so every shape is a
// payload here (Q-08). Nothing in this file is imported by anything: it exists to be scanned.
//
// This corpus proves a committed SCAN (src/modules/takeoff/partition/views/__tests__), not an ESLint
// rule: no M2 node is toolchain-tagged and scripts/eslint/** is locked, so the ban is the scan test.

export const spelledOnce = "LAYOUT_PLAN"; // RECORDED REASON L-CAD-06

export const inARecord = { fallbackType: "UNTYPED", anchorless: "UNASSIGNED" }; // RECORDED REASON L-CAD-06

export const inAnArray = ["SCHEDULE", "DETAIL", "TITLE"]; // RECORDED REASON L-CAD-06

export function decidesByComparison(value: string): boolean {
  return value === "STAIR_PLAN" || value === "STAIR_SECTION"; // RECORDED REASON L-CAD-06
}

export const inSingleQuotes = 'MEMBER_SECTION'; // RECORDED REASON L-CAD-06

export const inAKey = { LONG_SECTION_STRIP: 1 }["LONG_SECTION_STRIP"]; // RECORDED REASON L-CAD-06

export const inACall = decidesByComparison("LEGEND_NOTES"); // RECORDED REASON L-CAD-06
