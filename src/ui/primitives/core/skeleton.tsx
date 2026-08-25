"use client";
/**
 * R-UI-004's loading vocabulary: a bone that keeps the layout it stands in, never a spinner. The
 * owning screen announces that it is loading; a single bone announces nothing, so it is hidden
 * from the accessibility tree (Q-11).
 */
import type { ComponentPropsWithRef } from "react";
import { cx } from "./class-names";

export type SkeletonProps = ComponentPropsWithRef<"div">;

export function Skeleton({ className, ...rest }: SkeletonProps) {
  return <div {...rest} className={cx("cx-skeleton", className)} data-testid="skeleton" aria-hidden="true" />;
}
