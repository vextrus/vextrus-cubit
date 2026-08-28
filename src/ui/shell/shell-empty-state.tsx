// R-UI-050's empty state, in its one shape: a screen with nothing on it says what it is for and
// offers the next action — exactly one, so there is no doubt which it is. The action is the
// caller's, because only the screen knows what its next step is; the teaching frame is here.
import type { ReactNode } from "react";

export interface ShellEmptyStateProps {
  heading: string;
  body: string;
  /** The screen's one next action, rendered in the slot a journey reads it from. */
  children: ReactNode;
  /** What the action answered, below the slot it was taken in — absent until there is an answer. */
  answer?: ReactNode;
}

export function ShellEmptyState({ heading, body, children, answer }: ShellEmptyStateProps) {
  return (
    <div className="cx-shell-empty" data-testid="shell-empty">
      <h2 className="cx-shell-empty-heading">{heading}</h2>
      <p className="cx-shell-empty-body">{body}</p>
      <div className="cx-shell-empty-action" data-testid="shell-empty-action">
        {children}
      </div>
      {answer}
    </div>
  );
}
