// @vitest-environment jsdom
/**
 * The cases the survey found the components contradicting their own Design Decision in
 * (AM-03 (3): a design finding blocks a merge on the same footing as a failing test).
 *
 * Each `describe` below is one finding, written as the rule the document already states
 * rather than as the shape of today's fix — so a later leaf that reintroduces the behaviour
 * reddens here with the clause it broke.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetTitle,
  Slider,
  Combobox,
  Toaster,
  toast,
} from '../index';
import { groupedForDisplay } from '../number-input';
import { ts } from '../strings';
import { installJsdomSupport } from './jsdom-support';

installJsdomSupport();

const NAME = 'Field';
const OPEN = 'Open';
const ITEM_ONE = 'First';
const TITLE = 'A title';

const loadNothing = async (): Promise<{ value: string; label: string }[]> => [];

afterEach(() => {
  cleanup();
});

describe('NumberInput display — the three cases §4 states (B-07, R-SPINE-061)', () => {
  /**
   * The document's own examples, verbatim: "So value `1234567.89` displays `12,34,567.89`;
   * `10000000` displays `1,00,00,000`; `.5` displays `0.5`; empty displays empty — never
   * `NaN`", plus the sentence before them, "a trailing bare point drops from display".
   */
  const stated: readonly (readonly [string, string])[] = [
    ['1234567.89', '12,34,567.89'],
    ['10000000', '1,00,00,000'],
    ['.5', '0.5'],
    ['123.', '123'],
    ['1234567.', '12,34,567'],
    ['', ''],
    ['-.5', '-0.5'],
  ];

  for (const [value, shown] of stated) {
    it(`displays "${value}" as "${shown}"`, () => {
      expect(groupedForDisplay(value)).toBe(shown);
    });
  }

  it('shows a value that is not a number yet as itself, rather than inventing a digit', () => {
    // A field the user has only started is not a zero: `0` here would be a number nobody typed.
    expect(groupedForDisplay('-')).toBe('-');
    expect(groupedForDisplay('.')).toBe('.');
  });
});

describe('Combobox — "the list never renders silently blank" (§7, R-UI-020)', () => {
  /** Whichever row the surface is showing: the pending one, the empty one, or an option. */
  function rowCount(): number {
    return document.querySelectorAll(
      '[data-testid="combobox-option"], [data-testid="combobox-empty"], [role="status"]',
    ).length;
  }

  it('answers ArrowDown on an untouched field with a state, not an empty box', async () => {
    const user = userEvent.setup();
    render(<Combobox loadOptions={loadNothing} aria-label={NAME} />);

    const input = screen.getByTestId('combobox-input');
    await user.click(input);
    await user.keyboard('{ArrowDown}');

    expect(input.getAttribute('aria-expanded'), 'ArrowDown did not open the list').toBe('true');
    expect(rowCount(), 'the opened surface shows no row at all').toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryByTestId('combobox-empty'), 'the resolved empty state never appeared')
        .not.toBeNull();
    });
  });

  it('shows the empty row when a cleared field resolves to nothing', async () => {
    const user = userEvent.setup();
    render(<Combobox loadOptions={loadNothing} aria-label={NAME} />);

    const input = screen.getByTestId('combobox-input');
    await user.type(input, 'a');
    await screen.findByTestId('combobox-empty');

    await user.keyboard('{Backspace}');
    await waitFor(() => {
      expect(
        screen.queryByTestId('combobox-empty'),
        'clearing the field left an open surface with no row in it',
      ).not.toBeNull();
    });
    expect(screen.getByTestId('combobox-empty').textContent?.trim()).toBe(
      ts('primitives.combobox.empty'),
    );
  });

  it('points aria-controls at a listbox that is in the document, or at nothing', async () => {
    const user = userEvent.setup();
    render(<Combobox loadOptions={loadNothing} aria-label={NAME} />);
    const input = screen.getByTestId('combobox-input');

    // Closed: a dangling idref is what axe's aria-valid-attr-value reports (R-UI-012, Q-11).
    const closed = input.getAttribute('aria-controls');
    expect(
      closed === null || document.getElementById(closed) !== null,
      `aria-controls="${closed ?? ''}" names no element while the list is closed`,
    ).toBe(true);

    await user.click(input);
    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      const open = input.getAttribute('aria-controls');
      expect(open, 'an open combobox controls nothing').not.toBeNull();
      expect(open === null ? null : document.getElementById(open)).not.toBeNull();
    });
  });
});

describe('Slider — a range announces two thumbs a reader can tell apart (§5)', () => {
  it('gives the two thumbs different names', () => {
    render(<Slider aria-label={NAME} min={0} max={10} defaultValue={[2, 8]} />);
    const names = screen
      .getAllByRole('slider')
      .map((thumb) => thumb.getAttribute('aria-label') ?? '');

    expect(names).toHaveLength(2);
    expect(new Set(names).size, `both thumbs answer to "${names[0] ?? ''}"`).toBe(2);
    for (const name of names) expect(name.startsWith(NAME)).toBe(true);
    expect(names[0]).toContain(ts('primitives.slider.lower'));
    expect(names[1]).toContain(ts('primitives.slider.upper'));
  });

  it('announces the bounds each thumb can actually reach', () => {
    render(<Slider aria-label={NAME} min={0} max={10} defaultValue={[2, 8]} />);
    const [lower, upper] = screen.getAllByRole('slider');

    // The neighbour clamping `commit` enforces, said out loud rather than left to be
    // discovered by a user who cannot get past it.
    expect(lower?.getAttribute('aria-valuemin')).toBe('0');
    expect(lower?.getAttribute('aria-valuemax')).toBe('8');
    expect(upper?.getAttribute('aria-valuemin')).toBe('2');
    expect(upper?.getAttribute('aria-valuemax')).toBe('10');
  });

  it('leaves a single thumb announcing the whole rail', () => {
    render(<Slider aria-label={NAME} min={0} max={10} defaultValue={[4]} />);
    const thumb = screen.getByRole('slider');

    expect(thumb.getAttribute('aria-label')).toBe(NAME);
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('10');
  });
});

describe('ContextMenu — reachable from the keyboard (§10, R-UI-012)', () => {
  it('takes the focus, so Shift+F10 has something to fire at', async () => {
    const user = userEvent.setup();
    render(
      <ContextMenu>
        <ContextMenuTrigger>{OPEN}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>{ITEM_ONE}</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    await user.tab();
    const focused = document.activeElement;
    expect(focused, 'one Tab did not reach the context region').not.toBe(document.body);
    expect(focused?.textContent, 'the focused element is not the trigger').toBe(OPEN);
    expect(
      focused?.classList.contains('datum-focus-ring'),
      'a focusable region without the ring is a focus nobody can see',
    ).toBe(true);
  });
});

describe('Dialog and Sheet — the close control is the surface’s own (§11)', () => {
  const surfaces = [
    {
      name: 'Dialog',
      testid: 'dialog-content',
      copy: ts('primitives.dialog.close'),
      node: (
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>{TITLE}</DialogTitle>
          </DialogContent>
        </Dialog>
      ),
    },
    {
      name: 'Sheet',
      testid: 'sheet-content',
      copy: ts('primitives.sheet.close'),
      node: (
        <Sheet defaultOpen>
          <SheetContent>
            <SheetTitle>{TITLE}</SheetTitle>
          </SheetContent>
        </Sheet>
      ),
    },
  ] as const;

  for (const { name, testid, copy, node } of surfaces) {
    it(`${name} composed with no close of its own still ships one`, async () => {
      const user = userEvent.setup();
      render(node);

      const content = await screen.findByTestId(testid);
      const close = content.querySelector(`[aria-label="${copy}"]`);
      expect(close, `a ${name} with no visible dismiss affordance shipped`).not.toBeNull();

      await user.click(close as HTMLElement);
      await waitFor(() => {
        expect(screen.queryByTestId(testid), `the ${name}'s own close did not close it`).toBeNull();
      });
    });
  }
});

describe('Toast — the card is painted by Datum, not by sonner (§12, AC-1)', () => {
  it('puts the Datum classes on the card sonner renders', async () => {
    const MESSAGE = 'Saved as a draft';
    render(<Toaster />);
    act(() => {
      toast(MESSAGE);
    });

    const region = await screen.findByTestId('toast-region');
    await waitFor(() => {
      expect(region.textContent).toContain(MESSAGE);
    });

    // AC-1: "styling uses Datum token classes/variables only". A card sonner paints from its
    // own stylesheet carries none of ours and does not follow [data-theme].
    const card = region.querySelector('.datum-toast');
    expect(card, 'the toast card carries no Datum class — sonner is painting it').not.toBeNull();
    expect(card?.textContent).toContain(MESSAGE);
  });
});
