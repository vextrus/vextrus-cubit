"use client";
/**
 * R-UI-010's Chip. A chip a consumer can act on is a real button — keyboard reachable and wearing
 * the reticle (R-UI-012); a chip that only reads is a span, and stays out of the tab order.
 * Selection is announced either way, never as colour alone (Q-11): `aria-pressed` on the button
 * that toggles it, `aria-current` on the span that only reports it — a read-only chip has no
 * pressable state to report, but it is still the one selected among its set. A consumer that states
 * `aria-current` itself — "page", "step", the token its set actually means — keeps it: the chip's
 * boolean is the fallback for the set that says nothing, never an override of the truer word.
 */
import type { HTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { cx } from "./class-names";

export interface ChipProps extends Omit<HTMLAttributes<HTMLElement>, "onClick"> {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  selected?: boolean;
  children?: ReactNode;
}

export function Chip({ className, onClick, selected, children, ...rest }: ChipProps) {
  if (onClick === undefined) {
    return (
      <span
        {...rest}
        className={cx("cx-chip", className)}
        data-selected={selected || undefined}
        aria-current={rest["aria-current"] ?? (selected === undefined ? undefined : selected)}
      >
        {children}
      </span>
    );
  }
  return (
    <button
      {...rest}
      type="button"
      className={cx("cx-chip", "cx-reticle", className)}
      data-selected={selected || undefined}
      aria-pressed={selected === undefined ? undefined : selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
