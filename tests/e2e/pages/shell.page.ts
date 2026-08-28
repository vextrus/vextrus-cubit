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

  /** The rail entry for an area, by the id the Design Decision gives it. */
  nav(area: "projects" | "books" | "settings"): Locator {
    return this.page.getByTestId(`shell-nav-${area}`);
  }

  /** The area the URL currently selects, as the rail states it to a reader (`aria-current`). */
  async selectedArea(): Promise<string[]> {
    const areas: string[] = [];
    for (const area of ["projects", "books", "settings"] as const) {
      if ((await this.nav(area).getAttribute("aria-current")) === "page") areas.push(area);
    }
    return areas;
  }

  async open(route: string): Promise<void> {
    await this.page.goto(route);
  }

  /** Wait for the frame to be painted — every shell screen owes all four regions (R-UI-030). */
  async expectFrame(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.rail).toBeVisible();
    await expect(this.topBar).toBeVisible();
    await expect(this.main).toBeVisible();
    await expect(this.inspector).toBeVisible();
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
