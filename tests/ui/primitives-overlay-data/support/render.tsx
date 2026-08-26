/**
 * The rendering half of inc-005's acceptance support: the two document-root themes every criterion
 * is asserted under, and the measurement stubs jsdom owes a virtualiser.
 *
 * The theme is set on `document.documentElement` — not on a wrapper — because every overlay this
 * increment ships portals to `document.body`, and the root `[data-theme]` is what themes it
 * (Design Decision §1/§6). A wrapper would leave the portalled half untested.
 *
 * jsdom performs no layout: `getBoundingClientRect()` is all zeros, `offsetHeight` is 0 and
 * `scrollTop` never moves. A virtualiser reading those numbers renders everything or nothing, so
 * this module installs the stubs the increment's test procedures name — sized to a 400 px viewport
 * — keyed on the `datatable-viewport` testid so they bind whenever that element mounts. Nothing
 * else in the document is affected, and every stub is restorable.
 */
import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { TESTIDS } from "./primitives";

/** The scroll container's stubbed box (the increment's test procedures: a 400 px viewport). */
export const VIEWPORT_HEIGHT_PX = 400;
export const VIEWPORT_WIDTH_PX = 1200;

export type ThemeName = "light" | "dark";

/** Both document-root themes, in the order acceptance asserts them (Design Decision §6). */
export const THEMES: readonly ThemeName[] = ["light", "dark"];

export function setTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
}

export function clearTheme(): void {
  delete document.documentElement.dataset.theme;
}

/* ------------------------------------------------------------------ jsdom measurement stubs */

const isViewport = (node: unknown): boolean =>
  node instanceof Element && node.getAttribute("data-testid") === TESTIDS.datatableViewport;

const scrollOffsets = new WeakMap<Element, number>();

let installed = false;

/**
 * Install the stubs jsdom does not provide: a ResizeObserver, a measurable box on the DataTable's
 * scroll container, and a scrollTop that actually stores what a test assigns it. Idempotent, so
 * every suite may simply call it.
 */
export function installDomStubs(): void {
  if (installed) return;
  installed = true;

  const scope = globalThis as unknown as { ResizeObserver?: unknown };
  if (typeof scope.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      constructor(private readonly callback: (entries: unknown[], observer: unknown) => void) {}
      observe(target: Element): void {
        this.callback(
          [{ target, contentRect: target.getBoundingClientRect() }],
          this as unknown as ResizeObserver,
        );
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    scope.ResizeObserver = ResizeObserverStub;
  }

  // jsdom implements no media queries; a library that asks about prefers-reduced-motion (sonner
  // does, per Design Decision I-4) must get an answer rather than a TypeError.
  const win = globalThis as unknown as { matchMedia?: unknown };
  if (typeof win.matchMedia !== "function") {
    win.matchMedia = (query: string) => ({
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

  defineMeasured("offsetHeight", VIEWPORT_HEIGHT_PX);
  defineMeasured("clientHeight", VIEWPORT_HEIGHT_PX);
  defineMeasured("offsetWidth", VIEWPORT_WIDTH_PX);
  defineMeasured("clientWidth", VIEWPORT_WIDTH_PX);

  const target = describedOn("scrollTop") ?? Element.prototype;
  Object.defineProperty(target, "scrollTop", {
    configurable: true,
    get(this: Element): number {
      return isViewport(this) ? (scrollOffsets.get(this) ?? 0) : 0;
    },
    set(this: Element, value: number): void {
      if (isViewport(this)) scrollOffsets.set(this, value);
    },
  });
}

/** The prototype that actually declares a property, so an override lands where the read looks. */
function describedOn(prop: string): object | null {
  for (const proto of [HTMLElement.prototype, Element.prototype] as object[]) {
    if (Object.getOwnPropertyDescriptor(proto, prop)) return proto;
  }
  return null;
}

function defineMeasured(prop: string, measured: number): void {
  const target = describedOn(prop) ?? HTMLElement.prototype;
  Object.defineProperty(target, prop, {
    configurable: true,
    get(this: Element): number {
      return isViewport(this) ? measured : 0;
    },
  });
}

/**
 * Scroll the DataTable's viewport: assign `scrollTop` and dispatch the `scroll` event a virtualiser
 * listens for (the increment's test procedures). Returns after React has flushed.
 */
export async function scrollViewport(viewport: HTMLElement, top: number): Promise<void> {
  await act(async () => {
    viewport.scrollTop = top;
    viewport.dispatchEvent(new Event("scroll", { bubbles: false }));
    await Promise.resolve();
  });
}

/* ------------------------------------------------------------------ mounting */

/** Render into a fresh container attached to the document, under the given document-root theme. */
export function mount(ui: React.ReactElement, theme: ThemeName = "light"): HTMLElement {
  installDomStubs();
  setTheme(theme);
  return render(ui).container;
}

/** Unmount everything and put the document root back the way it was found. */
export function unmountAll(): void {
  cleanup();
  clearTheme();
}
