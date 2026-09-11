"use client";
/**
 * Select (Design Direction 00 §1: "no native `<select>`"). A button that says what is chosen, and a
 * listbox popover that says what else there is.
 *
 * Why not the native control: it cannot be drawn. A native `<select>` renders its popup with the
 * platform's own chrome — its own type face, its own row height, its own scrollbar and its own idea
 * of a focus ring — so on the one screen a QS spends the day in, the control that sets a role or a
 * unit is the one thing that does not look like the instrument. Everything else about it is kept:
 * the button IS the control (`role="combobox"`, R-UI-012), the options are a real `listbox`, the
 * keyboard is the platform's — ↑ ↓ Home End, type-ahead, Enter to take, Esc to leave it alone — and
 * DOM focus never moves off the button, so the reticle stays where the reader put it and the
 * cursor inside the list travels as `aria-activedescendant`.
 *
 * The popover is rendered inline rather than portalled, and positioned against the control's own
 * box. A portal is what an overlay needs when it must escape a clipping ancestor; this one is
 * 28 px under a 28 px control and the surfaces it stands in — a filter bar, a settings row, a
 * toolbar — own their own stacking. It carries `--z-overlay` for the rest.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cx } from "./class-names";
import { IconChevronDown } from "../../icons";
import { strings } from "../../strings";
import {
  NO_OPTION,
  firstChoosable,
  indexOfValue,
  isTypeAheadKey,
  lastChoosable,
  optionId,
  step,
  typeAhead,
  type ListboxOption,
} from "./listbox";

/** What a Select offers: the value it commits, the words it is read by, and whether it is takeable. */
export type SelectOption = ListboxOption;

export interface SelectProps {
  options: readonly SelectOption[];
  /** The chosen value. A value the options do not hold shows the placeholder — never a blank box. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  /** The trigger itself, for a consumer that must put focus back on this control (R-UI-012). */
  ref?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "data-testid"?: string;
}

/** How long a type-ahead buffer stands before the next keystroke starts a new word (ms). */
const TYPE_AHEAD_WINDOW = 500;

export function Select({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
  name,
  className,
  ref,
  "data-testid": testId,
  ...labelling
}: SelectProps): ReactNode {
  const generated = useId();
  const listId = `${id ?? generated}-listbox`;
  const [open, setOpen] = useState(false);
  const chosen = indexOfValue(options, value);
  const [active, setActive] = useState(chosen);
  const root = useRef<HTMLDivElement>(null);
  const buffer = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  // A click anywhere else is a decision not to choose: the list closes and the value stands.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const openAt = useCallback(
    (at: number): void => {
      setActive(at === NO_OPTION ? firstChoosable(options) : at);
      setOpen(true);
    },
    [options],
  );

  const take = useCallback(
    (at: number): void => {
      const option = options[at];
      if (option === undefined || option.disabled === true) return;
      onChange(option.value);
      setActive(at);
      setOpen(false);
    },
    [onChange, options],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const key = event.key;
    if (key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (key === "Tab") {
      setOpen(false);
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      const direction = key === "ArrowDown" ? 1 : -1;
      if (!open) openAt(chosen === NO_OPTION ? NO_OPTION : chosen);
      else setActive((at) => step(options, at, direction));
      return;
    }
    if (key === "Home" || key === "End") {
      if (!open) return;
      event.preventDefault();
      setActive(key === "Home" ? firstChoosable(options) : lastChoosable(options));
      return;
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (!open) openAt(chosen);
      else if (active !== NO_OPTION) take(active);
      return;
    }
    if (isTypeAheadKey(key)) {
      const now = Date.now();
      const text = now - buffer.current.at > TYPE_AHEAD_WINDOW ? key : `${buffer.current.text}${key}`;
      buffer.current = { text, at: now };
      const found = typeAhead(options, text, open ? active : chosen);
      if (found === NO_OPTION) return;
      event.preventDefault();
      if (open) setActive(found);
      else take(found);
    }
  };

  const chosenOption = chosen === NO_OPTION ? undefined : options[chosen];

  return (
    <div className={cx("cx-select", className)} ref={root} data-open={open || undefined}>
      {name === undefined ? null : <input type="hidden" name={name} value={value} />}
      <button
        {...labelling}
        ref={ref}
        type="button"
        id={id}
        role="combobox"
        className="cx-select-trigger cx-reticle"
        data-testid={testId}
        data-placeholder={chosenOption === undefined || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active !== NO_OPTION ? optionId(listId, active) : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(chosen))}
        onKeyDown={onKeyDown}
      >
        <span className="cx-select-value">{chosenOption?.label ?? placeholder ?? strings.primitive_select_placeholder}</span>
        <IconChevronDown size="sm" className="cx-select-caret" />
      </button>
      {open ? (
        <ul className="cx-listbox" id={listId} role="listbox" data-testid={testId === undefined ? undefined : `${testId}-listbox`}>
          {options.map((option, at) => (
            <li
              key={option.value}
              id={optionId(listId, at)}
              role="option"
              className="cx-listbox-option"
              aria-selected={at === chosen}
              aria-disabled={option.disabled || undefined}
              data-active={at === active || undefined}
              data-value={option.value}
              // A pointer press must not move focus off the button that owns the cursor.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => take(at)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
