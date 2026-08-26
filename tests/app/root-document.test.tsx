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

/** Anything that can take focus or be activated — the page is declared to have none of it yet. */
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

  test("AC-4: every word on the landmark comes from the string table, and nothing on it is interactive", async () => {
    const view = await mount();
    try {
      // C-SPINE-PLATFORM: take the declared copy out of the rendered text and nothing readable
      // may be left over — a slogan spelled in JSX would surface here.
      let remainder = view.main.textContent ?? "";
      for (const value of Object.values(view.strings)) remainder = remainder.split(value).join("");
      expect(remainder.trim(), `the landmark renders copy that is not in the string table: "${remainder.trim()}"`).toBe("");

      // The screen offers no actions until the auth and shell increments add them; a control here
      // would owe a focus reticle and a Design Decision state that this screen does not have.
      expect([...view.main.querySelectorAll(INTERACTIVE)].map((element) => element.outerHTML), "the / landmark has no interactive elements yet").toStrictEqual([]);
    } finally {
      view.unmount();
    }
  });
});
