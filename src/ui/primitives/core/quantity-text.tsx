"use client";
/**
 * QuantityText — a measured or entered figure in the face a figure is read in (Design Direction 00
 * §5 item 5: mono, tabular, right-aligned, lakh/crore), with its unit as a muted badge beside it.
 *
 * The grouping is SEAM-FORMAT's and arrives through `FigureFormat` (see `figures.tsx`): this
 * component neither calls the seam — `src/ui` may not (ARCH-01) — nor carries a second idea of what
 * `1,00,00,000` means. The exact decimal stays on the element, so a suite and a copy get the value
 * rather than its rendering (B-07).
 */
import type { ReactNode } from "react";
import { cx } from "./class-names";
import { useFigures, type FigureFormat } from "./figures";
import { UnitBadge } from "./unit-badge";

export interface QuantityTextProps {
  /** The figure as a decimal string — B-07 keeps a quantity off floats end to end. */
  value: string;
  unit?: string;
  format?: FigureFormat;
  className?: string;
  "data-testid"?: string;
}

export function QuantityText({ value, unit, format, className, "data-testid": testId }: QuantityTextProps): ReactNode {
  const figures = useFigures(format);
  return (
    <span className={cx("cx-quantity", className)} data-testid={testId ?? "quantity-text"} data-value={value}>
      <span className="cx-quantity-figure">{figures.figure(value)}</span>
      {unit === undefined ? null : <UnitBadge unit={unit} />}
    </span>
  );
}
