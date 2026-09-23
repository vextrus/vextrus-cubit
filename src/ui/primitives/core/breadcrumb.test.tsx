// @vitest-environment jsdom
/**
 * Breadcrumb — `workspace › project ▾ › area › page` (Design Direction 00 §1, §3.1, R-UI-084).
 *
 * The crumbs are built HERE from `src/ui/shell/routes.ts` — the one home of the address→label
 * mapping (B-17) — rather than from labels typed into this file: what the trail must prove is that
 * a crumb the shell derives arrives at a reader as a real place. The primitive itself decides
 * nothing about what a place is called, which is why the data comes from the module that does.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { Breadcrumb, type BreadcrumbCrumb } from "./breadcrumb";
import { areaLabel, shellHref, workspaceLabel, type ShellWorkspace } from "../../shell/routes";
import { strings } from "../../strings";

const WORKSPACE: ShellWorkspace = { tenantId: "00000000-0000-4000-8000-00000000c017", name: "Trace Survey" };
const PROJECT = { id: "p:riverside", label: "Riverside Tower", href: "/t/00000000-0000-4000-8000-00000000c017/p/riverside" };
const PAGE = "Register";

/** The trail the shell's own roster produces, exactly as the top bar will build it. */
function crumbs(): BreadcrumbCrumb[] {
  return [
    { id: "workspace", label: workspaceLabel(WORKSPACE), href: shellHref(WORKSPACE.tenantId, "projects") },
    {
      id: "project",
      label: PROJECT.label,
      href: PROJECT.href,
      menu: [
        { id: "p:sattva", label: "Sattva Tower", href: "/t/00000000-0000-4000-8000-00000000c017/p/sattva" },
        { id: "p:foundry", label: "Foundry", href: "/t/00000000-0000-4000-8000-00000000c017/p/foundry" },
      ],
    },
    { id: "area", label: areaLabel("settings"), href: shellHref(WORKSPACE.tenantId, "settings") },
    { id: "page", label: PAGE, current: true },
  ];
}

const items = (): HTMLElement[] => screen.getAllByTestId("breadcrumb-crumb");

afterEach(cleanup);

describe("Breadcrumb", () => {
  test("it is navigation, and it names the four places in the order the template spells them", () => {
    render(<Breadcrumb crumbs={crumbs()} />);
    const nav = screen.getByTestId("breadcrumb");
    expect(nav.tagName).toBe("NAV");
    expect(nav.getAttribute("aria-label")).toBe(strings.primitive_breadcrumb_label);
    expect(items().map((item) => item.getAttribute("data-crumb"))).toEqual(["workspace", "project", "area", "page"]);
  });

  test("R-UI-084: every crumb that has an address is a real link, carrying the address routes.ts gave it", () => {
    render(<Breadcrumb crumbs={crumbs()} />);
    const links = items().map((item) => item.querySelector("a.cx-breadcrumb-label"));
    expect(links[0]?.getAttribute("href"), "the workspace crumb leads to the workspace").toBe(shellHref(WORKSPACE.tenantId, "projects"));
    expect(links[0]?.textContent).toBe(workspaceLabel(WORKSPACE));
    expect(links[1]?.getAttribute("href")).toBe(PROJECT.href);
    expect(links[2]?.getAttribute("href")).toBe(shellHref(WORKSPACE.tenantId, "settings"));
    expect(links[2]?.textContent, "the area's words are the string table's, through areaLabel").toBe(areaLabel("settings"));
    expect(links[3], "the page a reader is on is not a link to itself").toBeNull();
  });

  test("exactly one crumb claims to be the page, and it is the last", () => {
    render(<Breadcrumb crumbs={crumbs()} />);
    const claiming = [...screen.getByTestId("breadcrumb").querySelectorAll("[aria-current]")];
    expect(claiming.length).toBe(1);
    expect(claiming[0]?.textContent).toBe(PAGE);
  });

  test("a crumb with siblings wears a disclosure, and what it opens is a list of real links", async () => {
    const user = userEvent.setup();
    render(<Breadcrumb crumbs={crumbs()} />);
    expect(screen.queryByTestId("breadcrumb-menu-list"), "the menu is closed until it is asked for").toBeNull();

    const disclosure = screen.getByTestId("breadcrumb-menu");
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    expect(disclosure.getAttribute("data-crumb")).toBe("project");
    await user.click(disclosure);

    const menu = screen.getByTestId("breadcrumb-menu-list");
    const entries = within(menu).getAllByRole("link");
    expect(entries.map((entry) => entry.textContent)).toEqual(["Sattva Tower", "Foundry"]);
    expect(entries[0]?.getAttribute("href")).toBe("/t/00000000-0000-4000-8000-00000000c017/p/sattva");
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("breadcrumb-menu-list"), "Escape closes it").toBeNull();
  });

  test("a crumb with no siblings has no disclosure at all", () => {
    render(<Breadcrumb crumbs={[{ id: "only", label: "Projects", href: "/t/x" }]} />);
    expect(screen.queryByTestId("breadcrumb-menu")).toBeNull();
  });

  test("the trail never wraps: the list is a nowrap row and each label ellipsises inside its own crumb", () => {
    const { container } = render(<Breadcrumb crumbs={crumbs()} />);
    expect(container.querySelector(".cx-breadcrumb-list"), "the row that must not break is the list").not.toBeNull();
    expect(items().every((item) => item.querySelector(".cx-breadcrumb-label") !== null)).toBe(true);
    // The measure itself is CSS (`white-space: nowrap` on the list, `text-overflow` on the label):
    // jsdom lays nothing out, so the class contract is what is graded here and the paint is graded
    // in the browser at the gallery's own capture (ARCH-02).
    expect(screen.getByTestId("breadcrumb").className).toContain("cx-breadcrumb");
  });

  test("a consumer's class joins the primitive's", () => {
    render(<Breadcrumb crumbs={crumbs()} className="cx-shell-crumbs" />);
    expect(screen.getByTestId("breadcrumb").className.split(" ")).toEqual(["cx-breadcrumb", "cx-shell-crumbs"]);
  });
});

/** A stylesheet with its prose removed: a comment is not a selector. */
const rulesOf = (file: string): string => readFileSync(resolve(process.cwd(), file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Every rule in `css` as `[selector, declarations]`, flat (the breadcrumb's rules sit in no @-block). */
const ruleBlocks = (css: string): [string, string][] =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => [(match[1] ?? "").trim(), match[2] ?? ""]);

const declarationsOf = (css: string, selector: string): string => {
  const hit = ruleBlocks(css).find(([held]) => held === selector);
  expect(hit, `the stylesheet declares a \`${selector}\` rule`).toBeDefined();
  return (hit as [string, string])[1];
};

describe("I-358: the page crumb names the page in full, and reads as the page", () => {
  const CORE = rulesOf("src/ui/primitives/core/core.css");
  const PAGE_LABEL = '.cx-breadcrumb-item[aria-current="page"] > .cx-breadcrumb-label';

  test("an ancestor's words keep the drawer cap; the page's words lift it", () => {
    expect(declarationsOf(CORE, ".cx-breadcrumb-label"), "an ancestor is capped at a drawer's measure").toContain(
      "max-width: calc(var(--drawer-w) - var(--space-8));",
    );
    const page = declarationsOf(CORE, PAGE_LABEL);
    expect(page, "the page crumb takes the trail's free width — the cap clipped a set's own name with 440 px standing empty").toContain(
      "max-width: none;",
    );
    expect(page, "and reads in the primary ink, as shell.md's top bar rules").toContain("color: var(--ink);");
    expect(page, "at the body-medium weight").toContain("font-weight: var(--weight-body-medium);");
  });

  test("when the trail runs out of room the ancestors yield first, and the page still ellipsises last", () => {
    expect(declarationsOf(CORE, ".cx-breadcrumb-item"), "an ancestor gives up its width four times as readily").toContain("flex: 0 4 auto;");
    expect(declarationsOf(CORE, '.cx-breadcrumb-item[aria-current="page"]'), "the page crumb shrinks only at the weight of its own width").toContain(
      "flex-shrink: 1;",
    );
  });

  test("every rule that styles the claim selects an element that carries it — no rule is dead", () => {
    // The rule that stood here from U1b named `aria-current` on the LABEL; the claim is the `<li>`'s,
    // so the page crumb was drawn exactly like the links above it and nothing said so.
    const { container } = render(<Breadcrumb crumbs={crumbs()} />);
    const claims = ruleBlocks(CORE)
      .flatMap(([selector]) => selector.split(","))
      .map((selector) => selector.trim())
      .filter((selector) => selector.includes("cx-breadcrumb") && selector.includes("aria-current"));
    expect(claims.length, "the stylesheet styles the page crumb at all").toBeGreaterThan(0);
    for (const selector of claims) {
      expect(container.querySelector(selector.replace(/:[a-z-]+(\([^)]*\))?/g, "")), `\`${selector}\` selects the page crumb`).not.toBeNull();
    }
    const label = container.querySelector<HTMLElement>(PAGE_LABEL);
    expect(label?.textContent, "and the element it selects is the page's own name").toBe(PAGE);
  });

  test("the top bar hands the trail exactly its free width, so the end cluster never breaks onto a second line", () => {
    const shell = declarationsOf(rulesOf("src/ui/shell/shell.css"), ".cx-shell-breadcrumb");
    expect(shell, "a basis of zero that grows: the trail takes what the cluster leaves, never the cluster's own width").toContain(
      "flex: 1 1 0%;",
    );
    expect(shell, "and clips what does not fit rather than widening the bar").toContain("min-width: 0;");
  });
});
