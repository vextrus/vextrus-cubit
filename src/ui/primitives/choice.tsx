/**
 * Checkbox, Radio/RadioGroup, Switch and Slider — the controls that hold a choice
 * (R-UI-010, R-UI-012).
 *
 * Restyled over Radix, which owns the roles, the checked state and the roving focus of a
 * radio group. What this file adds is the Datum surface and one rule the restyle must not
 * lose: the focus ring goes on the element the Tab key actually lands on. For a Slider that
 * is the thumb, not the root — which is also why the thumb is where the accessible name is
 * put, since a name on the root would name a `<span>` nobody can focus.
 */
import { forwardRef, useRef } from 'react';
import type { ComponentPropsWithoutRef, FocusEvent, KeyboardEvent, PointerEvent } from 'react';
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioGroupPrimitive, Slider as SliderPrimitive, Switch as SwitchPrimitive } from 'radix-ui';
import { cx } from './class-names';

export type CheckboxProps = ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { className, ...rest },
  ref,
) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cx('datum-control', 'datum-checkbox', 'datum-focus-ring', className)}
      {...rest}
    >
      <CheckboxPrimitive.Indicator className="datum-checkbox-indicator" />
    </CheckboxPrimitive.Root>
  );
});

export type RadioGroupProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;

/** The keys that move the roving focus inside a radio group (WAI-ARIA radiogroup pattern). */
const ROVING_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  { className, onKeyDown, onFocus, onPointerDown, ...rest },
  ref,
) {
  // Selection follows the arrows: in a radio group the roving focus *is* the choice, so
  // ArrowDown both moves and selects. Radix means to do this too, but decides inside a
  // document-level keyup flag that a synthetic key press clears before its own focus timer
  // fires — so the arrow moves and nothing is chosen. Deciding it here, off the keydown that
  // started the move, does not depend on when the focus lands.
  const arrowed = useRef(false);

  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cx('datum-radio-group', className)}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        if (ROVING_KEYS.has(event.key)) arrowed.current = true;
      }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        // A click or a Tab into the group reads it; only an arrow chooses.
        arrowed.current = false;
      }}
      onFocus={(event: FocusEvent<HTMLDivElement>) => {
        onFocus?.(event);
        if (!arrowed.current) return;
        arrowed.current = false;
        const item = event.target as HTMLElement;
        if (item.getAttribute('role') === 'radio' && item.getAttribute('aria-checked') !== 'true') {
          // Click rather than lift the value ourselves, so Radix's own check path runs and an
          // uncontrolled group and its onValueChange stay in step.
          item.click();
        }
      }}
      {...rest}
    />
  );
});

export type RadioProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>;

export const Radio = forwardRef<HTMLButtonElement, RadioProps>(function Radio(
  { className, ...rest },
  ref,
) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cx('datum-control', 'datum-radio', 'datum-focus-ring', className)}
      {...rest}
    >
      <RadioGroupPrimitive.Indicator className="datum-radio-indicator" />
    </RadioGroupPrimitive.Item>
  );
});

export type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, ...rest },
  ref,
) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cx('datum-control', 'datum-switch', 'datum-focus-ring', className)}
      {...rest}
    >
      <SwitchPrimitive.Thumb className="datum-switch-thumb" />
    </SwitchPrimitive.Root>
  );
});

export type SliderProps = ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

export const Slider = forwardRef<HTMLSpanElement, SliderProps>(function Slider(
  // The name is taken off the root on purpose and put on the thumb below: the thumb is the
  // element with role="slider" and the one a Tab reaches, so it is the one R-UI-012 names.
  { className, 'aria-label': name, ...rest },
  ref,
) {
  // Radix draws one thumb per value it holds. A slider given neither `value` nor
  // `defaultValue` holds none, and a slider with no thumb has nothing to focus — so an
  // uncontrolled one starts at its own minimum rather than at nothing.
  const uncontrolled = rest.value === undefined && rest.defaultValue === undefined;
  const start = uncontrolled ? { defaultValue: [rest.min ?? 0] } : {};

  return (
    <SliderPrimitive.Root ref={ref} className={cx('datum-slider', className)} {...start} {...rest}>
      <SliderPrimitive.Track className="datum-slider-track">
        <SliderPrimitive.Range className="datum-slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={name}
        className={cx('datum-slider-thumb', 'datum-focus-ring')}
      />
    </SliderPrimitive.Root>
  );
});
