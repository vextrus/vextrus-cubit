// @vitest-environment jsdom
// Moves inside the frame travel through the router. A bare `<a href>` fetches a fresh document,
// which re-mounts the shared layout and throws away whatever the person had arranged there; the
// screens that still do it are the S-Auth footer and the Books empty action.
import { expect, test, vi } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { codeOf, importsOf } from "./support/source-facts";
import { strings } from "../../src/ui/strings";

const FOOTER = "src/app/(auth)/footer.tsx";
const BOOKS = "src/app/(app)/t/[tenant]/books/page.tsx";

// The router's own component, standing in as the anchor it renders: this suite asks what the screen
// hands it, not how Next builds a document out of it.
vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => createElement("a", props),
}));

const { FooterLines } = await import("../../src/app/(auth)/footer");

test.each([FOOTER, BOOKS])("AC-5(a): %s hops through the router, never through a bare anchor", (file) => {
  // white-box: AC-5(a) — a bare `<a>` and a routed `Link` both render an anchor element, so the
  // difference is only visible in which component the screen asked for.
  const imports = importsOf(file);
  expect(
    imports.some((line) => line.specifier === "next/link"),
    `${file} does not import next/link`,
  ).toBe(true);
  // white-box: AC-5(a) — the rendered document holds an anchor either way, so which tag the screen
  // opened is not observable through it; the render below asserts what the anchor must still carry.
  expect(/<a[\s/>]/.test(codeOf(file)), `${file} still opens a bare <a> tag`).toBe(false);
});

test("AC-5(a): the footer link is still the evidence-link idiom, at the line's own href", () => {
  render(<FooterLines lines={[{ href: "/reset", label: "auth_evidence_try_again" }]} />);

  const link = screen.getByRole("link", { name: strings.auth_evidence_try_again });
  expect(link.getAttribute("href"), "the line's href is what it leads to").toBe("/reset");
  for (const className of ["cx-auth-link", "cx-reticle"]) {
    expect(link.classList.contains(className), `the footer link keeps ${className}`).toBe(true);
  }
});
