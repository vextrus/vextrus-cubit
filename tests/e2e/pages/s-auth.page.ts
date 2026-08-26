// S-Auth as a journey drives it. Every handle is one of the eleven test ids the screen's Design
// Decision closes over (§ 7) — a journey that reached for a class or a copy string would be reading
// the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The cookie a session travels in, as the increment's interfaces state it. A journey may not import
 * the identity seam — that module speaks to the database, and the runner is not the server — so the
 * wire name is restated here, where the journey's own reading of it lives.
 */
export const SESSION_COOKIE = "cubit_session";

/** The routes of the test contract, named here so a journey never spells a path twice. */
export const S_AUTH = Object.freeze({
  signUp: "/sign-up",
  signIn: "/sign-in",
  verify: "/verify",
  magicLink: "/magic-link",
  reset: "/reset",
  sessions: "/sessions",
  home: "/",
} as const);

export class SAuthPage {
  constructor(private readonly page: Page) {}

  /**
   * The column's one `<h1>`. Not a test id: the heading is a landmark of the document, and reading
   * it by role is how a person using a screen reader finds out what the screen is showing.
   */
  get heading(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  get email(): Locator {
    return this.page.getByTestId("s-auth-email");
  }

  get password(): Locator {
    return this.page.getByTestId("s-auth-password");
  }

  get workspace(): Locator {
    return this.page.getByTestId("s-auth-tenant-name");
  }

  get submit(): Locator {
    return this.page.getByTestId("s-auth-submit");
  }

  get refusal(): Locator {
    return this.page.getByTestId("s-auth-refusal");
  }

  get fault(): Locator {
    return this.page.getByTestId("s-auth-fault");
  }

  get notice(): Locator {
    return this.page.getByTestId("s-auth-notice");
  }

  get sessionRows(): Locator {
    return this.page.getByTestId("s-auth-session-row");
  }

  get currentSession(): Locator {
    return this.page.getByTestId("s-auth-session-current");
  }

  get revokeButtons(): Locator {
    return this.page.getByTestId("s-auth-session-revoke");
  }

  get signOut(): Locator {
    return this.page.getByTestId("s-auth-signout");
  }

  async open(route: string): Promise<void> {
    await this.page.goto(route);
  }

  /** Open a route with the token a mailed link carries. */
  async openWithToken(route: string, token: string): Promise<void> {
    await this.page.goto(`${route}?token=${encodeURIComponent(token)}`);
  }

  async signUpWith(email: string, password: string, workspace: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.workspace.fill(workspace);
    await this.submit.click();
  }

  async signInWith(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  /** A door that answers with a notice — a link sent, an account verified, a password set. */
  async expectNotice(): Promise<void> {
    await expect(this.notice).toBeVisible();
    await expect(this.fault).toHaveCount(0);
    await expect(this.refusal).toHaveCount(0);
  }

  /** The registered refusal the screen answered with, read from the nested RefusalState. */
  async refusedWith(code: string): Promise<void> {
    await expect(this.refusal.getByTestId("refusal-state")).toHaveAttribute("data-code", code);
    await expect(this.fault).toHaveCount(0);
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }

  /** The token this browser is holding the account's session in. */
  async sessionToken(): Promise<string> {
    const held = (await this.page.context().cookies()).find((cookie) => cookie.name === SESSION_COOKIE);
    expect(held, `the browser holds the ${SESSION_COOKIE} cookie`).toBeTruthy();
    return held?.value ?? "";
  }
}
