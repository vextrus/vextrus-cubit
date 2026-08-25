"use client";
/**
 * R-UI-010's Badge: a static label. It is never interactive, so it is never in the tab order and
 * carries no focus indicator (R-UI-012).
 */
import type { ComponentPropsWithRef } from "react";
import { cx } from "./class-names";

export type BadgeProps = ComponentPropsWithRef<"span">;

export function Badge({ className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx("cx-badge", className)}>
      {children}
    </span>
  );
}
