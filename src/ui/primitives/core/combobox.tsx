"use client";
/**
 * Combobox — a Select whose list can be filtered, in the two skins the direction asks for:
 *
 *  - `field`: the control reads like an Input, for a long roster in a form.
 *  - `chip`: the filter bar's `Label · Value ▾` (Design Direction 00 §3.2). A filter is a chip,
 *    never a labelled dropdown row — the label rides INSIDE the control, and the bar stays 36 px.
 *
 * Both skins open the same popover: a filter field and the listbox under it. The filter field holds
 * DOM focus while it is open — it is what a reader is typing into — and the cursor inside the list
 * travels as `aria-activedescendant`, so ↑ ↓ Home End and Enter work while the query is being
 * written (R-UI-012). Esc closes and the value stands.
 *
 * The keyboard and the filtering are the listbox engine's, not this file's (B-17): a Combobox that
 * disagreed with a Select about what ↓ does would be two controls, not one idea.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./class-names";
import { IconChevronDown } from "../../icons";
import { strings } from "../../strings";
import {
  NO_OPTION,
  filterOptions,
  firstChoosable,
  indexOfValue,
  lastChoosable,
  optionId,
  step,
  type ListboxOption,
} from "./listbox";

export type ComboboxOption = ListboxOption;

export interface ComboboxProps {
  options: readonly ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** The word the chip wears before its value: `Class · All ▾` (§3.2). Required in the chip skin. */
  label?: string;
  /** What the control reads when the value names no option — "All", "Any level", the roster's own. */
  placeholder?: string;
  variant?: "field" | "chip";
  filterPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder,
  variant = "field",
  filterPlaceholder,
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: ComboboxProps): ReactNode {
  const generated = useId();
  const listId = `${id ?? generated}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(NO_OPTION);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  const shown = filterOptions(options, query);
  const chosen = indexOfValue(options, value);
  const chosenOption = chosen === NO_OPTION ? undefined : options[chosen];
  const reads = chosenOption?.label ?? placeholder ?? strings.primitive_select_placeholder;

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // The field is what a reader types into, so opening the list puts them in it.
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  const close = useCallback((): void => {
    setOpen(false);
    setQuery("");
    setActive(NO_OPTION);
  }, []);

  const take = useCallback(
    (at: number): void => {
      const option = shown[at];
      if (option === undefined || option.disabled === true) return;
      onChange(option.value);
      close();
    },
    [close, onChange, shown],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => step(shown, at, key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (key === "Home" || key === "End") {
      event.preventDefault();
      setActive(key === "Home" ? firstChoosable(shown) : lastChoosable(shown));
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      take(active === NO_OPTION ? firstChoosable(shown) : active);
    }
  };

  return (
    <div className={cx("cx-combobox", className)} ref={root} data-variant={variant} data-open={open || undefined}>
      <button
        type="button"
        id={id}
        className={cx(variant === "chip" ? "cx-chip cx-combobox-chip" : "cx-combobox-trigger", "cx-reticle")}
        data-testid={testId}
        data-chosen={chosenOption === undefined ? undefined : "true"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel ?? (label === undefined ? undefined : `${label} ${reads}`)}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {label === undefined ? null : (
          <>
            <span className="cx-combobox-label">{label}</span>
            <span className="cx-combobox-separator" aria-hidden="true">
              {strings.primitive_combobox_chip_separator}
            </span>
          </>
        )}
        <span className="cx-combobox-value">{reads}</span>
        <IconChevronDown size="sm" className="cx-combobox-caret" />
      </button>

      {open ? (
        <div className="cx-combobox-popover">
          <input
            ref={field}
            type="text"
            role="combobox"
            className="cx-input cx-reticle cx-combobox-filter"
            data-testid={testId === undefined ? undefined : `${testId}-filter`}
            aria-label={filterPlaceholder ?? strings.primitive_combobox_filter_placeholder}
            aria-autocomplete="list"
            aria-expanded={true}
            aria-controls={listId}
            aria-activedescendant={active === NO_OPTION ? undefined : optionId(listId, active)}
            placeholder={filterPlaceholder ?? strings.primitive_combobox_filter_placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(NO_OPTION);
            }}
            onKeyDown={onKeyDown}
          />
          {shown.length === 0 ? (
            <p className="cx-combobox-none" data-testid={testId === undefined ? undefined : `${testId}-none`}>
              {strings.primitive_combobox_no_matches}
            </p>
          ) : (
            <ul className="cx-listbox" id={listId} role="listbox" data-testid={testId === undefined ? undefined : `${testId}-listbox`}>
              {shown.map((option, at) => (
                <li
                  key={option.value}
                  id={optionId(listId, at)}
                  role="option"
                  className="cx-listbox-option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  data-active={at === active || undefined}
                  data-value={option.value}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => take(at)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
