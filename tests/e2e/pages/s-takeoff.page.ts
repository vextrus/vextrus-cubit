/**
 * S-Takeoff, as the journey walks it (docs/design/s-takeoff.md §7's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape. The Builder may edit this file (test contract).
 */
import { expect, type Locator, type Page } from "@playwright/test";

/** The two addresses this screen answers at (test contract: routes). */
export const S_TAKEOFF = Object.freeze({
  takeoff: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff`,
  register: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`,
} as const);

export class STakeoffPage {
  constructor(private readonly page: Page) {}

  /** Open the takeoff address and be carried to the register, which is what it answers with. */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_TAKEOFF.takeoff(tenantId, projectId));
    await this.page.waitForURL(new RegExp(`${S_TAKEOFF.register(tenantId, projectId)}$`));
    await expect(this.root, "the register workspace renders for a project the workspace holds").toBeVisible();
  }

  get root(): Locator {
    return this.page.getByTestId("register-workspace");
  }

  /* --- the lane's own navigation (Decision §1) --- */

  get nav(): Locator {
    return this.page.getByTestId("takeoff-nav");
  }

  get navRegister(): Locator {
    return this.page.getByTestId("takeoff-nav-register");
  }

  /* --- the three regions of the body --- */

  get tree(): Locator {
    return this.page.getByTestId("register-tree");
  }

  /** One item of the tree, by the label a reader reads on it. */
  treeItem(label: string): Locator {
    return this.tree.getByRole("treeitem", { name: label, exact: false });
  }

  get inspector(): Locator {
    return this.page.getByTestId("register-inspector");
  }

  get objectCorroboration(): Locator {
    return this.page.getByTestId("register-object-corroboration");
  }

  get lines(): Locator {
    return this.page.getByTestId("register-lines");
  }

  get linesCount(): Locator {
    return this.page.getByTestId("register-lines-count");
  }

  /** One of the five filters, by the field it narrows on (`class`, `kind`, `level`, `basis`, `coverage`). */
  filter(name: string): Locator {
    return this.page.getByTestId(`register-filter-${name}`);
  }

  /* --- what produced no line, and what a door answered --- */

  get refusals(): Locator {
    return this.page.getByTestId("register-refusals");
  }

  get refusalRows(): Locator {
    return this.page.getByTestId("register-refusal");
  }

  get answer(): Locator {
    return this.page.getByTestId("register-answer");
  }

  /* --- the doors --- */

  get measure(): Locator {
    return this.page.getByTestId("register-measure");
  }

  get timeline(): Locator {
    return this.page.getByTestId("register-timeline");
  }

  /** The measure step of the timeline beneath the door — the run this screen started (R-UI-024). */
  get measureStep(): Locator {
    return this.timeline.getByTestId("job-timeline-step").filter({ has: this.page.locator('[data-kind="measure"]') }).or(this.timeline.locator('[data-testid="job-timeline-step"][data-kind="measure"]'));
  }

  get levelStack(): Locator {
    return this.page.getByTestId("register-level-stack");
  }

  /* --- the Trace's origin: the `source` cell's link and the row it returns to (inc-215) --- */

  /** Every EvidenceLink the lines table renders, in row order. */
  get evidenceLinks(): Locator {
    return this.lines.getByTestId("evidence-link");
  }

  /** The link one line's `source` cell carries. */
  evidenceLink(lineId: string): Locator {
    return this.lines.locator(`[data-testid="evidence-link"][data-line="${lineId}"]`);
  }

  /** The one link marked as the row the reader traced from (Decision I-182). */
  get originLink(): Locator {
    return this.lines.locator('[data-testid="evidence-link"][data-origin="true"]');
  }

  /** Open the register at an address that names an origin row (`originAddress`). */
  async openAtOrigin(tenantId: string, projectId: string, lineId: string): Promise<void> {
    await this.page.goto(`${S_TAKEOFF.register(tenantId, projectId)}?line=${encodeURIComponent(lineId)}`);
    await expect(this.root, "the register workspace renders at the address the Trace stamped").toBeVisible();
  }

  /** The lineIds the table offers a Trace from, in row order. */
  async tracedLineIds(): Promise<string[]> {
    const held: string[] = [];
    for (const anchor of await this.evidenceLinks.all()) held.push((await anchor.getAttribute("data-line")) ?? "");
    return held;
  }

  /**
   * The per-run texts a design picture may not freeze (Decision §7, B-19).
   *
   * Every region below carries text a STAGING RUN mints, not text the design fixes: the workspace and
   * the person signed in, the pinned revision's id, the job the door answered, the source key, and the
   * object key — which `src/core/identity/keys.ts` builds as "instance key = placement key + level
   * surrogate id" and which L-REG-02 forbids making stable ("a level is referenced by surrogate id;
   * its label, ordinal and height never enter a key"). AC-2 requires the screen to render that key
   * verbatim, so the picture must not assert its bytes: a baseline that froze them would be a red no
   * lawful actor could clear (B-20).
   *
   * Nothing structural belongs here. What each masked region says is asserted where it is a fact
   * rather than a picture: the key verbatim by AC-2 in jsdom, the refusal row's `data-code` and
   * `data-object` by AC-4, the timeline's job id by AC-8. This list may grow only by further per-run
   * surrogate text; a layout or structural region added to it would itself be a B-19 defect.
   */
  masks(): Locator[] {
    return [
      this.page.getByTestId("shell-breadcrumb"),
      this.page.getByTestId("shell-user"),
      // The staged workspace's own label — a name the run minted, beside the person who signed in.
      this.page.getByTestId("shell-tenant-switcher"),
      this.page.getByTestId("register-timeline"),
      this.page.getByTestId("register-source-key"),
      // The pinned revision the campaign stands on: a surrogate id, one per staged set revision.
      this.page.getByTestId("register-campaign"),
      // The object key in the inspector, and the same key repeated on each refusal row.
      this.page.getByTestId("register-object-key"),
      this.page.getByTestId("register-refusal-object"),
    ];
  }

  at(): Page {
    return this.page;
  }
}
