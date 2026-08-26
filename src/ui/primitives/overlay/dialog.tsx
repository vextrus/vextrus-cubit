"use client";
/**
 * R-UI-010's Dialog, restyled Radix. The content is portalled to `document.body` so the document
 * root's `[data-theme]` themes it and no ancestor's overflow or stacking context can clip it.
 *
 * An accessible name is the component's guarantee, not the consumer's good manners (R-UI-012): the
 * consumer passes either a `DialogTitle` or an `aria-label` on the content.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../core/class-names";

export type DialogProps = ComponentProps<typeof DialogPrimitive.Root>;

export function Dialog(props: DialogProps) {
  return <DialogPrimitive.Root {...props} />;
}

export type DialogTriggerProps = ComponentProps<typeof DialogPrimitive.Trigger>;

/**
 * Radix renders a real `<button>`, so the trigger wears the shipped core Button's chrome — its
 * class and its ghost variant, never a second copy of it (B-17). A consumer that passes its own
 * `data-variant`, or its own Button through `asChild`, overrides both.
 */
export function DialogTrigger({ className, ...rest }: DialogTriggerProps) {
  return (
    <DialogPrimitive.Trigger
      data-variant="ghost"
      {...rest}
      className={cx("cx-btn", "cx-dialog-trigger", "cx-reticle", className)}
    />
  );
}

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content>;

export function DialogContent({
  className,
  children,
  "aria-describedby": describedBy,
  ...rest
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="cx-scrim" />
      <DialogPrimitive.Content
        {...rest}
        // The description is the consumer's to name; left unset, the reference would dangle and an
        // accessible name built from a missing id is worse than none (R-UI-012).
        aria-describedby={describedBy}
        // A modal says so: Radix traps focus and hides the rest of the page, and the modality has
        // to reach assistive technology too (R-UI-012).
        aria-modal="true"
        data-testid="dialog-content"
        className={cx("cx-dialog", className)}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export type DialogTitleProps = ComponentProps<typeof DialogPrimitive.Title>;

export function DialogTitle({ className, ...rest }: DialogTitleProps) {
  return <DialogPrimitive.Title {...rest} className={cx("cx-dialog-title", className)} />;
}

export type DialogCloseProps = ComponentProps<typeof DialogPrimitive.Close>;

/** The dismissal affordance: a ghost square whose ✕ is drawn as text and hidden from the name. */
export function DialogClose({ className, children, ...rest }: DialogCloseProps) {
  const glyph: ReactNode = children ?? <span aria-hidden="true">{"✕"}</span>;
  return (
    <DialogPrimitive.Close {...rest} className={cx("cx-dialog-close", "cx-reticle", className)}>
      {glyph}
    </DialogPrimitive.Close>
  );
}
