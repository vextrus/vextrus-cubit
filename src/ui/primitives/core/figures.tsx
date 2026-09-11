"use client";
/**
 * The document's figure conventions, INJECTED (ARCH-01, and the house precedent `JobsFormat` sets:
 * "the pattern formats nothing", docs/design/job-timeline.md I-113).
 *
 * `src/core/format.ts` is the tree's sole caller of the platform's locale machinery (L-FMT-01,
 * SEAM-FORMAT) and `src/ui` may import nothing from `src/core` but types (ARCH-01, cubit/boundaries)
 * — so a primitive cannot call the seam, and it must not carry a second implementation of grouping
 * either (B-17: lakh/crore written twice is two conventions waiting to disagree). What crosses the
 * boundary is therefore the seam ITSELF, handed down by the app that may hold it, and the figure
 * primitives render what it answers.
 *
 * The tenant frame installs one, exactly as it installs the jobs register.
 */
import { createContext, useContext, type ReactNode } from "react";

/** The three readings the figure primitives need, each answered by SEAM-FORMAT at the app's edge. */
export interface FigureFormat {
  /** A decimal string grouped as the document groups it — `1,00,00,000` (`formatUserFigure`). */
  figure(value: string): string;
  /** An amount as the document writes it, sign and all, WITHOUT the currency character: MoneyText
      draws the sign itself (see the Interpretation in money-text.tsx). */
  money(amount: string): string;
  /** An instant as the document's own day, in the document's zone (`formatDate`+`dhakaDateParts`). */
  date(at: Date): string;
}

const FigureContext = createContext<FigureFormat | null>(null);

export interface FigureProviderProps {
  format: FigureFormat;
  children?: ReactNode;
}

export function FigureProvider({ format, children }: FigureProviderProps): ReactNode {
  return <FigureContext.Provider value={format}>{children}</FigureContext.Provider>;
}

/**
 * The conventions this figure is written under: the caller's own, or the tree's. A figure with
 * neither is not rendered ungrouped — a document that quietly prints `10000000` where it means
 * `1,00,00,000` is worse than one that stops — so the absence is raised where it can be fixed.
 */
export function useFigures(format?: FigureFormat): FigureFormat {
  const provided = useContext(FigureContext);
  const held = format ?? provided;
  if (held === null || held === undefined) {
    throw new Error(
      "The document's figure conventions are missing: pass `format`, or mount a FigureProvider — the tenant frame renders one (SEAM-FORMAT, ARCH-01).",
    );
  }
  return held;
}
