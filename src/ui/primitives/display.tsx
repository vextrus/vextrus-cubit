/**
 * The primitives that only display: Badge, Tag, Kbd, Progress, Skeleton, Separator
 * (R-UI-010).
 *
 * None of them takes focus, so none of them carries the ring. Two are worth a word:
 *
 *   - Progress is determinate — R-UI-010 says "Progress (determinate only where known)", and
 *     a bar that animates without knowing how far along it is tells the user a number nobody
 *     measured. Where the fraction is unknown the answer is a Skeleton, not an indeterminate
 *     bar.
 *   - Skeleton keeps the layout (R-UI-004: "loading uses skeletons that keep layout, never
 *     spinners on data tables") and is `aria-hidden`: it is the shape of content that has not
 *     arrived, and there is nothing there to announce.
 */
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, HTMLAttributes } from 'react';
import { Progress as ProgressPrimitive, Separator as SeparatorPrimitive } from 'radix-ui';
import { cx } from './class-names';

/** The semantic colours a Badge may take. Neutral where nothing is said (R-UI-001). */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: BadgeTone;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', className, ...rest },
  ref,
) {
  return <span ref={ref} data-tone={tone} className={cx('datum-badge', className)} {...rest} />;
});

export type TagProps = HTMLAttributes<HTMLSpanElement>;

export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag({ className, ...rest }, ref) {
  return <span ref={ref} className={cx('datum-tag', className)} {...rest} />;
});

export type KbdProps = HTMLAttributes<HTMLElement>;

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd({ className, ...rest }, ref) {
  return <kbd ref={ref} className={cx('datum-kbd', className)} {...rest} />;
});

export type ProgressProps = ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>;

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { className, value, max, ...rest },
  ref,
) {
  const ceiling = max ?? 100;
  // Radix reads a null value as its indeterminate mode, which drops aria-valuenow. A bar with
  // no stated position is exactly what R-UI-010 forbids, so a value-less Progress stands at
  // zero and still says so.
  const done = Math.min(Math.max(value ?? 0, 0), ceiling);
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={done}
      max={ceiling}
      className={cx('datum-progress', className)}
      {...rest}
    >
      <ProgressPrimitive.Indicator
        className="datum-progress-indicator"
        style={{ width: `${String((done / ceiling) * 100)}%` }}
      />
    </ProgressPrimitive.Root>
  );
});

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} aria-hidden="true" className={cx('datum-skeleton', className)} {...rest} />;
});

export type SeparatorProps = ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>;

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  { className, ...rest },
  ref,
) {
  return <SeparatorPrimitive.Root ref={ref} className={cx('datum-separator', className)} {...rest} />;
});
