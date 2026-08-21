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
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
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

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  { className, ...rest },
  ref,
) {
  return <RadioGroupPrimitive.Root ref={ref} className={cx('datum-radio-group', className)} {...rest} />;
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
