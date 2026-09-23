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
 * The popover is positioned against the control's own box and stands below it, on the overlay
 * layer: a consumer that puts the control in a CLIPPING box cuts the list off (s-takeoff
 * I-442 — the register's 36 px filter bar did, and a click on a chip showed an empty filter
 * field and no option). Four facts close the loop (s-takeoff I-443): taking an option or Esc
 * hands focus back to the control, so the reader stands where they left rather than at the top of
 * the document; focus that leaves the control — Tab's own step, Shift+Tab onto the control — closes
 * the popover, as the Select's Tab does, so no list is left standing over the page behind the
 * reader and the scrolling list is never a stop of its own, while a press inside the popover keeps
 * focus in the field; a press anywhere else closes it the same way Esc does, so the next opening
 * starts from an empty query; and the cursor the arrows move is kept in the list's view, so the
 * tenth option of a list that shows nine is never a cursor nobody can see.
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
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const shown = filterOptions(options, query);
  const chosen = indexOfValue(options, value);
  const chosenOption = chosen === NO_OPTION ? undefined : options[chosen];
  const reads = chosenOption?.label ?? placeholder ?? strings.primitive_select_placeholder;

  const close = useCallback((): void => {
    setOpen(false);
    setQuery("");
    setActive(NO_OPTION);
  }, []);

  // A press anywhere else is a decision not to choose: the list closes as Esc closes it, query and
  // all (I-443). Closing it with the query standing reopened the chip on a list the reader had
  // narrowed and walked away from — `col` still in the field, every other class missing.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, close]);

  // The field is what a reader types into, so opening the list puts them in it.
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  // The cursor the arrows move stays in the list's view (I-443). The list shows nine rows and
  // scrolls past them, and `aria-activedescendant` scrolls nothing of its own: without this the tenth
  // level of a building was a cursor standing below the list's edge, taken on Enter unseen. `nearest`
  // moves nothing while the option is already in view.
  useEffect(() => {
    if (!open || active === NO_OPTION) return;
    document.getElementById(optionId(listId, active))?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  // A list closed by the reader's own hand — an option taken, Esc — hands focus back to the control
  // it was opened from (I-443): the field it held is about to leave the document, and focus
  // that left with it would drop the reader at the top of the page.
  const closeToControl = useCallback((): void => {
    close();
    trigger.current?.focus();
  }, [close]);

  const take = useCallback(
    (at: number): void => {
      const option = shown[at];
      if (option === undefined || option.disabled === true) return;
      onChange(option.value);
      closeToControl();
    },
    [closeToControl, onChange, shown],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      closeToControl();
      return;
    }
    if (key === "Tab" && event.shiftKey) {
      // The stop before the field is the control itself: land there and take the list with it.
      // Tab forward is the browser's own step, and the field's blur below closes the list behind it.
      event.preventDefault();
      closeToControl();
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
        ref={trigger}
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
        <div
          className="cx-combobox-popover"
          // A press inside the popover must not take focus out of the field: an option, the padding
          // round the list, the gap above it, the no-matches line — each would otherwise blur the
          // field onto nothing, and the blur below closes the list before an option's click lands.
          // Two presses are the browser's to finish: in the field (it places the caret) and on the
          // list's own box (its scrollbar, which a cancelled press would not drag).
          onPointerDown={(event) => {
            if (event.target !== field.current && event.target !== list.current) event.preventDefault();
          }}
        >
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
            // Focus that leaves the control — Tab's own step to the next stop, a press on another
            // control — takes the list with it (I-443); focus that stays inside it (an option
            // taken hands it to the chip) leaves the closing to whoever moved it. Closing here rather
            // than in the Tab keydown keeps the field in the document until the browser has stepped
            // off it, so the step starts from the field and not from a node already removed.
            onBlur={(event) => {
              const to = event.relatedTarget;
              if (to instanceof Node && root.current?.contains(to) === true) return;
              close();
            }}
          />
          {shown.length === 0 ? (
            <p className="cx-combobox-none" data-testid={testId === undefined ? undefined : `${testId}-none`}>
              {strings.primitive_combobox_no_matches}
            </p>
          ) : (
            // `tabIndex={-1}`: a list longer than nine rows scrolls, and a browser makes a scroll box a
            // Tab stop of its own — which put a stop between the field and the next control that holds
            // no option a key can take. The cursor is the field's, so the list is never a stop.
            <ul
              ref={list}
              className="cx-listbox"
              id={listId}
              role="listbox"
              tabIndex={-1}
              data-testid={testId === undefined ? undefined : `${testId}-listbox`}
            >
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
