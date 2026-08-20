import { expect, type Page } from '@playwright/test';

/**
 * Onboarding and the tenant home (R-SPINE-002, R-UI-033, D-01).
 * The active tenant is explicit in the URL: /t/{tenantSlug}.
 */
export class TenantPage {
  constructor(private readonly page: Page) {}

  async expectCreateTenant(): Promise<void> {
    await expect(this.page).toHaveURL(/\/create-tenant$/);
    await expect(this.page.getByTestId('create-tenant-submit')).toBeVisible();
  }

  async createTenant(name: string): Promise<void> {
    await this.page.getByTestId('create-tenant-name').fill(name);
    await this.page.getByTestId('create-tenant-submit').click();
  }

  async skipCreateTenant(): Promise<void> {
    await this.page.getByTestId('create-tenant-skip').click();
  }

  async gotoTenant(slug: string): Promise<void> {
    await this.page.goto(`/t/${slug}`);
  }

  /** Returns the slug the tenant home is actually showing. */
  async expectTenantHome(): Promise<string> {
    await expect(this.page).toHaveURL(/\/t\/[a-z0-9-]+$/);
    await expect(this.page.getByTestId('tenant-home')).toBeVisible();
    const slug = this.page.getByTestId('tenant-slug');
    await expect(slug).toBeVisible();
    const shown = ((await slug.textContent()) ?? '').trim();
    const inUrl = new URL(this.page.url()).pathname.split('/')[2] ?? '';
    expect(shown, 'tenant-home must show the same slug the URL names').toContain(inUrl);
    return inUrl;
  }
}
