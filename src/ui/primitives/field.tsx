'use client';

import * as Label from '@radix-ui/react-label';
import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * A labelled input. The label is a real `<label for>` (R-UI-012: everything is
 * ARIA-labelled and keyboard reachable), the hint is wired through
 * `aria-describedby`, and the test id lands on the input itself so a journey
 * never selects by prose.
 */
export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  testId: string;
}

export function Field({ label, hint, testId, className, ...props }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="field">
      <Label.Root className="field-label" htmlFor={id}>
        {label}
      </Label.Root>
      <input
        id={id}
        data-testid={testId}
        className={cn('input', className)}
        {...(hint === undefined ? {} : { 'aria-describedby': hintId })}
        {...props}
      />
      {hint === undefined ? null : (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
