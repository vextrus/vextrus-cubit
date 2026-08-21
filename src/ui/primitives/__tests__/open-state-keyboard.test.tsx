// @vitest-environment jsdom
/**
 * The primitives, driven from the keyboard while they are open (R-UI-012, Q-11).
 *
 * The acceptance suites beside this one prove that one Tab reaches every interactive
 * primitive. That is the half of R-UI-012 a closed control can show. The other half only
 * exists once a layer is open: a menu whose items the arrows cannot reach, a popover that
 * strands the focus when it closes, or a tooltip nobody can dismiss all pass a tab-stop check
 * and still fail a keyboard journey.
 *
 * So this file asserts the open state — for the four layers the acceptance suites leave
 * closed, and for the value controls whose keyboard is their whole point. Every step is a key
 * and never a click, and every assertion is a property (`the focus is inside`, `the value
 * moved`) rather than a transcript of Radix's markup, so a restyle that changes the DOM
 * without changing the behaviour does not redden it.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Checkbox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Radio,
  RadioGroup,
  Slider,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../index';
import { installJsdomSupport } from './jsdom-support';

installJsdomSupport();

/** The class every focusable element of every interactive primitive carries (R-UI-012). */
const RING_CLASS = 'datum-focus-ring';

const NAME = 'Field';
const OPEN = 'Open';
const HINT = 'Hint';
const ITEM_ONE = 'First';
const ITEM_TWO = 'Second';
const OPTION_A = 'a';
const OPTION_B = 'b';
const LABEL_A = 'Cement';
const LABEL_B = 'Sand';
const REGION = 'Rows';

afterEach(() => {
  cleanup();
});

describe('DropdownMenu is operable, ringed and returns its focus', () => {
  async function open(): Promise<{
    user: ReturnType<typeof userEvent.setup>;
    trigger: HTMLElement;
  }> {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>{OPEN}</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>{ITEM_ONE}</DropdownMenuItem>
          <DropdownMenuItem>{ITEM_TWO}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await user.tab();
    const trigger = document.activeElement as HTMLElement;
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    return { user, trigger };
  }

  it('opens on Enter with items the arrows reach, each carrying the ring', async () => {
    const { user } = await open();

    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent?.trim())).toEqual([ITEM_ONE, ITEM_TWO]);
    for (const item of items) {
      expect(item.classList.contains(RING_CLASS), `a menu item without .${RING_CLASS}`).toBe(true);
    }

    // Radix focuses the first item on an Enter-opened menu; the assertion is the movement,
    // not which item the highlight starts on.
    const first = document.activeElement;
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement, 'ArrowDown did not move inside the menu').not.toBe(first);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement, 'ArrowUp did not move back').toBe(first);
  });

  it('closes on Escape and gives focus back to the trigger', async () => {
    const { user, trigger } = await open();
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu'), 'Escape did not close the menu').toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement, 'the menu stranded the focus').toBe(trigger);
    });
  });
});

describe('ContextMenu is reachable once it is open', () => {
  it('exposes ringed menu items and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <ContextMenu>
        <ContextMenuTrigger>{OPEN}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>{ITEM_ONE}</ContextMenuItem>
          <ContextMenuItem>{ITEM_TWO}</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    // A context menu is opened by the context gesture, not by a tab stop — which is exactly
    // why its keyboard contract begins here rather than at the trigger.
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText(OPEN) });
    await screen.findByRole('menu');

    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent?.trim())).toEqual([ITEM_ONE, ITEM_TWO]);
    for (const item of items) {
      expect(item.classList.contains(RING_CLASS), `a menu item without .${RING_CLASS}`).toBe(true);
    }

    await user.keyboard('{ArrowDown}');
    expect(
      screen.getByRole('menu').contains(document.activeElement),
      'the arrows do not reach inside an open context menu',
    ).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu'), 'Escape did not close the context menu').toBeNull();
    });
  });
});

describe('Popover and Tooltip hand the keyboard back', () => {
  it('opens a Popover on Enter, closes it on Escape and restores the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>{OPEN}</PopoverTrigger>
        <PopoverContent>{HINT}</PopoverContent>
      </Popover>,
    );

    await user.tab();
    const trigger = document.activeElement as HTMLElement;
    expect(trigger.classList.contains(RING_CLASS)).toBe(true);

    await user.keyboard('{Enter}');
    expect(await screen.findByText(HINT), 'Enter did not open the popover').toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText(HINT), 'Escape did not close the popover').toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement, 'the popover stranded the focus').toBe(trigger);
    });
  });

  it('shows a Tooltip when its trigger takes focus and hides it on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip>
        <TooltipTrigger>{OPEN}</TooltipTrigger>
        <TooltipContent>{HINT}</TooltipContent>
      </Tooltip>,
    );

    // A tooltip that only appears under a pointer is a tooltip a keyboard user never sees.
    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent, 'the focused trigger showed no tooltip').toContain(HINT);

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('tooltip'), 'Escape did not dismiss the tooltip').toBeNull();
    });
  });
});

describe('The value controls answer the keys their role promises', () => {
  it('toggles a Checkbox on Space and reports it as aria-checked', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label={NAME} />);

    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('false');

    await user.tab();
    await user.keyboard('[Space]');
    expect(box.getAttribute('aria-checked'), 'Space did not check the box').toBe('true');

    await user.keyboard('[Space]');
    expect(box.getAttribute('aria-checked'), 'Space did not uncheck the box').toBe('false');
  });

  it('toggles a Switch on Space', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label={NAME} />);

    const toggle = screen.getByRole('switch');
    await user.tab();
    await user.keyboard('[Space]');
    expect(toggle.getAttribute('aria-checked'), 'Space did not flip the switch').toBe('true');
  });

  it('is one tab stop whose arrows rove and choose', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <RadioGroup aria-label={NAME}>
        <Radio value={OPTION_A} aria-label={LABEL_A} />
        <Radio value={OPTION_B} aria-label={LABEL_B} />
      </RadioGroup>,
    );

    const radios = screen.getAllByRole('radio');
    const [first, second] = radios as [HTMLElement, HTMLElement];
    await user.tab();
    expect(document.activeElement, 'one Tab did not reach the group').toBe(first);

    // Selection follows the focus, as the radiogroup pattern asks: an arrow both moves and
    // chooses, and it does so however fast the keys arrive.
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement, 'ArrowDown did not rove inside the group').toBe(second);
    expect(second.getAttribute('aria-checked'), 'ArrowDown moved without choosing').toBe('true');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement, 'ArrowRight did not rove on round').toBe(first);
    expect(first.getAttribute('aria-checked'), 'ArrowRight moved without choosing').toBe('true');

    await user.keyboard('[Space]');
    const chosen = radios.filter((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(chosen, 'Space selected no radio, or more than one').toHaveLength(1);
    expect(document.activeElement, 'the selection and the focus parted company').toBe(chosen[0]);
  });

  it('reports and moves a Slider through its stated range', async () => {
    const user = userEvent.setup();
    render(<Slider aria-label={NAME} min={0} max={10} step={1} />);

    const thumb = screen.getByRole('slider');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('10');
    expect(thumb.getAttribute('aria-label'), 'the focusable thumb is unnamed').toBe(NAME);
    expect(thumb.classList.contains(RING_CLASS)).toBe(true);

    await user.tab();
    expect(document.activeElement, 'one Tab did not reach the thumb').toBe(thumb);

    const before = thumb.getAttribute('aria-valuenow');
    await user.keyboard('{ArrowRight}');
    expect(thumb.getAttribute('aria-valuenow'), 'ArrowRight did not move the slider').not.toBe(before);
    await user.keyboard('{ArrowLeft}');
    expect(thumb.getAttribute('aria-valuenow'), 'ArrowLeft did not move it back').toBe(before);
  });

  it('states a determinate Progress as a progressbar with its value (R-UI-010)', () => {
    render(<Progress value={40} max={100} aria-label={REGION} />);

    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow'), 'a determinate bar states where it is').toBe('40');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-label')).toBe(REGION);
  });

  it('offers no indeterminate Progress: a bar with no value still stands somewhere', () => {
    render(<Progress aria-label={REGION} />);

    const bar = screen.getByRole('progressbar');
    const now = bar.getAttribute('aria-valuenow');
    expect(now, 'a bar without a value went indeterminate').not.toBeNull();
    expect(Number.isFinite(Number(now))).toBe(true);
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });
});
