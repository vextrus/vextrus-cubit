// @vitest-environment jsdom
/**
 * Builder's own suite for the gaps the review named: a Combobox that reads the `value` its
 * screen holds, dismisses itself when the user moves on, and never points
 * `aria-activedescendant` at an option that is not there; a Slider that draws a thumb per value
 * and hands `aria-labelledby` to the thumb with the rest of the name; an IconButton whose
 * required `label` cannot be overwritten from outside.
 *
 * Behaviour only — the acceptance files own the contract, this owns the repairs.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installJsdomSupport } from './jsdom-support';

installJsdomSupport();

const primitives = async () => await import('../index');

const COMBOBOX_INPUT = 'combobox-input';
const COMBOBOX_LIST = 'combobox-list';
const OUTSIDE = 'outside';

const NAME = 'Pick one';
const OPTIONS = [
  { value: 'a', label: 'Cement' },
  { value: 'b', label: 'Sand' },
];
const QUERY = 'Ce';

afterEach(() => {
  cleanup();
});

describe('Combobox reads the value its screen holds', () => {
  it('shows a held value in the field, and clearing the value clears the field', async () => {
    const { Combobox } = await primitives();
    const loadOptions = vi.fn(async () => OPTIONS);

    const { rerender } = render(
      <Combobox loadOptions={loadOptions} aria-label={NAME} value={OPTIONS[0]!.value} />,
    );
    const input = screen.getByTestId(COMBOBOX_INPUT) as HTMLInputElement;
    expect(input.value, 'a held value left the field empty').toBe(OPTIONS[0]!.value);

    rerender(<Combobox loadOptions={loadOptions} aria-label={NAME} value="" />);
    expect(input.value, 'clearing the value did not reset the field').toBe('');
  });

  it('keeps the committed label when the screen echoes the value back', async () => {
    const { Combobox } = await primitives();
    const loadOptions = vi.fn(async () => OPTIONS);
    const user = userEvent.setup();

    const { rerender } = render(
      <Combobox loadOptions={loadOptions} aria-label={NAME} value="" />,
    );
    const input = screen.getByTestId(COMBOBOX_INPUT) as HTMLInputElement;
    await user.type(input, QUERY);
    const option = (await screen.findAllByTestId('combobox-option'))[0]!;
    await user.click(option);

    rerender(<Combobox loadOptions={loadOptions} aria-label={NAME} value={OPTIONS[0]!.value} />);
    expect(input.value, 'the echoed value retyped the field over its own label').toBe(
      OPTIONS[0]!.label,
    );
  });
});

describe('Combobox dismisses itself', () => {
  /** Types a query and waits for the list to be open. */
  async function openList(): Promise<{ user: ReturnType<typeof userEvent.setup>; input: HTMLElement }> {
    const { Combobox } = await primitives();
    const loadOptions = vi.fn(async () => OPTIONS);
    const user = userEvent.setup();

    render(
      <div>
        <Combobox loadOptions={loadOptions} aria-label={NAME} />
        <button type="button" data-testid={OUTSIDE}>
          {OUTSIDE}
        </button>
      </div>,
    );
    const input = screen.getByTestId(COMBOBOX_INPUT);
    await user.type(input, QUERY);
    await screen.findByTestId(COMBOBOX_LIST);
    return { user, input };
  }

  it('closes on a pointer landing outside it', async () => {
    const { user, input } = await openList();

    await user.click(screen.getByTestId(OUTSIDE));

    await waitFor(() => {
      expect(screen.queryByTestId(COMBOBOX_LIST), 'a click outside left the list open').toBeNull();
    });
    expect(input.getAttribute('aria-expanded'), 'the input still claims to be expanded').toBe(
      'false',
    );
  });

  it('closes when the focus tabs away', async () => {
    const { user, input } = await openList();

    await user.tab();

    expect(document.activeElement, 'Tab did not leave the combobox').not.toBe(input);
    await waitFor(() => {
      expect(screen.queryByTestId(COMBOBOX_LIST), 'Tab away left the list open').toBeNull();
    });
  });
});

describe('Combobox ArrowUp with nothing loaded', () => {
  it('points at no option at all', async () => {
    const { Combobox } = await primitives();
    const loadOptions = vi.fn(async () => []);
    const user = userEvent.setup();

    render(<Combobox loadOptions={loadOptions} aria-label={NAME} />);
    const input = screen.getByTestId(COMBOBOX_INPUT);
    input.focus();
    await user.keyboard('{ArrowUp}');

    const pointed = input.getAttribute('aria-activedescendant');
    expect(
      pointed === null || document.getElementById(pointed) !== null,
      `aria-activedescendant is "${String(pointed)}", which is in no element's id`,
    ).toBe(true);
    expect(input.getAttribute('aria-expanded'), 'ArrowUp did not open the list').toBe('true');
  });
});

describe('Slider', () => {
  it('draws one thumb per value it holds', async () => {
    const { Slider } = await primitives();

    render(<Slider aria-label={NAME} min={0} max={100} value={[10, 40]} onValueChange={vi.fn()} />);

    expect(
      screen.getAllByRole('slider'),
      'a two-value slider did not render two thumbs',
    ).toHaveLength(2);
  });

  it('puts aria-labelledby on the thumb, not the root', async () => {
    const { Slider } = await primitives();
    const labelId = 'slider-label';

    render(
      <div>
        <span id={labelId}>{NAME}</span>
        <Slider aria-labelledby={labelId} min={0} max={10} />
      </div>,
    );

    const thumb = screen.getByRole('slider');
    expect(thumb.getAttribute('aria-labelledby'), 'the thumb has no name to speak').toBe(labelId);
    expect(
      thumb.parentElement?.getAttribute('aria-labelledby') ?? null,
      'the name is still duplicated onto the role-less root',
    ).toBeNull();
  });
});

describe('IconButton', () => {
  it('keeps its required label as the name whatever a caller passes', async () => {
    const { IconButton } = await primitives();
    const intruder = 'not the name';
    const props = { 'aria-label': intruder } as Record<string, string>;

    render(<IconButton label={NAME} icon={null} {...props} />);

    expect(
      screen.getByRole('button').getAttribute('aria-label'),
      'a caller-supplied aria-label overwrote the required label',
    ).toBe(NAME);
  });
});
