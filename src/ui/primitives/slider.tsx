/**
 * Slider — the WAI-ARIA slider, written rather than restyled (R-UI-010, R-UI-012).
 *
 * Every other control in this module is Radix underneath. This one is not, for one reason:
 * Radix's Slider measures its thumb through `ResizeObserver` in a layout effect, so it throws
 * on mount in any DOM that has no layout — every jsdom, every consumer's unit test, every
 * server render that hydrates into one. A primitive that cannot be mounted outside a browser
 * is a primitive nobody can test, and "polyfill it in the test setup" only moves the failure
 * to whoever forgets. The behaviour is the same pattern Radix implements, stated here:
 *
 *   - the thumb is the control: it holds `role="slider"`, the value bounds, the accessible
 *     name and the tab stop (a name on the rail would name a span nobody can focus);
 *   - ArrowRight/ArrowUp raise the value by one `step`, ArrowLeft/ArrowDown lower it,
 *     PageUp/PageDown move ten, Home and End go to the ends — all clamped to `[min, max]`;
 *   - the value is never invented: a slider given `value` is controlled and only reports; one
 *     given neither `value` nor `defaultValue` starts at its own minimum, because a slider
 *     with no value has no thumb and no thumb has nothing to focus.
 *
 * The pointer half reads the rail's box. Where there is no layout to read — jsdom again — a
 * press is ignored rather than committing a value computed from a zero-width rail.
 */
import { forwardRef, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactElement } from 'react';
import { cx } from './class-names';

/** Which way the rail runs. Horizontal unless a screen says otherwise. */
export type SliderOrientation = 'horizontal' | 'vertical';

/** One value, or several — a range slider is a slider with two thumbs (R-UI-010). */
export type SliderValue = number | readonly number[];

export interface SliderProps {
  /** The values the screen holds. Given, the slider only reports; the screen decides. */
  readonly value?: SliderValue;
  /** Where an uncontrolled slider starts. Defaults to `min`. */
  readonly defaultValue?: SliderValue;
  /** Told what the user asked for, in the same shape Radix's sliders report: an array. */
  readonly onValueChange?: (next: number[]) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
  readonly orientation?: SliderOrientation;
  /** The thumb's accessible name (R-UI-012). */
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly className?: string;
}

const HORIZONTAL: SliderOrientation = 'horizontal';

/** How far PageUp and PageDown move, in steps — the WAI-ARIA slider pattern's "large step". */
const PAGE = 10;

/** A slider always has a value: given none, it stands at its minimum (see the file header). */
function held(given: SliderValue | undefined, floor: number): number[] {
  if (given === undefined) return [floor];
  if (typeof given === 'number') return [given];
  return given.length === 0 ? [floor] : [...given];
}

/**
 * The number of decimals a step implies, so that ten presses of `0.1` land on `1` rather than
 * on `0.9999999999999999` — a decimal string committed off that would be a B-07 defect.
 */
function decimals(step: number): number {
  const written = String(step);
  const point = written.indexOf('.');
  return point === -1 ? 0 : written.length - point - 1;
}

export const Slider = forwardRef<HTMLSpanElement, SliderProps>(function Slider(
  {
    value,
    defaultValue,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    orientation = HORIZONTAL,
    'aria-label': name,
    'aria-labelledby': namedBy,
    className,
  },
  ref,
) {
  const [own, setOwn] = useState<number[]>(() => held(defaultValue, min));
  const rail = useRef<HTMLSpanElement>(null);
  const thumbs = useRef<(HTMLSpanElement | null)[]>([]);
  /** Which thumb the pointer is dragging, or none. */
  const dragging = useRef<number | null>(null);

  const controlled = value !== undefined;
  const values = controlled ? held(value, min) : own;
  const places = decimals(step);
  const span = max - min;

  /** Onto the step grid, inside the bounds, without the float dust a repeated add leaves. */
  const settle = (raw: number): number => {
    const stepped = min + Math.round((raw - min) / step) * step;
    return Number(Math.min(Math.max(stepped, min), max).toFixed(places));
  };

  /** Where a value sits along the rail, as a percentage. A zero span puts everything at 0. */
  const along = (at: number): number => (span === 0 ? 0 : ((at - min) / span) * 100);

  const commit = (index: number, next: number): void => {
    const settled = settle(next);
    if (values[index] === settled) return;
    // A thumb may not pass its neighbours: the values a range slider reports stay in order.
    const lower = index === 0 ? min : (values[index - 1] ?? min);
    const upper = index === values.length - 1 ? max : (values[index + 1] ?? max);
    const bounded = Math.min(Math.max(settled, lower), upper);
    const proposed = values.map((current, at) => (at === index ? bounded : current));
    if (!controlled) setOwn(proposed);
    onValueChange?.(proposed);
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLSpanElement>): void => {
    if (disabled) return;
    const at = values[index] ?? min;
    const moved = ((): number | null => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          return at + step;
        case 'ArrowLeft':
        case 'ArrowDown':
          return at - step;
        case 'PageUp':
          return at + step * PAGE;
        case 'PageDown':
          return at - step * PAGE;
        case 'Home':
          return min;
        case 'End':
          return max;
        default:
          return null;
      }
    })();
    if (moved === null) return;
    // The keys this control answers are its own: an ArrowDown here must not also scroll the
    // page, and a Home must not jump the document to its top.
    event.preventDefault();
    commit(index, moved);
  };

  /** The value under the pointer, or nothing where there is no rail to measure. */
  const under = (event: PointerEvent<HTMLSpanElement>): number | null => {
    const box = rail.current?.getBoundingClientRect();
    if (box === undefined) return null;
    const length = orientation === HORIZONTAL ? box.width : box.height;
    if (length === 0) return null;
    const fraction =
      orientation === HORIZONTAL
        ? (event.clientX - box.left) / length
        : (box.bottom - event.clientY) / length;
    return settle(min + fraction * span);
  };

  /** The thumb nearest a value — the one a press on the rail picks up. */
  const nearest = (to: number): number => {
    let closest = 0;
    for (const [index, current] of values.entries()) {
      if (Math.abs(current - to) < Math.abs((values[closest] ?? min) - to)) closest = index;
    }
    return closest;
  };

  const onPointerDown = (event: PointerEvent<HTMLSpanElement>): void => {
    if (disabled) return;
    const to = under(event);
    if (to === null) return;
    const index = nearest(to);
    dragging.current = index;
    thumbs.current[index]?.focus();
    commit(index, to);
  };

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>): void => {
    const index = dragging.current;
    if (index === null) return;
    const to = under(event);
    if (to === null) return;
    commit(index, to);
  };

  const release = (): void => {
    dragging.current = null;
  };

  const lower = values.length > 1 ? Math.min(...values) : min;
  const upper = values.length > 1 ? Math.max(...values) : (values[0] ?? min);
  const rangeStyle: CSSProperties =
    orientation === HORIZONTAL
      ? { left: `${String(along(lower))}%`, width: `${String(along(upper) - along(lower))}%` }
      : { bottom: `${String(along(lower))}%`, height: `${String(along(upper) - along(lower))}%` };

  return (
    <span
      ref={ref}
      className={cx('datum-slider', className)}
      data-orientation={orientation}
      data-disabled={disabled ? '' : undefined}
    >
      <span
        ref={rail}
        className="datum-slider-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className="datum-slider-range" style={rangeStyle} />
        {values.map((at, index): ReactElement => {
          const position: CSSProperties =
            orientation === HORIZONTAL
              ? { left: `${String(along(at))}%` }
              : { bottom: `${String(along(at))}%` };
          return (
            <span
              key={index}
              ref={(node) => {
                thumbs.current[index] = node;
              }}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label={name}
              aria-labelledby={namedBy}
              aria-orientation={orientation}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={at}
              aria-disabled={disabled ? true : undefined}
              data-disabled={disabled ? '' : undefined}
              className={cx('datum-slider-thumb', 'datum-focus-ring')}
              style={position}
              onKeyDown={onKeyDown(index)}
            />
          );
        })}
      </span>
    </span>
  );
});
