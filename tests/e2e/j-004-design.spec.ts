/**
 * J-004 — "Design gallery renders both themes; visual baselines; axe."
 *
 * R-UI-011: "A living gallery at `/design` renders every component in every state in both
 * themes with sample data; the visual baseline suite screenshots it; a component without a
 * gallery entry fails a test." AM-03 (4): "The /design gallery (R-UI-011) is gate evidence:
 * screenshotted in both themes and diffed across increments through the visual-baseline
 * suite."
 *
 * Two named checkpoints, as the Increment Spec's journey names them: `gallery-light` and
 * `gallery-dark`. Each is the whole page — every entry, every state — scanned by axe (Q-11,
 * zero serious or critical) and compared against its committed Linux baseline (Q-06,
 * maxDiffPixelRatio 0.002, animations disabled, an empty mask because the gallery is static).
 *
 * Q-11 has a second half, and it is a separate obligation from the axe scan: "keyboard journey
 * J-004/J-011 pass." So this file also conducts J-004 from the keyboard alone — focus reached
 * by Tab, the focus indicator visible where the Tab landed (R-UI-012), activation by
 * Enter/Space, focus moved into the opened content and returned to the trigger on Escape
 * (docs/design/datum-primitives.md §1, §9, §11, which AM-03 makes contractual) — and operates
 * every specimen the Design Decision §3 designates as interactive without touching a pointer.
 *
 * The roster is not written here. It is read from the Design Decision's §3 table, so this
 * journey follows the document rather than a list that was true the day it was written: a
 * component added to a barrel is added to §3 and to the registry, and this file finds it. The
 * keyboard journey draws its specimens from the same table, by what §3 says about them — a
 * state named `trigger`, or a specimen whose state is reached by interaction — never from a
 * list typed here.
 */
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { copyEntries, designDocText, rosterRows } from '../../src/app/design/__tests__/design-doc';
import { expectNoSeriousOrCritical } from './axe';
import { DesignGalleryPage } from './setup/design-gallery';

/** The tree, from this file rather than from a working directory the lane happens to pick. */
const REPO = fileURLToPath(new URL('../..', import.meta.url));

/** Every entry the Design Decision decides, and the states each must render (§3, §10). */
const ROSTER = rosterRows(REPO);

/**
 * §3's fourth column, the specimen prose, keyed by slug. `rosterRows` reads the first three
 * columns; the fourth is what designates a specimen as one that is *operated* rather than
 * posed ("Closed; opening is interaction", "they open on interaction"). Rows of other tables
 * in the document have fewer cells and are skipped.
 */
function specimenProse(text: string): Map<string, string> {
  const prose = new Map<string, string>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const parts = trimmed.split('|').map((cell) => cell.trim());
    parts.shift();
    if (parts[parts.length - 1] === '') parts.pop();
    if (parts.length < 4) continue;
    prose.set(parts[0] ?? '', parts[3] ?? '');
  }
  return prose;
}

const SPECIMEN = specimenProse(designDocText(REPO));

/**
 * The interactive specimens, per §3 itself: an entry whose state is literally named `trigger`
 * (the state *is* the interaction — nothing else of it is on the page at rest), or one whose
 * specimen prose says its states are reached by interaction (select, combobox: a listbox
 * cannot sit open in a static page). Derived, so a later increment's interactive component is
 * operated here the day its §3 row lands.
 */
const INTERACTIVE = ROSTER.filter(
  (row) => row.states.includes('trigger') || /interaction/i.test(SPECIMEN.get(row.slug) ?? ''),
);

/**
 * The specimens §3 says need no activation key, because focus itself is the gesture
 * ("opens on hover/focus" — Tooltip, datum-primitives §9). Read from the prose, so a later
 * component that opens on focus is granted the same allowance the day its §3 row lands, and
 * every other specimen must be *activated*.
 */
function opensOnFocus(slug: string): boolean {
  return /focus/i.test(SPECIMEN.get(slug) ?? '');
}

/** §6's copy, verbatim — the words a specimen that announces rather than opens must say. */
const COPY = copyEntries(REPO);

/**
 * The copy key a §3 row says its specimen fires: "fires `toast(estimateSaved)`" names the §6
 * key `estimateSaved`, and §6 decides its verbatim value. Derived from the document, so an
 * announcing specimen added later is held to its own decided copy rather than to this one.
 * A row that names no key still has to say *something* new (see the journey below).
 */
function announcedCopy(slug: string): string | undefined {
  const key = /`[A-Za-z][\w.]*\(([A-Za-z][\w.]*)\)`/.exec(SPECIMEN.get(slug) ?? '')?.[1];
  if (key === undefined) return undefined;
  return COPY.get(key.includes('.') ? key : `design.sample.${key}`);
}

/** Overlay surfaces a keyboard gesture can raise (datum-primitives §1, §6, §9, §10, §11). */
const SURFACE = '[role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"]';

/** The items inside such a surface, when it has any: arrows move, Enter activates (§1). */
const ITEM =
  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"]';

/** What a checkpoint asserts about the page before it is scanned and screenshotted. */
function assertRoster(rendered: readonly { slug: string; states: readonly string[] }[]): void {
  expect(ROSTER.length, 'AM-03: the Design Decision §3 roster is the contract').toBeGreaterThan(0);
  const bySlug = new Map(rendered.map((entry) => [entry.slug, entry.states]));

  for (const row of ROSTER) {
    const states = bySlug.get(row.slug);
    expect(states, `R-UI-011: /design renders an entry for ${row.slug}`).toBeDefined();
    for (const state of row.states) {
      expect(states ?? [], `R-UI-011: ${row.slug} renders its "${state}" state`).toContain(state);
    }
  }
  // The rule, not today's roster: whatever the page shows, it shows it in states.
  for (const entry of rendered) {
    expect(entry.states.length, `R-UI-011: ${entry.slug} renders at least one state`).toBeGreaterThan(
      0,
    );
  }
}

/** Is the focus inside this entry's section? (Overlay content is portalled out of it.) */
async function focusInside(page: Page, slug: string): Promise<boolean> {
  return await page.evaluate(
    (entry) => document.activeElement?.closest(`[data-testid="gallery-entry-${entry}"]`) !== null,
    slug,
  );
}

/**
 * Tab — and only Tab — until the focus lands inside this entry. No pointer touches the page:
 * reachability by keyboard is itself part of what Q-11 asks J-004 to prove.
 */
async function tabInto(page: Page, slug: string, budget = 400): Promise<void> {
  for (let press = 0; press < budget; press += 1) {
    await page.keyboard.press('Tab');
    if (await focusInside(page, slug)) return;
  }
  throw new Error(`Q-11: no Tab stop inside gallery-entry-${slug} within ${budget} presses`);
}

/**
 * The focus indicator on whatever the Tab landed on, with the live value of the token it is
 * supposed to be painted in. datum-primitives §1 (R-UI-012):
 * `.datum-focus-ring:focus-visible { outline: 2px solid var(--cobalt-500); outline-offset: 1px }`
 * — the token is read from the page rather than pinned to a hex, because §9 forks it per theme.
 */
async function focusRing(page: Page): Promise<{
  style: string;
  width: number;
  color: string;
  cobalt: string;
  name: string;
}> {
  return await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const style = getComputedStyle(el ?? document.body);
    const probe = document.createElement('span');
    probe.style.color = 'var(--cobalt-500)';
    document.body.append(probe);
    const cobalt = getComputedStyle(probe).color;
    probe.remove();
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      color: style.outlineColor,
      cobalt,
      name: (el?.textContent ?? el?.getAttribute('aria-label') ?? '').trim(),
    };
  });
}

/** How many overlay surfaces are open and visible right now. */
async function surfaceCount(page: Page): Promise<number> {
  return await page.locator(SURFACE).filter({ visible: true }).count();
}

/**
 * The live regions a keyboard response can speak through. A specimen that raises no overlay
 * surface (the toast entry announces; it does not open a menu) has exactly one contractual
 * way to be observed: R-UI-012's announcement. datum-primitives §12 mounts the Toaster's
 * messages in an ARIA live region, and sonner's own container is `aria-live="polite"`, so the
 * selector is the general one — any live region, whoever raises it.
 */
const LIVE = '[role="status"], [role="alert"], [aria-live]:not([aria-live="off"])';

/**
 * What every live region on the page is currently saying, whitespace-collapsed, silent
 * regions dropped. This is a *reading of the page's words*, not a count of its nodes: an
 * unrelated repaint elsewhere (a portal remounting, a previous specimen's toast animating
 * out) cannot add a sentence here, so it cannot be mistaken for a response.
 */
async function announcements(page: Page): Promise<string[]> {
  return await page.evaluate(
    (selector) =>
      Array.from(document.querySelectorAll(selector))
        .map((region) => (region.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((said) => said !== ''),
    LIVE,
  );
}

interface Rest {
  readonly surfaces: number;
  readonly said: readonly string[];
}

/** The page at rest, before a gesture is tried. */
async function restingState(page: Page): Promise<Rest> {
  return { surfaces: await surfaceCount(page), said: await announcements(page) };
}

interface Outcome {
  readonly kind: 'surface' | 'announced' | 'none';
  /** When `announced`: the words that were not being said before the gesture. */
  readonly said: readonly string[];
}

/**
 * What the last gesture produced: an overlay surface, a new announcement, or nothing.
 * Surfaces win the race — they are given the whole window before an announcement is
 * reported, so a menu is never mistaken for a spoken response.
 *
 * `listen: false` refuses the announcement branch outright, which is how a gesture that must
 * *open* something (see openFromKeyboard) is stopped from claiming a response it did not cause.
 */
async function outcomeOf(page: Page, rest: Rest, listen = true): Promise<Outcome> {
  const deadline = Date.now() + 900;
  let said: readonly string[] = [];
  for (;;) {
    if ((await surfaceCount(page)) > rest.surfaces) return { kind: 'surface', said: [] };
    if (listen) {
      const fresh = (await announcements(page)).filter((line) => !rest.said.includes(line));
      if (fresh.length > 0) said = fresh;
    }
    if (Date.now() >= deadline) {
      return said.length > 0 ? { kind: 'announced', said } : { kind: 'none', said: [] };
    }
    await page.waitForTimeout(60);
  }
}

/**
 * Open the focused specimen with the keyboard, trying the gestures the component decisions
 * name, in order: Enter (buttons, Dialog, Sheet, Popover, DropdownMenu, Select — §6, §10,
 * §11), ArrowDown (a closed Select or Combobox, §6, §7), then the two keyboard gestures that
 * raise a context menu (§10). Returns what the page did.
 *
 * Focus alone is tried first only for the specimens §3 says open on focus (Tooltip: "opens on
 * hover/focus", §9) — and even for those it can only be answered by a *surface*, never by an
 * announcement: nothing on this page is supposed to speak merely because focus arrived, so
 * counting a stray announcement there would let a specimen pass with no activation at all.
 */
async function openFromKeyboard(page: Page, rest: Rest, opensOnFocus: boolean): Promise<Outcome> {
  const pressed = ['Enter', 'ArrowDown', 'ContextMenu', 'Shift+F10'] as const;
  if (opensOnFocus) {
    const onFocus = await outcomeOf(page, rest, false);
    if (onFocus.kind !== 'none') return onFocus;
  }
  for (const gesture of pressed) {
    await page.keyboard.press(gesture);
    const outcome = await outcomeOf(page, rest);
    if (outcome.kind !== 'none') return outcome;
  }
  return { kind: 'none', said: [] };
}

test.describe('J-004 — the living gallery in both themes (R-UI-011, AM-03)', () => {
  test('checkpoints gallery-light and gallery-dark: every entry, axe clean, baselines match', async ({
    page,
  }) => {
    const gallery = new DesignGalleryPage(page);

    await test.step('checkpoint gallery-light', async () => {
      await gallery.open('light');
      // AC-1: ?theme=light renders light.
      expect(await gallery.theme(), 'AC-1: ?theme=light sets data-theme="light"').toBe('light');
      assertRoster(await gallery.rendered());

      // Q-11: axe on every journey checkpoint page, zero serious or critical.
      await expectNoSeriousOrCritical(page, 'gallery-light');

      // Q-06 / AC-4: the committed Linux baseline, no platform suffix, no volatile mask.
      // The name is an array, not 'design/gallery-light.png': Playwright sanitises a string
      // name before it reaches {arg} and turns the separator into a hyphen, so the string
      // form would target baselines/design-gallery-light.png and never compare against the
      // committed baselines/design/gallery-light.png this comment claims. Only the array
      // form is path-joined and keeps the directory segment.
      await expect(page).toHaveScreenshot(['design', 'gallery-light.png'], {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
        mask: [],
      });
    });

    await test.step('checkpoint gallery-dark', async () => {
      await gallery.open('dark');
      // AC-1: ?theme=dark sets data-theme="dark" on <html> — a total flip, same entry set.
      expect(await gallery.theme(), 'AC-1: ?theme=dark sets data-theme="dark"').toBe('dark');
      assertRoster(await gallery.rendered());

      await expectNoSeriousOrCritical(page, 'gallery-dark');

      // Q-06 / AC-4: the array form again — see the light checkpoint above.
      await expect(page).toHaveScreenshot(['design', 'gallery-dark.png'], {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
        mask: [],
      });
    });
  });

  test('AC-1: no query and an unknown theme both render light', async ({ page }) => {
    const gallery = new DesignGalleryPage(page);

    await gallery.open();
    expect(await gallery.theme(), 'AC-1: no query renders light').toBe('light');

    await gallery.open('midnight');
    expect(await gallery.theme(), 'AC-1: an unknown value renders light').toBe('light');
    // A refused theme still renders the gallery — the page never goes blank (R-UI-020).
    await expect(gallery.root).toBeVisible();
  });

  test('Q-11: the keyboard journey — the Dialog is reached, opened, trapped and dismissed by keyboard alone', async ({
    page,
  }) => {
    const gallery = new DesignGalleryPage(page);
    await gallery.open();

    // The test contract: "Interactive examples on the page include at least one Dialog with a
    // visible trigger." §3 marks gallery-entry-dialog "the contractual interactive Dialog".
    const trigger = gallery.entry('dialog').getByRole('button').first();
    await expect(trigger, 'AC-1: the dialog entry has a visible trigger').toBeVisible();

    // Q-11: the journey is conducted from the keyboard — the trigger is *reached* by Tab, and
    // nothing here is clicked. The pointer path is a separate test below (R-UI-030).
    await tabInto(page, 'dialog');
    await expect(trigger, 'Q-11: Tab reaches the dialog trigger').toBeFocused();

    // R-UI-012 / datum-primitives §1: where the Tab landed is visibly indicated — a 2 px
    // cobalt outer ring, compared against the live token value (§9 forks it per theme).
    const ring = await focusRing(page);
    expect(ring.style, 'R-UI-012: the focused trigger carries an outline').toBe('solid');
    expect(ring.width, 'R-UI-012: a 2 px outer ring').toBeGreaterThanOrEqual(2);
    expect(ring.color, 'R-UI-012: the ring is painted in --cobalt-500').toBe(ring.cobalt);

    // datum-primitives §11: Enter on the trigger opens; focus moves into the content.
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog, 'Q-11: Enter on the focused trigger opens the dialog').toBeVisible();
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
        { message: 'datum-primitives §11: focus moves into the dialog content on open' },
      )
      .toBe(true);

    // §11: "Tab and Shift+Tab cycle inside while open" — the focus never escapes the dialog.
    for (let press = 0; press < 8; press += 1) {
      await page.keyboard.press('Tab');
      const trapped = await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      );
      expect(trapped, `Q-11: Tab ${press + 1} stays inside the open dialog`).toBe(true);
    }

    // §11: "Escape closes; focus returns to the trigger."
    await page.keyboard.press('Escape');
    await expect(dialog, 'Q-11: Escape dismisses the dialog').toBeHidden();
    await expect(trigger, 'Q-11: focus returns to the trigger on close').toBeFocused();
  });

  test('Q-11: every §3 interactive specimen is operated from the keyboard alone', async ({
    page,
  }) => {
    const gallery = new DesignGalleryPage(page);
    await gallery.open();

    expect(
      INTERACTIVE.length,
      'AM-03: §3 designates the specimens that are operated, not posed',
    ).toBeGreaterThan(0);

    // Walk the specimens in the order the page lays them out, so one forward Tab pass reaches
    // them all — the order is read from the page, not assumed from the document.
    const laidOut = await page
      .locator('[data-testid^="gallery-entry-"]')
      .evaluateAll((sections) =>
        sections.map((section) =>
          (section.getAttribute('data-testid') ?? '').replace('gallery-entry-', ''),
        ),
      );
    const specimens = INTERACTIVE.map((row) => row.slug)
      .filter((slug) => laidOut.includes(slug))
      .sort((left, right) => laidOut.indexOf(left) - laidOut.indexOf(right));
    expect(
      specimens.length,
      'R-UI-011: every §3 interactive specimen has an entry on the page',
    ).toBe(INTERACTIVE.length);

    for (const slug of specimens) {
      await test.step(`keyboard: ${slug}`, async () => {
        const rest = await restingState(page);

        // Reached by Tab, and the landing is visible (R-UI-012 — the ring's colour is asserted
        // against the token on the dialog above; here every specimen must at least show one).
        await tabInto(page, slug);
        const ring = await focusRing(page);
        expect(ring.style, `R-UI-012: ${slug}'s tab stop shows a focus indicator`).not.toBe('none');
        expect(ring.width, `R-UI-012: ${slug}'s focus ring is 2 px`).toBeGreaterThanOrEqual(2);

        // Opened with the keyboard gestures its component decision names — never a pointer.
        const outcome = await openFromKeyboard(page, rest, opensOnFocus(slug));
        expect(outcome.kind, `Q-11: ${slug} responds to a keyboard opening gesture`).not.toBe(
          'none',
        );

        if (outcome.kind === 'announced') {
          // No surface to dismiss: this specimen speaks instead (the toast entry announces).
          // The response is read as words, not as a repaint — and where §3 names the copy the
          // specimen fires, those are the words §6 decided, verbatim (AM-03 (2): copy is design).
          const spoken = outcome.said.join(' ');
          const decided = announcedCopy(slug);
          if (decided !== undefined) {
            expect(spoken, `AM-03: ${slug} announces its §6 copy — "${decided}"`).toContain(decided);
          } else {
            expect(
              spoken.length,
              `Q-11: ${slug}'s keyboard activation announces something`,
            ).toBeGreaterThan(0);
          }
          // The focus stayed where the keyboard put it — activation strands nobody (§1).
          expect(await focusInside(page, slug), `Q-11: ${slug} keeps the focus it was given`).toBe(
            true,
          );
          return;
        }

        const items = page.locator(SURFACE).filter({ visible: true }).locator(ITEM);
        if ((await items.count()) > 0) {
          // datum-primitives §1: "the highlight moves with ArrowUp/ArrowDown, Enter activates,
          // Escape closes and returns focus to the trigger."
          await page.keyboard.press('ArrowDown');
          const moved = await page.evaluate(
            ({ surfaceSelector, itemSelector }) => {
              const active = document.activeElement;
              if (active?.closest(itemSelector) != null) return true;
              const described = active?.getAttribute('aria-activedescendant');
              if (described != null && document.getElementById(described) != null) return true;
              return Array.from(document.querySelectorAll(surfaceSelector))
                .filter((surface) => surface.getClientRects().length > 0)
                .some(
                  (surface) =>
                    surface.querySelector('[data-highlighted], [aria-selected="true"]') != null,
                );
            },
            { surfaceSelector: SURFACE, itemSelector: ITEM },
          );
          expect(moved, `Q-11: ArrowDown moves ${slug}'s highlight`).toBe(true);

          // Enter commits the highlighted item and closes the surface.
          await page.keyboard.press('Enter');
        } else {
          // A surface with nothing to arrow through (Dialog, Sheet, Popover, Tooltip): Escape.
          await page.keyboard.press('Escape');
        }

        await expect
          .poll(() => surfaceCount(page), {
            message: `Q-11: ${slug}'s surface closes from the keyboard`,
          })
          .toBe(rest.surfaces);
        // datum-primitives §1/§11 (which datum-patterns §9 composes): closing "returns focus to
        // the trigger". A keyboard reader left on <body> has to start the page again.
        await expect
          .poll(() => focusInside(page, slug), {
            message: `Q-11: ${slug} returns the focus to its trigger, not to <body>`,
          })
          .toBe(true);
      });
    }
  });

  test('R-UI-030: the Dialog example also opens from the pointer and closes on Escape', async ({
    page,
  }) => {
    const gallery = new DesignGalleryPage(page);
    await gallery.open();

    const trigger = gallery.entry('dialog').getByRole('button').first();
    await expect(trigger, 'AC-1: the dialog entry has a visible trigger').toBeVisible();

    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog, 'R-UI-030: the dialog opens on its trigger').toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog, 'R-UI-030: Escape dismisses it').toBeHidden();
  });
});
