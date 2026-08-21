/**
 * Tabs — one tab stop, arrows inside it (R-UI-010, R-UI-012).
 *
 * Radix owns the roving tabindex, `aria-selected` and the `aria-controls`/`role="tabpanel"`
 * pairing; the restyle is the underline and the ring. Activation stays automatic — arrowing
 * onto a tab shows it — because a Datum tab switches a view that is already loaded, and a
 * second keypress to see what you have already moved to is a keypress that buys nothing.
 */
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cx } from './class-names';

export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs({ className, ...rest }, ref) {
  return <TabsPrimitive.Root ref={ref} className={cx('datum-tabs', className)} {...rest} />;
});

export type TabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List>;

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { className, ...rest },
  ref,
) {
  return <TabsPrimitive.List ref={ref} className={cx('datum-tabs-list', className)} {...rest} />;
});

export type TabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
  { className, ...rest },
  ref,
) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cx('datum-control', 'datum-tabs-trigger', 'datum-focus-ring', className)}
      {...rest}
    />
  );
});

export type TabsContentProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent(
  { className, ...rest },
  ref,
) {
  return <TabsPrimitive.Content ref={ref} className={cx('datum-tabs-content', className)} {...rest} />;
});
