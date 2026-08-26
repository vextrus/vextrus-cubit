// @vitest-environment jsdom
/**
 * Public acceptance for the `/` landmark — the Golden Path's first checkpoint, which AC-4's
 * journey reads in a browser (`root-home-main` visible, a heading and a tagline on it). The same
 * markup is judged here as a component, where a missing test id or copy that no string table owns
 * names itself instead of failing as a locator timeout.
 *
 * The page is static: it renders from the string table with no seam behind it, so a jsdom render
 * is the whole of its behaviour. Copy is asserted against the table, never against a literal
 * spelled here — C-SPINE-PLATFORM puts the words in one place and this file reads them from it.
 */
import { createElement } from "react";
import { render, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { loadStrings, productModule } from "../server/support/wire";

const PAGE_MODULE = "src/app/page.tsx";

/** Anything that can take focus or be activated — the landmark's interactive surface, exactly. */
const INTERACTIVE = "a[href], button, input, select, textarea, summary, [tabindex], [role='button'], [role='link'], [contenteditable='true']";

interface PageModule {
  default?: unknown;
}

async function mount(): Promise<{ main: HTMLElement; strings: Record<string, string>; unmount: () => void }> {
  const page = await productModule<PageModule>(PAGE_MODULE);
  expect(typeof page.default, `${PAGE_MODULE} must default-export HomePage — Next renders the default export`).toBe("function");
  const { strings } = await loadStrings();
  const view = render(createElement(page.default as () => null));
  return { main: within(view.container).getByTestId("root-home-main"), strings, unmount: () => view.unmount() };
}

describe("AC-4: the Golden Path's first checkpoint renders", () => {
  test("AC-4: / renders a real main landmark carrying the heading and the tagline", async () => {
    const view = await mount();
    try {
      expect(view.main.tagName, "root-home-main must be a real <main> element — the landmark axe and the journey both read").toBe("MAIN");
      const scope = within(view.main);
      expect(scope.getByTestId("root-home-heading").tagName, "the product's name is the page's level-1 heading").toBe("H1");
      expect(scope.getByTestId("root-home-tagline"), "the tagline sits inside the landmark").toBeTruthy();
    } finally {
      view.unmount();
    }
  });

  test("AC-4: the heading and the tagline say exactly what the string table says", async () => {
    const view = await mount();
    try {
      const scope = within(view.main);
      const title = view.strings["app_title"];
      const tagline = view.strings["home_tagline"];
      expect(title, "strings.app_title must be declared — it is the document title and the heading (C-SPINE-PLATFORM)").toBeTypeOf("string");
      expect(tagline, "strings.home_tagline must be declared").toBeTypeOf("string");
      expect(String(title).trim().length, "strings.app_title must not be empty: the journey asserts a non-empty document title").toBeGreaterThan(0);
      expect(String(tagline).trim().length, "strings.home_tagline must not be empty").toBeGreaterThan(0);

      expect(scope.getByTestId("root-home-heading").textContent?.trim()).toBe(title);
      expect(scope.getByTestId("root-home-tagline").textContent?.trim()).toBe(tagline);
      expect(scope.getByRole("heading", { level: 1, name: String(title) }), "the heading's accessible name is its visible text").toBe(scope.getByTestId("root-home-heading"));
    } finally {
      view.unmount();
    }
  });

  test("AC-4: every word on the landmark comes from the string table, and its only controls are the two auth links", async () => {
    const view = await mount();
    try {
      // C-SPINE-PLATFORM: take the declared copy out of the rendered text and nothing readable
      // may be left over — a slogan spelled in JSX would surface here.
      let remainder = view.main.textContent ?? "";
      for (const value of Object.values(view.strings)) remainder = remainder.split(value).join("");
      expect(remainder.trim(), `the landmark renders copy that is not in the string table: "${remainder.trim()}"`).toBe("");

      // R-UI-031 (B-20: the increment that changes law owns the acceptance the old law froze).
      // S-Auth ships the auth screens this increment, so a typed URL may no longer be the only way
      // to reach one: / offers visible navigation to /sign-in and /sign-up, and those two links are
      // the whole of its interactive surface — anything else here would owe a Design Decision state.
      const signIn = view.strings["home_sign_in"];
      const signUp = view.strings["home_sign_up"];
      expect(signIn, "strings.home_sign_in must be declared — it is the visible text of /'s link to the sign-in screen (C-SPINE-PLATFORM)").toBeTypeOf("string");
      expect(signUp, "strings.home_sign_up must be declared — it is the visible text of /'s link to the sign-up screen").toBeTypeOf("string");
      expect(String(signIn).trim().length, "strings.home_sign_in must not be empty: a link with no words is not visible navigation").toBeGreaterThan(0);
      expect(String(signUp).trim().length, "strings.home_sign_up must not be empty").toBeGreaterThan(0);

      // Compared as a set, not a sequence: R-UI-031 fixes which controls the landmark carries, not
      // the order the Design Decision lays them out in. Sorted by code point — `no-raw-intl` binds
      // this file too, so `localeCompare` is not available to order them.
      const byHref = (a: { href: string | null }, b: { href: string | null }): number => ((a.href ?? "") < (b.href ?? "") ? -1 : (a.href ?? "") > (b.href ?? "") ? 1 : 0);
      const controls = [...view.main.querySelectorAll(INTERACTIVE)]
        .map((element) => ({ tag: element.tagName, href: element.getAttribute("href"), text: element.textContent?.trim() ?? "" }))
        .sort(byHref);
      expect(controls, "the / landmark's interactive surface is exactly the two auth links the string table names").toStrictEqual([
        { tag: "A", href: "/sign-in", text: String(signIn) },
        { tag: "A", href: "/sign-up", text: String(signUp) },
      ]);
    } finally {
      view.unmount();
    }
  });
});
