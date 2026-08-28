"use client";
/**
 * R-UI-010's DropdownMenu, restyled Radix. Radix unifies pointer and keyboard highlight on
 * `[data-highlighted]`, so the menu has one highlighted state rather than two (R-UI-012); the
 * content is portalled to `document.body` unless the caller names a container of its own.
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

export interface DropdownMenuContentProps extends ComponentProps<typeof DropdownMenuPrimitive.Content> {
  /**
   * Where the open menu is portalled. Default `document.body`, as before; a caller passes its own
   * element when the menu must land inside a landmark — content parked at the document root is an
   * axe `region` violation, and only the caller knows which of its regions the menu belongs to.
   * The portalled node is the popper's own `position: fixed` box (Radix portals `asChild`), so a
   * container contributes no layout, and nothing is rendered there while the menu is closed.
   */
  container?: ComponentProps<typeof DropdownMenuPrimitive.Portal>["container"];
}

export function DropdownMenuContent({ className, side = "bottom", sideOffset = 6, container, ...rest }: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal container={container}>
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
