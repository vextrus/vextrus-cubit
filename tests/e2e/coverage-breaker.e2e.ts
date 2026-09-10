/**
 * S-Coverage, attacked (inc-216-coverage-grid, Breaker).
 *
 * Two tabs on one cell. A reader holds a kind out of this bill in one of them; the other still shows
 * the door, because its reading is the one it loaded. Pressing that door a second time is exactly the
 * ask AC-4 promises is refused by name (`ACT_CHANGES_NOTHING`), and R-UI-050 · R-UI-020 · the Design
 * Decision §2 all say where that refusal is rendered: "the dialog's own slot for a preview or commit
 * refused while it holds focus. Never a toast, never a local block." A refusal is an ANSWER — the
 * screen must go on standing and say it.
 *
 * Nothing here is transcribed: the cell is read off the grid the product paints, and the refusal is
 * found by the shipped refusal pattern's own id rather than by any word.
 *
 * The title names no journey, so the gate's `--journey J-022` / `--journey J-000` greps do not
 * collect this file; it is run by name.
 */
import { expect, test } from "@playwright/test";
import { NOT_ESTABLISHED, NOT_IN_THIS_BILL, SCoveragePage } from "./pages/s-coverage.page";
import { stageCoverage } from "./takeoff/coverage-stage";

test.use({ viewport: { width: 1440, height: 900 } });

/** Addresses this residue holds no cell for — a stale one, a malformed one, and a long non-ASCII one. */
const STALE_ADDRESSES: readonly string[] = [
  "rcc.concrete:column:00000000-0000-0000-0000-000000000000",
  "rcc.concrete:column:extra:part",
  `🙂${"x".repeat(1024)}:🙂:🙂`,
];

test.describe("S-Coverage breaker — a door refused in one tab is answered, not crashed", () => {
  test("breaker: holding a cell out of this bill twice from two tabs is refused in place", async ({ page }) => {
    const staged = await stageCoverage(page, { label: "breaker" });
    const { kind, class: klass, levelId } = staged.unmeasured;

    /* --- two tabs of one session, both standing on the same unmeasured cell --- */
    const first = new SCoveragePage(page);
    await first.open(staged.tenantId, staged.projectId);

    const otherTab = await page.context().newPage();
    const faults: string[] = [];
    otherTab.on("pageerror", (thrown) => faults.push(thrown.message));
    const second = new SCoveragePage(otherTab);
    await second.open(staged.tenantId, staged.projectId);

    const cellHere = first.cell(kind, klass, levelId);
    const cellThere = second.cell(kind, klass, levelId);
    await expect(cellHere, "the staged cell stands unmeasured in the first tab").toHaveAttribute("data-measurement", NOT_ESTABLISHED);
    await expect(cellThere, "and in the second, which loaded the same reading").toHaveAttribute("data-measurement", NOT_ESTABLISHED);

    await first.select(cellHere);
    await second.select(cellThere);
    await expect(first.holdOut, "the door stands in the first tab").toBeVisible();
    await expect(second.holdOut, "and in the second — neither tab knows about the other").toBeVisible();

    /* --- the first tab carries the act --- */
    await first.carry(first.holdOut);
    await expect(cellHere, "the cell the act named now stands outside this bill").toHaveAttribute("data-bill", NOT_IN_THIS_BILL, { timeout: 30_000 });

    /* --- the second tab asks for the very same boundary, over a reading that has moved --- */
    await second.holdOut.click();
    await second.dialog.waitFor({ state: "visible" });
    await second.dialogConfirm.click();

    // AC-4: "a second identical declaration refuses through actChangesNothing". A refusal is an
    // answer the product gives a person, not a fault it records about itself (ARCH-03, B-21), so it
    // is rendered through the one shipped RefusalState in the dialog that is holding focus.
    await expect(
      otherTab.getByTestId("refusal-state").first(),
      "the refusal is rendered through the one shipped RefusalState where the reader is looking (R-UI-020, Decision §2)",
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      second.root,
      `and the coverage screen it was asked from is still standing${faults.length === 0 ? "" : ` — the browser raised: ${faults.join(" · ")}`}`,
    ).toBeVisible();
    expect(faults, "no unhandled failure reaches the browser: a registered refusal is not a fault (ARCH-03, B-21)").toEqual([]);

    // Whatever the answer, nothing was written twice: the cell reads one boundary, not two.
    await expect(cellThere, "the cell still reads the one boundary a person drew").toHaveAttribute("data-bill", NOT_IN_THIS_BILL, { timeout: 30_000 });

    /* --- and an address this residue holds no cell for still selects nothing and says nothing (I-193) --- */
    for (const address of STALE_ADDRESSES) {
      await otherTab.goto(`/t/${staged.tenantId}/p/${staged.projectId}/takeoff/coverage?cell=${encodeURIComponent(address)}`);
      await expect(second.root, `the screen stands on a stale address: ${address.slice(0, 32)}`).toBeVisible();
      await expect(second.inspector, "which selects no cell at all").toHaveAttribute("data-cell", "");
    }
  });
});
