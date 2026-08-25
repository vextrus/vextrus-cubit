// @vitest-environment jsdom
/**
 * AC-4 — the root error boundary renders the product's own error state (ARCH-03, B-21,
 * C-SPINE-PLATFORM).
 *
 * The component is rendered directly under jsdom with a stubbed `reset`. No JSX is written here:
 * the boundary is invoked through `React.createElement`, so this file collects under the existing
 * unit lane whatever the config does with `.tsx`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ERROR_BOUNDARY_MODULE, REPO_ROOT, loadStrings, productModule } from "../server/support/wire";

interface ReactLike {
  createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
}

interface Queries {
  getByTestId(id: string): HTMLElement;
  getByRole(role: string, options?: { name?: string; level?: number }): HTMLElement;
}

interface RtlLike {
  render(ui: unknown): { container: HTMLElement; unmount(): void };
  fireEvent: { click(element: Element): boolean };
  within(element: HTMLElement): Queries;
}

interface BoundaryModule {
  default: unknown;
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
    const boundary = await productModule<BoundaryModule>(ERROR_BOUNDARY_MODULE);
    expect(boundary.default, `${ERROR_BOUNDARY_MODULE} must default-export the boundary component (Next renders the default export)`).toBeTypeOf("function");
    const { strings } = await loadStrings();
    const react = (await import("react").catch((cause: unknown) => expect.fail(`react (a declared dependency) does not resolve: ${String(cause)}`))) as unknown as ReactLike;
    const rtl = (await import("@testing-library/react").catch((cause: unknown) =>
      expect.fail(`@testing-library/react (a declared dependency) does not resolve: ${String(cause)}`),
    )) as unknown as RtlLike;
    return { react, rtl, Boundary: boundary.default, strings };
  })());

const INTERNAL = "render-crashed-in-the-takeoff-grid-99";

interface Mounted {
  container: HTMLElement;
  q: Queries;
  resetCalls: () => number;
  unmount: () => void;
}

async function mount(): Promise<Mounted & Staged> {
  const s = await staged();
  let calls = 0;
  const element = s.react.createElement(s.Boundary, {
    error: Object.assign(new Error(INTERNAL), { digest: "digest-should-not-be-shown" }),
    reset: () => {
      calls += 1;
    },
  });
  const view = s.rtl.render(element);
  return { ...s, container: view.container, q: s.rtl.within(view.container), resetCalls: () => calls, unmount: () => view.unmount() };
}

describe("AC-4: the root error boundary", () => {
  test("AC-4: it renders the four contracted test ids with the string table's copy and nothing else", async () => {
    const view = await mount();
    try {
      const root = view.q.getByTestId("error-state");
      const title = view.q.getByTestId("error-state-title");
      const message = view.q.getByTestId("error-state-message");
      const retry = view.q.getByTestId("error-retry");

      expect(title.textContent?.trim()).toBe(view.strings.error_title);
      expect(message.textContent?.trim()).toBe(view.strings.error_body);
      expect(retry.textContent?.trim()).toBe(view.strings.error_retry);

      // C-SPINE-PLATFORM: every visible word comes from the string table. Take the three declared
      // strings out of the rendered text and nothing readable may be left over.
      let remainder = root.textContent ?? "";
      for (const value of [view.strings.error_title, view.strings.error_body, view.strings.error_retry]) {
        remainder = remainder.replace(value as string, "");
      }
      expect(remainder.trim(), `the error state renders copy that is not in the string table: "${remainder.trim()}"`).toBe("");
    } finally {
      view.unmount();
    }
  });

  test("AC-4: the retry control is a button whose accessible name is strings.error_retry, and one activation calls reset exactly once", async () => {
    const view = await mount();
    try {
      const retry = view.q.getByTestId("error-retry");
      expect(retry.tagName, "the remedy is a real button — never an anchor, never a div").toBe("BUTTON");
      expect(retry.getAttribute("type")).toBe("button");
      expect(view.q.getByRole("button", { name: view.strings.error_retry as string }), "the button's accessible name must be its visible label").toBe(retry);

      expect(view.resetCalls()).toBe(0);
      view.rtl.fireEvent.click(retry);
      expect(view.resetCalls(), "one activation, one reset").toBe(1);
    } finally {
      view.unmount();
    }
  });

  test("AC-4: no error internals — neither the thrown message nor the digest — appear in the markup", async () => {
    const view = await mount();
    try {
      expect(view.container.innerHTML).not.toContain(INTERNAL);
      expect(view.container.innerHTML).not.toContain("digest-should-not-be-shown");
    } finally {
      view.unmount();
    }
  });

  test("AC-4: the string table declares the three error keys with the copy the increment fixes", async () => {
    const { strings } = await loadStrings();

    expect(strings.error_title).toBe("Something went wrong on our side");
    expect(strings.error_body).toBe("Your work is safe. The fault has been recorded for the operators — try again, and if it keeps failing, contact support.");
    expect(strings.error_retry).toBe("Try again");
  });

  test("AC-4: the boundary is announced as an alert under a level-1 heading (ARCH-03/B-21, per recorded Interpretation)", async () => {
    const view = await mount();
    try {
      const alert = view.q.getByRole("alert");
      expect(alert.contains(view.q.getByTestId("error-state-title")), "the title lives inside the alert region").toBe(true);
      expect(view.q.getByRole("heading", { name: view.strings.error_title as string, level: 1 })).toBe(view.q.getByTestId("error-state-title"));
    } finally {
      view.unmount();
    }
  });

  test("AC-4: it is a client component", () => {
    // white-box: AC-4 — the "use client" directive is a compile-time marker with no runtime
    // observable; a boundary without it cannot mount handlers in the app router at all.
    const path = join(REPO_ROOT, ERROR_BOUNDARY_MODULE);
    expect(existsSync(path), `${ERROR_BOUNDARY_MODULE} is missing from the checkout`).toBe(true);
    const source = readFileSync(path, "utf8");
    expect(source.trimStart().startsWith('"use client"') || source.trimStart().startsWith("'use client'"), `${ERROR_BOUNDARY_MODULE} must open with the "use client" directive`).toBe(true);
  });
});
