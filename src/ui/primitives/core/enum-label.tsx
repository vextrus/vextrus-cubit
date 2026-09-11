"use client";
/**
 * EnumLabel — a model value said in words. `MEMBER` is what the store holds; "Member" is what a
 * person reads (Design Direction 00 §3.7, §6). The two are not alternatives: the raw value stays in
 * the DOM, inside a technical disclosure, so an engineer reading over a shoulder and a suite
 * matching on the enum both still find it — it is simply not what the screen says out loud.
 *
 * The mapping is mechanical, never a table: SCREAMING_SNAKE becomes one sentence-cased phrase. A
 * screen that needs different words for a value has a string table for exactly that, and hands the
 * `label` in.
 */
import type { ReactNode } from "react";
import { cx } from "./class-names";

export interface EnumLabelProps {
  value: string;
  /** The words this value is read by, when its own screen has authored them (R-SPINE-060). */
  label?: string;
  className?: string;
  "data-testid"?: string;
}

/** `ASSIGN_PARTICIPANT_ROLE` → `Assign participant role`. One rule, no roster to keep in step. */
export function humaniseEnum(value: string): string {
  const words = value
    .split("_")
    .filter((word) => word !== "")
    .map((word) => word.toLowerCase());
  if (words.length === 0) return value;
  const first = words[0] as string;
  return [`${first.charAt(0).toUpperCase()}${first.slice(1)}`, ...words.slice(1)].join(" ");
}

export function EnumLabel({ value, label, className, "data-testid": testId }: EnumLabelProps): ReactNode {
  return (
    <span className={cx("cx-enum-label", className)} data-testid={testId} data-value={value}>
      {label ?? humaniseEnum(value)}
      <span className="cx-enum-raw" data-technical="">
        {value}
      </span>
    </span>
  );
}
