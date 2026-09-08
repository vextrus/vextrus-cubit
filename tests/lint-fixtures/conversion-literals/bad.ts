// L-FRM-06's payload: a CONVERSION FACTOR written as a literal somewhere other than the canon.
// "One factor per unit (`toCanonical`); every pair derives as a quotient" — so a factor spelled
// anywhere else is a second home for the law, and this file is what the scan is proved on.
//
// Every shape a factor creeps back in as is a payload here: a bare constant, a record value, an
// array member, a comparison, a call argument, and the same number written as a string in either
// quote style. Nothing in this file is imported by anything: it exists to be scanned.
//
// The corpus proves a committed SCAN (src/core/units/__tests__/literal-scan.ts), not an ESLint rule:
// scripts/eslint/** is locked at M2, so the ban is the scan, exactly as the view-type spellings were
// done.
//
// Each of the canon's needles — the factors that are neither 1 nor an integer power of ten — is
// spelled at least once in CODE below. None is spelled only in this comment, because a word in a
// comment is not code (Q-17) and could never be reported.

export const cubicFootInCubicMetres = 0.028316846592;

export const metresPerFoot = { foot: 0.3048, alsoTheFoot: '0.3048' };

export const squareFootInSquareMetres = [0.09290304, "0.09290304"];

export const poundInKilogrammes = "0.45359237";

export function isAFoot(value: number): boolean {
  return value === 0.3048;
}

export const passedAlong = isAFoot(0.028316846592);

export const poundAgain = 0.45359237;
