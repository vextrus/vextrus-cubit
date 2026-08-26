"use client";
/**
 * R-UI-010's Sheet — the side panel. It is a modal dialog anchored to an edge of the viewport, so
 * it is built on the same Radix Dialog as the Dialog rather than on a second modality
 * implementation (B-17); the edge is `side`, reflected as `data-side` for the stylesheet.
 *
 * The Sheet exports no title part, so its accessible name is the consumer's `aria-label`.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { cx } from "../core/class-names";

export type SheetSide = "right" | "left";

export type SheetProps = ComponentProps<typeof DialogPrimitive.Root>;

export function Sheet(props: SheetProps) {
  return <DialogPrimitive.Root {...props} />;
}

export type SheetTriggerProps = ComponentProps<typeof DialogPrimitive.Trigger>;

export function SheetTrigger({ className, ...rest }: SheetTriggerProps) {
  return <DialogPrimitive.Trigger {...rest} className={cx("cx-sheet-trigger", "cx-reticle", className)} />;
}

export interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  side?: SheetSide;
}

export function SheetContent({
  className,
  children,
  side = "right",
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  ...rest
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="cx-scrim" />
      <DialogPrimitive.Content
        {...rest}
        // No title part means no title id: both references are the consumer's to make, and a
        // dangling one names nothing (R-UI-012).
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        // A modal says so: the panel traps focus and hides the rest of the page (R-UI-012).
        aria-modal="true"
        data-testid="sheet-content"
        data-side={side}
        className={cx("cx-sheet", className)}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
