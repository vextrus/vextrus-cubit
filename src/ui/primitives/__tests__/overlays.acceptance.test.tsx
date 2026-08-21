// @vitest-environment jsdom
/**
 * inc-005 acceptance — overlays and feedback (AC-5).
 *
 * R-UI-010 names Dialog, Sheet, Toast (sonner) and Tabs; R-UI-012 says every interactive
 * element is keyboard reachable and ARIA labelled. A modal that leaks the Tab key to the
 * page behind it, or one that drops focus on the floor when it closes, is the shape that
 * fails Q-11's keyboard journey — so both are asserted here rather than assumed of Radix.
 *
 * Focus containment is asserted as a property, not as an order: pressing Tab through the
 * dialog many times, focus is always inside the dialog. That is what "trapped" means, and
 * it stays true when the Design Decision changes what is inside.
 *
 * The barrel is loaded inside each test so that a module which does not exist yet reads as
 * one missing behaviour per test rather than a single collection error.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { installJsdomSupport } from './jsdom-support';

installJsdomSupport();

/** The barrel, per test (see the file header). */
const primitives = async () => await import('../index');

/** The test contract's ids. */
const DIALOG_CONTENT = 'dialog-content';
const SHEET_CONTENT = 'sheet-content';
const TOAST_REGION = 'toast-region';

const OPEN = 'Open';
const CLOSE = 'Close';
const TITLE = 'Revoke this document';
const DESCRIPTION = 'What the act does, before it is done.';
const FIRST = 'First';
const SECOND = 'Second';
const MESSAGE = 'Saved as a draft';
const TAB_ONE = 'one';
const TAB_TWO = 'two';
const TAB_THREE = 'three';
const TAB_ONE_LABEL = 'Overview';
const TAB_TWO_LABEL = 'Basis';
const TAB_THREE_LABEL = 'Trace';
const TABS_NAME = 'Sections';

/** Every element a live-region announcement may sit in. */
const LIVE = '[role="status"], [role="alert"], [aria-live]';

/** How many Tab presses is enough to leave a dialog that does not hold focus. */
const TAB_ROUNDS = 8;

/** The text a labelled overlay resolves to through aria-labelledby. */
function labelledByText(element: Element): string {
  const ids = element.getAttribute('aria-labelledby');
  if (ids === null) return '';
  return ids
    .split(/\s+/)
    .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim();
}

afterEach(() => {
  cleanup();
});

describe('AC-5 — Dialog and Sheet are labelled modals that hold the keyboard', () => {
  /**
   * One case per overlay: the two are the same contract with different geometry, so they
   * are held to the same assertions rather than to two hand-written near-copies.
   */
  const overlays = [
    { name: 'Dialog', testid: DIALOG_CONTENT },
    { name: 'Sheet', testid: SHEET_CONTENT },
  ] as const;

  async function mount(which: string): Promise<{
    user: ReturnType<typeof userEvent.setup>;
    trigger: HTMLElement;
  }> {
    const {
      Dialog,
      DialogTrigger,
      DialogContent,
      DialogTitle,
      DialogDescription,
      DialogClose,
      Sheet,
      SheetTrigger,
      SheetContent,
      SheetTitle,
      SheetClose,
    } = await primitives();
    const user = userEvent.setup();

    render(
      which === 'Dialog' ? (
        <Dialog>
          <DialogTrigger>{OPEN}</DialogTrigger>
          <DialogContent>
            <DialogTitle>{TITLE}</DialogTitle>
            <DialogDescription>{DESCRIPTION}</DialogDescription>
            <button type="button">{FIRST}</button>
            <button type="button">{SECOND}</button>
            <DialogClose>{CLOSE}</DialogClose>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet>
          <SheetTrigger>{OPEN}</SheetTrigger>
          <SheetContent>
            <SheetTitle>{TITLE}</SheetTitle>
            <button type="button">{FIRST}</button>
            <button type="button">{SECOND}</button>
            <SheetClose>{CLOSE}</SheetClose>
          </SheetContent>
        </Sheet>
      ),
    );

    await user.tab();
    const trigger = document.activeElement;
    expect(trigger, `one Tab did not reach the ${which} trigger`).not.toBe(document.body);
    await user.keyboard('{Enter}');
    return { user, trigger: trigger as HTMLElement };
  }

  for (const { name, testid } of overlays) {
    it(`${name} opens from the keyboard as a modal dialog labelled by its title`, async () => {
      await mount(name);

      const content = await screen.findByTestId(testid);
      expect(content.getAttribute('role'), `${name} is not role="dialog"`).toBe('dialog');
      expect(content.getAttribute('aria-modal'), `${name} is not aria-modal`).toBe('true');

      // R-UI-012's "ARIA labelled", for an overlay: the name is the title it already shows,
      // not a second string somebody has to keep in step with it.
      expect(labelledByText(content), `${name} is not labelled by its title`).toBe(TITLE);
    });

    it(`${name} keeps Tab and Shift+Tab inside itself while it is open`, async () => {
      const { user } = await mount(name);
      const content = await screen.findByTestId(testid);

      for (let round = 0; round < TAB_ROUNDS; round += 1) {
        await user.tab();
        expect(
          content.contains(document.activeElement),
          `Tab ${String(round + 1)} left the open ${name} (focus on <${document.activeElement?.tagName.toLowerCase() ?? 'nothing'}>)`,
        ).toBe(true);
      }

      for (let round = 0; round < TAB_ROUNDS; round += 1) {
        await user.tab({ shift: true });
        expect(
          content.contains(document.activeElement),
          `Shift+Tab ${String(round + 1)} left the open ${name}`,
        ).toBe(true);
      }
    });

    it(`${name} closes on Escape and gives focus back to the trigger`, async () => {
      const { user, trigger } = await mount(name);
      await screen.findByTestId(testid);

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId(testid), `Escape did not close the ${name}`).toBeNull();
      });
      // Losing focus to <body> on close is how a keyboard user loses their place entirely.
      await waitFor(() => {
        expect(document.activeElement, `the ${name} did not hand focus back`).toBe(trigger);
      });
    });
  }
});

describe('AC-5 — a toast is announced in a live region (R-UI-010: sonner)', () => {
  it('shows the message inside the toast region', async () => {
    const { Toaster, toast } = await primitives();

    render(<Toaster />);
    act(() => {
      toast(MESSAGE);
    });

    const region = await screen.findByTestId(TOAST_REGION);
    await waitFor(() => {
      expect(region.textContent, 'the toast was raised outside the region').toContain(MESSAGE);
    });
  });

  it('puts the message in an ARIA live region so it is spoken', async () => {
    const { Toaster, toast } = await primitives();

    render(<Toaster />);
    act(() => {
      toast(MESSAGE);
    });

    const region = await screen.findByTestId(TOAST_REGION);
    await waitFor(() => {
      expect(region.textContent).toContain(MESSAGE);
    });

    // A toast nobody announces is a toast a screen-reader user never receives.
    const live = region.matches(LIVE) ? region : region.querySelector(LIVE);
    expect(live, `no role="status" or aria-live inside [data-testid="${TOAST_REGION}"]`).not.toBeNull();
    expect(live?.textContent, 'the message is outside the live region').toContain(MESSAGE);
  });
});

describe('AC-5 — Tabs rove, select and own their panels (R-UI-010)', () => {
  async function mountTabs(): Promise<ReturnType<typeof userEvent.setup>> {
    const { Tabs, TabsList, TabsTrigger, TabsContent } = await primitives();
    const user = userEvent.setup();

    render(
      <Tabs defaultValue={TAB_ONE}>
        <TabsList aria-label={TABS_NAME}>
          <TabsTrigger value={TAB_ONE}>{TAB_ONE_LABEL}</TabsTrigger>
          <TabsTrigger value={TAB_TWO}>{TAB_TWO_LABEL}</TabsTrigger>
          <TabsTrigger value={TAB_THREE}>{TAB_THREE_LABEL}</TabsTrigger>
        </TabsList>
        <TabsContent value={TAB_ONE}>{FIRST}</TabsContent>
        <TabsContent value={TAB_TWO}>{SECOND}</TabsContent>
        <TabsContent value={TAB_THREE}>{CLOSE}</TabsContent>
      </Tabs>,
    );
    return user;
  }

  /** The tab at `index`, or a failure that says so rather than a TypeError. */
  function tabAt(index: number): HTMLElement {
    const tabs = screen.getAllByRole('tab');
    const tab = tabs[index];
    if (tab === undefined) {
      throw new Error(`the tablist has ${String(tabs.length)} tabs, so there is no tab ${String(index)}`);
    }
    return tab;
  }

  it('is one tab stop whose arrows move the roving focus', async () => {
    const user = await mountTabs();

    expect(screen.getByRole('tablist'), 'the triggers are not in a tablist').toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(3);

    await user.tab();
    expect(document.activeElement, 'one Tab did not reach the tablist').toBe(tabAt(0));

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement, 'ArrowRight did not move the roving focus').toBe(tabAt(1));

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement, 'ArrowRight did not keep moving').toBe(tabAt(2));

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement, 'ArrowLeft did not move back').toBe(tabAt(1));
  });

  it('marks exactly the active trigger aria-selected and gives it its panel', async () => {
    const user = await mountTabs();

    /** The one selected trigger, whichever it is — never more than one. */
    const selected = (): HTMLElement => {
      const chosen = screen
        .getAllByRole('tab')
        .filter((tab: HTMLElement) => tab.getAttribute('aria-selected') === 'true');
      expect(chosen, `${String(chosen.length)} tabs claim to be selected`).toHaveLength(1);
      const only = chosen[0];
      if (only === undefined) throw new Error('no tab is selected');
      return only;
    };

    expect(selected(), 'the default value did not select its trigger').toBe(tabAt(0));

    // Whether the arrow key selects as it moves or waits to be activated is the Design
    // Decision's call; either way the trigger the keyboard commits on is the selected one.
    await user.tab();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(selected(), 'committing on a roved tab did not select it').toBe(tabAt(1));

    // R-UI-010's association: the selected trigger names its panel, and the panel is one.
    const controls = selected().getAttribute('aria-controls');
    expect(controls, 'the selected tab controls nothing').not.toBeNull();
    const panel = controls === null ? null : document.getElementById(controls);
    expect(panel, `aria-controls="${controls ?? ''}" names no element`).not.toBeNull();
    expect(panel?.getAttribute('role'), 'the panel is not role="tabpanel"').toBe('tabpanel');
    expect(panel?.textContent, 'the selected tab shows the wrong panel').toContain(SECOND);
  });
});
