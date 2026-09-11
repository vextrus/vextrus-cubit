/**
 * The one home of what a listbox DOES when a key is pressed (B-17). Select and Combobox paint
 * differently and are opened differently, but "down moves to the next option that can be chosen",
 * "Home is the first", "typing jumps to what starts with what you typed" are one behaviour, and a
 * behaviour with two implementations drifts until neither is the rule.
 *
 * Everything here is pure: options in, an index out. No DOM, no React, no timers — the surfaces own
 * their own state, and this owns the answers.
 */

/** One choosable thing: the value it commits, the words it is read by, and whether it can be taken. */
export interface ListboxOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Nothing is active. Spelled once so no surface invents its own "none" (-1 is an index, not a word). */
export const NO_OPTION = -1;

/** Can this option be taken? A disabled option is shown — it is an answer — but never chosen. */
function choosable(option: ListboxOption | undefined): boolean {
  return option !== undefined && option.disabled !== true;
}

/** The first option a reader can take, or `NO_OPTION` when the list offers none. */
export function firstChoosable(options: readonly ListboxOption[]): number {
  const at = options.findIndex((option) => choosable(option));
  return at === -1 ? NO_OPTION : at;
}

/** The last option a reader can take, or `NO_OPTION`. */
export function lastChoosable(options: readonly ListboxOption[]): number {
  for (let at = options.length - 1; at >= 0; at -= 1) if (choosable(options[at])) return at;
  return NO_OPTION;
}

/**
 * The option a step in `direction` lands on. The list does not wrap: a cursor at the end that is
 * pushed further stays where it is, because a reader holding ↓ to reach the bottom of a long list
 * must not be thrown back to the top without having asked for it (R-UI-012's keyboard reading).
 */
export function step(options: readonly ListboxOption[], from: number, direction: 1 | -1): number {
  if (options.length === 0) return NO_OPTION;
  if (from === NO_OPTION) return direction === 1 ? firstChoosable(options) : lastChoosable(options);
  for (let at = from + direction; at >= 0 && at < options.length; at += direction) {
    if (choosable(options[at])) return at;
  }
  return choosable(options[from]) ? from : direction === 1 ? lastChoosable(options) : firstChoosable(options);
}

/** Where a value sits in the list, or `NO_OPTION` when the list does not hold it. */
export function indexOfValue(options: readonly ListboxOption[], value: string): number {
  const at = options.findIndex((option) => option.value === value);
  return at === -1 ? NO_OPTION : at;
}

/**
 * Type-ahead: the option the typed buffer names, searched from AFTER the cursor and wrapping once,
 * so repeated presses of the same letter walk that letter's options rather than sticking on the
 * first. Matching is case-insensitive on the label's start — a reader types what they can see.
 */
export function typeAhead(options: readonly ListboxOption[], buffer: string, from: number): number {
  if (buffer === "") return NO_OPTION;
  const needle = buffer.toLowerCase();
  // A repeated single letter walks; anything longer keeps refining the option already found.
  const repeated = buffer.length > 1 && [...buffer].every((character) => character === buffer[0]);
  const search = repeated ? (buffer[0] as string).toLowerCase() : needle;
  const start = repeated || buffer.length === 1 ? from + 1 : from === NO_OPTION ? 0 : from;
  for (let offset = 0; offset < options.length; offset += 1) {
    const at = (((start + offset) % options.length) + options.length) % options.length;
    const option = options[at];
    if (choosable(option) && (option as ListboxOption).label.toLowerCase().startsWith(search)) return at;
  }
  return NO_OPTION;
}

/** Is this key a character a reader meant to type into the list, rather than a command? */
export function isTypeAheadKey(key: string): boolean {
  return key.length === 1 && key !== " " && !/\s/.test(key);
}

/** Options filtered by what a person typed — the Combobox's one filtering rule (B-17). */
export function filterOptions(options: readonly ListboxOption[], query: string): readonly ListboxOption[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return options;
  return options.filter((option) => option.label.toLowerCase().includes(needle));
}

/** The id of one option inside one listbox — the string `aria-activedescendant` must point at. */
export function optionId(listId: string, at: number): string {
  return `${listId}-o${at}`;
}
