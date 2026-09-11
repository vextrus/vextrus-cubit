// The 32 px toolbar (Direction §1): "a single row of 28 px icon buttons in 32 px height, grouped by
// hairline separators, tooltip = label + `Kbd`". One row, never tabs of tabs.
//
// This is the container and the group, and nothing else: the tools themselves belong to the screen
// that has them, and the icon button is the shipped core Button wearing the toolbar's own size —
// a second button chrome here would be the copy B-17 blocks.
import type { ReactNode } from "react";

export interface ShellToolbarProps {
  /** The groups, in the order the screen places them; the hairline seam stands between them. */
  children: ReactNode;
  /** The row's name for a reader — a screen's own words, because a screen's tools are its own. */
  label: string;
  className?: string;
}

export function ShellToolbar({ children, label, className }: ShellToolbarProps) {
  return (
    <div className={className === undefined ? "cx-shell-toolbar" : `cx-shell-toolbar ${className}`} data-testid="shell-toolbar" role="toolbar" aria-label={label}>
      {children}
    </div>
  );
}

export interface ShellToolbarGroupProps {
  children: ReactNode;
  /** The group's name, where the group holds more than one tool and the set has a meaning. */
  label?: string;
}

/**
 * One group of tools. The seam between groups is drawn by the group's own inline-start hairline
 * rather than by a separator element: a line that is not a control does not belong in a toolbar's
 * tab order, and an `aria-hidden` spacer is a box a reader steps over for nothing.
 */
export function ShellToolbarGroup({ children, label }: ShellToolbarGroupProps) {
  return (
    <div className="cx-shell-toolbar-group" role="group" aria-label={label}>
      {children}
    </div>
  );
}
