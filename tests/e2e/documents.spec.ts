/**
 * J-030 — the project's issued documents: a person reaches the list from their project's home, finds
 * every issue the project has published newest first with its kind, its version, the person who
 * issued it, its digest, the acts it stands on and the issue that replaced it — each identifier a
 * chip and each row a door onto the PDF itself (R-SPINE-040, R-UI-050, R-UI-082, R-UI-083, R-UI-031,
 * docs/design/s-documents.md).
 *
 * The journey walks the product as a person does: from S-Project's quick actions onto the list, down
 * its rows, and through one row's link to the document it names. The two design checkpoints are taken
 * here and nowhere else; the picture itself is the gate's to re-take (v16.2 §1).
 *
 * The gate runs `pnpm e2e --journey J-030`, and Playwright exits 1 on an unmatched grep — so the
 * J-030 tag in the titles below is what makes this spec runnable at all.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { SDocumentsPage, S_DOCUMENTS } from "./pages/s-documents.page";
import { PROJECT_QUICK_ACTIONS, SProjectPage, S_PROJECT } from "./pages/s-project.page";
import { stageBareProject, stageDocuments } from "./documents/documents-stage";
import { checkpoint } from "./support/checkpoint";
import { emulateTheme, restoreLaneTheme } from "./support/lane-theme";
import { everyAttribute, everyRow, heldAttribute } from "./support/retrying-read";
import { signInAsSeededTenant } from "./support/seeded-session";
import { settled } from "./support/settled";

/** The key S-Project files this screen's quick action under (increment interfaces). */
const DOCUMENTS_ACTION = "documents";

/** The screen this journey walks, and its baseline directory — one spelling for both (B-17). */
const SCREEN = "s-documents";

/**
 * One checkpoint of this walk, as the increment's journey contract names it: `<screen>/<leg>`.
 *
 * Composed rather than written out, so the screen is spelled once and the name of a leg is never
 * mistaken for an address: a checkpoint id is an evidence label, not a route this increment renders.
 */
const checkpointAt = (leg: string): string => [SCREEN, leg].join("/");

/** Copy this walk reads on screen, verbatim from docs/design/s-documents.md §3. */
const DOCUMENTS_TITLE = "Documents";
const PROOF_LABEL = "Proof";
const CURRENT = "Current";

/** R-UI-083's compact row, and R-UI-081's fold — both the clause's own figures, not this screen's. */
const ROW_HEIGHT_PX = 28;
const ABOVE_THE_FOLD_PX = 240;

/** The two widths every data screen is judged at (R-UI-081). */
const WIDE = { width: 1440, height: 900 } as const;
const NARROW = { width: 1280, height: 800 } as const;

/** The width the frame paints all four of its regions at (R-UI-030, lg and up). */
test.use({ viewport: { ...WIDE } });

/** The top of one element, in page coordinates — the geometry R-UI-081 and R-UI-083 are read from. */
async function boxOf(locator: Locator, what: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box, `${what} is laid out, so it has a box to measure`).not.toBeNull();
  return box as { x: number; y: number; width: number; height: number };
}

/**
 * The grid law as a measurement: every row of the list is the compact 28 px row, and the first of
 * them stands within 240 px of the top of main. Asked at whatever width the page is set to, because
 * both clauses are asked at 1440×900 AND at 1280×800.
 */
async function measureGridLaw(documents: SDocumentsPage, page: Page, at: string): Promise<void> {
  await settled(page);
  const main = await boxOf(documents.main, `${at}: the shell's main region`);
  // A row list is read through the retrying reader, never `.all()`: a count taken at one instant on a
  // virtualised grid is a reading of the timing, not of the screen (`cubit/no-unretried-read`).
  const rows = await everyRow(documents.bodyRows(), `${at}: the rows the grid drew`);
  expect(rows.length, `${at}: the grid drew rows to measure`).toBeGreaterThan(0);

  for (let index = 0; index < rows.length; index += 1) {
    const box = await boxOf(rows[index] as Locator, `${at}: row ${index}`);
    expect(Math.round(box.height), `${at}: row ${index} is the compact 28 px row the grid law fixes (R-UI-083)`).toBe(ROW_HEIGHT_PX);
  }

  const first = await boxOf(rows[0] as Locator, `${at}: the first row`);
  expect(
    Math.round(first.y - main.y),
    `${at}: the primary grid starts within ${ABOVE_THE_FOLD_PX} px of the top of main (R-UI-081)`,
  ).toBeLessThanOrEqual(ABOVE_THE_FOLD_PX);
}

test.describe("J-030 — the project's issued documents", () => {
  test("J-030: the list is reached from S-Project, newest first, every identifier a chip and every row a door", async ({ page, baseURL }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const staged = await stageDocuments(page, { label: "j030-list" });
    const documents = new SDocumentsPage(page);
    const project = new SProjectPage(page);
    const origin = baseURL ?? "";

    /* --- reached by visible navigation, never by a typed URL (R-UI-031, AC-2) --- */
    await project.open(staged.tenantId, staged.projectId);
    await settled(page);
    const action = project.quickAction(DOCUMENTS_ACTION);
    await expect(action, "S-Project offers the documents list as a quick action").toBeVisible();
    await expect(action, "which is a link to this screen's one address").toHaveAttribute("href", S_DOCUMENTS.documents(staged.tenantId, staged.projectId));
    await action.click();
    await expect(page, "and pressing it lands the reader on the documents list").toHaveURL(`${origin}${S_DOCUMENTS.documents(staged.tenantId, staged.projectId)}`);
    await settled(page);
    await expect(documents.screen, "the screen stands").toBeVisible();
    await expect(documents.crumbPage, "and the crumb names the page a reader is on (R-UI-084)").toHaveText(DOCUMENTS_TITLE);

    /* --- the rows: the store's own roster, in the store's own order (AC-1) --- */
    expect(await documents.state(), "a project holding issues is the ready state (R-UI-050)").toBe("ready");
    expect(
      await documents.rowsRendered(),
      `the grid states how many rows it drew — the project's whole roster: ${JSON.stringify(staged.documents.map((one) => one.version))}`,
    ).toBe(String(staged.documents.length));
    expect(
      await everyAttribute(documents.rows, "data-document", "the rows the list drew"),
      "one row per issued document, in the order the store lists them — newest first, so version 2 stands above version 1",
    ).toEqual(staged.documents.map((one) => one.id));

    for (const issue of staged.documents) {
      const row = documents.row(issue.id);
      await expect(row, `the list holds a row for issue ${issue.version}`).toHaveCount(1);
      await expect(row, "carrying the kind the store recorded").toHaveAttribute("data-kind", issue.kind);
      await expect(row, "and the issue it is").toHaveAttribute("data-version", String(issue.version));
      await expect(row, `and whether a later issue replaced it (${String(issue.supersededBy)})`).toHaveAttribute("data-superseded", String(issue.supersededBy !== null));
      // The kind renders over its own stored value, and what stands there is the WORD for it: the
      // rule the bare mount binds cell by cell (tests/ui/documents), read here on the served screen.
      const kindLabel = row.locator(`[data-value="${issue.kind}"]`);
      await expect(kindLabel, `the kind renders as a label over the value the row carries: ${issue.kind} (R-UI-082)`).toHaveCount(1);
      await expect(kindLabel, `reading the word the copy table gives that kind: ${PROOF_LABEL}`).toContainText(PROOF_LABEL);

      /* --- every opaque value through the one chip: whole in the data, short on screen --- */
      await expect(documents.digest(row), "the document's digest is a chip").toHaveCount(1);
      await expect(documents.digest(row), "carrying the whole 64-hex address in the data").toHaveAttribute("data-value", issue.sha256);
      await expect(documents.issuedBy(row), "the person who issued it is a chip").toHaveCount(1);
      await expect(documents.issuedBy(row), "carrying their whole id").toHaveAttribute("data-value", staged.issuedBy);
      expect(
        await everyAttribute(documents.acts(row), "data-value", `the acts issue ${issue.version} cites`),
        `one chip per act this issue stands on: ${JSON.stringify(issue.actIds)} (R-SPINE-040)`,
      ).toEqual([...issue.actIds]);

      if (issue.supersededBy === null) {
        await expect(documents.supersededBy(row), "nothing replaced this issue, so there is no document to chip").toHaveCount(0);
        await expect(row, `and the row says so in a word: ${CURRENT} (R-UI-060)`).toContainText(CURRENT);
      } else {
        await expect(documents.supersededBy(row), "the issue that replaced this one is named by its own id").toHaveAttribute("data-value", issue.supersededBy);
      }

      /* --- the row's door: a signed link the reader's own session is answered on (AC-3) --- */
      const link = documents.openLink(row);
      await expect(link, "and the row opens the document itself").toHaveCount(1);
      const href = await heldAttribute(link, "href");
      expect(href, `the link is the minted address the contract fixes, for this row's document: ${String(href)}`).toMatch(
        new RegExp(`^/api/documents/${issue.id}\\?tenant=${staged.tenantId}&expires=\\d+&signature=[0-9a-f]+$`, "u"),
      );
      const answer = await page.request.get(`${origin}${href ?? ""}`);
      expect(answer.status(), `the session reading the list may open what it lists: ${String(href)}`).toBe(200);
      expect(answer.headers()["content-type"], "and what comes back is the document itself").toBe("application/pdf");
    }

    /* --- the grid law, at both widths R-UI-081 and R-UI-083 are asked at (AC-4) --- */
    await measureGridLaw(documents, page, "1440×900");

    /* --- s-documents/list: axe over the page, then the committed baselines, dark then light --- */
    await checkpoint(page, testInfo, checkpointAt("list"));
    await expect(page).toHaveScreenshot([SCREEN, "list.png"], { mask: documents.masks(), animations: "disabled" });

    await emulateTheme(page, "light");
    await settled(page);
    await checkpoint(page, testInfo, checkpointAt("list-light"));
    await expect(page).toHaveScreenshot([SCREEN, "list-light.png"], { mask: documents.masks(), animations: "disabled" });
    await restoreLaneTheme(page, testInfo);

    await page.setViewportSize({ ...NARROW });
    await measureGridLaw(documents, page, "1280×800");
    await page.setViewportSize({ ...WIDE });
  });

  test("J-030: a project that has issued nothing teaches the takeoff register rather than standing empty-handed", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    // A project nobody has published from — the empty cell of this screen's state matrix (AC-4).
    const bare = await stageBareProject(page, { label: "j030-empty" });
    const documents = new SDocumentsPage(page);

    await documents.open(bare.tenantId, bare.projectId);
    await settled(page);
    expect(await documents.state(), "a project holding no issued document says it is empty (R-UI-050)").toBe("empty");
    await expect(documents.empty, "and teaches what would put a document here").toBeVisible();
    await expect(documents.grid, "with no grid standing over nothing").toHaveCount(0);
    await expect(
      documents.empty.getByRole("link").first(),
      "the one action it offers is the takeoff register, where a document is published from",
    ).toHaveAttribute("href", `/t/${bare.tenantId}/p/${bare.projectId}/takeoff`);

    await checkpoint(page, testInfo, checkpointAt("empty"));
  });

  test("J-030: S-Project's fourth quick action stands beside the three that were there", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const bare = await stageBareProject(page, { label: "j030-action" });
    const project = new SProjectPage(page);

    await project.open(bare.tenantId, bare.projectId);
    await settled(page);
    const actions = await everyAttribute(project.quickActions, "data-action", "S-Project's quick actions");
    expect(actions, `the documents action is one of the quick actions this screen offers: ${JSON.stringify(actions)}`).toContain(DOCUMENTS_ACTION);
    // APPENDED, not last: every action the screen's own contract knew before this one still stands
    // ahead of it, and a lawful fifth action landing later does not red this walk (B-19).
    const at = actions.indexOf(DOCUMENTS_ACTION);
    for (const stood of PROJECT_QUICK_ACTIONS.filter((one) => one !== DOCUMENTS_ACTION)) {
      expect(actions.indexOf(stood), `the \`${stood}\` action still stands on the screen`).toBeGreaterThanOrEqual(0);
      expect(at, `and the documents action was appended after \`${stood}\`, never inserted in front of it (AC-2)`).toBeGreaterThan(actions.indexOf(stood));
    }
    expect(S_PROJECT.home(bare.tenantId, bare.projectId), "and this walk stood on S-Project's own address").toBe(`/t/${bare.tenantId}/p/${bare.projectId}`);
  });
});
