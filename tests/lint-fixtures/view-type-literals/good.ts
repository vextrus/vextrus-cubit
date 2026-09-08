// The lawful half of the corpus: everything here NAMES the vocabulary without spelling a member as
// a string literal, so the scan must report nothing at all in this file.
//
// Two shapes the scan has to see past, and the reason each is lawful:
//  - prose: LAYOUT_PLAN, SCHEDULE, DETAIL, UNTYPED and UNASSIGNED are written in this comment, and a
//    comment is not code (Q-17) — the tree's one lexer drops it before anything is counted;
//  - a module specifier: "./TITLE" lexes as a string, but it addresses a file rather than stating a
//    member, so a scan that merely walked every string literal would report it wrongly.
//
// Nothing here reaches out of its own directory: this file is linted as though it stood in the
// layered tree, and a fixture that tripped a boundary rule would be proving somebody else's NEVER.
import { importedFromASpelledPath } from "./TITLE";

export const lawful = importedFromASpelledPath;
export const asked = String(importedFromASpelledPath).length > 0;
export const said = `the view type is read through the module that declares it, never spelled here`;
