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
 *     (R-UI-012). The ContextMenu trigger deliberately does not: it is a region you press
 *     the context key on, not a control you tab to.
 */
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import { ContextMenu as ContextMenuPrimitive, DropdownMenu as DropdownMenuPrimitive, Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import { cx } from './class-names';

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
      <TooltipPrimitive.Portal>
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
      <PopoverPrimitive.Portal>
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

export const DropdownMenu = DropdownMenuPrimitive.Root;

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
      <DropdownMenuPrimitive.Portal>
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

export const ContextMenu = ContextMenuPrimitive.Root;

export type ContextMenuTriggerProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Trigger>;

export const ContextMenuTrigger = forwardRef<HTMLSpanElement, ContextMenuTriggerProps>(
  function ContextMenuTrigger({ className, ...rest }, ref) {
    return (
      <ContextMenuPrimitive.Trigger
        ref={ref}
        className={cx('datum-context-trigger', className)}
        {...rest}
      />
    );
  },
);

export type ContextMenuContentProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>;

export const ContextMenuContent = forwardRef<HTMLDivElement, ContextMenuContentProps>(
  function ContextMenuContent({ className, ...rest }, ref) {
    return (
      <ContextMenuPrimitive.Portal>
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
