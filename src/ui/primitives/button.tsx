/**
 * Button and IconButton (R-UI-010, R-UI-012).
 *
 * R-UI-010: "Button (primary/secondary/ghost/danger; loading; icon), IconButton".
 *
 * Two decisions worth stating:
 *
 *   1. A loading button is `aria-busy` and refuses to activate, but it stays in the tab
 *      order. `disabled` would take it out, and a control that vanishes from the keyboard
 *      mid-act is how a keyboard user loses their place; `aria-disabled` says the same thing
 *      to assistive technology while the guard below makes it true for everyone. Blocking the
 *      second activation is the point: every act in CUBIT is a document, and a double click
 *      on a slow submit writes two.
 *   2. IconButton takes `label` as a required prop rather than an optional `aria-label`. An
 *      icon-only control is the commonest way to ship an unnamed button (R-UI-012), and a
 *      required prop is the only version of that rule the compiler enforces.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './class-names';

/** The four Datum buttons. The stylesheet selects on `data-variant`; nothing here paints. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Which of the four (R-UI-010). `primary` when nothing says otherwise. */
  readonly variant?: ButtonVariant;
  /** An act is in flight: announced `aria-busy`, and a second activation is refused. */
  readonly loading?: boolean;
  /** A leading glyph, rendered inside the button beside its label. */
  readonly icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, icon, className, children, onClick, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // A button inside a form submits it unless it says otherwise, and a primitive that
      // submits by accident is a document written by accident.
      type={type ?? 'button'}
      data-variant={variant}
      data-loading={loading ? '' : undefined}
      aria-busy={loading ? true : undefined}
      aria-disabled={loading ? true : undefined}
      className={cx('datum-control', 'datum-button', 'datum-focus-ring', className)}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {icon === undefined ? null : <span className="datum-button-icon">{icon}</span>}
      {children}
      {loading ? <span className="datum-button-busy" aria-hidden="true" /> : null}
    </button>
  );
});

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  /** The control's name, rendered as its `aria-label` (R-UI-012). Required, deliberately. */
  readonly label: string;
  /** The glyph the button shows instead of that name. */
  readonly icon: ReactNode;
  readonly variant?: ButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      data-variant={variant}
      className={cx('datum-control', 'datum-button', 'datum-icon-button', 'datum-focus-ring', className)}
      {...rest}
      // After the spread, not before: `aria-label` is off the prop type, but a caller reaching
      // past it must not be able to overwrite the one name this control is required to have.
      aria-label={label}
    >
      {icon}
    </button>
  );
});
