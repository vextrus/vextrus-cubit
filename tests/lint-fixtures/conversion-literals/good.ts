// The lawful half of the corpus: everything here stands near the canon's factors without spelling
// one as a literal the ban governs, so the scan must report nothing at all in this file.
//
// Four shapes the scan has to see past, and the reason each is lawful:
//  - prose: 0.028316846592, 0.3048, 0.09290304 and 0.45359237 are written in this comment, and a
//    comment is not code (Q-17) — the tree's one lexer drops it before anything is counted;
//  - a template literal, which riskNotes (4) settles as never a hit;
//  - a number that is an integer power of ten: 1000 kg to the tonne is a canon factor, but it is
//    also every timeout and every grouping constant in the tree, so the needle set excludes it
//    (riskNotes (4)) — a scan that reddened this line would redden the whole tree;
//  - ordinary arithmetic that says nothing about a unit at all.
//
// Nothing here reaches out of its own directory: this file is linted as though it stood in the
// layered tree, and a fixture that tripped a boundary rule would be proving somebody else's NEVER.

export const millisecondsInASecond = 1000;

export const kilogrammesPerTonne = 1000;

export const said = `a factor is read from the canon — 0.3048 is written here in a template, which states no law`;

export const one = 1;

export const halved = 0.5;

export const aQuotientOfNothingInParticular = millisecondsInASecond / 4;
