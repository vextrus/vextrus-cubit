"use client";
/**
 * DateText — a day as the document writes it, `DD MMM YYYY` in the document's zone (L-FMT-01). The
 * reading comes from `FigureFormat`, which the app wires to SEAM-FORMAT: a day is the day the
 * reader is standing in, and a component that read the machine's local zone would print one date on
 * the server and another in the browser.
 *
 * The `<time>` element carries the machine-readable instant, so what is shown is prose and what is
 * parsed is exact (Q-11).
 */
import type { ReactNode } from "react";
import { cx } from "./class-names";
import { useFigures, type FigureFormat } from "./figures";

export interface DateTextProps {
  at: Date;
  format?: FigureFormat;
  className?: string;
  "data-testid"?: string;
}

export function DateText({ at, format, className, "data-testid": testId }: DateTextProps): ReactNode {
  const figures = useFigures(format);
  return (
    <time className={cx("cx-date", className)} dateTime={at.toISOString()} data-testid={testId ?? "date-text"}>
      {figures.date(at)}
    </time>
  );
}
