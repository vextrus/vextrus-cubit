// @vitest-environment jsdom
/**
 * Public acceptance for AC-3 — the guard in front of the workspace: an unauthenticated request to
 * any `/t/…` URL never renders workspace content, and lands on `/sign-in`, which is the remedy and
 * not a blank screen or a 500.
 *
 * The guard's home is `src/app/(app)/layout.tsx` (docs/design/shell.md §1: "no live session →
 * `redirect("/sign-in")`"), so that is what is called here, with Next's two request-scope modules
 * answered: a cookie jar holding no session, and a `redirect` that records where it was sent and
 * then throws, as the real one does. Nothing else is stubbed — if the layout renders anything at
 * all for a visitor with no session, this file sees it.
 *
 * The other half of AC-3 — "after signing in the person can reach the shell through visible
 * navigation without typing a URL" — is the workspace door on `/`
 * (tests/app/root-document.test.tsx, AC-2) walked end to end by the journey this increment
 * delivers (tests/e2e/shell.spec.ts).
 *
 * This file lives under tests/ui/shell/** because that is the acceptance home the increment owns.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT } from "../../server/support/wire";

const APP_LAYOUT = "src/app/(app)/layout.tsx";

/** Where `redirect` was sent, in call order — the remedy the guard chose. */
const redirects: string[] = [];

/** What Next's own `redirect` does: it never returns. A guard that renders past it is not a guard. */
class RedirectSignal extends Error {}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirects.push(to);
    throw new RedirectSignal(`redirect(${to})`);
  },
  permanentRedirect: (to: string) => {
    redirects.push(to);
    throw new RedirectSignal(`permanentRedirect(${to})`);
  },
  notFound: () => {
    throw new RedirectSignal("notFound()");
  },
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/t/unknown",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/headers", () => ({
  // No session: an anonymous request, which is the only case this file judges.
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
  headers: async () => new Headers(),
}));

interface LayoutModule {
  default?: unknown;
}

afterEach(() => {
  redirects.length = 0;
});

describe("AC-3: an unauthenticated request never reaches workspace content", () => {
  test("AC-3: the signed-in layout sends a visitor with no session to /sign-in", async () => {
    const absolute = join(REPO_ROOT, APP_LAYOUT);
    expect(existsSync(absolute), `${APP_LAYOUT} is missing from the checkout — it is where the guard lives (docs/design/shell.md §1)`).toBe(true);
    const specifier: string = absolute;
    const layout = (await import(specifier)) as LayoutModule;
    expect(typeof layout.default, `${APP_LAYOUT} must default-export the layout Next renders the workspace tree inside`).toBe("function");

    const marker = "workspace content the guard must never paint";
    let rendered: unknown = null;
    try {
      rendered = await (layout.default as (props: { children: unknown }) => unknown)({ children: createElement("p", { "data-testid": "guarded-child" }, marker) });
    } catch (thrown) {
      expect(thrown, "the guard must refuse by redirecting, not by faulting — a 500 is not the remedy (AC-3)").toBeInstanceOf(RedirectSignal);
    }

    expect(redirects, `AC-3: no live session → redirect("/sign-in"); the layout redirected to ${JSON.stringify(redirects)}`).toStrictEqual(["/sign-in"]);

    if (rendered !== null) {
      // A layout that returned rather than threw has painted something: it must not be the tree.
      const view = render(rendered as never);
      try {
        expect(view.queryByTestId("guarded-child"), "AC-3: an unauthenticated request to a /t/… URL never renders workspace content").toBeNull();
      } finally {
        view.unmount();
      }
    }
  });
});
