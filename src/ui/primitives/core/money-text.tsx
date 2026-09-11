"use client";
/**
 * MoneyText — taka, grouped lakh/crore to the paisa, in the tabular mono face (Design Direction 00
 * §5 item 5). The figure is SEAM-FORMAT's, handed down through `FigureFormat` (ARCH-01 keeps the
 * seam out of `src/ui`, and B-17 keeps a second grouping out of this file).
 *
 * INTERPRETATION — the ৳ sign (§5 item 5, B-24, AM-08):
 * The direction asks for `৳` "from the vendored Bengali subset". A subset is a binary, and this
 * machine cannot produce one: there is no `pyftsubset`, no fontTools and no Noto Sans Bengali
 * installed, and the offline lane has no network to fetch either. Two things were therefore
 * refused: fabricating a woff2 (a binary nobody can account for is worse than a missing one), and
 * adding a `@font-face` whose `src:` is a URL — B-24 admits no URL in an authored stylesheet, and
 * the one file that carries the Spline faces (`src/ui/theme/globals.css`) is not this node's.
 *
 * So the sign is drawn: `IconTaka` traces U+09F3 at the icon set's own stroke and box, and the
 * figure beside it is ASCII digits, which is what the document convention already specifies
 * (`BD_DOCUMENT.numberingSystem: "latn"`). The glyph is announced with the character itself, so a
 * screen reader says the currency rather than describing a shape. When a real subset is vendored
 * under `src/ui/fonts/` with its SIL OFL 1.1 text beside it, this component swaps the glyph for the
 * character and `IconTaka` is deleted — in one place.
 */
import type { ReactNode } from "react";
import { cx } from "./class-names";
import { useFigures, type FigureFormat } from "./figures";
import { IconTaka } from "../../icons";

/** The character the sign stands for, for the accessible name alone — never for the painted glyph. */
const TAKA = "৳";

export interface MoneyTextProps {
  /** The amount as a decimal string at exactly the document's precision (L-FMT-02 refuses others). */
  amount: string;
  format?: FigureFormat;
  className?: string;
  "data-testid"?: string;
}

export function MoneyText({ amount, format, className, "data-testid": testId }: MoneyTextProps): ReactNode {
  const figures = useFigures(format);
  const written = figures.money(amount);
  // A document never prints the direction after the currency: `-৳2,500.00`, never `৳-2,500.00`.
  const negative = written.startsWith("-");
  return (
    <span className={cx("cx-money", className)} data-testid={testId ?? "money-text"} data-amount={amount}>
      {negative ? <span className="cx-money-sign">-</span> : null}
      <IconTaka size="sm" className="cx-money-currency" title={TAKA} />
      <span className="cx-money-figure">{negative ? written.slice(1) : written}</span>
    </span>
  );
}
