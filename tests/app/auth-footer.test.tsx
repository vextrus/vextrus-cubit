// @vitest-environment jsdom
/**
 * AC-5(a): the auth frame's footer and the books screen travel the way the frame travels.
 *
 * A hop inside the product goes through `next/link` — a bare `<a>` fetches a fresh document, drops
 * the client cache and re-mounts the shared layout, taking the rail's collapse back to expanded.
 *
 * The question is asked of the RENDERED screen, not of the module's text: `next/link` is answered
 * with a stand-in that stamps every anchor it renders. An anchor that comes back unstamped is an
 * anchor this screen opened itself, whatever its source says — and a screen that spelled the import
 * without using it fails here exactly as one that never imported it (B-19).
 */
import { join } from "node:path";
import { createElement, type AnchorHTMLAttributes, type FunctionComponent } from "react";
import { render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, productModule } from "../server/support/wire";

const FOOTER = "src/app/(auth)/footer.tsx";
const BOOKS = "src/app/(app)/t/[tenant]/books/page.tsx";
const SHELL = "src/ui/shell/index.ts";

const TENANT = "2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88";

/** What the stand-in router link stamps on every anchor it renders. */
const ROUTED = "data-routed-link";

interface FooterModule {
  FooterLines: FunctionComponent<{ lines: readonly { href: string; label: string; prose?: string }[] }>;
}

interface BooksModule {
  default: (props: { params: Promise<{ tenant: string }> }) => Promise<unknown>;
}

beforeEach(() => {
  vi.resetModules();
  // The router's own link, answered by a stand-in that renders the same real `<a>` and marks it.
  vi.doMock("next/link", () => ({
    default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", { ...props, [ROUTED]: "true" }),
  }));
});

afterEach(() => {
  vi.doUnmock("next/link");
  vi.doUnmock(join(REPO_ROOT, SHELL));
});

/** Every anchor of a rendered tree, with whether the router rendered it. */
function anchorsOf(container: HTMLElement): { href: string | null; routed: boolean; classes: string[]; text: string }[] {
  return [...container.querySelectorAll("a")].map((anchor) => ({
    href: anchor.getAttribute("href"),
    routed: anchor.getAttribute(ROUTED) === "true",
    classes: (anchor.getAttribute("class") ?? "").split(/\s+/).filter((name) => name !== ""),
    text: anchor.textContent?.trim() ?? "",
  }));
}

describe("AC-5: a screen moves the way the frame moves", () => {
  test("AC-5: the auth footer's line is a router hop, still in the evidence-link idiom", async () => {
    const module = await productModule<FooterModule>(FOOTER);
    const line = { href: "/sign-in", label: "auth_evidence_try_again" as const };
    const view = render(createElement(module.FooterLines, { lines: [line] }));
    try {
      const anchors = anchorsOf(view.container);
      expect(anchors.length, "the footer renders the line it was given").toBe(1);
      const anchor = anchors[0];
      expect(anchor?.routed, `the footer's hop must go through the router — this anchor was opened by the screen itself (href ${JSON.stringify(anchor?.href)})`).toBe(true);
      expect(anchor?.href, "and it still points where the line said").toBe(line.href);
      // R-UI-012's focus ring and link colour hang off these two classes: a hop that loses them
      // loses the treatment, whatever element carries it.
      expect(anchor?.classes, "the footer link keeps the auth-link idiom").toContain("cx-auth-link");
      expect(anchor?.classes, "the footer link keeps the reticle").toContain("cx-reticle");

      // The rendered link is still a real anchor a browser can open in a new tab (I-19).
      expect(within(view.container).getByRole("link", { name: anchor?.text ?? "" }).tagName).toBe("A");
    } finally {
      view.unmount();
    }
  });

  test("AC-5: every hop the books screen offers is a router hop", async () => {
    const books = await productModule<BooksModule>(BOOKS);
    const view = render((await books.default({ params: Promise.resolve({ tenant: TENANT }) })) as never);
    try {
      const anchors = anchorsOf(view.container);
      expect(anchors.length, "the empty books area still offers the way to where the work starts (R-UI-050)").toBeGreaterThan(0);
      for (const anchor of anchors) {
        expect(anchor.routed, `an anchor this screen opened itself re-fetches the document and re-mounts the frame — ${JSON.stringify(anchor.href)}`).toBe(true);
        expect(String(anchor.href), "and it points inside the workspace the address names").toContain(TENANT);
      }
    } finally {
      view.unmount();
    }
  });
});
