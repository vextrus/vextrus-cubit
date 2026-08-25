// @vitest-environment jsdom
/**
 * ARCH-03 / the "outage tells the truth" checkpoint — "never a blank or framework screen" has no
 * exception for the root layout. `src/app/error.tsx` is mounted *inside* the root layout, so a
 * throw in `src/app/layout.tsx` (or in the boundary's own render) unwinds past it and Next answers
 * with its built-in error screen. `src/app/global-error.tsx` is the only boundary that catches it.
 *
 * These tests prove the global boundary renders the same contracted error state as the route
 * boundary, from the same string table, with one working remedy — and, per ARCH-02/B-17, that it
 * does so by reusing the one home of that markup rather than carrying a second copy.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, loadStrings, productModule } from "../server/support/wire";

const GLOBAL_ERROR_MODULE = "src/app/global-error.tsx";
const ROUTE_ERROR_MODULE = "src/app/error.tsx";
const INTERNAL = "layout-crashed-while-reading-the-session-7";

interface ReactLike {
  createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
}

interface Queries {
  getByTestId(id: string): HTMLElement;
  getByRole(role: string, options?: { name?: string; level?: number }): HTMLElement;
}

interface RtlLike {
  render(ui: unknown, options?: { container?: HTMLElement }): { container: HTMLElement; unmount(): void };
  fireEvent: { click(element: Element): boolean };
  within(element: HTMLElement): Queries;
}

interface Staged {
  react: ReactLike;
  rtl: RtlLike;
  Boundary: unknown;
  strings: Record<string, string>;
}

let pending: Promise<Staged> | undefined;
const staged = (): Promise<Staged> =>
  (pending ??= (async (): Promise<Staged> => {
    const mod = await productModule<{ default: unknown }>(GLOBAL_ERROR_MODULE);
    expect(mod.default, `${GLOBAL_ERROR_MODULE} must default-export the boundary component`).toBeTypeOf("function");
    const { strings } = await loadStrings();
    const react = (await import("react")) as unknown as ReactLike;
    const rtl = (await import("@testing-library/react")) as unknown as RtlLike;
    return { react, rtl, Boundary: mod.default, strings };
  })());

interface Mounted extends Staged {
  q: Queries;
  html: string;
  resetCalls: () => number;
  unmount: () => void;
}

async function mount(): Promise<Mounted> {
  const s = await staged();
  let calls = 0;
  const element = s.react.createElement(s.Boundary, {
    error: Object.assign(new Error(INTERNAL), { digest: "digest-should-not-be-shown" }),
    reset: () => {
      calls += 1;
    },
  });
  // The boundary renders its own <html>/<body> because it replaces the root layout. jsdom already
  // owns a document, so it is mounted into a fresh detached host: React builds the html/body
  // elements inside it and every query below runs against that subtree.
  const view = s.rtl.render(element, { container: document.createElement("div") });
  return {
    ...s,
    q: s.rtl.within(view.container),
    html: view.container.innerHTML,
    resetCalls: () => calls,
    unmount: () => view.unmount(),
  };
}

/** Every component/element type in a React element tree, however deeply the boundary nests it. */
function typesIn(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(typesIn);
  if (typeof node !== "object" || node === null) return [];
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (element.type === undefined) return [];
  return [element.type, ...typesIn(element.props?.children)];
}

describe("the global error boundary (a throw in the root layout)", () => {
  test("it exists, so a root-layout throw never reaches Next's framework screen", () => {
    expect(existsSync(join(REPO_ROOT, GLOBAL_ERROR_MODULE)), `${GLOBAL_ERROR_MODULE} is missing — a throw in src/app/layout.tsx would render Next's built-in error screen`).toBe(true);
  });

  test("it is a client component", () => {
    const source = readFileSync(join(REPO_ROOT, GLOBAL_ERROR_MODULE), "utf8");
    expect(source.trimStart().startsWith('"use client"') || source.trimStart().startsWith("'use client'"), `${GLOBAL_ERROR_MODULE} must open with the "use client" directive`).toBe(true);
  });

  test("it renders the product's own error state with the string table's copy", async () => {
    const view = await mount();
    try {
      expect(view.q.getByTestId("error-state")).toBeTruthy();
      expect(view.q.getByTestId("error-state-title").textContent?.trim()).toBe(view.strings.error_title);
      expect(view.q.getByTestId("error-state-message").textContent?.trim()).toBe(view.strings.error_body);
      expect(view.q.getByTestId("error-retry").textContent?.trim()).toBe(view.strings.error_retry);
      expect(view.q.getByRole("alert").contains(view.q.getByTestId("error-state-title"))).toBe(true);
    } finally {
      view.unmount();
    }
  });

  test("its remedy is a button that calls reset exactly once, and no error internals are shown", async () => {
    const view = await mount();
    try {
      const retry = view.q.getByTestId("error-retry");
      expect(retry.tagName).toBe("BUTTON");
      expect(view.q.getByRole("button", { name: view.strings.error_retry as string })).toBe(retry);

      expect(view.resetCalls()).toBe(0);
      view.rtl.fireEvent.click(retry);
      expect(view.resetCalls(), "one activation, one reset").toBe(1);

      expect(view.html).not.toContain(INTERNAL);
      expect(view.html).not.toContain("digest-should-not-be-shown");
    } finally {
      view.unmount();
    }
  });

  test("ARCH-02/B-17: the error state markup is imported, not a second copy", async () => {
    const source = readFileSync(join(REPO_ROOT, GLOBAL_ERROR_MODULE), "utf8");
    // The law is "imported from its one home", not "imported from this particular path": a later
    // design increment may move `ErrorState` to its Datum home and this must still hold.
    expect(source, "global-error.tsx must import the error state, not re-spell it").toMatch(
      /import\s*\{[^}]*\bErrorState\b[^}]*\}\s*from\s*["'][^"']+["']/,
    );

    // And the imported component is what actually renders. Proved on the element tree rather than
    // on the source text: the boundary's own output must contain an element whose *type is* the
    // very `ErrorState` function src/app/error.tsx exports. A verbatim copy of the markup fails
    // this however identical it renders today, while a lawful change here — a wrapper element, a
    // comment naming the test ids while explaining the reuse — still passes.
    const { ErrorState } = await productModule<{ ErrorState: unknown }>(ROUTE_ERROR_MODULE);
    const s = await staged();
    const rendered = (s.Boundary as (props: { error: Error; reset: () => void }) => unknown)({
      error: new Error(INTERNAL),
      reset: () => {},
    });
    expect(typesIn(rendered), `${GLOBAL_ERROR_MODULE} re-spells the error state instead of rendering src/app/error.tsx's one home`).toContain(ErrorState);
  });
});
