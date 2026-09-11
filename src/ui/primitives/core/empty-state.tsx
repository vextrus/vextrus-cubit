"use client";
/**
 * EmptyState (Design Direction 00 §1's table, R-UI-050): one glyph, one sentence, one action.
 *
 * What it refuses is the point — no illustration, no "Welcome!", no paragraph explaining the
 * product to someone who is already inside it. An empty region says what is not there and offers
 * the one move that changes it; everything else is the screen's job.
 */
import type { ReactNode } from "react";
import { cx } from "./class-names";
import { IconInbox } from "../../icons";

export interface EmptyStateProps {
  /** The sentence. It is a heading because a region's emptiness is that region's subject (Q-11). */
  heading: string;
  /** One further line, where the sentence alone cannot say what is missing. Never a paragraph. */
  body?: string;
  /** The glyph — 20 px, from the vendored set. The inbox is the default for "nothing here yet". */
  glyph?: ReactNode;
  /** The one primary action. */
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function EmptyState({ heading, body, glyph, children, className, "data-testid": testId }: EmptyStateProps): ReactNode {
  return (
    <div className={cx("cx-empty-state", className)} data-testid={testId ?? "empty-state"}>
      <span className="cx-empty-state-glyph" aria-hidden="true">
        {glyph ?? <IconInbox size="lg" />}
      </span>
      <h2 className="cx-empty-state-heading">{heading}</h2>
      {body === undefined ? null : <p className="cx-empty-state-body">{body}</p>}
      {children === undefined ? null : <div className="cx-empty-state-action">{children}</div>}
    </div>
  );
}
