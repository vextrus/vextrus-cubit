/**
 * Page object — the living gallery at /design (S-Design, R-UI-011).
 *
 * The journey talks to the screen through the names the Design Decision §10 introduced and
 * the test contract repeats: the route, `data-testid="design-gallery"`,
 * `gallery-entry-<slug>` and `data-gallery-state="<state name>"`. Nothing here knows how the
 * page is built.
 */
import type { Locator, Page } from '@playwright/test';

/** One entry as the page renders it: its slug and the state blocks inside it. */
export interface RenderedEntry {
  readonly slug: string;
  readonly states: readonly string[];
}

export class DesignGalleryPage {
  constructor(private readonly page: Page) {}

  /** `/design`, optionally with a `?theme=` value — including a value that means nothing. */
  async open(theme?: string): Promise<void> {
    const url = theme === undefined ? '/design' : `/design?theme=${encodeURIComponent(theme)}`;
    await this.page.goto(url);
    await this.root.waitFor({ state: 'visible' });
    // Fonts settle before any checkpoint: a baseline taken mid-swap is a flake, not a diff.
    await this.page.evaluate(async () => {
      await document.fonts.ready;
    });
  }

  /** The page root (AC-1). */
  get root(): Locator {
    return this.page.getByTestId('design-gallery');
  }

  /** One entry section. */
  entry(slug: string): Locator {
    return this.page.getByTestId(`gallery-entry-${slug}`);
  }

  /** One state block inside an entry. */
  state(slug: string, name: string): Locator {
    return this.entry(slug).locator(`[data-gallery-state="${name}"]`);
  }

  /** `data-theme` on `<html>` — what `?theme=` decided (AC-1). */
  async theme(): Promise<string | null> {
    return await this.page.locator('html').getAttribute('data-theme');
  }

  /** Every entry the page rendered, with the state names inside it. */
  async rendered(): Promise<RenderedEntry[]> {
    return await this.page.locator('[data-testid^="gallery-entry-"]').evaluateAll((sections) =>
      sections.map((section) => ({
        slug: (section.getAttribute('data-testid') ?? '').replace('gallery-entry-', ''),
        states: Array.from(section.querySelectorAll('[data-gallery-state]')).map(
          (block) => block.getAttribute('data-gallery-state') ?? '',
        ),
      })),
    );
  }
}
