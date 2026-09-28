/*
 * One formatter per kind of figure, driven by the Market (docs/design/m0-screens.md §1.2, §1.8, §1.9;
 * ADR 0038). Screens take them from `useFormat()`; the table of expected strings is
 * tests/expected-strings.json, checked in the browser by expected-strings.browser.test.ts.
 */
export { FormatProvider, Notation, createFormat, useFormat, type Format } from './Format'
export { EMPTY, type Decimal, type Money } from './numbers'
export { lengthFromFeetInches, lengthFromInches, lengthFromMm, type Length, type NotationText } from './notation'
export type { Grouping, MarketFormat, UnitSystemKey } from './profile'
export { unitSystem, type LengthNotation, type UnitSystem } from './units'
export type { Instant } from './dates'
