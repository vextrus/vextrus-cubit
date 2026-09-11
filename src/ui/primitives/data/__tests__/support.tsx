/**
 * The harness DataTable v2's own suites are written against, beside the code they judge.
 *
 * jsdom performs no layout, so the three measurements the grid depends on are stubbed here and
 * ONLY here: the scroll container's box (a 400 px viewport, so a windowed list is a window), the
 * text box a truncated cell is detected by, and a `scrollTop` that stores what a test assigns. Each
 * stub is declared, not guessed: `scrollWidth` answers wide for the strings a test has declared
 * clipped and zero for every other, which is exactly the reading a browser gives.
 */
import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";

export const VIEWPORT_HEIGHT_PX = 400;
export const VIEWPORT_WIDTH_PX = 1200;
/** The width a cell's own text box reports; a clipped string reports more than this. */
export const CELL_WIDTH_PX = 100;
const CLIPPED_WIDTH_PX = 400;

/** The strings a test has declared too long for their cell — the truncation the Tooltip answers. */
export const CLIPPED = new Set<string>();

const isViewport = (node: unknown): boolean =>
  node instanceof Element && node.getAttribute("data-testid") === "datatable-viewport";

const scrollOffsets = new WeakMap<Element, number>();
let installed = false;

/** The prototype that actually declares a property, so an override lands where the read looks. */
function describedOn(prop: string): object {
  for (const proto of [HTMLElement.prototype, Element.prototype] as object[]) {
    if (Object.getOwnPropertyDescriptor(proto, prop)) return proto;
  }
  return HTMLElement.prototype;
}

function define(prop: string, read: (element: Element) => number): void {
  Object.defineProperty(describedOn(prop), prop, {
    configurable: true,
    get(this: Element): number {
      return read(this);
    },
  });
}

export function installDomStubs(): void {
  if (installed) return;
  installed = true;

  const scope = globalThis as unknown as { ResizeObserver?: unknown; matchMedia?: unknown };
  if (typeof scope.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      constructor(private readonly callback: (entries: unknown[], observer: unknown) => void) {}
      observe(target: Element): void {
        this.callback([{ target }], this as unknown as ResizeObserver);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    scope.ResizeObserver = ResizeObserverStub;
  }
  if (typeof scope.matchMedia !== "function") {
    scope.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (typeof proto.scrollIntoView !== "function") proto.scrollIntoView = function scrollIntoView(): void {};
  if (typeof proto.scrollTo !== "function") proto.scrollTo = function scrollTo(): void {};
  if (typeof proto.hasPointerCapture !== "function")
    proto.hasPointerCapture = function hasPointerCapture(): boolean {
      return false;
    };
  if (typeof proto.releasePointerCapture !== "function")
    proto.releasePointerCapture = function releasePointerCapture(): void {};

  const originalRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element): DOMRect {
    if (!isViewport(this)) return originalRect.call(this);
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: VIEWPORT_WIDTH_PX,
      bottom: VIEWPORT_HEIGHT_PX,
      width: VIEWPORT_WIDTH_PX,
      height: VIEWPORT_HEIGHT_PX,
      toJSON: () => ({}),
    } as DOMRect;
  };

  define("offsetHeight", (element) => (isViewport(element) ? VIEWPORT_HEIGHT_PX : 0));
  define("clientHeight", (element) => (isViewport(element) ? VIEWPORT_HEIGHT_PX : 0));
  define("offsetWidth", (element) => (isViewport(element) ? VIEWPORT_WIDTH_PX : CELL_WIDTH_PX));
  define("clientWidth", (element) => (isViewport(element) ? VIEWPORT_WIDTH_PX : CELL_WIDTH_PX));
  define("scrollWidth", (element) => (CLIPPED.has(element.textContent ?? "") ? CLIPPED_WIDTH_PX : 0));

  Object.defineProperty(describedOn("scrollTop"), "scrollTop", {
    configurable: true,
    get(this: Element): number {
      return isViewport(this) ? (scrollOffsets.get(this) ?? 0) : 0;
    },
    set(this: Element, value: number): void {
      if (isViewport(this)) scrollOffsets.set(this, value);
    },
  });
}

/** Render into a fresh container attached to the document. */
export function mount(ui: ReactElement): HTMLElement {
  installDomStubs();
  return render(ui).container;
}

export function unmountAll(): void {
  cleanup();
  CLIPPED.clear();
  delete document.documentElement.dataset.density;
}

/** Scroll the grid's viewport and let the virtualiser hear it. */
export async function scrollViewport(viewport: HTMLElement, top: number): Promise<void> {
  await act(async () => {
    viewport.scrollTop = top;
    viewport.dispatchEvent(new Event("scroll", { bubbles: false }));
    await Promise.resolve();
  });
}

/* ------------------------------------------------------------------ reading the document */

export const byTestId = (root: ParentNode, id: string): HTMLElement | null =>
  root.querySelector(`[data-testid="${id}"]`);

export const allTestId = (root: ParentNode, id: string): HTMLElement[] =>
  [...root.querySelectorAll(`[data-testid="${id}"]`)] as HTMLElement[];

export const textOf = (node: Element | null | undefined): string => node?.textContent?.trim() ?? "";

/** A store a test can read and write, standing where the browser's `localStorage` stands. */
export function memoryStorage(seed: Record<string, string> = {}): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  entries: Map<string, string>;
} {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/* ------------------------------------------------------------------ the fixture (B-19) */

export interface Line {
  readonly id: string;
  readonly item: string;
  readonly level: string;
  readonly klass: string;
  readonly qty: string;
  readonly unit: string;
}

/** Two levels, two classes, figures that add exactly — every expectation below is derived from it. */
export const LINES: readonly Line[] = [
  { id: "l1", item: "Column C-12", level: "GF", klass: "column", qty: "0.405", unit: "m3" },
  { id: "l2", item: "Column C-4", level: "GF", klass: "column", qty: "0.405", unit: "m3" },
  { id: "l3", item: "Slab S-2", level: "GF", klass: "slab", qty: "96.00", unit: "m2" },
  { id: "l4", item: "Beam GB-3", level: "L1", klass: "beam", qty: "12.60", unit: "m3" },
  { id: "l5", item: "Beam GB-9", level: "L1", klass: "beam", qty: "1.40", unit: "m3" },
];

export const lineRows = (count: number): Line[] =>
  Array.from({ length: count }, (_unused, index) => {
    const n = index + 1;
    return { id: `v${n}`, item: `Line ${n}`, level: "GF", klass: "column", qty: `${n}.00`, unit: "m3" };
  });

export const rowIdOf = (row: Line): string => row.id;
