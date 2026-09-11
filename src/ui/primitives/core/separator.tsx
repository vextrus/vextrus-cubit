"use client";
/**
 * Separator — the hairline that groups a toolbar, a menu or a stack. It is `role="separator"`, so
 * the grouping a sighted reader sees is a grouping every reader meets (Q-11), and it is drawn from
 * `--hairline` rather than a border a consumer re-spells each time (R-UI-001).
 */
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./class-names";

export interface SeparatorProps extends Omit<ComponentPropsWithoutRef<"div">, "children" | "role"> {
  orientation?: "horizontal" | "vertical";
}

export function Separator({ orientation = "horizontal", className, ...rest }: SeparatorProps): ReactNode {
  return (
    <div
      {...rest}
      role="separator"
      aria-orientation={orientation}
      data-orientation={orientation}
      className={cx("cx-separator", className)}
    />
  );
}
