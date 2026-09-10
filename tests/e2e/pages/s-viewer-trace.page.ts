/**
 * The Trace's target, as J-021 walks it (docs/design/s-viewer-inspector.md, amended by inc-215).
 *
 * Every locator is found by the id the test contract closes or by the role and name a reader uses;
 * nothing here knows a class name or a DOM shape. The Builder may edit this file (test contract).
 */
import { expect, type Locator, type Page } from "@playwright/test";

/** The Trace address, spelled once (C-05): the cited keys, the origin line, and no `v`. */
export const S_VIEWER_TRACE = Object.freeze({
  at: (tenantId: string, projectId: string, drawingId: string, layoutName: string, keys: readonly string[], lineId: string): string => {
    const query = new URLSearchParams();
    query.set("s", keys.join(","));
    query.set("line", lineId);
    return `/t/${tenantId}/p/${projectId}/viewer/${encodeURIComponent(drawingId)}/${encodeURIComponent(layoutName)}?${query.toString()}`;
  },
} as const);

export class SViewerTracePage {
  constructor(private readonly page: Page) {}

  get screen(): Locator {
    return this.page.getByTestId("viewer-screen");
  }

  get inspector(): Locator {
    return this.page.getByTestId("viewer-inspector");
  }

  get selection(): Locator {
    return this.page.getByTestId("viewer-inspector-selection");
  }

  get entities(): Locator {
    return this.page.getByTestId("viewer-inspector-entity");
  }

  /* --- the Trace block (AC-4) --- */

  get trace(): Locator {
    return this.page.getByTestId("viewer-inspector-trace");
  }

  get formula(): Locator {
    return this.page.getByTestId("viewer-inspector-trace-formula");
  }

  get variables(): Locator {
    return this.page.getByTestId("viewer-inspector-trace-variable");
  }

  get origin(): Locator {
    return this.page.getByTestId("viewer-inspector-trace-origin");
  }

  get retry(): Locator {
    return this.page.getByTestId("viewer-inspector-trace-retry");
  }

  /* --- the Cited-by block (AC-6) --- */

  get cited(): Locator {
    return this.page.getByTestId("viewer-inspector-cited");
  }

  get citedLines(): Locator {
    return this.page.getByTestId("viewer-inspector-cited-line");
  }

  /** The keys the panel holds, in the order it lists them. */
  async selectedKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (const row of await this.entities.all()) keys.push((await row.getAttribute("data-key")) ?? "");
    return keys;
  }

  /** The selection the address carries, in the order the address carries it. */
  addressKeys(): string[] {
    const stated = new URL(this.page.url()).searchParams.get("s");
    return stated === null || stated === "" ? [] : stated.split(",");
  }

  /** The line the address named as the Trace's origin. */
  addressLine(): string | null {
    return new URL(this.page.url()).searchParams.get("line");
  }

  /** Wait for the travel to land — the screen says so itself, so nothing here sleeps (Decision §4). */
  async settled(): Promise<void> {
    await expect(this.screen, "the fly-to lands and the screen says so").toHaveAttribute("data-flyto", "settled", { timeout: 15_000 });
  }

  /** The basis the Trace is held in, as the screen publishes it while it holds one. */
  traceBasis(): Promise<string | null> {
    return this.screen.getAttribute("data-trace-basis");
  }

  /** One variable row's whole reading, by the name it was bound under. */
  async variable(name: string): Promise<{ value: string; unit: string; basis: string; source: string }> {
    const row = this.page.locator(`[data-testid="viewer-inspector-trace-variable"][data-name="${name}"]`);
    await expect(row, `the Trace block states the variable ${name}`).toBeVisible();
    return {
      value: (await row.getAttribute("data-value")) ?? "",
      unit: (await row.getAttribute("data-unit")) ?? "",
      basis: (await row.getAttribute("data-basis")) ?? "",
      source: (await row.getAttribute("data-source")) ?? "",
    };
  }

  /** The names the Trace block states, in binding order. */
  async variableNames(): Promise<string[]> {
    const names: string[] = [];
    for (const row of await this.variables.all()) names.push((await row.getAttribute("data-name")) ?? "");
    return names;
  }

  /** The lines the Cited-by block lists, in the order it lists them. */
  async citedLineIds(): Promise<string[]> {
    const held: string[] = [];
    for (const row of await this.citedLines.all()) held.push((await row.getAttribute("data-line")) ?? "");
    return held;
  }

  /**
   * The per-run texts a picture of this region must not diff on (s-viewer.md §7's class).
   *
   * A cited line's link is labelled with that line's object key (s-viewer-inspector I-184's
   * anatomy), and an object key ends in the id of the drawing the campaign staged — a fresh uuid
   * every run. The lines are listed in `publishedAt` then `lineId` order and `lineId` is a uuid
   * too, so the order those equal-timestamped rows fall into is per-run as well. Both are the same
   * class of volatility: the picture grades the block's shape, its count line and each row's kind,
   * value and unit, and reads nothing into which uuid this run happened to mint.
   */
  masks(): Locator[] {
    return [this.page.getByTestId("shell-user"), this.page.getByTestId("shell-tenant-switcher"), this.citedLines.getByTestId("evidence-link")];
  }

  at(): Page {
    return this.page;
  }
}
