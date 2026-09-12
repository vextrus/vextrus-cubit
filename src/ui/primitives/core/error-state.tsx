"use client";
/**
 * ErrorState (Design Direction 00 §1's table, R-UI-050) — an EmptyState's discipline with the two
 * things a fault owes a reader: a way to try again, and the id to quote when trying again does not
 * work. The report id is rendered through `IdChip`, so it is short on screen, whole in the DOM and
 * one press from the clipboard (R-UI-082) — which is exactly what a person needs when they are
 * reading it out to support.
 *
 * A REFUSAL is not a fault and does not render here: an answer the product meant to give is
 * `RefusalState`'s (R-UI-020). This is for the fault nobody intended.
 */
import type { ReactNode } from "react";
import { cx } from "./class-names";
import { Button } from "./button";
import { IconAlert } from "../../icons";
import { IdChip } from "./id-chip";
import { strings } from "../../strings";
import { TESTIDS } from "@/ui/testids";

export interface ErrorStateProps {
  heading: string;
  body?: string;
  /** The fault id a reader quotes. Rendered through IdChip — short, whole, copyable (R-UI-082). */
  reportId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  glyph?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function ErrorState({
  heading,
  body,
  reportId,
  onRetry,
  retryLabel,
  glyph,
  className,
  "data-testid": testId,
}: ErrorStateProps): ReactNode {
  return (
    <div className={cx("cx-error-state", className)} data-testid={testId ?? "error-state-panel"} role="alert">
      <span className="cx-error-state-glyph" aria-hidden="true">
        {glyph ?? <IconAlert size="lg" />}
      </span>
      <h2 className="cx-error-state-heading">{heading}</h2>
      {body === undefined ? null : <p className="cx-error-state-body">{body}</p>}
      <div className="cx-error-state-foot">
        {onRetry === undefined ? null : (
          <Button variant="secondary" data-testid={TESTIDS.error.stateRetry} onClick={onRetry}>
            {retryLabel ?? strings.primitive_error_retry}
          </Button>
        )}
        {reportId === undefined ? null : (
          <span className="cx-error-state-report">
            <span className="cx-error-state-report-label">{strings.primitive_error_report}</span>
            <IdChip value={reportId} data-testid={TESTIDS.error.stateReport} />
          </span>
        )}
      </div>
    </div>
  );
}
