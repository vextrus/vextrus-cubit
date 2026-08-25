"use client";
/**
 * R-UI-010's Textarea. As with Input, the accessible name comes from the consumer (R-UI-012).
 */
import type { ComponentPropsWithRef } from "react";
import { cx } from "./class-names";

export type TextareaProps = ComponentPropsWithRef<"textarea">;

export function Textarea({ className, rows = 3, ...rest }: TextareaProps) {
  return <textarea {...rest} rows={rows} className={cx("cx-textarea", "cx-reticle", className)} />;
}
