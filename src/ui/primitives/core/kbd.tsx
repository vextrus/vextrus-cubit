"use client";
/**
 * R-UI-010's Kbd: a keycap, rendered as the native `<kbd>` so the shortcut a screen names is
 * announced as a key and not as prose.
 */
import type { ComponentPropsWithRef } from "react";
import { cx } from "./class-names";

export type KbdProps = ComponentPropsWithRef<"kbd">;

export function Kbd({ className, children, ...rest }: KbdProps) {
  return (
    <kbd {...rest} className={cx("cx-kbd", className)}>
      {children}
    </kbd>
  );
}
