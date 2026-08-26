"use client";
/**
 * R-UI-010's Popover, restyled Radix: non-modal, portalled to `document.body`, dismissed by Escape
 * or an outside click with focus returning to its trigger.
 */
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";
import { cx } from "../core/class-names";

export type PopoverProps = ComponentProps<typeof PopoverPrimitive.Root>;

export function Popover(props: PopoverProps) {
  return <PopoverPrimitive.Root {...props} />;
}

export type PopoverTriggerProps = ComponentProps<typeof PopoverPrimitive.Trigger>;

/** The ghost button the Design Decision names, taken from core's Button rather than redrawn (B-17). */
export function PopoverTrigger({ className, ...rest }: PopoverTriggerProps) {
  return (
    <PopoverPrimitive.Trigger
      data-variant="ghost"
      {...rest}
      className={cx("cx-btn", "cx-popover-trigger", "cx-reticle", className)}
    />
  );
}

export type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Content>;

export function PopoverContent({ className, side = "bottom", sideOffset = 6, ...rest }: PopoverContentProps) {
  // A dialog owes an accessible name (R-UI-012), and a primitive owns no copy to give it one: the
  // content announces itself as a dialog exactly when its consumer has named it, and is otherwise
  // plain content the trigger reveals.
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined;

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        {...rest}
        role={named ? "dialog" : undefined}
        side={side}
        sideOffset={sideOffset}
        data-testid="popover-content"
        className={cx("cx-popover", className)}
      />
    </PopoverPrimitive.Portal>
  );
}
