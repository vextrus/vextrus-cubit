"use client";
/**
 * Checkbox — the native `<input type="checkbox">`, kept as the control and painted over.
 *
 * The input is what the platform, the form and every assistive technology already agree on: it is
 * in the tab order, Space toggles it, a label points at it, and a form serialises it. What the
 * platform cannot do is draw it at this instrument's hairline weight, so the input itself is made
 * invisible IN PLACE — never `display: none`, which would take it out of the tab order — and the
 * box beside it is the drawing. The tick is the vendored `check` glyph, so the mark is the same
 * mark the rest of the product uses (Design Direction 00 §1 "Iconography").
 */
import { useId, type ChangeEvent, type ReactNode } from "react";
import { cx } from "./class-names";
import { IconCheck } from "../../icons";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The words beside the box. A checkbox with no label is named by the consumer's `aria-label`. */
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  name,
  className,
  "data-testid": testId,
  ...labelling
}: CheckboxProps): ReactNode {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <span className={cx("cx-checkbox", className)} data-checked={checked || undefined}>
      <input
        {...labelling}
        id={fieldId}
        name={name}
        type="checkbox"
        className="cx-checkbox-input cx-reticle"
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
      />
      <span className="cx-checkbox-box" aria-hidden="true">
        {checked ? <IconCheck size="sm" className="cx-checkbox-mark" /> : null}
      </span>
      {label === undefined ? null : (
        <label className="cx-checkbox-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
    </span>
  );
}
