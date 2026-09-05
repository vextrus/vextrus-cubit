// S-Viewer as a journey drives it (inc-110's test contract). The address, the closed test ids of the
// Design Decision §7, and the gestures J-011 walks — spelled once so no journey writes a path or a
// scripted pan twice.
//
// It lives under tests/e2e/viewer/ rather than tests/e2e/pages/: the merged hotfix suite freezes the
// page-object directory, and this increment claims none of it.
import { expect, type Locator, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";

/** The addresses S-Viewer answers at (test contract). */
export const S_VIEWER = Object.freeze({
  /** The sheet itself: the tree's own convention, `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`. */
  route: (tenantId: string, projectId: string, drawingId: string, layoutName: string): string =>
    `/t/${tenantId}/p/${projectId}/viewer/${drawingId}/${encodeURIComponent(layoutName)}`,
  /** The same sheet at a stated viewport — the deep link R-UI-031 owes. */
  at: (tenantId: string, projectId: string, drawingId: string, layoutName: string, viewport: string): string =>
    `${S_VIEWER.route(tenantId, projectId, drawingId, layoutName)}?v=${encodeURIComponent(viewport)}`,
  /**
   * The same sheet with a selection, and optionally the camera to see it at (inc-111's widened
   * query): `s` is the source keys comma-joined in selection order, `v` the camera when one is
   * stated. Written as one home so no journey spells the parameter names twice (C-05).
   */
  selecting: (tenantId: string, projectId: string, drawingId: string, layoutName: string, keys: readonly string[], viewport?: string): string => {
    const query = new URLSearchParams();
    if (viewport !== undefined) query.set("v", viewport);
    query.set("s", keys.join(","));
    return `${S_VIEWER.route(tenantId, projectId, drawingId, layoutName)}?${query.toString()}`;
  },
} as const);

/** The world box a selection row publishes, as `minx,miny,maxx,maxy` (Decision §1). */
export type SelectionBox = { minX: number; minY: number; maxX: number; maxY: number };

/** The budgets the client publishes and PB-2/PB-3 state, as this journey grades against them. */
export const VIEWER_BUDGETS = Object.freeze({
  firstPaintColdMs: 6000,
  firstPaintWarmMs: 2000,
  frameMedianMs: 16.7,
  /** Headless software GL: two vsyncs at the tail, while the median holds PB-3 (Decision §7). */
  frameP95Ms: 33,
});

/** The eight bytes a PNG opens with, as decimals — a hex number here would read as a colour (R-UI-001). */
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** How much of one channel a byte holds, and the weights sRGB luminance is taken with. */
const CHANNEL_VALUES = 256;

/** Paeth's predictor, as the PNG format defines filter type 4. */
function paeth(left: number, above: number, corner: number): number {
  const estimate = left + above - corner;
  const toLeft = Math.abs(estimate - left);
  const toAbove = Math.abs(estimate - above);
  const toCorner = Math.abs(estimate - corner);
  if (toLeft <= toAbove && toLeft <= toCorner) return left;
  return toAbove <= toCorner ? above : corner;
}

/**
 * The mean sRGB luminance of a PNG capture, decoded rather than trusted: signature, IHDR, the IDATs
 * inflated and the scanline filters undone. It is what "the canvas corner is lighter in light than in
 * dark" is measured with, and it names no colour of its own — the two captures are compared to each
 * other (R-UI-001: no acceptance spells a colour literal).
 */
export function meanLuminance(bytes: Uint8Array): number {
  for (const [index, byte] of PNG_SIGNATURE.entries()) expect(bytes[index], "the capture is a PNG").toBe(byte);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const depth = bytes[24] ?? 0;
  const colourType = bytes[25] ?? 0;
  const interlace = bytes[28] ?? 0;
  expect({ depth, interlace }, "the capture is an eight-bit, non-interlaced PNG").toStrictEqual({ depth: 8, interlace: 0 });
  const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0;
  expect(channels, "the capture is true colour, with or without an alpha channel").toBeGreaterThan(0);

  const parts: Uint8Array[] = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const kind = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (kind === "IDAT") parts.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  const raw = new Uint8Array(inflateSync(joined));

  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  const none = new Uint8Array(stride);
  let cursor = 0;
  let total = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[cursor] ?? 0;
    cursor += 1;
    const line = out.subarray(row * stride, (row + 1) * stride);
    const prior = row === 0 ? none : out.subarray((row - 1) * stride, row * stride);
    for (let index = 0; index < stride; index += 1) {
      const value = raw[cursor + index] ?? 0;
      const left = index >= channels ? (line[index - channels] ?? 0) : 0;
      const above = prior[index] ?? 0;
      const corner = index >= channels ? (prior[index - channels] ?? 0) : 0;
      let restored = value;
      if (filter === 1) restored = value + left;
      else if (filter === 2) restored = value + above;
      else if (filter === 3) restored = value + Math.floor((left + above) / 2);
      else if (filter === 4) restored = value + paeth(left, above, corner);
      line[index] = restored % CHANNEL_VALUES;
    }
    cursor += stride;
    for (let column = 0; column < width; column += 1) {
      const pixel = row * stride + column * channels;
      total += 0.2126 * (out[pixel] ?? 0) + 0.7152 * (out[pixel + 1] ?? 0) + 0.0722 * (out[pixel + 2] ?? 0);
    }
  }
  return total / Math.max(width * height, 1);
}

/** S-Viewer, as J-011 walks it. */
export class SViewerPage {
  constructor(private readonly page: Page) {}

  get screen(): Locator {
    return this.page.getByTestId("viewer-screen");
  }

  get canvas(): Locator {
    return this.page.getByTestId("viewer-canvas");
  }

  get status(): Locator {
    return this.page.getByTestId("viewer-status");
  }

  get layers(): Locator {
    return this.page.getByTestId("viewer-layers");
  }

  get rows(): Locator {
    return this.page.getByTestId("viewer-layer-row");
  }

  get fit(): Locator {
    return this.page.getByTestId("viewer-fit");
  }

  get zoomIn(): Locator {
    return this.page.getByTestId("viewer-zoom-in");
  }

  /** One layer's row, by the layer it names — a row carries its layer as a data attribute. */
  row(layerName: string): Locator {
    return this.page.locator(`[data-testid="viewer-layer-row"][data-layer="${layerName}"]`);
  }

  /** A `data-` hook off the status line, as a number. */
  async statusNumber(name: string): Promise<number> {
    const raw = await this.status.getAttribute(name);
    expect(raw, `the status line publishes ${name} (Decision §7)`).not.toBeNull();
    return Number(raw);
  }

  /** The camera's pixels-per-unit, as the status line publishes it. */
  scale(): Promise<number> {
    return this.statusNumber("data-scale");
  }

  /** The viewport the address carries, or null where it carries none. */
  async viewportParam(): Promise<string | null> {
    return new URL(this.page.url()).searchParams.get("v");
  }

  /**
   * The scripted gestures the frame ledger is read after: half the frames a wheel zoom at the
   * cursor, half a drag pan across the sheet — the two gestures PB-3 states its budget for.
   */
  async scriptGestures(frames: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    expect(box, "the canvas is laid out before it is driven").not.toBeNull();
    const at = box as { x: number; y: number; width: number; height: number };
    const cx = at.x + at.width / 2;
    const cy = at.y + at.height / 2;
    const half = Math.floor(frames / 2);

    await this.page.mouse.move(cx, cy);
    for (let step = 0; step < half; step += 1) {
      await this.page.mouse.wheel(0, step % 2 === 0 ? -50 : 50);
      await this.page.waitForTimeout(8);
    }

    await this.page.mouse.move(cx, cy);
    await this.page.mouse.down();
    for (let step = 0; step < half; step += 1) {
      await this.page.mouse.move(cx + ((step * 7) % 120) - 60, cy + ((step * 5) % 80) - 40);
      await this.page.waitForTimeout(8);
    }
    await this.page.mouse.up();
  }

  /* ------------------------------------------------------------------ the inspector (inc-111) */

  get inspector(): Locator {
    return this.page.getByTestId("viewer-inspector");
  }

  get hover(): Locator {
    return this.page.getByTestId("viewer-inspector-hover");
  }

  get entities(): Locator {
    return this.page.getByTestId("viewer-inspector-entity");
  }

  get missingKeys(): Locator {
    return this.page.getByTestId("viewer-inspector-missing-key");
  }

  get reveal(): Locator {
    return this.page.getByTestId("viewer-inspector-reveal");
  }

  get clear(): Locator {
    return this.page.getByTestId("viewer-inspector-clear");
  }

  get marquee(): Locator {
    return this.page.getByTestId("viewer-marquee");
  }

  get statusSelection(): Locator {
    return this.page.getByTestId("viewer-status-selection");
  }

  /** One layer row's Select control — the keyboard path to a whole layer's keys. */
  layerSelect(layerName: string): Locator {
    return this.row(layerName).getByTestId("viewer-layer-select");
  }

  /** The selected keys, in the order the panel lists them. */
  async selectedKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (const row of await this.entities.all()) keys.push((await row.getAttribute("data-key")) ?? "");
    return keys;
  }

  /** The selection the address carries, or null where it carries none. */
  async selectionParam(): Promise<string | null> {
    return new URL(this.page.url()).searchParams.get("s");
  }

  /** The world box one selected row publishes. */
  static boxOf(bbox: string): SelectionBox {
    const numbers = bbox.split(",").map(Number);
    expect(numbers.length, `a row's data-bbox is minx,miny,maxx,maxy — it reads "${bbox}"`).toBe(4);
    return { minX: numbers[0] as number, minY: numbers[1] as number, maxX: numbers[2] as number, maxY: numbers[3] as number };
  }

  /** The centre of the union of every selected row's box — where a reveal must leave the camera. */
  async selectionCentre(): Promise<[number, number]> {
    const boxes = await Promise.all((await this.entities.all()).map(async (row) => SViewerPage.boxOf((await row.getAttribute("data-bbox")) ?? "")));
    expect(boxes.length, "a centre is taken of a selection, so something is selected").toBeGreaterThan(0);
    const union = boxes.reduce((held, box) => ({
      minX: Math.min(held.minX, box.minX),
      minY: Math.min(held.minY, box.minY),
      maxX: Math.max(held.maxX, box.maxX),
      maxY: Math.max(held.maxY, box.maxY),
    }));
    return [(union.minX + union.maxX) / 2, (union.minY + union.maxY) / 2];
  }

  /** The camera the address states, as its three numbers. */
  async cameraFromAddress(): Promise<{ x: number; y: number; scale: number }> {
    const stated = await this.viewportParam();
    expect(stated, "the address carries the camera (R-UI-031)").not.toBeNull();
    const parts = (stated as string).split(",").map(Number);
    expect(parts.length, `the viewport parameter is x,y,scale — it reads "${stated}"`).toBe(3);
    return { x: parts[0] as number, y: parts[1] as number, scale: parts[2] as number };
  }

  /** The canvas's own box on screen, refused where it has not been laid out. */
  async canvasBox(): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.canvas.boundingBox();
    expect(box, "the canvas is laid out before it is driven").not.toBeNull();
    return box as { x: number; y: number; width: number; height: number };
  }

  /** The middle of the canvas — where a sheet flown to one entity puts that entity. */
  async canvasCentre(): Promise<{ x: number; y: number }> {
    const at = await this.canvasBox();
    return { x: at.x + at.width / 2, y: at.y + at.height / 2 };
  }

  /** A click of no travel at all: down and up in the same place, which is a select and not a pan. */
  async clickAt(at: { x: number; y: number }, modifier?: "Shift"): Promise<void> {
    if (modifier !== undefined) await this.page.keyboard.down(modifier);
    await this.page.mouse.move(at.x, at.y);
    await this.page.mouse.down();
    await this.page.mouse.up();
    if (modifier !== undefined) await this.page.keyboard.up(modifier);
  }

  /**
   * The marquee, drawn with Shift held from one inset corner of the canvas to the other — the
   * rectangle select of R-TO-011, and the gesture the test contract fixes.
   */
  async rectangleSelect(inset = 6): Promise<void> {
    const at = await this.canvasBox();
    await this.page.keyboard.down("Shift");
    await this.page.mouse.move(at.x + inset, at.y + inset);
    await this.page.mouse.down();
    for (const step of [1, 2, 3]) {
      await this.page.mouse.move(at.x + inset + ((at.width - 2 * inset) * step) / 3, at.y + inset + ((at.height - 2 * inset) * step) / 3);
    }
    await expect(this.marquee, "the rectangle is drawn while the button is down").toBeVisible();
    await this.page.mouse.up();
    await this.page.keyboard.up("Shift");
  }

  /** A plain drag across the sheet: the pan gesture, unchanged by the selection model. */
  async dragAcross(): Promise<void> {
    const at = await this.canvasBox();
    await this.page.mouse.move(at.x + at.width * 0.3, at.y + at.height * 0.3);
    await this.page.mouse.down();
    for (const step of [1, 2, 3]) await this.page.mouse.move(at.x + at.width * 0.3 + step * 20, at.y + at.height * 0.3 + step * 12);
    await this.page.mouse.up();
  }

  /** Press one row's copy door and answer the key that row names. */
  async copyKey(row: Locator): Promise<string> {
    const key = (await row.getAttribute("data-key")) ?? "";
    await row.getByTestId("viewer-inspector-copy").click();
    await expect(row.getByTestId("viewer-inspector-copy"), "the row says it has been copied").toHaveAttribute("data-copied", "true");
    return key;
  }

  /** What the browser's clipboard holds — the permissions are granted on the context (test contract). */
  clipboardText(): Promise<string> {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  /** Flip the document's theme the way the shell does, and wait for the root to say so. */
  async setTheme(theme: "light" | "dark"): Promise<void> {
    await this.page.evaluate((asked) => document.documentElement.setAttribute("data-theme", asked), theme);
    await expect(this.page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", theme);
  }

  /** A CSS custom property as the page itself resolves it, inside the element that carries it. */
  async token(name: string, on: Locator): Promise<string> {
    return on.evaluate((element, property) => getComputedStyle(element).getPropertyValue(property).trim(), name);
  }

  /** One computed style of an element, read in the page (no colour or font is ever spelled here). */
  async computed(on: Locator, property: string): Promise<string> {
    return on.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
  }

  /**
   * The first record of one layer of the served feed, of the type asked for — how a journey picks an
   * entity to deep-link to without projecting world coordinates onto the screen itself.
   */
  async recordOnLayer(drawingId: string, layoutName: string, tenantId: string, index: number, type: string): Promise<{ key: string; type: string }> {
    const answer = await this.page.request.get(
      `/api/viewer/${drawingId}/${encodeURIComponent(layoutName)}?tenant=${encodeURIComponent(tenantId)}&part=layer&index=${index}`,
    );
    expect(answer.ok(), `the layer feed answers layer ${index} of ${layoutName}`).toBe(true);
    const body = (await answer.json()) as { records: { key?: string; src?: string; type: string }[] };
    const found = body.records.find((record) => record.type === type && (record.key ?? record.src ?? "") !== "");
    expect(found, `layer ${index} of ${layoutName} carries a ${type} to select`).toBeTruthy();
    const record = found as { key?: string; src?: string; type: string };
    return { key: record.key ?? record.src ?? "", type: record.type };
  }

  /**
   * The first record of the sheet of the type asked for, wherever it is: the layer feed is walked
   * from its first layer until one answers, so a journey never assumes which layer a corpus put its
   * geometry on (B-19).
   */
  async findRecordOfType(drawingId: string, layoutName: string, tenantId: string, type: string, layers = 32): Promise<{ key: string; type: string }> {
    for (let index = 0; index < layers; index += 1) {
      const answer = await this.page.request.get(
        `/api/viewer/${drawingId}/${encodeURIComponent(layoutName)}?tenant=${encodeURIComponent(tenantId)}&part=layer&index=${index}`,
      );
      if (!answer.ok()) break;
      const body = (await answer.json()) as { records: { key?: string; src?: string; type: string }[] };
      const found = body.records.find((record) => record.type === type && (record.key ?? record.src ?? "") !== "");
      if (found !== undefined) return { key: found.key ?? found.src ?? "", type: found.type };
    }
    expect(null, `the sheet ${layoutName} carries a ${type} for this journey to select`).not.toBeNull();
    throw new Error(`no ${type} on ${layoutName}`);
  }

  /** The paper in the canvas's own top-left corner, as luminance — the dark/light proof (§6). */
  async cornerLuminance(): Promise<number> {
    const box = await this.canvas.boundingBox();
    expect(box, "the canvas is laid out before its corner is read").not.toBeNull();
    const at = box as { x: number; y: number; width: number; height: number };
    const shot = await this.page.screenshot({ clip: { x: at.x + 3, y: at.y + 3, width: 8, height: 8 } });
    return meanLuminance(new Uint8Array(shot));
  }
}
