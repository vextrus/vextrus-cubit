/**
 * Checkbox, Radio/RadioGroup and Switch — the controls that hold a choice (R-UI-010,
 * R-UI-012).
 *
 * Restyled over Radix, which owns the roles, the checked state and the hidden form input.
 * What this file adds is the Datum surface, the focus ring on the element the Tab key lands
 * on, and two keyboard rules that are decided here rather than left to a library's internal
 * timing:
 *
 *   - **A radio group's arrows both move and choose.** In a radio group the roving focus *is*
 *     the choice (WAI-ARIA's automatic-selection radiogroup), so ArrowDown moves the focus to
 *     the next radio and checks it in the same keystroke. It is done on the item's own keydown
 *     — synchronously, off the event that started the move — so it does not depend on when a
 *     focus lands or on a document-level flag a synthetic key press has already cleared.
 *   - **A switch toggles on Space.** A browser turns Space on a `<button>` into a click, and
 *     Radix toggles on the click; a DOM driver that sends the keydown alone does not. So the
 *     keydown toggles, and the click a browser synthesises afterwards is swallowed — one press
 *     is one toggle, whichever of the two the caller's environment sends.
 *
 * The Slider lives in slider.tsx: it is the one control here that Radix cannot mount without
 * layout, and the reason is written there.
 */
import { forwardRef, useRef } from 'react';
import type { ComponentPropsWithoutRef, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import {
  Checkbox as CheckboxPrimitive,
  RadioGroup as RadioGroupPrimitive,
  Switch as SwitchPrimitive,
} from 'radix-ui';
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
  return (
    <RadioGroupPrimitive.Root ref={ref} className={cx('datum-radio-group', className)} {...rest} />
  );
});

export type RadioProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>;

/** How far each arrow moves the choice inside a group. */
const ROVING: Readonly<Record<string, number>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

/** The radios of the group an item belongs to, in document order, skipping the disabled. */
function siblingsOf(item: HTMLElement): HTMLElement[] {
  const group = item.closest('[role="radiogroup"]') ?? item.ownerDocument.body;
  return [...group.querySelectorAll<HTMLElement>('[role="radio"]')].filter(
    (radio) => !radio.hasAttribute('disabled') && radio.getAttribute('aria-disabled') !== 'true',
  );
}

export const Radio = forwardRef<HTMLButtonElement, RadioProps>(function Radio(
  { className, onKeyDown, ...rest },
  ref,
) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cx('datum-control', 'datum-radio', 'datum-focus-ring', className)}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        const step = ROVING[event.key];
        if (step === undefined || event.defaultPrevented) return;

        const radios = siblingsOf(event.currentTarget);
        const at = radios.indexOf(event.currentTarget);
        if (at === -1 || radios.length === 0) return;
        const next = radios[(at + step + radios.length) % radios.length];
        if (next === undefined) return;

        // Ours to answer: preventing the default also stops Radix's own roving focus from
        // moving a second time behind this one.
        event.preventDefault();
        next.focus();
        // Click rather than lift the value ourselves, so Radix's check path runs and an
        // uncontrolled group, a controlled one and `onValueChange` all stay in step.
        if (next.getAttribute('aria-checked') !== 'true') next.click();
      }}
      {...rest}
    >
      <RadioGroupPrimitive.Indicator className="datum-radio-indicator" />
    </RadioGroupPrimitive.Item>
  );
});

export type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

/** The key that toggles a switch (WAI-ARIA's switch pattern), spelt as the DOM spells it. */
const SPACE = ' ';

/**
 * A click carries the number of times the pointer was pressed; a click a browser synthesised
 * from a key press carries zero. That is how the toggle below tells its own key press from a
 * real one without asking what test driver is running.
 */
const FROM_A_KEY = 0;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, onKeyDown, onClick, onPointerDown, ...rest },
  ref,
) {
  /** A Space this control has already answered, whose synthesised click is still to come. */
  const answered = useRef(false);
  /** True only while the toggle below is dispatching its own click. */
  const ours = useRef(false);

  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cx('datum-control', 'datum-switch', 'datum-focus-ring', className)}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        if (event.key !== SPACE) {
          answered.current = false;
          return;
        }
        if (event.defaultPrevented) return;
        // Space on a control must not scroll the page, and Radix must not see this key twice.
        event.preventDefault();
        const control = event.currentTarget;
        ours.current = true;
        control.click();
        ours.current = false;
        answered.current = true;
      }}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (ours.current || !answered.current || event.detail !== FROM_A_KEY) return;
        // The browser's echo of a Space this control already answered: one press, one toggle.
        answered.current = false;
        event.preventDefault();
      }}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        onPointerDown?.(event);
        answered.current = false;
      }}
      {...rest}
    >
      <SwitchPrimitive.Thumb className="datum-switch-thumb" />
    </SwitchPrimitive.Root>
  );
});
