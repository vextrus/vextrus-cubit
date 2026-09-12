/**
 * The page object for S-Viewer's snapping region (inc-206), beside `s-viewer.page.ts` because the
 * merged hotfix suite freezes the page-object directory.
 *
 * It states WHERE things are and HOW they are reached — the test ids the Design Decision closes (§7)
 * and the gestures I-145 fixes — and judges nothing: every expectation belongs to the journey that
 * walks it. The sheet's own geometry is read from the feed the screen itself reads, so a journey's
 * anchors are the drawing's own points rather than numbers typed into a spec (B-19).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

/** One drawn record of the served sheet, as the feed answers one. */
export type SheetRecord = { key: string; type: string; points: [number, number][] };

/** One point of interest of the sheet, and what it is: an endpoint of a record, or its midpoint. */
export type Feature = { kind: "endpoint" | "midpoint"; key: string; type: string; at: [number, number] };

/** The properties a glyph's SHAPE is drawn from — the channel R-UI-060 asks for beside the word. */
export const SHAPE_PROPERTIES: readonly string[] = Object.freeze([
  "width",
  "height",
  "border-radius",
  "border-top-width",
  "border-left-width",
  "clip-path",
  "transform",
]);

export class SViewerSnapPage {
  constructor(private readonly page: Page) {}

  get toggle(): Locator {
    return this.page.getByTestId("viewer-snap-toggle");
  }

  get ortho(): Locator {
    return this.page.getByTestId("viewer-snap-ortho");
  }

  get angle(): Locator {
    return this.page.getByTestId("viewer-snap-angle");
  }

  get glyph(): Locator {
    return this.page.getByTestId("viewer-snap-glyph");
  }

  get picks(): Locator {
    return this.page.getByTestId("viewer-snap-pick");
  }

  get statusSnap(): Locator {
    return this.page.getByTestId("viewer-status-snap");
  }

  get statusDistance(): Locator {
    return this.page.getByTestId("viewer-status-distance");
  }

  /** Whether a toggle reads as pressed — the one channel WCAG gives a toggle (4.1.2). */
  async isPressed(toggle: Locator): Promise<boolean> {
    const stated = await toggle.getAttribute("aria-pressed");
    expect(stated, "a toolbar toggle states whether it is pressed").not.toBeNull();
    return stated === "true";
  }

  /** A `data-` hook of one element, refused where it carries none. */
  async hook(on: Locator, name: string): Promise<string> {
    const raw = await on.getAttribute(name);
    expect(raw, `the element publishes ${name} (Decision §7)`).not.toBeNull();
    return raw as string;
  }

  /**
   * Every drawn record of the opened sheet, read from the same progressive feed the screen reads —
   * so a journey's anchors are the served drawing's own points (R-UI-043).
   */
  async sheetRecords(sheet: { tenantId: string; drawingId: string; layoutName: string }, layers: number): Promise<SheetRecord[]> {
    const answered = await this.page.evaluate(
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
    expect(answered.length, "the served sheet carries drawn records to snap to").toBeGreaterThan(0);
    return answered;
  }

  /**
   * Every point of the sheet a snap can land on: each record's drawn points, and the middle of each
   * of its segments. A record carrying one point alone contributes that point — it draws no segment
   * to snap along, but it is still somewhere the pointer may meet something, so it counts when a
   * journey asks for a point standing clear of everything.
   */
  static featuresOf(records: readonly SheetRecord[]): Feature[] {
    const found: Feature[] = [];
    for (const record of records) {
      const points = record.points;
      for (const at of points) found.push({ kind: "endpoint", key: record.key, type: record.type, at: [at[0], at[1]] });
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1] as [number, number];
        const to = points[index] as [number, number];
        found.push({ kind: "midpoint", key: record.key, type: record.type, at: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] });
      }
    }
    return found;
  }

  /**
   * A feature of the asked-for kind and drawn type standing `clearance` drawing units clear of every
   * feature of every OTHER record, and `ownClearance` clear of the rest of its own record's — so
   * what the pointer meets there is that record and that point, whatever the priority ladder does.
   * Refused loudly where the sheet draws none, which is a fixture fact rather than a product one.
   */
  static isolated(features: readonly Feature[], o: { kind: Feature["kind"]; type: string; clearance: number; ownClearance?: number; notKey?: string }): Feature {
    const own = o.ownClearance ?? o.clearance;
    const found = features.find(
      (one) =>
        one.kind === o.kind &&
        one.type === o.type &&
        one.key !== o.notKey &&
        features.every((other) => {
          if (other === one) return true;
          const apart = Math.hypot(other.at[0] - one.at[0], other.at[1] - one.at[1]);
          return apart > (other.key === one.key ? own : o.clearance);
        }),
    );
    expect(
      found,
      `the staged sheet draws a ${o.type} ${o.kind} standing more than ${o.clearance} drawing units clear of every other record's points, and ${own} clear of its own`,
    ).toBeTruthy();
    return found as Feature;
  }

  /**
   * The emptiest point of the drawn sheet: the node of a regular lattice over the records' own
   * bounding box that stands furthest from every point a snap could land on. Bare paper, derived
   * from the sheet rather than guessed at a corner of the stage.
   */
  static emptiest(features: readonly Feature[], steps = 24): { at: [number, number]; clear: number } {
    const xs = features.map((one) => one.at[0]);
    const ys = features.map((one) => one.at[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    let best: { at: [number, number]; clear: number } = { at: [minX, minY], clear: -1 };
    for (let ix = 0; ix <= steps; ix += 1) {
      for (let iy = 0; iy <= steps; iy += 1) {
        const at: [number, number] = [minX + ((maxX - minX) * ix) / steps, minY + ((maxY - minY) * iy) / steps];
        let clear = Number.POSITIVE_INFINITY;
        for (const one of features) clear = Math.min(clear, Math.hypot(one.at[0] - at[0], one.at[1] - at[1]));
        if (clear > best.clear) best = { at, clear };
      }
    }
    expect(best.clear, "the staged sheet leaves a patch of bare paper inside its own extents").toBeGreaterThan(0);
    return best;
  }

  /** The pointer put on a point of the sheet, given where the projection says it stands. */
  async hoverAt(at: { x: number; y: number }): Promise<void> {
    await this.page.mouse.move(at.x, at.y);
  }

  /** Alt+click — the pick gesture (I-145). */
  async pickAt(at: { x: number; y: number }): Promise<void> {
    await this.page.mouse.move(at.x, at.y);
    await this.page.keyboard.down("Alt");
    await this.page.mouse.down();
    await this.page.mouse.up();
    await this.page.keyboard.up("Alt");
  }

  /** The properties one glyph's shape is drawn from, as one comparable string. */
  async shapeSignature(): Promise<string> {
    // The registry is a NODE-side declaration: `testIdSelector` and `TESTIDS` do not exist in the
    // page, so the selector is resolved here and handed in as the argument (AM-09 §1 asks that the
    // id be read from the registry, not that the browser be able to read it).
    return this.page.evaluate(
      ({ selector, properties }) => {
        const element = document.querySelector(selector);
        if (element === null) return "";
        const read = (on: Element, pseudo: string | null): string => properties.map((name) => window.getComputedStyle(on, pseudo).getPropertyValue(name)).join("|");
        return [read(element, null), read(element, "::before"), read(element, "::after")].join("//");
      },
      { selector: testIdSelector(TESTIDS.viewer.snapGlyph), properties: [...SHAPE_PROPERTIES] },
    );
  }

  /** One computed property of the live glyph. */
  async glyphStyle(property: string): Promise<string> {
    return this.page.evaluate(
      ([selector, name]) => {
        const element = document.querySelector(String(selector));
        return element === null ? "" : window.getComputedStyle(element).getPropertyValue(String(name));
      },
      [testIdSelector(TESTIDS.viewer.snapGlyph), property] as const,
    );
  }

  /** A design token's value as the document resolves it right now (R-UI-001). */
  async token(name: string): Promise<string> {
    return this.page.evaluate(([held]) => window.getComputedStyle(document.documentElement).getPropertyValue(String(held)).trim(), [name] as const);
  }

  /**
   * A colour token as the browser itself computes it — in the same spelling a computed style reads
   * back, so a journey compares what an element paints with against what the token resolves to
   * rather than against a value typed into a spec (R-UI-001).
   */
  async resolvedColour(token: string): Promise<string> {
    return this.page.evaluate(([name]) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${String(name)})`;
      document.body.appendChild(probe);
      const value = window.getComputedStyle(probe).color;
      probe.remove();
      return value;
    }, [token] as const);
  }
}
