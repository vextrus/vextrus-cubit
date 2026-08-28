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

/**
 * One row of R-UI-070's usage law: which asset, how small it may go, its spark, where it goes —
 * and what it may never share that surface with, because the clause states one rule of that shape
 * ("a DRAFT banner never shares a page with the spark") and a table without a place for it cannot
 * be read for it.
 */
export interface BrandUsage {
  variant: string;
  minSizePx: number;
  sparkRule: SparkRule;
  surface: string;
  /** Variants this row may never appear beside on the same surface; empty when none is barred. */
  neverWith: readonly string[];
}

/**
 * R-UI-070 verbatim, enumerated. Every asset the clause places is a row: the rail's quiet no-spark
 * mark (the spark is omitted below 32 px), the full spark mark on the only two surfaces that carry
 * it — sign-in and certificates — and the two an issued PDF carries, the light lockup *and the
 * quiet watermark*. Copper is scarce across brand and product alike, so no row outside sign-in and
 * certificates puts a spark anywhere; the lockup and the watermark are quiet by that same law. The
 * DRAFT banner is the clause's one co-occurrence rule, and it is carried where a reader looks for
 * it: on the spark-bearing rows themselves, which may never share their page with it.
 */
export const BRAND_USAGE: readonly BrandUsage[] = Object.freeze([
  Object.freeze({ variant: "mark-nospark", minSizePx: 16, sparkRule: "never", surface: "rail", neverWith: Object.freeze([]) }),
  Object.freeze({ variant: "mark", minSizePx: 32, sparkRule: "at-or-above-32", surface: "sign-in", neverWith: Object.freeze(["draft-banner"]) }),
  Object.freeze({ variant: "mark", minSizePx: 32, sparkRule: "at-or-above-32", surface: "certificates", neverWith: Object.freeze(["draft-banner"]) }),
  // The lockup's floor is LOGO-SPEC's 104 px horizontal minimum; it is quiet, because R-UI-070
  // gives the full spark mark to sign-in and certificates and to nothing else.
  Object.freeze({ variant: "lockup-light", minSizePx: 104, sparkRule: "never", surface: "issued-pdf", neverWith: Object.freeze([]) }),
  // The watermark is the mark's no-spark geometry, so it wears the mark's own 16 px floor.
  Object.freeze({ variant: "watermark-quiet", minSizePx: 16, sparkRule: "never", surface: "issued-pdf", neverWith: Object.freeze([]) }),
  // The banner itself: it carries no brand geometry, which is exactly why it is spark-less, and it
  // names the same bar from its own side so neither row can be read without the other.
  Object.freeze({ variant: "draft-banner", minSizePx: 16, sparkRule: "never", surface: "issued-pdf", neverWith: Object.freeze(["mark"]) }),
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
