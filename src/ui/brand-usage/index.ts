/**
 * R-UI-070's brand usage, as a table the product reads and a suite reflects over — and the one
 * component that puts the quiet mark on a surface (B-17, ARCH-02).
 *
 * The geometry is never redrawn: the vendored SVG at `src/ui/brand/` (B-24) is referenced as an
 * asset, so the rail paints the file itself rather than a second spelling of its paths. There is
 * one no-spark asset and it carries fixed indigo facets, which is what both themes show — it is
 * decorative here (`alt=""`), so no contrast floor binds it.
 */
import { createElement } from "react";
import mark from "../brand/vextrus-mark-nospark.svg";

/** How a variant treats the beam spark: never painted, or painted only at or above the floor. */
export type SparkRule = "never" | "at-or-above-32";

/** One row of R-UI-070's usage law: which asset, how small it may go, its spark, and where. */
export interface BrandUsage {
  variant: string;
  minSizePx: number;
  sparkRule: SparkRule;
  surface: string;
}

/**
 * R-UI-070 verbatim, enumerated: the rail carries the quiet no-spark mark (the beam spark is
 * omitted below 32 px), the full spark mark appears only on sign-in and on certificates, and issued
 * PDFs carry the light lockup. Copper is scarce across brand and product alike, so no row outside
 * these puts a spark anywhere.
 */
export const BRAND_USAGE: readonly BrandUsage[] = Object.freeze([
  Object.freeze({ variant: "mark-nospark", minSizePx: 16, sparkRule: "never", surface: "rail" }),
  Object.freeze({ variant: "mark", minSizePx: 32, sparkRule: "at-or-above-32", surface: "sign-in" }),
  Object.freeze({ variant: "mark", minSizePx: 32, sparkRule: "at-or-above-32", surface: "certificates" }),
  Object.freeze({ variant: "lockup-light", minSizePx: 104, sparkRule: "at-or-above-32", surface: "issued-pdf" }),
]);

/** The size the rail paints the quiet mark at (R-UI-070), stated once. */
export const QUIET_MARK_PX = 26;

/**
 * The asset's address. A static image import is an object under the app's compiler and a URL under
 * a test runner's; both are the same vendored file, and reading either gives the address to load.
 */
const MARK_SRC: string = typeof mark === "string" ? mark : String(mark.src);

/**
 * The rail's mark: the vendored no-spark geometry at exactly 26 px, decorative (R-UI-070).
 *
 * Written with `createElement` rather than JSX because this file is the barrel the usage table is
 * read from, and the table and the component it governs stay in one home (B-17).
 */
export function QuietMark() {
  return createElement("img", { src: MARK_SRC, alt: "", width: QUIET_MARK_PX, height: QUIET_MARK_PX });
}
