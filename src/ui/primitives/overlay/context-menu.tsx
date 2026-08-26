"use client";
/**
 * R-UI-010's ContextMenu, restyled Radix. It wears the same `cx-menu` chrome as the DropdownMenu —
 * one menu surface, one home (B-17) — and differs only in its gesture: it opens at the pointer on
 * a `contextmenu` event over its trigger.
 */
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import type { ComponentProps } from "react";
import { cx } from "../core/class-names";
import type { MenuItemVariant } from "./menu-item";

export type ContextMenuProps = ComponentProps<typeof ContextMenuPrimitive.Root>;

export function ContextMenu(props: ContextMenuProps) {
  return <ContextMenuPrimitive.Root {...props} />;
}

export type ContextMenuTriggerProps = ComponentProps<typeof ContextMenuPrimitive.Trigger>;

export function ContextMenuTrigger({ className, ...rest }: ContextMenuTriggerProps) {
  return <ContextMenuPrimitive.Trigger {...rest} className={cx("cx-menu-surface", className)} />;
}

export type ContextMenuContentProps = ComponentProps<typeof ContextMenuPrimitive.Content>;

export function ContextMenuContent({ className, ...rest }: ContextMenuContentProps) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        {...rest}
        data-testid="contextmenu-content"
        className={cx("cx-menu", className)}
      />
    </ContextMenuPrimitive.Portal>
  );
}

export interface ContextMenuItemProps extends ComponentProps<typeof ContextMenuPrimitive.Item> {
  variant?: MenuItemVariant;
}

export function ContextMenuItem({ className, variant = "default", ...rest }: ContextMenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      {...rest}
      data-variant={variant}
      className={cx("cx-menu-item", "cx-reticle", className)}
    />
  );
}
