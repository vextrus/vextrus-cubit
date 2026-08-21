/**
 * Dialog and Sheet — the two modal surfaces (R-UI-010, R-UI-012).
 *
 * One implementation, two geometries: a Sheet is a Dialog that arrives from the side, and a
 * side panel that behaved differently from a centred one under the keyboard would be a second
 * modal contract to keep in step. Radix holds the focus inside while it is open, closes on
 * Escape and hands focus back to the trigger; the Title is the accessible name, which is why
 * it is a component rather than a prop — a name that is not the heading the user can see is a
 * name that drifts from it.
 *
 * `aria-modal` is set here rather than by Radix, which states `role="dialog"` and leaves the
 * modality to the focus scope. R-UI-012's screen-reader half needs it said out loud: without
 * it a screen reader will happily read the page behind a modal the keyboard cannot reach.
 */
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cx } from './class-names';
import { ts } from './strings';

/** Which edge a Sheet arrives from. Centred has no side; a panel always has one. */
export type SheetSide = 'left' | 'right';

/**
 * `aria-modal`'s value — the ARIA vocabulary, not copy, which is why it is a constant rather
 * than a string table key or a JSX literal (R-SPINE-060).
 */
const MODAL = 'true';

export const Dialog = DialogPrimitive.Root;

export type DialogTriggerProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>;

export const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(
  function DialogTrigger({ className, ...rest }, ref) {
    return (
      <DialogPrimitive.Trigger
        ref={ref}
        className={cx('datum-dialog-trigger', 'datum-focus-ring', className)}
        {...rest}
      />
    );
  },
);

export type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { className, children, ...rest },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="datum-scrim" />
      <DialogPrimitive.Content
        ref={ref}
        data-testid="dialog-content"
        aria-modal={MODAL}
        className={cx('datum-dialog', className)}
        {...rest}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export type DialogTitleProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(function DialogTitle(
  { className, ...rest },
  ref,
) {
  return <DialogPrimitive.Title ref={ref} className={cx('datum-dialog-title', className)} {...rest} />;
});

export type DialogDescriptionProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;

export const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  function DialogDescription({ className, ...rest }, ref) {
    return (
      <DialogPrimitive.Description
        ref={ref}
        className={cx('datum-dialog-description', className)}
        {...rest}
      />
    );
  },
);

export type DialogCloseProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Close>;

export const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(function DialogClose(
  { className, children, ...rest },
  ref,
) {
  // With children it is whatever the screen wrote — usually a cancel button. Without them it
  // is the corner control, which is an icon and therefore needs a name of its own (R-UI-012).
  const bare = children === undefined;
  return (
    <DialogPrimitive.Close
      ref={ref}
      data-glyph={bare ? '' : undefined}
      aria-label={bare ? ts('primitives.dialog.close') : undefined}
      className={cx('datum-control', 'datum-dialog-close', 'datum-focus-ring', className)}
      {...rest}
    >
      {children}
    </DialogPrimitive.Close>
  );
});

/* ---- Sheet: the same modal, arriving from an edge ------------------------------------ */

export const Sheet = DialogPrimitive.Root;

export type SheetTriggerProps = DialogTriggerProps;

export const SheetTrigger = forwardRef<HTMLButtonElement, SheetTriggerProps>(function SheetTrigger(
  { className, ...rest },
  ref,
) {
  return (
    <DialogPrimitive.Trigger
      ref={ref}
      className={cx('datum-sheet-trigger', 'datum-focus-ring', className)}
      {...rest}
    />
  );
});

export interface SheetContentProps extends DialogContentProps {
  /** Which edge the panel arrives from. Right by default: it is where a detail panel lives. */
  readonly side?: SheetSide;
}

export const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(function SheetContent(
  { className, children, side, ...rest },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="datum-scrim" />
      <DialogPrimitive.Content
        ref={ref}
        data-testid="sheet-content"
        data-side={side ?? 'right'}
        aria-modal={MODAL}
        className={cx('datum-sheet', className)}
        {...rest}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export type SheetTitleProps = DialogTitleProps;

export const SheetTitle = forwardRef<HTMLHeadingElement, SheetTitleProps>(function SheetTitle(
  { className, ...rest },
  ref,
) {
  return <DialogPrimitive.Title ref={ref} className={cx('datum-dialog-title', className)} {...rest} />;
});

export type SheetCloseProps = DialogCloseProps;

export const SheetClose = forwardRef<HTMLButtonElement, SheetCloseProps>(function SheetClose(
  { className, children, ...rest },
  ref,
) {
  const bare = children === undefined;
  return (
    <DialogPrimitive.Close
      ref={ref}
      data-glyph={bare ? '' : undefined}
      aria-label={bare ? ts('primitives.sheet.close') : undefined}
      className={cx('datum-control', 'datum-dialog-close', 'datum-focus-ring', className)}
      {...rest}
    >
      {children}
    </DialogPrimitive.Close>
  );
});
