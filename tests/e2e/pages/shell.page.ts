// The signed-in shell as a journey drives it. Every handle is one of the test ids the screen's
// Design Decision closes over (docs/design/shell.md § 7) — a journey that reached for a class or a
// copy string would be reading the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";

/** The addresses R-UI-031 pins, spelled once so a journey never writes a path twice. */
export const SHELL = Object.freeze({
  home: "/",
  signIn: "/sign-in",
  sessions: "/sessions",
  workspace: (tenantId: string): string => `/t/${tenantId}`,
  books: (tenantId: string): string => `/t/${tenantId}/books`,
  settings: (tenantId: string): string => `/t/${tenantId}/settings`,
} as const);

/** The rail's areas, in the order the Design Decision lists them (docs/design/shell.md § 1). */
export const SHELL_AREAS = ["projects", "books", "settings"] as const;
export type ShellArea = (typeof SHELL_AREAS)[number];

/** The regions R-UI-030 composes the frame from — each one owed *inside* shell-root. */
const FRAME_REGIONS = ["shell-rail", "shell-topbar", "shell-main", "shell-inspector"] as const;

export class ShellPage {
  constructor(private readonly page: Page) {}

  /* --- the nameplate's door into the workspace (R-UI-031) --- */

  get workspaceDoor(): Locator {
    return this.page.getByTestId("root-home-workspace-door");
  }

  /* --- the frame (R-UI-030) --- */

  get root(): Locator {
    return this.page.getByTestId("shell-root");
  }

  get rail(): Locator {
    return this.page.getByTestId("shell-rail");
  }

  get railMark(): Locator {
    return this.page.getByTestId("shell-rail-mark");
  }

  get railCollapse(): Locator {
    return this.page.getByTestId("shell-rail-collapse");
  }

  get tenantSwitcher(): Locator {
    return this.page.getByTestId("shell-tenant-switcher");
  }

  get topBar(): Locator {
    return this.page.getByTestId("shell-topbar");
  }

  get breadcrumb(): Locator {
    return this.page.getByTestId("shell-breadcrumb");
  }

  get main(): Locator {
    return this.page.getByTestId("shell-main");
  }

  get inspector(): Locator {
    return this.page.getByTestId("shell-inspector");
  }

  /* --- the user menu, holding the two doors a signed-in person always owes --- */

  get user(): Locator {
    return this.page.getByTestId("shell-user");
  }

  get userSessions(): Locator {
    return this.page.getByTestId("shell-user-sessions");
  }

  get userSignOut(): Locator {
    return this.page.getByTestId("shell-user-signout");
  }

  /* --- the onboarding screen (R-UI-033) --- */

  get empty(): Locator {
    return this.page.getByTestId("shell-empty");
  }

  get emptyAction(): Locator {
    return this.page.getByTestId("shell-empty-action");
  }

  get sampleOffer(): Locator {
    return this.page.getByTestId("shell-sample-offer");
  }

  get sampleOutcome(): Locator {
    return this.page.getByTestId("shell-sample-outcome");
  }

  /* --- the settings screen's rename (R-UI-033) --- */

  get settingsName(): Locator {
    return this.page.getByTestId("shell-settings-name");
  }

  get renameInput(): Locator {
    return this.page.getByTestId("shell-rename-input");
  }

  get renameSubmit(): Locator {
    return this.page.getByTestId("shell-rename-submit");
  }

  get renameRefusal(): Locator {
    return this.page.getByTestId("shell-rename-refusal");
  }

  /* --- the frameless denial surface (R-UI-050's permission-denied state) --- */

  get denied(): Locator {
    return this.page.getByTestId("shell-permission-denied");
  }

  get deniedPermission(): Locator {
    return this.page.getByTestId("shell-denied-permission");
  }

  get deniedHolder(): Locator {
    return this.page.getByTestId("shell-denied-holder");
  }

  /** The registered refusal a screen is answering with, read from the one renderer. */
  get refusalState(): Locator {
    return this.page.getByTestId("refusal-state");
  }

  /** The rail entry for an area, by the id the Design Decision gives it. */
  nav(area: ShellArea): Locator {
    return this.page.getByTestId(`shell-nav-${area}`);
  }

  /** The area the URL currently selects, as the rail states it to a reader (`aria-current`). */
  async selectedArea(): Promise<ShellArea[]> {
    const areas: ShellArea[] = [];
    for (const area of SHELL_AREAS) {
      if ((await this.nav(area).getAttribute("aria-current")) === "page") areas.push(area);
    }
    return areas;
  }

  async open(route: string): Promise<void> {
    await this.page.goto(route);
  }

  /**
   * Wait for the frame to be painted — every shell screen owes all four regions (R-UI-030).
   *
   * Containment, not co-existence: R-UI-030 is a composition clause ("left rail … top bar, main
   * area, right inspector"), and four regions rendered as unrelated siblings of shell-root would
   * satisfy any page-scoped "is it there" check while not being the frame. So each region is looked
   * for INSIDE shell-root. "Contains", never "contains only" — the top bar gains ⌘K, the jobs tray
   * and a project switcher in later milestones, and that must not redden this.
   */
  async expectFrame(): Promise<void> {
    await expect(this.root).toBeVisible();
    for (const region of FRAME_REGIONS) {
      await expect(this.root.getByTestId(region), `R-UI-030: ${region} is a region of the frame, inside shell-root`).toBeVisible();
    }
  }

  /* --- the selection's paint (R-UI-030: "3 px inset beam bar + beam-100 row fill") --- */

  /**
   * Every colour token the page declares, each PAIRED WITH ITS NAME: a hidden probe resolves
   * `var(--token)` inside the document, so painted surfaces are graded against the token the clause
   * names and this file spells no colour (R-UI-001, which `cubit/no-colour-literal` binds anyway).
   * Both sides of a paint comparison come back in the same serialized form, under the same theme.
   */
  async tokenPalette(): Promise<{ name: string; colour: string }[]> {
    return this.page.evaluate(() => {
      const probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.position = "fixed";
      probe.style.top = "0";
      probe.style.left = "0";
      probe.style.width = "1px";
      probe.style.height = "1px";
      probe.style.opacity = "0";
      document.body.append(probe);
      const declared = getComputedStyle(document.documentElement);
      const painted: { name: string; colour: string }[] = [];
      for (let index = 0; index < declared.length; index += 1) {
        const name = declared.item(index);
        // Only the tokens that ARE colours — a space or a duration painted as a background is not
        // one, and the browser is asked which is which rather than this file spelling a value.
        if (!name.startsWith("--") || !CSS.supports("color", declared.getPropertyValue(name).trim())) continue;
        probe.style.backgroundColor = `var(${name})`;
        painted.push({ name, colour: getComputedStyle(probe).backgroundColor });
      }
      probe.remove();
      return painted;
    });
  }

  /** The colour a rail entry is actually filled with, as the browser serializes it. */
  async paintedFill(area: ShellArea): Promise<string> {
    return this.nav(area).evaluate((element: Element) => getComputedStyle(element).backgroundColor);
  }

  /**
   * Every way a rail entry wears a strip of exactly `width` down one edge, and the colour of each.
   *
   * The mechanism is deliberately not dictated: a positioned pseudo-element (what docs/design/shell.md
   * § 1 rules), a positioned child, a border on the inline start, or an inset box-shadow all paint
   * the same bar, and R-UI-030 is about the bar, not the technique.
   */
  async insetStrips(area: ShellArea, width: string): Promise<{ where: string; colour: string }[]> {
    return this.nav(area).evaluate((element: Element, bar: string) => {
      const strips: { where: string; colour: string }[] = [];
      const consider = (where: string, size: string, colour: string): void => {
        if (size.trim() === bar) strips.push({ where, colour });
      };
      const own = getComputedStyle(element);
      for (const side of ["border-inline-start", "border-left"]) {
        consider(side, own.getPropertyValue(`${side}-width`), own.getPropertyValue(`${side}-color`));
      }
      for (const pseudo of ["::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        if (style.getPropertyValue("content") === "none") continue;
        consider(pseudo, style.getPropertyValue("width"), style.getPropertyValue("background-color"));
      }
      for (const child of Array.from(element.querySelectorAll("*"))) {
        const style = getComputedStyle(child);
        consider(`child <${child.tagName.toLowerCase()}>`, style.getPropertyValue("width"), style.getPropertyValue("background-color"));
      }
      // A box-shadow serializes as `<colour function> <offsets> inset`: the colour comes first and
      // closes its own parenthesis, the geometry follows. Split at that parenthesis rather than
      // matching a colour function by name, so this file spells no colour at all (R-UI-001).
      const shadow = own.getPropertyValue("box-shadow");
      const split = shadow.lastIndexOf(")");
      const colour = split >= 0 ? shadow.slice(0, split + 1).trim() : "";
      const geometry = (split >= 0 ? shadow.slice(split + 1) : shadow).trim();
      if (colour !== "" && geometry.includes("inset") && geometry.split(/\s+/).includes(bar)) strips.push({ where: "inset box-shadow", colour });
      return strips;
    }, width);
  }

  /** Open the user menu and wait for its two doors, so a click lands on a settled overlay. */
  async openUserMenu(): Promise<void> {
    await this.user.click();
    await expect(this.userSessions).toBeVisible();
    await expect(this.userSignOut).toBeVisible();
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}
