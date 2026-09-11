"use client";
/**
 * IconButton — the toolbar's unit (Design Direction 00 §1, §3.1): 28 px square, a 16 px glyph,
 * and a tooltip that says the label and the key. `--control-h` is the height, so the whole bar
 * changes with the density switch and nothing here is a bare pixel.
 *
 * The label is not optional and is not decoration: a glyph alone names nothing, so the label is the
 * accessible name (R-UI-012) AND the tooltip's first line. Where a tool has a mode, `pressed` makes
 * it a real toggle — `aria-pressed`, with a 2 px beam underline rather than a filled pill (§1).
 */
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./class-names";
import { Kbd } from "./kbd";
import { Tooltip } from "./tooltip";

export interface IconButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "children" | "aria-label"> {
  /** The glyph, from the vendored set. */
  icon: ReactNode;
  /** What this control does, in the words a tooltip and a screen reader both use. */
  label: string;
  /** The shortcut, rendered as a keycap beside the label — never spelled into the label itself. */
  kbd?: string;
  pressed?: boolean;
}

export function IconButton({ icon, label, kbd, pressed, className, type = "button", ...rest }: IconButtonProps): ReactNode {
  return (
    <Tooltip
      content={
        <span className="cx-icon-btn-hint">
          {label}
          {kbd === undefined ? null : <Kbd>{kbd}</Kbd>}
        </span>
      }
    >
      <button
        {...rest}
        type={type}
        className={cx("cx-icon-btn", "cx-reticle", className)}
        aria-label={label}
        aria-pressed={pressed}
        data-pressed={pressed || undefined}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
