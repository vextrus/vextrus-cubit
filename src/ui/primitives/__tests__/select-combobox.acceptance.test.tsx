// @vitest-environment jsdom
/**
 * inc-005 acceptance — Select and Combobox are operable from the keyboard (AC-4).
 *
 * R-UI-010: "Select, Combobox (async, keyboard)". R-UI-012: "Every interactive element:
 * … keyboard reachable". A picker that only opens under a mouse is the commonest way a
 * screen fails Q-11's keyboard journey, so every step here is a key and never a click.
 *
 * Movement is proved relatively, never by naming the option the highlight happens to start
 * on: one ArrowDown and two ArrowDowns must commit different options, and ArrowUp must undo
 * the second. That holds whatever the picker highlights first, which is a decision the
 * Design Decision may lawfully change without reddening this suite.
 *
 * The Combobox's copy is asserted as "a value the module's string table registers", never as
 * a quoted sentence: R-SPINE-060 puts the words in the table and AM-03 (2) puts the decision
 * in docs/design/datum-primitives.md — this file is not entitled to either.
 *
 * The barrel is loaded inside each test so that a module which does not exist yet reads as
 * one missing behaviour per test rather than a single collection error.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installJsdomSupport } from './jsdom-support';

installJsdomSupport();

/** The barrel and the module's string table, per test (see the file header). */
const primitives = async () => await import('../index');
const stringTable = async () => await import('../strings');

/** The test contract's ids. */
const COMBOBOX_INPUT = 'combobox-input';
const COMBOBOX_LIST = 'combobox-list';
const COMBOBOX_OPTION = 'combobox-option';
const COMBOBOX_EMPTY = 'combobox-empty';

const NAME = 'Pick one';
const OPTION_A = 'a';
const OPTION_B = 'b';
const OPTION_C = 'c';
const LABEL_A = 'Cement';
const LABEL_B = 'Sand';
const LABEL_C = 'Steel';

const OPTIONS = [
  { value: OPTION_A, label: LABEL_A },
  { value: OPTION_B, label: LABEL_B },
  { value: OPTION_C, label: LABEL_C },
];

/** What the tests type into the combobox: a prefix of the first option's label. */
const QUERY = LABEL_A.slice(0, 2);

/** A promise the test resolves when it chooses to — the only way to observe "still loading". */
function deferred<T>(): { promise: Promise<T>; settle: (value: T) => void } {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

/** Every string leaf of every object the module's table exports, whatever it is named. */
function registeredCopy(namespace: object): string[] {
  const found: string[] = [];
  for (const exported of Object.values(namespace)) {
    if (exported === null || typeof exported !== 'object') continue;
    for (const value of Object.values(exported as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim().length > 0) found.push(value);
    }
  }
  return found;
}

const onScreen = (value: string): boolean => document.body.textContent?.includes(value) === true;

afterEach(() => {
  cleanup();
});

describe('AC-4 — Select opens, moves and closes from the keyboard (R-UI-012)', () => {
  /** Renders a three-option Select, tabs to its trigger and returns both. */
  async function mountSelect(): Promise<{
    user: ReturnType<typeof userEvent.setup>;
    trigger: HTMLElement;
    onValueChange: ReturnType<typeof vi.fn>;
  }> {
    const { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } = await primitives();
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label={NAME}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );

    // The trigger is whatever one Tab reaches — the suite does not care which element or
    // role the restyle chose, only that the keyboard gets there.
    await user.tab();
    const trigger = document.activeElement;
    expect(trigger, 'one Tab did not reach the Select trigger').not.toBe(document.body);
    return { user, trigger: trigger as HTMLElement, onValueChange };
  }

  for (const [name, key] of [
    ['Enter', '{Enter}'],
    ['Space', '[Space]'],
    ['ArrowDown', '{ArrowDown}'],
  ] as const) {
    it(`opens a listbox of options on ${name}`, async () => {
      const { user } = await mountSelect();
      await user.keyboard(key);

      const listbox = await screen.findByRole('listbox');
      expect(listbox, `${name} did not open the Select`).toBeTruthy();

      const options = screen.getAllByRole('option');
      expect(
        options.map((option: HTMLElement) => option.textContent?.trim()),
        'the options are not exposed as role="option"',
      ).toEqual([LABEL_A, LABEL_B, LABEL_C]);
    });
  }

  it('closes on Escape and gives focus back to the trigger', async () => {
    const { user, trigger, onValueChange } = await mountSelect();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox'), 'Escape did not close the Select').toBeNull();
    });
    expect(document.activeElement, 'Escape stranded the focus outside the trigger').toBe(trigger);
    expect(onValueChange, 'Escape committed a value').not.toHaveBeenCalled();
  });

  it('moves down and back up through the options before Enter commits one', async () => {
    /** Opens, presses `steps`, commits, and reports what was chosen. */
    const chooseAfter = async (steps: readonly string[]): Promise<unknown> => {
      const { user, onValueChange } = await mountSelect();
      await user.keyboard('{Enter}');
      await screen.findByRole('listbox');
      for (const step of steps) await user.keyboard(step);
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(onValueChange, 'Enter committed nothing').toHaveBeenCalled();
      });
      const chosen: unknown = onValueChange.mock.calls[0]?.[0];
      cleanup();
      return chosen;
    };

    const oneDown = await chooseAfter(['{ArrowDown}']);
    const twoDown = await chooseAfter(['{ArrowDown}', '{ArrowDown}']);
    const downThenUp = await chooseAfter(['{ArrowDown}', '{ArrowDown}', '{ArrowUp}']);

    expect(
      [OPTION_A, OPTION_B, OPTION_C],
      `Enter committed ${String(oneDown)}, which is not one of the options`,
    ).toContain(oneDown);
    expect(twoDown, 'a second ArrowDown selected the same option — the highlight does not move').not.toBe(
      oneDown,
    );
    expect(downThenUp, 'ArrowUp did not undo the second ArrowDown').toBe(oneDown);
  });
});

describe('AC-4 — Combobox loads, filters and commits from the keyboard (R-UI-010)', () => {
  it('exposes the input as a combobox with an expanded state', async () => {
    const { Combobox } = await primitives();
    const loadOptions = vi.fn(async () => OPTIONS);

    render(<Combobox loadOptions={loadOptions} aria-label={NAME} />);

    const input = screen.getByTestId(COMBOBOX_INPUT);
    expect(input.getAttribute('role'), 'the combobox input is not role="combobox"').toBe(
      'combobox',
    );
    expect(
      input.getAttribute('aria-expanded'),
      'a combobox says whether its list is open',
    ).toMatch(/^(?:true|false)$/);
  });

  it('shows registered loading copy until the loader resolves, then the options', async () => {
    const { Combobox } = await primitives();
    const copy = registeredCopy(await stringTable());
    expect(copy.length, 'src/ui/primitives/strings.ts registers no copy').toBeGreaterThan(0);

    const gate = deferred<{ value: string; label: string }[]>();
    const loadOptions = vi.fn(async (_query: string) => await gate.promise);
    const user = userEvent.setup();

    render(<Combobox loadOptions={loadOptions} aria-label={NAME} />);
    await user.type(screen.getByTestId(COMBOBOX_INPUT), QUERY);

    // The loader is asked for what was typed. Whether it is asked once per keystroke or
    // once after a pause is the Design Decision's business; that it is asked for the query
    // is this contract's.
    await waitFor(() => {
      expect(
        loadOptions.mock.calls.map((call) => call[0]),
        'the loader was never asked for what was typed',
      ).toContain(QUERY);
    });

    // While the loader is out: no options yet, and — the copy defect this guards against —
    // not the "no matches" state either. A pending request is not an empty result.
    await waitFor(() => {
      expect(copy.some(onScreen), 'no registered loading copy appeared').toBe(true);
    });
    const whileLoading = copy.filter(onScreen);
    expect(screen.queryAllByTestId(COMBOBOX_OPTION), 'options appeared before the loader returned')
      .toHaveLength(0);
    expect(
      screen.queryByTestId(COMBOBOX_EMPTY),
      'a pending loader was reported to the user as "no matches"',
    ).toBeNull();

    await act(async () => {
      gate.settle(OPTIONS);
      await gate.promise;
    });

    const rendered = await screen.findAllByTestId(COMBOBOX_OPTION);
    const labels = rendered.map((option: HTMLElement) => option.textContent?.trim() ?? '');

    // What the loader resolved is what may be shown — no more. Whether the control also
    // narrows the resolved list against the query is a decision the contract leaves open,
    // so the assertion is a subset that still contains the option the query names.
    const loaded = OPTIONS.map((option) => option.label);
    const invented = labels.filter((label: string) => !loaded.includes(label));
    expect(invented, `options nobody loaded: ${invented.join(' | ')}`).toEqual([]);
    expect(labels, 'the option the query names was not offered').toContain(LABEL_A);
    expect(screen.getByTestId(COMBOBOX_LIST).contains(rendered[0] ?? null)).toBe(true);

    // The loading state ended: some copy that was on screen while the loader was out is not
    // on screen now.
    const stillShowing = copy.filter(onScreen);
    expect(
      whileLoading.some((value) => !stillShowing.includes(value)),
      `the loading state never went away (still showing: ${stillShowing.join(' | ')})`,
    ).toBe(true);
  });

  it('commits the option ArrowDown then Enter lands on', async () => {
    const { Combobox } = await primitives();
    const onValueChange = vi.fn();
    const loadOptions = vi.fn(async () => OPTIONS);
    const user = userEvent.setup();

    render(
      <Combobox loadOptions={loadOptions} onValueChange={onValueChange} aria-label={NAME} />,
    );
    await user.type(screen.getByTestId(COMBOBOX_INPUT), QUERY);
    await screen.findAllByTestId(COMBOBOX_OPTION);

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onValueChange, 'ArrowDown then Enter committed nothing').toHaveBeenCalled();
    });
    const chosen: unknown = onValueChange.mock.calls[0]?.[0];
    expect(
      OPTIONS.map((option) => option.value),
      `the combobox committed ${String(chosen)}, which is not one of the loaded options`,
    ).toContain(chosen);
  });

  it('shows the registered empty copy when the loader returns nothing', async () => {
    const { Combobox } = await primitives();
    const copy = registeredCopy(await stringTable());
    const loadOptions = vi.fn(async () => []);
    const user = userEvent.setup();

    render(<Combobox loadOptions={loadOptions} aria-label={NAME} />);
    await user.type(screen.getByTestId(COMBOBOX_INPUT), QUERY);

    const empty = await screen.findByTestId(COMBOBOX_EMPTY);
    const text = empty.textContent?.trim() ?? '';

    // AM-03 (2): "Copy is design: product voice is decided in the Design Decision, never
    // improvised by a builder." So the words are the table's, and the table's are the
    // document's — this suite only insists that the chain is intact.
    expect(text.length, 'the empty state has no copy at all').toBeGreaterThan(0);
    expect(
      copy.includes(text),
      `"${text}" is improvised in JSX — it is not a value src/ui/primitives/strings.ts registers`,
    ).toBe(true);
    expect(screen.queryAllByTestId(COMBOBOX_OPTION), 'an empty result still rendered options')
      .toHaveLength(0);
  });
});
