/**
 * S-Takeoff, as the journey walks it (docs/design/s-takeoff.md §7's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape. The Builder may edit this file (test contract).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { screenInFrame } from "./shell.page";
import { everyRow, steadyText } from "../support/retrying-read";

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
    await expect(this.root, "and the frame holds exactly one of it — a screen stands in `TESTIDS.shell.main` once").toHaveCount(1);
  }

  /** The workspace itself, where the frame puts it: one screen inside `TESTIDS.shell.main` (R-UI-030). */
  get root(): Locator {
    return screenInFrame(this.page, TESTIDS.register.workspace);
  }

  /* --- the lane's own navigation (Decision §1) --- */

  get nav(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.nav);
  }

  get navRegister(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.navRegister);
  }

  /* --- the three regions of the body --- */

  get tree(): Locator {
    return this.page.getByTestId(TESTIDS.register.tree);
  }

  /** One item of the tree, by the label a reader reads on it. */
  treeItem(label: string): Locator {
    return this.tree.getByRole("treeitem", { name: label, exact: false });
  }

  /**
   * The frame's ONE right column, as this screen fills it (Direction §3.1, R-UI-080): it is mounted
   * into the shell's inspector slot, so it is found on the PAGE rather than under the workspace — and
   * it is absent entirely until a row or an object is selected.
   */
  get inspector(): Locator {
    return this.page.getByTestId(TESTIDS.register.inspector);
  }

  get objectCorroboration(): Locator {
    return this.page.getByTestId(TESTIDS.register.objectCorroboration);
  }

  /**
   * The Technical disclosure's own door (§7 C6, I-234). The machine's names — the object key and the
   * key it was read at — stand one press away rather than on the face of the screen, so a journey
   * that reads one presses it exactly as a person does.
   */
  get technical(): Locator {
    return this.page.getByTestId(TESTIDS.register.technical);
  }

  get lines(): Locator {
    return this.page.getByTestId(TESTIDS.register.lines);
  }

  /**
   * The count line, read INSIDE the one screen the frame holds. Page-wide, this id resolved twice:
   * React streams the register route into a hidden parcel beside the hydrated screen for about a
   * tenth of a second, so for that tenth of a second the page carries two of every id the screen
   * owns and a page-wide read is `strict mode violation`. `screenInFrame()` is the one home for a
   * screen's ids (R-UI-030): a read of the register is a read of the register the frame is showing.
   */
  get linesCount(): Locator {
    return this.root.getByTestId(TESTIDS.register.linesCount);
  }

  /**
   * One of the five filters, by the field it narrows on (`class`, `kind`, `level`, `basis`,
   * `coverage`). Since v22 each is a `Label · Value ▾` filter chip in the 36 px bar rather than a
   * labelled row with a native popup (Direction §3.2), under the same id.
   */
  filter(name: string): Locator {
    return this.page.getByTestId(`register-filter-${name}`);
  }

  /* --- what produced no line, and what a door answered --- */

  get refusals(): Locator {
    return this.page.getByTestId(TESTIDS.register.refusals);
  }

  get refusalRows(): Locator {
    return this.page.getByTestId(TESTIDS.register.refusal);
  }

  get answer(): Locator {
    return this.page.getByTestId(TESTIDS.register.answer);
  }

  /* --- the doors --- */

  /** The one primary, which stands in the lane's tabs row — the frame's tool track (§3.2). */
  get measure(): Locator {
    return this.page.getByTestId(TESTIDS.register.measure);
  }

  get timeline(): Locator {
    return this.page.getByTestId(TESTIDS.register.timeline);
  }

  /** The measure step of the timeline beneath the door — the run this screen started (R-UI-024). */
  get measureStep(): Locator {
    return this.timeline.getByTestId(TESTIDS.job.timelineStep).filter({ has: this.page.locator('[data-kind="measure"]') }).or(this.timeline.locator(`${testIdSelector(TESTIDS.job.timelineStep)}[data-kind="measure"]`));
  }

  get levelStack(): Locator {
    return this.page.getByTestId(TESTIDS.register.levelStack);
  }

  /* --- the Trace's origin: the `source` cell's link and the row it returns to (inc-215) --- */

  /** Every EvidenceLink the lines table renders, in row order. */
  get evidenceLinks(): Locator {
    return this.lines.getByTestId(TESTIDS.evidence.link);
  }

  /** The link one line's `source` cell carries. */
  evidenceLink(lineId: string): Locator {
    return this.lines.locator(`${testIdSelector(TESTIDS.evidence.link)}[data-line="${lineId}"]`);
  }

  /** The one link marked as the row the reader traced from (Decision I-182). */
  get originLink(): Locator {
    return this.lines.locator(`${testIdSelector(TESTIDS.evidence.link)}[data-origin="true"]`);
  }

  /** Open the register at an address that names an origin row (`originAddress`). */
  async openAtOrigin(tenantId: string, projectId: string, lineId: string): Promise<void> {
    await this.page.goto(`${S_TAKEOFF.register(tenantId, projectId)}?line=${encodeURIComponent(lineId)}`);
    await expect(this.root, "the register workspace renders at the address the Trace stamped").toBeVisible();
  }

  /** The lineIds the table offers a Trace from, in row order. */
  async tracedLineIds(): Promise<string[]> {
    // The lines body is virtualised: the row elements exist only after hydration has measured the
    // viewport, so the first paint carries this table with ZERO rows in it. `.all()` does not
    // retry — it reads whatever is mounted at the instant it is called — and on 2026-09-11 it read
    // that empty first paint and turned J-021 red on main (the DOM was right a moment later; the
    // page snapshot taken at the failure already showed all three Trace links). Every other read of
    // these anchors in the journeys retries (`toBeVisible`, `toHaveCount`); this one now does too.
    // The count the screen states is server-rendered and settles first, and R-UI-022 says every line
    // the table SHOWS offers a Trace — so that count is exactly how many anchors to wait for.
    //
    // P4b §3: "settles first" was an assumption, and `steadyText` was not checking it — it answered
    // with the first non-empty text, which on a register that has not painted is the count line of
    // the state before. A `stated` of 0 then skipped the `toHaveCount` below altogether and this
    // page object answered with an empty roster of Trace anchors, silently. The read now waits for
    // the region to publish `data-rows-rendered` and for three readings to agree.
    const stated = Number((/(\d[\d,.\s]*)/.exec(await steadyText(this.linesCount, "the register's count line"))?.[1] ?? "0").replace(/\D/g, ""));
    if (stated > 0) await expect(this.evidenceLinks, "the lines table offers a Trace from every line it shows (R-UI-022), once its virtualised body has painted them").toHaveCount(stated);
    const held: string[] = [];
    for (const anchor of await everyRow(this.evidenceLinks, "the lines table's Trace anchors")) held.push((await anchor.getAttribute("data-line")) ?? "");
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
      this.page.getByTestId(TESTIDS.shell.breadcrumb),
      this.page.getByTestId(TESTIDS.shell.user),
      // The staged workspace's own label — a name the run minted, beside the person who signed in.
      this.page.getByTestId(TESTIDS.shell.tenantSwitcher),
      // The job strip, which stands only while a run does (R-UI-080) — and carries the run's own id
      // when it does. A locator that resolves to nothing masks nothing, which is the right answer
      // for a region that is absent at rest.
      this.page.getByTestId(TESTIDS.register.timeline),
      // The pinned revision the campaign stands on: a surrogate id, one per staged set revision,
      // now the short form an `IdChip` shows (R-UI-082) — still per-run ink, still masked.
      this.page.getByTestId(TESTIDS.register.campaign),
      // The object key repeated on each refusal row, which is the one place a surrogate is still
      // painted. The inspector's own object key and source key are NOT here any more: since v22 they
      // stand inside the Technical disclosure (§6), which is closed at rest, so they are not text the
      // picture can freeze — and the inspector itself is absent until something is selected.
      this.page.getByTestId(TESTIDS.register.refusalObject),
    ];
  }

  at(): Page {
    return this.page;
  }
}
