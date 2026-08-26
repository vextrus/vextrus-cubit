"use client";
/**
 * R-UI-010's DropdownMenu, restyled Radix. Radix unifies pointer and keyboard highlight on
 * `[data-highlighted]`, so the menu has one highlighted state rather than two (R-UI-012); the
 * content is portalled to `document.body`.
 */
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cx } from "../core/class-names";
import type { MenuItemVariant } from "./menu-item";

export type DropdownMenuProps = ComponentProps<typeof DropdownMenuPrimitive.Root>;

export function DropdownMenu(props: DropdownMenuProps) {
  return <DropdownMenuPrimitive.Root {...props} />;
}

export type DropdownMenuTriggerProps = ComponentProps<typeof DropdownMenuPrimitive.Trigger>;

/** The trigger is the shipped core Button in its ghost variant, as every overlay trigger is (B-17). */
export function DropdownMenuTrigger({ className, ...rest }: DropdownMenuTriggerProps) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-variant="ghost"
      {...rest}
      className={cx("cx-btn", "cx-menu-trigger", "cx-reticle", className)}
    />
  );
}

export type DropdownMenuContentProps = ComponentProps<typeof DropdownMenuPrimitive.Content>;

export function DropdownMenuContent({ className, side = "bottom", sideOffset = 6, ...rest }: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        {...rest}
        side={side}
        sideOffset={sideOffset}
        data-testid="dropdown-content"
        className={cx("cx-menu", className)}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentProps<typeof DropdownMenuPrimitive.Item> {
  variant?: MenuItemVariant;
}

export function DropdownMenuItem({ className, variant = "default", ...rest }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      {...rest}
      data-variant={variant}
      className={cx("cx-menu-item", "cx-reticle", className)}
    />
  );
}
