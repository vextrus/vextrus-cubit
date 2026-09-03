// @vitest-environment jsdom
/**
 * AC-3 — the area→label mapping has one home, and the breadcrumb can name the current page
 * (debt-src-ui-15k635n, debt-src-ui-1bld80v).
 *
 * Both halves are graded through the frame's own contract: the label is read back from
 * `areaLabel` for every area the roster holds (never from a list re-typed here), and the crumbs are
 * read out of `[data-testid="shell-breadcrumb"]` as a reader meets them — position, link, and the
 * one `aria-current` claim docs/design/shell.md §top bar allows.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";
import { lex } from "./support/source-text";

const ROUTES_MODULE = "src/ui/shell/routes.ts";
const BARREL_MODULE = "src/ui/shell/index.ts";
const TOP_BAR_MODULE = "src/ui/shell/shell-top-bar.tsx";
const APP_SHELL_MODULE = "src/ui/shell/app-shell.tsx";
const RAIL_MODULE = "src/ui/shell/shell-rail.tsx";
const STRINGS_MODULE = "src/ui/strings/index.ts";

/** The workspace the frame is showing in these mounts, declared once (B-19). */
const WORKSPACE = { tenantId: "A", name: "Acme Holdings" };
/** The crumb text the caller hands down — the page's own name, never a string-table key (C-05). */
const PAGE = "Members";
const AREA = "books";

const sourceOf = (relative: string) => readFileSync(join(REPO_ROOT, relative), "utf8");
const noop = () => {};

async function routes() {
  return await productModule<Record<string, unknown>>(ROUTES_MODULE);
}

async function topBar(props: Record<string, unknown>) {
  const mod = await productModule<Record<string, unknown>>(TOP_BAR_MODULE);
  const ShellTopBar = mod.ShellTopBar as (p: Record<string, unknown>) => unknown;
  return render(createElement(ShellTopBar as never, { workspace: WORKSPACE, area: AREA, email: null, signOut: noop, ...props }));
}

/** The `<li>`s of the breadcrumb, in the order a reader meets them. */
function crumbsOf(container: HTMLElement): HTMLElement[] {
  const nav = within(container).getByTestId("shell-breadcrumb");
  return [...nav.querySelectorAll("li")] as HTMLElement[];
}

afterEach(() => {
  cleanup();
});

describe("AC-3: the area label has one home", () => {
  test("AC-3(a): areaLabel answers the string table's own words for every area in the roster", async () => {
    const mod = await routes();
    expect(typeof mod.areaLabel, `${ROUTES_MODULE} exports areaLabel`).toBe("function");
    const areaLabel = mod.areaLabel as (area: string) => string;
    const areas = mod.SHELL_AREAS as readonly string[];
    const { strings } = await productModule<{ strings: Record<string, string> }>(STRINGS_MODULE);

    expect(areas.length, "there is an area to label").toBeGreaterThan(0);
    for (const area of areas) {
      const key = `shell_nav_${area}`;
      expect(strings[key], `the string table holds ${key}`).toBeTruthy();
      expect(areaLabel(area), `${area}'s label comes from the string table`).toBe(strings[key]);
    }
  });

  test("AC-3(a): the shell barrel publishes the same areaLabel, not a second one", async () => {
    const barrel = await productModule<Record<string, unknown>>(BARREL_MODULE);
    const mod = await routes();
    expect(barrel.areaLabel, `${BARREL_MODULE} exports areaLabel`).toBeDefined();
    expect(barrel.areaLabel).toBe(mod.areaLabel);
  });

  test("AC-3(a): neither the rail nor the top bar reaches for the nav strings itself (B-17)", () => {
    for (const relative of [RAIL_MODULE, TOP_BAR_MODULE]) {
      const { code } = lex(sourceOf(relative), "ts");
      expect(code.includes("strings.shell_nav_"), `${relative} reads its labels through areaLabel`).toBe(false);
    }
  });
});

describe("AC-3: the breadcrumb can name the page inside an area", () => {
  test("AC-3(b): inside an area, the page crumb follows the area link and carries the only aria-current", async () => {
    const mod = await routes();
    const areaLabel = mod.areaLabel as (area: string) => string;
    const shellHref = mod.shellHref as (tenantId: string, area: string) => string;
    const workspaceLabel = mod.workspaceLabel as (workspace: typeof WORKSPACE) => string;

    const { container } = await topBar({ atAreaHome: false, page: PAGE });
    const nav = within(container).getByTestId("shell-breadcrumb");
    const crumbs = crumbsOf(container);
    expect(crumbs.length, "workspace, separator, area, separator, page").toBe(5);

    const workspaceLink = crumbs[0].querySelector("a");
    expect(workspaceLink?.textContent).toBe(workspaceLabel(WORKSPACE));
    expect(crumbs[1].className).toContain("cx-shell-crumb-separator");

    const areaLink = crumbs[2].querySelector("a");
    expect(areaLink, "the area crumb is a link back to the area's home").not.toBeNull();
    expect(areaLink?.getAttribute("href")).toBe(shellHref(WORKSPACE.tenantId, AREA));
    expect(areaLink?.textContent).toBe(areaLabel(AREA));
    expect(crumbs[3].className).toContain("cx-shell-crumb-separator");

    const page = within(nav).getByTestId("shell-crumb-page");
    expect(page).toBe(crumbs[4]);
    expect(page.tagName).toBe("LI");
    expect(page.className).toContain("cx-shell-crumb-current");
    expect(page.getAttribute("aria-current")).toBe("page");
    expect(page.textContent).toBe(PAGE);

    expect([...nav.querySelectorAll("[aria-current]")], "one crumb claims to be the page").toEqual([page]);
  });

  test("AC-3(c): at the area's own home the area crumb is the page and the page prop is ignored", async () => {
    const mod = await routes();
    const areaLabel = mod.areaLabel as (area: string) => string;

    const { container } = await topBar({ atAreaHome: true, page: PAGE });
    const nav = within(container).getByTestId("shell-breadcrumb");
    expect(within(nav).queryByTestId("shell-crumb-page"), "the area home names no page beneath itself").toBeNull();

    const current = [...nav.querySelectorAll("[aria-current]")] as HTMLElement[];
    expect(current.length).toBe(1);
    expect(current[0].getAttribute("aria-current")).toBe("page");
    expect(current[0].textContent).toBe(areaLabel(AREA));
  });

  test("AC-3(d): AppShell hands the page down to the top bar", async () => {
    const mod = await productModule<Record<string, unknown>>(APP_SHELL_MODULE);
    const AppShell = mod.AppShell as (p: Record<string, unknown>) => unknown;
    const { container } = render(
      createElement(AppShell as never, {
        workspace: WORKSPACE,
        area: AREA,
        atAreaHome: false,
        email: null,
        signOut: noop,
        page: PAGE,
        children: createElement("p", null, "screen"),
      }),
    );
    const nav = within(container).getByTestId("shell-breadcrumb");
    expect(within(nav).getByTestId("shell-crumb-page").textContent).toBe(PAGE);
  });
});
