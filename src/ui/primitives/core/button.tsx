"use client";
/**
 * R-UI-010's Button: primary, secondary, ghost, danger and act. The act variant is the confirm of
 * every consequential action, and it alone wears the 7 px copper dot — copper stays scarce.
 *
 * Loading is announced, never spun (R-UI-004): the button keeps its label and its focus, reports
 * `aria-busy`, and swallows its own activation so a second commit cannot be issued mid-action.
 */
import type { ComponentPropsWithRef, MouseEvent } from "react";
import { cx } from "./class-names";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "act";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  type = "button",
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      type={type}
      className={cx("cx-btn", "cx-reticle", className)}
      data-variant={variant}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
    >
      {variant === "act" ? <span className="cx-act-dot" data-testid="act-dot" aria-hidden="true" /> : null}
      <span className="cx-btn-label">{children}</span>
    </button>
  );
}
