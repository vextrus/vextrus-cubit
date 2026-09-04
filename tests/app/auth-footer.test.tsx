// @vitest-environment jsdom
/**
 * AC-5(a): the auth frame's footer and the books screen travel the way the frame travels.
 *
 * A screen inside the app shell moves between routes through `next/link` — a bare `<a>` leaves the
 * router, discards the client cache and re-fetches the whole document. The criterion is therefore
 * about the module's imports and its tags (a property of the text, marked below) AND about what the
 * rendered line still is: the same anchor, wearing the same idiom classes and pointing at the same
 * place, because R-UI-012's focus and colour treatment hangs off `cx-auth-link cx-reticle`.
 */
import { render, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { productModule } from "../server/support/wire";
import { importsOf, lexed } from "./support/sources";

const FOOTER = "src/app/(auth)/footer.tsx";
const BOOKS = "src/app/(app)/t/[tenant]/books/page.tsx";

/** Modules the criterion names, each of which must reach its other routes through the router. */
const ROUTED: readonly string[] = [FOOTER, BOOKS];

interface FooterModule {
  FooterLines: (props: { lines: readonly { href: string; label: string; prose?: string }[] }) => unknown;
}

describe("AC-5: a screen moves the way the frame moves", () => {
  for (const file of ROUTED) {
    test(`AC-5: ${file} imports next/link and opens no bare anchor`, () => {
      // white-box: AC-5(a) — "imports next/link" and "opens no bare `<a` tag" are properties of the
      // module's text: a rendered anchor cannot say which component produced it.
      const specifiers = importsOf(file).map((record) => record.specifier);
      expect(specifiers, `${file} must reach its other routes through the router (next/link), never a document load`).toContain("next/link");

      // white-box: AC-5(a) — the same question, asked of the tags the file opens.
      const { code } = lexed(file);
      const bare = [...code.matchAll(/<a[\s/>]/g)].map((match) => match.index);
      expect(bare, `${file} opens a bare <a> JSX tag at ${JSON.stringify(bare)} — every in-product hop is a <Link>`).toStrictEqual([]);
    });
  }

  test("AC-5: the footer's rendered line is still an anchor in the evidence-link idiom", async () => {
    const module = await productModule<FooterModule>(FOOTER);
    const line = { href: "/sign-in", label: "auth_evidence_try_again" as const };
    const view = render(module.FooterLines({ lines: [line] }) as never);
    try {
      const anchor = within(view.container).getByRole("link");
      expect(anchor.getAttribute("href"), "the line still points where the line said").toBe(line.href);
      const classes = (anchor.getAttribute("class") ?? "").split(/\s+/);
      // R-UI-012's focus ring and link colour hang off these two classes: a hop that loses them
      // loses the treatment, whatever element carries it.
      expect(classes, "the footer link keeps the auth-link idiom").toContain("cx-auth-link");
      expect(classes, "the footer link keeps the reticle").toContain("cx-reticle");
    } finally {
      view.unmount();
    }
  });
});
