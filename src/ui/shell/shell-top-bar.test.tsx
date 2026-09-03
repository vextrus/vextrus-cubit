// @vitest-environment jsdom
/**
 * The breadcrumb tells a reader where they are (R-UI-031): the workspace, the area, and — inside an
 * area — the screen itself, with exactly one crumb claiming to be the page (Q-11).
 */
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ShellTopBar } from "./shell-top-bar";
import { areaLabel, shellHref, workspaceLabel } from "./routes";
import type { ShellWorkspace } from "./routes";

const WORKSPACE: ShellWorkspace = { tenantId: "A", name: "Acme Holdings" };
const PAGE = "Members";

afterEach(() => {
  cleanup();
});

function crumbs(container: HTMLElement): HTMLElement[] {
  return [...within(container).getByTestId("shell-breadcrumb").querySelectorAll("li")];
}

describe("the breadcrumb inside an area", () => {
  test("names the page after the area, and only it claims to be the page", () => {
    const { container } = render(
      <ShellTopBar workspace={WORKSPACE} area="books" atAreaHome={false} page={PAGE} email={null} signOut={() => {}} />,
    );
    const trail = crumbs(container);
    expect(trail.length).toBe(5);
    expect(trail[0]?.querySelector("a")?.textContent).toBe(workspaceLabel(WORKSPACE));
    expect(trail[2]?.querySelector("a")?.getAttribute("href")).toBe(shellHref(WORKSPACE.tenantId, "books"));
    expect(trail[2]?.querySelector("a")?.textContent).toBe(areaLabel("books"));

    const page = within(container).getByTestId("shell-crumb-page");
    expect(page).toBe(trail[4]);
    expect(page.getAttribute("aria-current")).toBe("page");
    expect(page.textContent).toBe(PAGE);
    expect([...container.querySelectorAll("[aria-current]")]).toEqual([page]);
  });

  test("without a page the trail ends at the area, as the frame has always drawn it", () => {
    const { container } = render(
      <ShellTopBar workspace={WORKSPACE} area="books" atAreaHome={false} email={null} signOut={() => {}} />,
    );
    expect(crumbs(container).length).toBe(3);
    expect(within(container).queryByTestId("shell-crumb-page")).toBeNull();
  });
});

describe("the breadcrumb at an area's own home", () => {
  test("the area crumb is the page, and a page handed in is not shown beneath it", () => {
    const { container } = render(
      <ShellTopBar workspace={WORKSPACE} area="books" atAreaHome={true} page={PAGE} email={null} signOut={() => {}} />,
    );
    expect(within(container).queryByTestId("shell-crumb-page")).toBeNull();
    const current = [...container.querySelectorAll("[aria-current]")];
    expect(current.length).toBe(1);
    expect(current[0]?.textContent).toBe(areaLabel("books"));
  });
});
