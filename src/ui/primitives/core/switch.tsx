"use client";
/**
 * Switch — a setting that takes effect as it is thrown, not one that waits for a Save.
 *
 * It is a `role="switch"` button rather than a checkbox because the difference is real: a checkbox
 * states an intention a form will later act on, a switch IS the act. The two never mean the same
 * thing on a screen, and a reader hears which one they met (Q-11). Where the act is consequential
 * the switch is not the control at all — that is a ConsequenceDialog (R-UI-023).
 */
import { useId, type ReactNode } from "react";
import { cx } from "./class-names";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className,
  "data-testid": testId,
  ...labelling
}: SwitchProps): ReactNode {
  const generated = useId();
  const controlId = id ?? generated;
  const labelId = label === undefined ? undefined : `${controlId}-label`;
  return (
    <span className={cx("cx-switch", className)} data-checked={checked || undefined}>
      <button
        {...labelling}
        type="button"
        id={controlId}
        role="switch"
        className="cx-switch-track cx-reticle"
        data-testid={testId}
        aria-checked={checked}
        aria-labelledby={labelling["aria-label"] === undefined ? labelId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="cx-switch-thumb" aria-hidden="true" />
      </button>
      {label === undefined ? null : (
        <span className="cx-switch-label" id={labelId}>
          {label}
        </span>
      )}
    </span>
  );
}
