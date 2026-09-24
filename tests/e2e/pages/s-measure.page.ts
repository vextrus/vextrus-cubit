// S-Measure as a journey drives it (docs/design/s-measure.md § 9, the closed contract C-05): the
// condition chest in the drawer, the armed tool's draft on the sheet, the card at the closing point and
// the measure cell — spelled once so no journey writes a selector twice (B-17).
//
// It holds no opinion about the sheet: the camera, the address and the projection a click is aimed
// through are `tests/e2e/viewer/s-viewer.page.ts`'s, and what the sheet draws is read off the served
// layer feed exactly as the scale panel's page reads it — in the sheet's own coordinates, a paper
// sheet's model entities already projected through their window (I-501), never transcribed (B-19).
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { heldAttribute } from "../support/retrying-read";
import { afterSettled } from "../support/settled";
import type { SViewerPage } from "../viewer/s-viewer.page";

/** One drawn record of a sheet, as the layer feed serves it (its points in the sheet's own space). */
export type MeasureRecord = { key: string; points: [number, number][] };

/** How many layers of a sheet the feed is asked for: every index it answers, the rest skipped. */
const LAYER_REACH = 64;

export class SMeasurePage {
  constructor(private readonly page: Page) {}

  /* ----------------------------------------------------------------------------- the chest */

  get chest(): Locator {
    return this.page.getByTestId(TESTIDS.measure.chest);
  }

  /** One condition's row in the chest, by the name it is listed under. */
  condition(name: string): Locator {
    return this.page.getByTestId(TESTIDS.measure.chestCondition).filter({ hasText: name });
  }

  /** How many standing hand measurements cite a condition in the open campaign (I-575). */
  async measured(name: string): Promise<number> {
    return Number(await heldAttribute(this.condition(name).locator("[data-measured]"), "data-measured"));
  }

  /** Put a condition in the chest through New condition, as a QS does: the name and a thickness; the rest as the form opens. */
  async author(name: string, thickness: string): Promise<void> {
    await this.page.getByTestId(TESTIDS.measure.chestNew).click();
    const form = this.page.getByTestId(TESTIDS.measure.conditionForm);
    await expect(form, "New condition opens its form (§ 2.6)").toBeVisible();
    await form.locator("#measure-condition-name").fill(name);
    await form.locator("#measure-condition-reading-t").fill(thickness);
    await this.page.getByTestId(TESTIDS.measure.conditionSave).click();
  }

  /** Pick a condition: its row's button, which arms its tool (§ 2.6). */
  async pick(name: string): Promise<void> {
    await this.condition(name).locator("button").first().click();
  }

  /* ----------------------------------------------------------------------------- the sheet */

  get draft(): Locator {
    return this.page.getByTestId(TESTIDS.measure.draft);
  }

  get points(): Locator {
    return this.page.getByTestId(TESTIDS.measure.point);
  }

  get cell(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.statusMeasure);
  }

  /** Every record of one sheet the served feed draws, keyed by the entity it shows (`key`, or the original a paint names as `src`). */
  async records(sheet: { tenantId: string; drawingId: string; layoutName: string }): Promise<MeasureRecord[]> {
    return afterSettled(this.page, () =>
      this.page.evaluate(
        async ([tenantId, drawingId, layoutName, count]) => {
          const held: { key: string; points: [number, number][] }[] = [];
          for (let index = 0; index < Number(count); index += 1) {
            const response = await fetch(`/api/viewer/${drawingId}/${encodeURIComponent(String(layoutName))}?tenant=${tenantId}&part=layer&index=${index}`);
            if (!response.ok) continue;
            const body = (await response.json()) as { records?: { key?: string; src?: string; points?: [number, number][] }[] };
            for (const record of body.records ?? []) {
              const identity = record.key ?? record.src;
              if (identity !== undefined && record.points !== undefined) held.push({ key: identity, points: record.points });
            }
          }
          return held;
        },
        [sheet.tenantId, sheet.drawingId, sheet.layoutName, String(LAYER_REACH)] as const,
      ),
    );
  }

  /** The vertices a record draws, in the sheet's space — a closed ring's repeated first point dropped. */
  static ringOf(records: readonly MeasureRecord[], key: string): [number, number][] {
    const record = records.find((held) => held.key === key && held.points.length >= 2);
    expect(record, `the sheet draws ${key}`).toBeDefined();
    const points = (record as MeasureRecord).points;
    const first = points[0] as [number, number];
    const last = points[points.length - 1] as [number, number];
    return first[0] === last[0] && first[1] === last[1] ? points.slice(0, -1) : [...points];
  }

  /** The viewport that shows a ring whole, filling most of the canvas: `x,y,scale`, the address's own form. */
  static viewportOver(ring: readonly [number, number][], canvas: { width: number; height: number }): string {
    const xs = ring.map((point) => point[0]);
    const ys = ring.map((point) => point[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const scale = 0.7 * Math.min(canvas.width / width, canvas.height / height);
    return `${(Math.min(...xs) + Math.max(...xs)) / 2},${(Math.min(...ys) + Math.max(...ys)) / 2},${scale}`;
  }

  /** Click each vertex of a ring where the projection puts it: the endpoint snap meets the drawn point there. */
  async trace(viewer: SViewerPage, ring: readonly [number, number][]): Promise<void> {
    for (const vertex of ring) {
      const at = await viewer.screenPointOf(vertex);
      await this.page.mouse.move(at.x, at.y);
      await this.page.mouse.down();
      await this.page.mouse.up();
    }
  }

  /* ----------------------------------------------------------------------------- the card */

  get card(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.dialog);
  }

  get confirm(): Locator {
    return this.card.getByTestId(TESTIDS.consequence.confirm);
  }

  get quantity(): Locator {
    return this.card.getByTestId(TESTIDS.consequence.measurementQuantity);
  }

  get reading(): Locator {
    return this.card.getByTestId(TESTIDS.consequence.measurementReading);
  }

  get level(): Locator {
    return this.card.getByTestId(TESTIDS.consequence.measurementLevel);
  }

  get readingChoice(): Locator {
    return this.card.getByTestId(TESTIDS.consequence.measurementReadingChoice);
  }

  get refusal(): Locator {
    return this.card.locator(testIdSelector(TESTIDS.refusal.state));
  }

  /** Take the option of a card Select whose words match, as a hand does: open it, click the option. */
  async choose(select: Locator, words: RegExp): Promise<void> {
    await select.click();
    await this.page.getByRole("option", { name: words }).click();
  }
}
