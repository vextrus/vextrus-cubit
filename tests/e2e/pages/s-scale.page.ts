// S-Viewer's scale panel as a journey drives it (inc-205's test contract): the closed test ids of
// docs/design/s-scale.md §7, and the gestures J-020 walks — spelled once so no journey writes a
// selector or a theme flip twice (C-05, B-17).
//
// It holds no opinion about the sheet beside it: the camera, the address and the status line are
// `tests/e2e/viewer/s-viewer.page.ts`'s, the picks are `s-viewer-snap.page.ts`'s and the overlay is
// `s-viewer-partition.page.ts`'s. A journey that reads several opens several.
import { expect, type Locator, type Page } from "@playwright/test";

/** The test ids this region publishes (Decision §7, C-05). */
export const S_SCALE = Object.freeze({
  tabs: "viewer-inspector-tabs",
  tabSelection: "viewer-inspector-tab-selection",
  tabScale: "viewer-inspector-tab-scale",
  inspector: "viewer-inspector",
  panel: "viewer-scale",
  view: "viewer-scale-view",
  proposal: "viewer-scale-proposal",
  member: "viewer-scale-member",
  affirm: "viewer-scale-affirm",
  distance: "viewer-scale-distance",
  unit: "viewer-scale-unit",
  observe: "viewer-scale-observe",
  observation: "viewer-scale-observation",
  checkVerification: "viewer-scale-check-verification",
  answer: "viewer-scale-answer",
  retry: "viewer-scale-retry",
});

/** One drawn record of the sheet, as the layer feed serves one. */
export type SheetRecord = { key: string; type: string; points: [number, number][] };

/** A segment of the sheet a two-point calibration can be taken across: its key and its two ends. */
export type Segment = { key: string; from: [number, number]; to: [number, number] };

export class SScalePage {
  constructor(private readonly page: Page) {}

  get tabs(): Locator {
    return this.page.getByTestId(S_SCALE.tabs);
  }

  get selectionTab(): Locator {
    return this.page.getByTestId(S_SCALE.tabSelection);
  }

  get scaleTab(): Locator {
    return this.page.getByTestId(S_SCALE.tabScale);
  }

  get panel(): Locator {
    return this.page.getByTestId(S_SCALE.panel);
  }

  get rows(): Locator {
    return this.page.getByTestId(S_SCALE.view);
  }

  get proposals(): Locator {
    return this.page.getByTestId(S_SCALE.proposal);
  }

  get distance(): Locator {
    return this.page.getByTestId(S_SCALE.distance);
  }

  get unit(): Locator {
    return this.page.getByTestId(S_SCALE.unit);
  }

  get observe(): Locator {
    return this.page.getByTestId(S_SCALE.observe);
  }

  get observations(): Locator {
    return this.page.getByTestId(S_SCALE.observation);
  }

  get checkVerification(): Locator {
    return this.page.getByTestId(S_SCALE.checkVerification);
  }

  get answer(): Locator {
    return this.page.getByTestId(S_SCALE.answer);
  }

  get dialog(): Locator {
    return this.page.getByTestId("consequence-dialog");
  }

  get subjectRows(): Locator {
    return this.page.getByTestId("consequence-subject-row");
  }

  get digestLine(): Locator {
    return this.page.getByTestId("consequence-digest-line");
  }

  get confirm(): Locator {
    return this.page.getByTestId("consequence-confirm");
  }

  get effectLines(): Locator {
    return this.page.getByTestId("consequence-effect-lines");
  }

  get effectSignatures(): Locator {
    return this.page.getByTestId("consequence-effect-signatures");
  }

  /** One view's row, by the key it names. */
  row(viewKey: string): Locator {
    return this.page.locator(`[data-testid="${S_SCALE.view}"][data-view-key="${viewKey}"]`);
  }

  /** The checkbox that includes one view in the affirmation (I-157). */
  member(viewKey: string): Locator {
    return this.row(viewKey).locator(`[data-testid="${S_SCALE.member}"]`);
  }

  /** The Affirm door offered at one rank. */
  affirm(rank: string): Locator {
    return this.page.locator(`[data-testid="${S_SCALE.affirm}"][data-rank="${rank}"]`);
  }

  /** The panel opened at its tab, once the door has answered. */
  async open(): Promise<void> {
    await this.scaleTab.click();
    await expect(this.panel, "the scale tab shows the scale panel").toBeVisible();
    await expect
      .poll(async () => this.panel.getAttribute("data-state"), { message: "the panel settles out of its loading state" })
      .not.toBe("loading");
  }

  /** A `data-` hook of an element, refused loudly where it is not published. */
  async hook(on: Locator, name: string): Promise<string> {
    const raw = await on.getAttribute(name);
    expect(raw, `the element publishes ${name} (Decision §7)`).not.toBeNull();
    return raw as string;
  }

  /** Every view key the panel answered for, in the order the rows stand in. */
  async viewKeys(): Promise<string[]> {
    return Promise.all((await this.rows.all()).map((row) => this.hook(row, "data-view-key")));
  }

  /** The rows standing at a declared absence — a view no act names (L-MEA-05). */
  async absentRows(): Promise<string[]> {
    const keys: string[] = [];
    for (const row of await this.rows.all()) {
      const state = await this.hook(row, "data-state");
      if (state !== "affirmed") keys.push(await this.hook(row, "data-view-key"));
    }
    return keys;
  }

  /** Every drawn record of one sheet, read off the served layer feed. */
  async sheetRecords(sheet: { tenantId: string; drawingId: string; layoutName: string }, layers: number): Promise<SheetRecord[]> {
    return this.page.evaluate(
      async ([tenantId, drawingId, layoutName, count]) => {
        const held: { key: string; type: string; points: [number, number][] }[] = [];
        for (let index = 0; index < Number(count); index += 1) {
          const response = await fetch(`/api/viewer/${drawingId}/${encodeURIComponent(String(layoutName))}?tenant=${tenantId}&part=layer&index=${index}`);
          if (!response.ok) continue;
          const body = (await response.json()) as { records?: { key?: string; src?: string; type: string; points?: [number, number][] }[] };
          for (const record of body.records ?? []) {
            const identity = record.key ?? record.src;
            if (identity === undefined || record.points === undefined) continue;
            held.push({ key: identity, type: record.type, points: record.points });
          }
        }
        return held;
      },
      [sheet.tenantId, sheet.drawingId, sheet.layoutName, String(layers)] as const,
    );
  }

  /**
   * The segment a two-point calibration is taken across: a two-point record whose ends stand on ONE
   * axis (so the observation speaks for that axis) and whose ends stand clear of every other point
   * the sheet draws by `clearance` drawing units, so each pick can only have met that end. Chosen by
   * the longest such span, and derived from the served sheet rather than transcribed (B-19).
   */
  static calibratable(records: readonly SheetRecord[], o: { type: string; clearance: number }): Segment {
    const points = records.flatMap((record) => record.points.map((at) => ({ key: record.key, at })));
    const clear = (key: string, at: [number, number]): boolean =>
      points.every((other) => other.key === key || Math.hypot(other.at[0] - at[0], other.at[1] - at[1]) > o.clearance);

    const found = records
      .filter((record) => record.type === o.type && record.points.length === 2)
      .map((record) => ({ key: record.key, from: record.points[0] as [number, number], to: record.points[1] as [number, number] }))
      .filter((segment) => segment.from[0] === segment.to[0] || segment.from[1] === segment.to[1])
      .filter((segment) => clear(segment.key, segment.from) && clear(segment.key, segment.to))
      .sort((left, right) => Math.hypot(right.to[0] - right.from[0], right.to[1] - right.from[1]) - Math.hypot(left.to[0] - left.from[0], left.to[1] - left.from[1]));

    const segment = found[0];
    expect(segment, `the staged sheet draws a ${o.type} on one axis whose ends stand ${o.clearance} drawing units clear of everything else`).toBeTruthy();
    return segment as Segment;
  }

  /** Flip the document's theme the way the shell does, and wait for the root to say so. */
  async setTheme(theme: "light" | "dark"): Promise<void> {
    await this.page.evaluate((asked) => document.documentElement.setAttribute("data-theme", asked), theme);
    await expect(this.page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", theme);
  }
}
