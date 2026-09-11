"use client";
/**
 * NumberInput — a figure a person types, in the face a figure is read in (Design Direction 00 §5:
 * mono, tabular, right-aligned) and with no spinner chrome at all.
 *
 * `type="number"` is refused on purpose: it paints the platform's spinner buttons on a 28 px
 * control, it silently drops what it cannot parse (so the reader's own keystrokes vanish), and it
 * rounds. This takes and gives a STRING — B-07 keeps a figure a person entered off floats end to
 * end — and touches the text only where the reader asked for a step: ↑ and ↓ move by `step` and
 * the result is clamped to `[min, max]`, exactly as a spinner would, without the chrome.
 */
import { useId, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./class-names";

export interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
  "data-testid"?: string;
}

/** The figure the arrows move from, and `null` for text that is not a figure at all. */
function figureOf(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A stepped figure written back the way a person writes one: no exponent, no trailing zeros. */
function spell(figure: number, step: number): string {
  const places = (String(step).split(".")[1] ?? "").length;
  return places === 0 ? String(figure) : figure.toFixed(places);
}

/** The value a step lands on, held inside the bounds the caller stated (L-FMT-02's spirit). */
export function stepValue(value: string, direction: 1 | -1, step: number, min?: number, max?: number): string {
  const from = figureOf(value);
  const next = (from ?? 0) + direction * step;
  const held = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next));
  return spell(held, step);
}

/** The value a blur settles on: inside the bounds, or exactly what was typed when it is no figure. */
export function clampValue(value: string, min?: number, max?: number): string {
  const figure = figureOf(value);
  if (figure === null) return value;
  const held = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, figure));
  return held === figure ? value : String(held);
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  disabled = false,
  id,
  name,
  placeholder,
  className,
  "data-testid": testId,
  ...labelling
}: NumberInputProps): ReactNode {
  const generated = useId();
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    onChange(stepValue(value, event.key === "ArrowUp" ? 1 : -1, step, min, max));
  };

  return (
    <input
      {...labelling}
      id={id ?? generated}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      role="spinbutton"
      aria-valuenow={figureOf(value) ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={value === "" ? undefined : value}
      className={cx("cx-input", "cx-reticle", "cx-number-input", className)}
      data-testid={testId}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        const held = clampValue(value, min, max);
        if (held !== value) onChange(held);
      }}
    />
  );
}
