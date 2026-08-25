"use client";
/**
 * Coverage as a share of one, rendered as the percentage a reader can act on. A precision
 * instrument never rounds an incomplete coverage up to done: the value is clamped to [0, 1] and
 * floored, and only a complete coverage reads 100%.
 *
 * The band colour is redundant to the numeral it tints, never the only carrier of the meaning
 * (R-UI-002's principle, Q-11).
 */
import type { ComponentPropsWithRef } from "react";
import { cx } from "./class-names";

export interface CoverageChipProps extends ComponentPropsWithRef<"span"> {
  value: number;
}

type CoverageBand = "low" | "partial" | "high";

function clampCoverage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatCoverage(coverage: number): string {
  const percent = coverage >= 1 ? 100 : Math.min(99, Math.floor(coverage * 100));
  return `${percent}%`;
}

function bandOf(coverage: number): CoverageBand {
  if (coverage < 0.5) return "low";
  if (coverage < 0.9) return "partial";
  return "high";
}

export function CoverageChip({ value, className, ...rest }: CoverageChipProps) {
  const coverage = clampCoverage(value);
  return (
    <span
      {...rest}
      className={cx("cx-coverage-chip", className)}
      data-testid="coverage-chip"
      data-band={bandOf(coverage)}
    >
      {formatCoverage(coverage)}
    </span>
  );
}
