/**
 * Input and Textarea — the two plain text fields (R-UI-010).
 *
 * They add exactly two things to the native element: the Datum field surface and the focus
 * ring (R-UI-012). Everything else — `aria-label`, `name`, `disabled`, `onChange` — is the
 * native prop, forwarded, because a wrapper that re-declares the platform's own vocabulary is
 * a wrapper that will disagree with it.
 */
import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from './class-names';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type ?? 'text'}
      className={cx('datum-control', 'datum-field', 'datum-focus-ring', className)}
      {...rest}
    />
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cx('datum-control', 'datum-field', 'datum-textarea', 'datum-focus-ring', className)}
      {...rest}
    />
  );
});
