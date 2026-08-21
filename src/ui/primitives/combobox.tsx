/**
 * Combobox — the open picker, asked for its options (R-UI-010: "Combobox (async, keyboard)").
 *
 * Written rather than restyled: the thing that makes this a Combobox and not a Select is that
 * its options come from somewhere else, one query at a time, and that "somewhere else has not
 * answered yet" is a state the user is told about. Radix has no async listbox, so what is
 * assembled here is the ARIA 1.2 combobox pattern — an input with `role="combobox"` and
 * `aria-expanded`, a listbox it names through `aria-controls`, and `aria-activedescendant` for
 * the option the arrows are on, so the highlight moves without focus ever leaving the input.
 *
 * Three states, and they are three (R-UI-050, AM-03):
 *
 *   - loading: the loader is out. Not "no matches" — a pending request reported as an empty
 *     result is a copy defect that tells the user their search failed when it has not run.
 *   - options: what the loader resolved. This control shows what it was given and narrows
 *     nothing itself; filtering is the loader's business, which is where the data is.
 *   - empty: the loader answered, for a query, with nothing.
 *
 * Every request carries a sequence number and only the newest one may paint, so a slow answer
 * to `Ce` cannot overwrite a fast answer to `Cem`.
 *
 * The copy is the module string table's (R-SPINE-060), decided in
 * docs/design/datum-primitives.md (AM-03 (2)).
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import type { AccessibleName } from './accessible-name';
import { cx } from './class-names';
import { ts } from './strings';

/** One offered choice: the value a form commits, and the words a person reads. */
export interface ComboboxOption {
  readonly value: string;
  readonly label: string;
}

export interface ComboboxOwnProps {
  /** Asked for options whenever the query changes. Async by contract, not by accident. */
  readonly loadOptions: (query: string) => Promise<readonly ComboboxOption[]>;
  /** The committed value, if the screen holds one. */
  readonly value?: string;
  /** Asked for a change when an option is committed. */
  readonly onValueChange?: (next: string) => void;
  readonly className?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

/**
 * The field's accessible name is required, not offered (Design Decision §1: "No unnamed
 * control ships"). A Combobox has no visible text of its own to fall back on, so the type
 * makes the name a condition of mounting one.
 */
export type ComboboxProps = ComboboxOwnProps & AccessibleName;

/** Nothing is highlighted yet: the first ArrowDown moves to the first option. */
const NONE = -1;

/**
 * ARIA 1.2's value for "the suggestions arrive in the listbox this input controls". A token,
 * not copy — held in a constant because R-SPINE-060's rule reads "no string literals in JSX",
 * and the aria vocabulary is not something the string table should carry either.
 */
const AUTOCOMPLETE_LIST = 'list';

/**
 * "Announce this when nothing else is being read." Also ARIA vocabulary rather than copy: the
 * Design Decision (§7) states the pending row lives in a polite live region, and `role="status"`
 * says the same thing — both are written so neither a browser nor a reader has to infer it.
 */
const POLITE = 'polite';

export function Combobox({
  loadOptions,
  value,
  onValueChange,
  'aria-label': name,
  'aria-labelledby': namedBy,
  className,
  placeholder,
  disabled,
}: ComboboxProps): ReactElement {
  const listId = useId();
  const optionId = useId();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<readonly ComboboxOption[]>([]);
  const [active, setActive] = useState(NONE);

  /** The newest request. An older one that lands late is read and discarded. */
  const latest = useRef(0);
  /** The field and its surface, so a pointer landing elsewhere can be told from one landing here. */
  const box = useRef<HTMLDivElement>(null);
  /** Every value/label pair this control has been shown, so a held value can be read back in words. */
  const labels = useRef(new Map<string, string>());
  /** The last `value` this control put in the field: a screen echoing it back is not a change. */
  const held = useRef<string | undefined>(undefined);

  useEffect(() => {
    // The mounted control has asked nothing yet, and a listbox nobody opened shows nothing.
    return () => {
      latest.current += 1;
    };
  }, []);

  // A screen that holds the value drives the field: the committed value is shown in words when
  // this control knows them and as itself when it does not, and clearing the value clears the
  // field. A commit records what it committed, so the echo of one's own change does not retype
  // the field underneath the user.
  useEffect(() => {
    if (value === undefined) return;
    if (held.current === value) return;
    held.current = value;
    setQuery(value === '' ? '' : (labels.current.get(value) ?? value));
    setOpen(false);
    setActive(NONE);
  }, [value]);

  // The suggestions are dismissed by anything that says the user has moved on: a pointer landing
  // outside the control, or the focus leaving it. Without this the surface floats over the page
  // and the input keeps `aria-expanded="true"` long after nobody is looking at it (R-UI-012).
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event): void => {
      const target = event.target;
      if (target instanceof Node && box.current?.contains(target) === true) return;
      setOpen(false);
      setActive(NONE);
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
    };
  }, [open]);

  const ask = useCallback(
    (next: string): void => {
      latest.current += 1;
      const mine = latest.current;
      setLoading(true);
      setOptions([]);
      setActive(NONE);
      void loadOptions(next).then(
        (resolved) => {
          if (latest.current !== mine) return;
          for (const option of resolved) labels.current.set(option.value, option.label);
          setOptions(resolved);
          setLoading(false);
        },
        () => {
          // A loader that rejects has answered: the list is empty and it is no longer out.
          if (latest.current !== mine) return;
          setOptions([]);
          setLoading(false);
        },
      );
    },
    [loadOptions],
  );

  const commit = (option: ComboboxOption): void => {
    labels.current.set(option.value, option.label);
    held.current = option.value;
    setQuery(option.label);
    setOpen(false);
    setActive(NONE);
    onValueChange?.(option.value);
  };

  /**
   * An arrow on a closed field opens it, and opening it asks. The Design Decision (§7) says
   * "the list never renders silently blank": a surface opened over a loader nobody called has
   * no options, no pending row and no empty row, which is exactly that. So the first press is
   * the request — the pending row appears at once — and the next one moves the highlight.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        ask(query);
        return;
      }
      setActive((current) => (options.length === 0 ? NONE : Math.min(current + 1, options.length - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      // Both arrows open, and neither points `aria-activedescendant` at an option that is not
      // there: with nothing loaded there is nothing to highlight, so the highlight stays off.
      if (!open) {
        setOpen(true);
        ask(query);
        return;
      }
      setActive((current) => (options.length === 0 ? NONE : current <= 0 ? 0 : current - 1));
      return;
    }
    if (event.key === 'Enter') {
      const chosen = options[active];
      if (chosen === undefined) return;
      event.preventDefault();
      commit(chosen);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(NONE);
    }
  };

  // The loader has answered and answered with nothing — for a query or for an empty field
  // alike. An open surface holding neither options, nor the pending row, nor this one is the
  // silently blank list §7 forbids, so the row is not gated on anything the user typed.
  const nothingMatched = open && !loading && options.length === 0;

  return (
    <div
      ref={box}
      className={cx('datum-combobox', className)}
      onBlur={(event) => {
        // The focus left the control itself — not merely moved inside it — so the suggestions go.
        if (event.relatedTarget !== null && box.current?.contains(event.relatedTarget) === true) {
          return;
        }
        setOpen(false);
        setActive(NONE);
      }}
    >
      <input
        data-testid="combobox-input"
        role="combobox"
        aria-label={name}
        aria-labelledby={namedBy}
        aria-expanded={open ? 'true' : 'false'}
        // The listbox only exists while the surface is open, and an idref pointing at an
        // element that is not in the document is a broken reference to a screen reader and an
        // aria-valid-attr-value finding to axe (R-UI-012, Q-11).
        aria-controls={open ? listId : undefined}
        aria-autocomplete={AUTOCOMPLETE_LIST}
        aria-activedescendant={active === NONE ? undefined : `${optionId}-${String(active)}`}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        className={cx('datum-control', 'datum-field', 'datum-focus-ring')}
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          ask(next);
        }}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <div
          className="datum-popover-surface datum-combobox-popover"
          onMouseDown={(event) => {
            // Pressing an option must not take the focus off the input: ARIA 1.2 keeps it there
            // for the whole interaction, and a blur here would close the list before the click.
            event.preventDefault();
          }}
        >
          {loading ? (
            <div className="datum-combobox-status" role="status" aria-live={POLITE}>
              {ts('primitives.combobox.loading')}
            </div>
          ) : null}
          {nothingMatched ? (
            <div data-testid="combobox-empty" className="datum-combobox-status" role="status">
              {ts('primitives.combobox.empty')}
            </div>
          ) : null}
          <ul
            id={listId}
            role="listbox"
            // The list is the field's own suggestions, so it answers to the field's name
            // (R-UI-012) rather than to a second word this module would have to decide.
            aria-label={name}
            aria-labelledby={name === undefined ? namedBy : undefined}
            data-testid="combobox-list"
            className="datum-combobox-list"
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${optionId}-${String(index)}`}
                role="option"
                aria-selected={index === active}
                data-testid="combobox-option"
                data-active={index === active ? 'true' : 'false'}
                className="datum-control datum-combobox-option"
                onClick={() => {
                  commit(option);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
