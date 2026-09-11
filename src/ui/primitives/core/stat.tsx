"use client";
/**
 * Stat — a tile of the dashboard row (Design Direction 00 §3.3): the figure at 20 px in the mono
 * face, the word under it at 12. The figure is already formatted by the time it arrives here — a
 * `MoneyText`, a `QuantityText` or a plain count — because grouping and precision are SEAM-FORMAT's
 * (L-FMT-01) and a tile is a layout, not a second formatter.
 */
import type { ReactNode } from "react";
import { cx } from "./class-names";

export interface StatProps {
  value: ReactNode;
  label: string;
  className?: string;
  "data-testid"?: string;
}

export function Stat({ value, label, className, "data-testid": testId }: StatProps): ReactNode {
  return (
    <div className={cx("cx-stat", className)} data-testid={testId ?? "stat"}>
      <span className="cx-stat-value">{value}</span>
      <span className="cx-stat-label">{label}</span>
    </div>
  );
}
