// LAW-FMT's refusals: what the one formatting seam answers when a value cannot be rendered at the
// precision or in the repertoire a document requires (R-SPINE-062).

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type FormatRefusalCode =
  | "PRECISION_NOT_APPLIED"
  | "CHARACTER_NOT_COVERED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const FORMAT_REFUSALS: RefusalGroup<FormatRefusalCode> = Object.freeze({
  PRECISION_NOT_APPLIED: Object.freeze({
    code: "PRECISION_NOT_APPLIED",
    message: "The value is not at the exact precision this document requires.",
    remedy: "Enter the value at the stated precision — nothing is rounded or padded on your behalf.",
    severity: "error",
    surface: "inline",
  }),
  CHARACTER_NOT_COVERED: Object.freeze({
    code: "CHARACTER_NOT_COVERED",
    message: "The text contains a character the document font cannot print.",
    remedy: "Replace or remove the unsupported character — a document never prints a blank box in its place.",
    severity: "error",
    surface: "inline",
  }),
});
