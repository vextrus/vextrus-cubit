// The workspace members screen as a journey drives it: the roster, the two role controls, and the
// invitations panel beneath them. Every handle is one of the test ids the screen's Design Decision
// closes over (docs/design/s-settings.md § 7) — a journey that reached for a class or a copy string
// would be reading the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";

/** The addresses this screen is reached at, spelled once so a journey never writes a path twice. */
export const S_MEMBERS = Object.freeze({
  settings: (tenantId: string): string => `/t/${tenantId}/settings`,
  members: (tenantId: string): string => `/t/${tenantId}/settings/members`,
  workspace: (tenantId: string): string => `/t/${tenantId}`,
  accept: "/accept-invitation",
} as const);

export class SMembersPage {
  constructor(private readonly page: Page) {}

  /* --- the settings landing's door into this screen (I-60) --- */

  get link(): Locator {
    return this.page.getByTestId("settings-members-link");
  }

  /* --- the roster (§ 1) --- */

  get section(): Locator {
    return this.page.getByTestId("members-section");
  }

  get memberRows(): Locator {
    return this.page.getByTestId("members-row");
  }

  /** One member's row, by the account id the row carries. */
  memberRow(userId: string): Locator {
    return this.page.locator(`[data-testid="members-row"][data-user="${userId}"]`);
  }

  /** The role the roster shows for one member — the store's own word, rendered verbatim (I-55). */
  async roleOf(userId: string): Promise<string> {
    return (await this.memberRow(userId).getByTestId("members-row-role").innerText()).trim();
  }

  /** Move one member's role through the form the screen ships, and wait for the answer to settle. */
  async chooseRole(userId: string, role: string): Promise<void> {
    await this.memberRow(userId).getByTestId("members-role-form").getByTestId("members-role-select").selectOption(role);
    await this.memberRow(userId).getByTestId("members-role-submit").click();
  }

  /** Ask for one membership to be taken away. */
  async submitRemoval(userId: string): Promise<void> {
    await this.memberRow(userId).getByTestId("members-remove-form").getByTestId("members-remove-submit").click();
  }

  /** The answer slot the refused row speaks in (I-57). */
  refusal(userId: string): Locator {
    return this.memberRow(userId).getByTestId("members-refusal");
  }

  /** The registered code that slot is wearing, machine-readably — waited for, never assumed. */
  async refusalCode(userId: string): Promise<string> {
    const slot = this.refusal(userId).locator("[data-code]").first();
    await slot.waitFor({ state: "visible", timeout: 30_000 });
    return (await slot.getAttribute("data-code")) ?? "";
  }

  /* --- the invitations panel (§ 1, I-61's two slots) --- */

  get inviteForm(): Locator {
    return this.page.getByTestId("members-invite-form");
  }

  get pendingList(): Locator {
    return this.page.getByTestId("members-pending-invitations");
  }

  get pendingRows(): Locator {
    return this.page.getByTestId("invitations-row");
  }

  get noPending(): Locator {
    return this.page.getByTestId("invitations-none");
  }

  get panelRefusal(): Locator {
    return this.page.getByTestId("invitations-refusal");
  }

  /** Offer somebody a membership by email, and wait for the pending row it becomes. */
  async invite(email: string): Promise<void> {
    await this.inviteForm.getByTestId("invitations-email").fill(email);
    await this.inviteForm.getByTestId("invitations-submit").click();
    await expect(this.noPending, "the honest empty line steps aside once an invitation stands").toHaveCount(0);
  }

  /** Withdraw the first standing offer. */
  async revokeFirst(): Promise<void> {
    await this.pendingRows.first().getByTestId("invitations-revoke").click();
  }

  /** Open this screen at a workspace, and wait for the roster to be painted. */
  async open(tenantId: string): Promise<void> {
    await this.page.goto(S_MEMBERS.members(tenantId));
    await expect(this.section).toBeVisible();
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}

/**
 * The workspaces the rail's switcher offers, read by opening the menu a person opens (R-SPINE-002:
 * one user, many tenants, the switcher live).
 */
export async function switcherWorkspaces(page: Page): Promise<string[]> {
  const trigger = page.getByTestId("shell-tenant-switcher");
  await trigger.waitFor({ state: "visible", timeout: 30_000 });
  await trigger.click();
  const menu = page.locator('[role="menu"]').first();
  await menu.waitFor({ state: "visible", timeout: 30_000 });
  const offered = (await menu.locator('[role="menuitem"]').allTextContents()).map((text) => text.replace(/\s+/g, " ").trim());
  await page.keyboard.press("Escape");
  return offered.filter((text) => text.length > 0);
}

/** Move to one of the offered workspaces through the switcher, exactly as a person would. */
export async function switchTo(page: Page, workspaceName: string): Promise<void> {
  const trigger = page.getByTestId("shell-tenant-switcher");
  await trigger.click();
  const menu = page.locator('[role="menu"]').first();
  await menu.waitFor({ state: "visible", timeout: 30_000 });
  await menu.getByRole("menuitem", { name: workspaceName, exact: true }).click();
}
