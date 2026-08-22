/**
 * The non-modal layers: Tooltip, Popover, DropdownMenu and ContextMenu (R-UI-010).
 *
 * All four are the same shape — a trigger, a portalled surface, and Radix's dismiss and
 * focus handling — so they are assembled the same way, and the differences that matter are
 * stated rather than inherited:
 *
 *   - Tooltip carries its own `Provider`. Radix requires one in the tree, and a primitive
 *     that throws unless a screen remembered to wrap the app is a primitive with a trap in
 *     it; the provider is idempotent, so a screen that wraps its own is unaffected.
 *   - A menu item is a tab stop while its menu is open, so it carries the ring class too
 *     (R-UI-012). So is the ContextMenu trigger: the keyboard raises a `contextmenu` event
 *     with Shift+F10 or the Menu key, and it raises it against the focused element — a region
 *     nothing can focus is a region only a mouse can open (Design Decision §10).
 */
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import { ContextMenu as ContextMenuPrimitive, DropdownMenu as DropdownMenuPrimitive, Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import { cx } from './class-names';
import { surfaceContainer } from './surface-container';

/* ---- Tooltip ---------------------------------------------------------------------- */

export type TooltipProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>;

/**
 * How long a pointer rests on the trigger before the tip appears, in milliseconds (Design
 * Decision §9). Radix's own default is most of a second, which reads as a tooltip that does
 * not work; a keyboard focus still opens it at once.
 */
const DWELL = 200;

export function Tooltip({ children, ...rest }: TooltipProps): ReactElement {
  return (
    <TooltipPrimitive.Provider delayDuration={DWELL}>
      <TooltipPrimitive.Root delayDuration={DWELL} {...rest}>
        {children}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export type TooltipTriggerProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>;

export const TooltipTrigger = forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  function TooltipTrigger({ className, ...rest }, ref) {
    return (
      <TooltipPrimitive.Trigger
        ref={ref}
        className={cx('datum-tooltip-trigger', 'datum-focus-ring', className)}
        {...rest}
      />
    );
  },
);

export type TooltipContentProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;

export const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  function TooltipContent({ className, ...rest }, ref) {
    return (
      <TooltipPrimitive.Portal container={surfaceContainer()}>
        <TooltipPrimitive.Content ref={ref} className={cx('datum-tooltip', className)} {...rest} />
      </TooltipPrimitive.Portal>
    );
  },
);

/* ---- Popover ---------------------------------------------------------------------- */

export const Popover = PopoverPrimitive.Root;

export type PopoverTriggerProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>;

export const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  function PopoverTrigger({ className, ...rest }, ref) {
    return (
      <PopoverPrimitive.Trigger
        ref={ref}
        className={cx('datum-popover-trigger', 'datum-focus-ring', className)}
        {...rest}
      />
    );
  },
);

export type PopoverContentProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>;

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent({ className, ...rest }, ref) {
    return (
      <PopoverPrimitive.Portal container={surfaceContainer()}>
        <PopoverPrimitive.Content
          ref={ref}
          className={cx('datum-popover-surface', className)}
          {...rest}
        />
      </PopoverPrimitive.Portal>
    );
  },
);

/* ---- DropdownMenu ------------------------------------------------------------------ */

export type DropdownMenuProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>;

/**
 * Non-modal by default. Radix's Root opens modal, which `aria-hidden`s every sibling of the
 * portal — the page's own heading and every control on it leave the accessibility tree, and
 * axe reports `aria-hidden-focus` and `page-has-heading-one` against a menu that has taken
 * the page away from the reader. A menu is a layer, not a mode (this file's own heading).
 */
export function DropdownMenu({ modal, ...rest }: DropdownMenuProps): ReactElement {
  return <DropdownMenuPrimitive.Root modal={modal ?? false} {...rest} />;
}

export type DropdownMenuTriggerProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>;

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger({ className, ...rest }, ref) {
    return (
      <DropdownMenuPrimitive.Trigger
        ref={ref}
        className={cx('datum-menu-trigger', 'datum-focus-ring', className)}
        {...rest}
      />
    );
  },
);

export type DropdownMenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>;

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  function DropdownMenuContent({ className, ...rest }, ref) {
    return (
      <DropdownMenuPrimitive.Portal container={surfaceContainer()}>
        <DropdownMenuPrimitive.Content
          ref={ref}
          className={cx('datum-popover-surface', 'datum-menu', className)}
          {...rest}
        />
      </DropdownMenuPrimitive.Portal>
    );
  },
);

export type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>;

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  function DropdownMenuItem({ className, ...rest }, ref) {
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cx('datum-control', 'datum-menu-item', 'datum-focus-ring', className)}
        {...rest}
      />
    );
  },
);

/* ---- ContextMenu -------------------------------------------------------------------- */

export type ContextMenuProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Root>;

/** Non-modal by default, for the reason DropdownMenu is. */
export function ContextMenu({ modal, ...rest }: ContextMenuProps): ReactElement {
  return <ContextMenuPrimitive.Root modal={modal ?? false} {...rest} />;
}

export type ContextMenuTriggerProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Trigger>;

export const ContextMenuTrigger = forwardRef<HTMLSpanElement, ContextMenuTriggerProps>(
  function ContextMenuTrigger({ className, tabIndex, ...rest }, ref) {
    return (
      <ContextMenuPrimitive.Trigger
        ref={ref}
        // Shift+F10 and the Menu key fire `contextmenu` at whatever holds the focus, so the
        // region has to be able to hold it. A consumer that has its own tab stop inside the
        // region may pass its own `tabIndex` and take this one back out.
        tabIndex={tabIndex ?? 0}
        className={cx('datum-context-trigger', 'datum-focus-ring', className)}
        {...rest}
      />
    );
  },
);

export type ContextMenuContentProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>;

export const ContextMenuContent = forwardRef<HTMLDivElement, ContextMenuContentProps>(
  function ContextMenuContent({ className, ...rest }, ref) {
    return (
      <ContextMenuPrimitive.Portal container={surfaceContainer()}>
        <ContextMenuPrimitive.Content
          ref={ref}
          className={cx('datum-popover-surface', 'datum-menu', className)}
          {...rest}
        />
      </ContextMenuPrimitive.Portal>
    );
  },
);

export type ContextMenuItemProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>;

export const ContextMenuItem = forwardRef<HTMLDivElement, ContextMenuItemProps>(
  function ContextMenuItem({ className, ...rest }, ref) {
    return (
      <ContextMenuPrimitive.Item
        ref={ref}
        className={cx('datum-control', 'datum-menu-item', 'datum-focus-ring', className)}
        {...rest}
      />
    );
  },
);
