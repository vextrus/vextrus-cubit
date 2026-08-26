"use client";
/**
 * R-UI-010's ScrollArea, restyled Radix. The viewport carries no chrome of its own — the consumer's
 * box is the surface; only the scrollbar is ours, and it fades in on hover or scroll (R-UI-004).
 */
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type { ComponentProps } from "react";
import { cx } from "../core/class-names";

export interface ScrollAreaProps extends ComponentProps<typeof ScrollAreaPrimitive.Root> {
  /** Which axis shows a bar; both is the default a text column and a wide table both need. */
  orientation?: "vertical" | "horizontal" | "both";
}

export function ScrollArea({ className, children, orientation = "vertical", ...rest }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root {...rest} type="hover" className={cx("cx-scrollarea", className)}>
      <ScrollAreaPrimitive.Viewport data-testid="scrollarea-viewport" className="cx-scrollarea-viewport">
        {children}
      </ScrollAreaPrimitive.Viewport>
      {orientation !== "horizontal" ? <Bar orientation="vertical" /> : null}
      {orientation !== "vertical" ? <Bar orientation="horizontal" /> : null}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function Bar({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <ScrollAreaPrimitive.Scrollbar orientation={orientation} className="cx-scrollarea-bar">
      <ScrollAreaPrimitive.Thumb className="cx-scrollarea-thumb" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}
