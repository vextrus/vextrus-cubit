// A module whose FILE NAME is a view-type spelling, so `good.ts` can import it and the scan can be
// shown that a module specifier is not a spelling of the law (AC-1: import specifiers are never
// hits). The name is the whole payload; what it exports is deliberately uninteresting.
export const importedFromASpelledPath = 1;
