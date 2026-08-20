import { expect, type Page } from '@playwright/test';

/**
 * S-Auth page object (R-SPINE-001). Every locator is a contract test id — no
 * text selectors, so the string table can change without breaking a journey.
 */
export class AuthPage {
  constructor(private readonly page: Page) {}

  // --- sign up ------------------------------------------------------------
  async gotoSignUp(): Promise<void> {
    await this.page.goto('/sign-up');
    await expect(this.page.getByTestId('signup-submit')).toBeVisible();
  }

  async signUp(user: { name: string; email: string; password: string }): Promise<void> {
    await this.page.getByTestId('signup-name').fill(user.name);
    await this.page.getByTestId('signup-email').fill(user.email);
    await this.page.getByTestId('signup-password').fill(user.password);
    await this.page.getByTestId('signup-submit').click();
  }

  // --- sign in ------------------------------------------------------------
  async gotoSignIn(): Promise<void> {
    await this.page.goto('/sign-in');
    await expect(this.page.getByTestId('signin-submit')).toBeVisible();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.page.getByTestId('signin-email').fill(email);
    await this.page.getByTestId('signin-password').fill(password);
    await this.page.getByTestId('signin-submit').click();
  }

  // --- magic link ---------------------------------------------------------
  async requestMagicLink(email: string): Promise<void> {
    await this.page.goto('/magic-link');
    await this.page.getByTestId('magic-link-email').fill(email);
    await this.page.getByTestId('magic-link-submit').click();
    await expect(this.page.getByTestId('magic-link-sent')).toBeVisible();
  }

  // --- password reset -----------------------------------------------------
  async requestReset(email: string): Promise<void> {
    await this.page.goto('/forgot-password');
    await this.page.getByTestId('forgot-email').fill(email);
    await this.page.getByTestId('forgot-submit').click();
    await expect(this.page.getByTestId('forgot-sent')).toBeVisible();
  }

  async completeReset(url: string, newPassword: string): Promise<void> {
    await this.page.goto(url);
    await this.page.getByTestId('reset-password').fill(newPassword);
    await this.page.getByTestId('reset-password-confirm').fill(newPassword);
    await this.page.getByTestId('reset-submit').click();
  }

  // --- sessions -----------------------------------------------------------
  async gotoSessions(): Promise<void> {
    await this.page.goto('/account/sessions');
  }

  sessionRows() {
    return this.page.getByTestId('session-row');
  }

  currentSessionRow() {
    return this.sessionRows().filter({ has: this.page.getByTestId('session-current-badge') });
  }

  otherSessionRows() {
    return this.sessionRows().filter({ hasNot: this.page.getByTestId('session-current-badge') });
  }

  // --- refusals (R-UI-020, AC-16) ----------------------------------------
  /** A refusal renders in place: code, message and remedy, never a toast alone. */
  async expectRefusal(code: string): Promise<void> {
    const state = this.page.getByTestId('refusal-state');
    await expect(state).toBeVisible();
    await expect(state.getByTestId('refusal-code')).toHaveText(code);
    await expect(state.getByTestId('refusal-message')).not.toBeEmpty();
    await expect(state.getByTestId('refusal-remedy')).not.toBeEmpty();
  }

  // --- theme (AC-30) ------------------------------------------------------
  async toggleTheme(): Promise<void> {
    await this.page.getByTestId('theme-toggle').click();
  }

  async currentTheme(): Promise<string | null> {
    return this.page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  }
}
