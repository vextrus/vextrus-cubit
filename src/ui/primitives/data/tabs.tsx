"use client";
/**
 * R-UI-010's Tabs, restyled Radix. Selection rides two channels — the beam underline and the text
 * shift — so it never depends on colour alone (R-UI-012). The content switch is instant: a tab
 * change is navigation, not theatre (R-UI-004).
 */
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cx } from "../core/class-names";

export type TabsProps = ComponentProps<typeof TabsPrimitive.Root>;

export function Tabs({ className, ...rest }: TabsProps) {
  return <TabsPrimitive.Root {...rest} className={cx("cx-tabs", className)} />;
}

export type TabsListProps = ComponentProps<typeof TabsPrimitive.List>;

export function TabsList({ className, ...rest }: TabsListProps) {
  return <TabsPrimitive.List {...rest} className={cx("cx-tabs-list", className)} />;
}

export type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger>;

export function TabsTrigger({ className, ...rest }: TabsTriggerProps) {
  return <TabsPrimitive.Trigger {...rest} className={cx("cx-tabs-trigger", "cx-reticle", className)} />;
}

export type TabsContentProps = ComponentProps<typeof TabsPrimitive.Content>;

export function TabsContent({ className, ...rest }: TabsContentProps) {
  return <TabsPrimitive.Content {...rest} className={cx("cx-tabs-content", "cx-reticle", className)} />;
}
