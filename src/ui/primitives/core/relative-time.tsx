"use client";
/**
 * RelativeTime — "2 h ago" for the near past, the document date for everything else.
 *
 * Deterministic by construction: the present is either handed in as `now` or read from the app's
 * injected clock, and `Date.now()` is never called in a render. A component that cannot be
 * photographed twice with the same result is not a component the evidence suite can hold (Design
 * Direction 00 §9.1 item 7); this one is frozen exactly as hard as the tenant that renders it.
 *
 * With no clock and no `now` there is no present to be relative to, so it says the date — the true
 * answer, never an invented one. The date itself is SEAM-FORMAT's, through `FigureFormat`.
 */
import type { ReactNode } from "react";
import { cx } from "./class-names";
import { useClock } from "./clock";
import { useFigures, type FigureFormat } from "./figures";
import { fill, strings } from "../../strings";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
/** Past this many hours a reading stops being "ago" and becomes a date (§3.3's "Tue", "2 h ago"). */
const RELATIVE_HOURS = 24;

export interface RelativeTimeProps {
  at: Date;
  /** The present, stated. Overrides the injected clock — a caller that knows is never overruled. */
  now?: Date;
  format?: FigureFormat;
  className?: string;
  "data-testid"?: string;
}

/** How an elapsed span is said, given the two instants and the document's conventions — pure. */
export function relativeReading(at: Date, now: Date, figures: FigureFormat): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / MS_PER_MINUTE);
  if (minutes < 0) return figures.date(at);
  if (minutes < 1) return strings.primitive_relative_just_now;
  if (minutes < MINUTES_PER_HOUR) return fill(strings.primitive_relative_minutes, { count: figures.figure(String(minutes)) });
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < RELATIVE_HOURS) return fill(strings.primitive_relative_hours, { count: figures.figure(String(hours)) });
  if (hours < RELATIVE_HOURS * 2) return strings.primitive_relative_yesterday;
  return figures.date(at);
}

export function RelativeTime({ at, now, format, className, "data-testid": testId }: RelativeTimeProps): ReactNode {
  const injected = useClock();
  const figures = useFigures(format);
  const reference = now ?? injected;
  return (
    <time
      className={cx("cx-relative-time", className)}
      dateTime={at.toISOString()}
      data-testid={testId ?? "relative-time"}
      title={figures.date(at)}
    >
      {reference === null ? figures.date(at) : relativeReading(at, reference, figures)}
    </time>
  );
}
