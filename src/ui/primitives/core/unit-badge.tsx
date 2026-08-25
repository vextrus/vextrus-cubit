"use client";
/**
 * The unit a quantity is measured in, carried verbatim. A unit is a source key: the badge shows
 * what it is given and translates nothing (R-UI-003's mono, tabular treatment in the stylesheet).
 */
import type { ComponentPropsWithRef } from "react";
import { cx } from "./class-names";

export interface UnitBadgeProps extends ComponentPropsWithRef<"span"> {
  unit: string;
}

export function UnitBadge({ unit, className, ...rest }: UnitBadgeProps) {
  return (
    <span {...rest} className={cx("cx-unit-badge", className)} data-testid="unit-badge">
      {unit}
    </span>
  );
}
