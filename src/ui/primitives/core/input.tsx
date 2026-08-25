"use client";
/**
 * R-UI-010's Input. The accessible name is the consumer's obligation — a placeholder is a hint,
 * never a label (R-UI-012).
 */
import type { ComponentPropsWithRef } from "react";
import { cx } from "./class-names";

export type InputProps = ComponentPropsWithRef<"input">;

export function Input({ className, type = "text", ...rest }: InputProps) {
  return <input {...rest} type={type} className={cx("cx-input", "cx-reticle", className)} />;
}
