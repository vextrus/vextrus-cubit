// J-012 — "sets and revisions: create set, pin set revision, upload a changed file → new revision,
// manifest digest shown", walked end to end against the served product (AC-6, R-TO-005, L-REG-06).
//
// This journey stages its own identity (sign-up → verify mail → sign-in → a project on S-Home, the
// J-010 precedent) so its drawings never land in another spec's workspace, and it spawns NO worker:
// nothing here waits on a job. A set is made of the rows the upload seam records, and the seam
// records them the moment the bytes are stored — the queued ingest jobs for these drawings are
// harmless and another journey's worker may drain them later.
//
// tests/e2e/pages/ and tests/e2e/support/ gain no file (the merged hotfix suite reds any branch that
// adds one), so the two new screens are addressed through the local `S_SETS` locators below.
//
// Nothing is transcribed: every digest, sha256 and ordinal asserted is read off the screen itself in
// this run, and the changed file is derived from the committed corpus rather than committed beside it.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SDrawingsPage } from "../pages/s-drawings.page";
import { SHomePage } from "../pages/s-home.page";
import { ShellPage, SHELL } from "../pages/shell.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j012sets-${RUN}@cubit.test`;
const PASSWORD = `sets-and-revisions-journey-${RUN}`;
const WORKSPACE = "Sattva Sets";
const PROJECT = "Sattva Court Sets";
const SET_NAME = "Tender set";

/** The corpus this journey drops, and the name both uploads present it under. */
const FIXTURE = join(process.cwd(), "fixtures", "rcc6", "rcc6.dxf");
const PRESENTED = "rcc6.dxf";

/** How long a stored upload may take on a cold server. */
const UPLOAD_BUDGET_MS = 90_000;

/** The two screens' own test ids (docs/design/s-drawings-sets.md §7), declared here: the e2e page
 *  objects are frozen ground and gain no file. */
const S_SETS = {
  index: "sets-index",
  row: "set-row",
  rowName: "set-row-name",
  rowDigest: "set-row-digest",
  open: "set-open",
  createForm: "set-create-form",
  nameInput: "set-name-input",
  create: "set-create",
  indexEmpty: "sets-empty",
  browser: "set-browser",
  heading: "set-heading",
  drawings: "set-drawings",
  drawing: "set-drawing",
  drawingName: "set-drawing-name",
  revisionCount: "set-drawing-revision-count",
  drawingRevision: "set-drawing-revision",
  toggle: "set-member-toggle",
  pin: "set-pin",
  revisions: "set-revisions",
  revision: "set-revision",
  revisionDigest: "set-revision-digest",
  revisionMember: "set-revision-member",
  empty: "set-empty",
  dialog: "consequence-dialog",
  dialogConfirm: "consequence-confirm",
} as const;

/** A 64-hex content address or manifest digest, as both screens render one. */
const DIGEST = /^[0-9a-f]{64}$/;

const at = (page: Page, testId: string): Locator => page.locator(`[data-testid="${testId}"]`);
const setsRoute = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings/sets`;

/**
 * The corpus with two lines added before its trailing tags: the same presented name, different
 * bytes, and the first 1024 bytes untouched so the seam reads the same declared format off the head.
 */
function changedCopy(): string {
  const source = readFileSync(FIXTURE, "utf8");
  const tail = source.lastIndexOf("  0\nEOF");
  expect(tail, "the committed corpus ends with the DXF tags this journey inserts before").toBeGreaterThan(0);
  const changed = `${source.slice(0, tail)}999\nJ-012 revision B\n${source.slice(tail)}`;
  const path = join(mkdtempSync(join(tmpdir(), "j-012-")), PRESENTED);
  writeFileSync(path, changed, "utf8");
  return path;
}

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-012 — a set, pinned, and a changed file that revises it", () => {
  test("J-012: a lead names a set, pins it, uploads a changed drawing and re-pins it to a new digest", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const drawings = new SDrawingsPage(page);

    /* --- this journey's own identity --- */
    await auth.open(S_AUTH.signUp);
    await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE);
    await auth.expectNotice();
    const verifyMail = await newestMail(EMAIL, "verify-email");
    await auth.openWithToken(S_AUTH.verify, verifyMail.token);
    await auth.expectNotice();
    await auth.open(S_AUTH.signIn);
    await auth.signInWith(EMAIL, PASSWORD);
    await expect(page).toHaveURL(`${origin}${SHELL.home}`);

    await shell.workspaceDoor.click();
    await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));
    const tenantId = (page.url().split("/t/")[1] ?? "").trim();
    expect(tenantId, "the workspace names itself in its own address").not.toBe("");

    await home.createWith({ name: PROJECT, code: "SCT-012", client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "12" });
    const card = home.cardNamed(PROJECT);
    await expect(card, "the created project stands on S-Home").toBeVisible();
    const projectId = (await card.getAttribute("data-project")) ?? "";
    expect(projectId, "the card names the project it is for").not.toBe("");

    /* --- the drawing this set will name, dropped through the screen's own Dropzone --- */
    await drawings.open(tenantId, projectId);
    await drawings.dropFile(FIXTURE);
    await expect(drawings.dropzoneItems.first(), "the dropped drawing is stored by the upload seam").toHaveAttribute("data-state", "stored", { timeout: UPLOAD_BUDGET_MS });

    /* --- j-012-set-created: a project with no set says so, and naming one opens it --- */
    await page.goto(setsRoute(tenantId, projectId));
    await expect(at(page, S_SETS.createForm), "the sets index stands, with the door that names a set").toBeVisible();
    await expect(at(page, S_SETS.indexEmpty), "a project holding no set says why the list is empty (R-UI-020)").toBeVisible();

    await at(page, S_SETS.nameInput).fill(SET_NAME);
    await at(page, S_SETS.create).click();
    await expect(page, "the set stands open at its own address — the new set IS the answer").toHaveURL(new RegExp(`^${origin}/t/${tenantId}/p/${projectId}/drawings/sets/[0-9a-f-]{36}$`));
    const browser = at(page, S_SETS.browser);
    await expect(browser, "the set browser stands").toBeVisible();
    await expect(at(page, S_SETS.heading), "titled with the name that was typed").toHaveText(SET_NAME);

    const rows = at(page, S_SETS.drawing);
    await expect(rows, "every drawing the project holds is listed").toHaveCount(1);
    const row = rows.first();
    await expect(row, "and none of them is in the set yet").toHaveAttribute("data-member", "false");
    await expect(at(page, S_SETS.empty), "a set that has never been pinned says which emptiness that is (I-97)").toHaveAttribute("data-cause", "no-revisions");
    await checkpoint(page, testInfo, "j-012-set-created");

    /* --- j-012-set-pinned: the member, then the act, then the manifest and its digest --- */
    await row.locator(`[data-testid="${S_SETS.toggle}"]`).click();
    await expect(row, "a toggle writes the draft at once (I-96)").toHaveAttribute("data-member", "true");
    await expect(row.locator(`[data-testid="${S_SETS.drawingRevision}"]`), "one upload of a name is one revision of that drawing").toHaveCount(1);
    const firstSha = (await row.getAttribute("data-current-sha256")) ?? "";
    expect(firstSha, "the row publishes the content the drawing stands at").toMatch(DIGEST);

    await at(page, S_SETS.pin).click();
    const dialog = at(page, S_SETS.dialog);
    await dialog.waitFor({ state: "visible" });
    await dialog.locator(`[data-testid="${S_SETS.dialogConfirm}"]`).click();
    await expect(dialog, "the dialog closes on the act it carried (R-UI-021)").toHaveCount(0, { timeout: UPLOAD_BUDGET_MS });

    const pinnedRevisions = at(page, S_SETS.revision);
    await expect(pinnedRevisions, "the pin recorded one set revision").toHaveCount(1);
    const firstPin = pinnedRevisions.first();
    await expect(firstPin, "which is the one the set stands at").toHaveAttribute("data-current", "true");
    const firstDigest = (await firstPin.getAttribute("data-digest")) ?? "";
    expect(firstDigest, "a manifest digest is a lowercase 64-hex sha256").toMatch(DIGEST);
    await expect(firstPin.locator(`[data-testid="${S_SETS.revisionDigest}"]`), "and it is shown whole, character for character (I-99)").toHaveText(firstDigest);
    const firstCitation = firstPin.locator(`[data-testid="${S_SETS.revisionMember}"]`);
    await expect(firstCitation, "citing the one member it held").toHaveCount(1);
    await expect(firstCitation.first(), "at the content that member stood at (L-REG-06: the manifest is the citation list)").toHaveAttribute("data-sha256", firstSha);

    // A machine identifier renders in the mono face the tokens name (I-25, I-26) — read out of the
    // page's own token value rather than spelled here.
    const mono = await page.evaluate(() => {
      const digest = document.querySelector('[data-testid="set-revision-digest"]');
      const wanted = getComputedStyle(document.documentElement).getPropertyValue("--font-mono");
      const flat = (value: string): string => value.replace(/["']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      return { shown: flat(digest === null ? "" : getComputedStyle(digest).fontFamily), wanted: flat(wanted) };
    });
    expect(mono.shown, "the digest renders in the mono face the design tokens name").toBe(mono.wanted);
    await checkpoint(page, testInfo, "j-012-set-pinned");

    /* --- j-012-revision-added: the same name, changed bytes, a second revision --- */
    await drawings.open(tenantId, projectId);
    await drawings.dropFile(changedCopy());
    await expect(drawings.dropzoneItems.first(), "the changed drawing is stored under the same presented name").toHaveAttribute("data-state", "stored", { timeout: UPLOAD_BUDGET_MS });

    await page.goto(`${origin}${setsRoute(tenantId, projectId)}`);
    await at(page, S_SETS.row).first().locator(`[data-testid="${S_SETS.open}"]`).click();
    await expect(at(page, S_SETS.browser), "the set stands open again").toBeVisible();

    const revvedRow = at(page, S_SETS.drawing).first();
    const revisions = revvedRow.locator(`[data-testid="${S_SETS.drawingRevision}"]`);
    await expect(revisions, "an upload of a changed file for an existing drawing creates a drawing revision (R-TO-005)").toHaveCount(2);
    await expect(revvedRow.locator(`[data-testid="${S_SETS.revisionCount}"]`), "and the row counts them").toContainText("2");
    const current = revvedRow.locator(`[data-testid="${S_SETS.drawingRevision}"][data-current="true"]`);
    await expect(current, "exactly one revision is the one the drawing stands at").toHaveCount(1);
    await expect(current, "and it is the second one").toHaveAttribute("data-ordinal", "2");
    const secondSha = (await current.getAttribute("data-sha256")) ?? "";
    expect(secondSha, "whose content address is a 64-hex sha256").toMatch(DIGEST);
    expect(secondSha, "different bytes have a different address — that is what makes it a revision").not.toBe(firstSha);

    const standing = at(page, S_SETS.revision);
    await expect(standing, "the pin that was taken is still the only one").toHaveCount(1);
    await expect(standing.first(), "and its digest has not moved: what is pinned never changes (L-REG-06)").toHaveAttribute("data-digest", firstDigest);
    await expect(standing.first().locator(`[data-testid="${S_SETS.revisionMember}"]`).first(), "it still cites the content it pinned, not the content the drawing has moved to (I-98)").toHaveAttribute("data-sha256", firstSha);
    await checkpoint(page, testInfo, "j-012-revision-added");

    /* --- j-012-repinned: advance, never drift --- */
    await at(page, S_SETS.pin).click();
    const second = at(page, S_SETS.dialog);
    await second.waitFor({ state: "visible" });
    await second.locator(`[data-testid="${S_SETS.dialogConfirm}"]`).click();
    await expect(second, "the dialog closes on the act it carried").toHaveCount(0, { timeout: UPLOAD_BUDGET_MS });

    const both = at(page, S_SETS.revision);
    await expect(both, "re-revving a member yields a NEW set revision beside the old one").toHaveCount(2);
    const newest = both.nth(0);
    const older = both.nth(1);
    await expect(newest, "the newest pinned revision stands first and is the current one").toHaveAttribute("data-current", "true");
    await expect(older, "the one before it is superseded, never rewritten").toHaveAttribute("data-current", "false");
    await expect(older, "and carries the digest it always carried").toHaveAttribute("data-digest", firstDigest);
    const secondDigest = (await newest.getAttribute("data-digest")) ?? "";
    expect(secondDigest, "the new manifest has an address of its own").toMatch(DIGEST);
    expect(secondDigest, "and it is not the old one: the content decided the address (L-REG-06)").not.toBe(firstDigest);
    await expect(newest.locator(`[data-testid="${S_SETS.revisionDigest}"]`), "shown whole").toHaveText(secondDigest);
    await expect(newest.locator(`[data-testid="${S_SETS.revisionMember}"]`).first(), "citing the revision the member stands at now").toHaveAttribute("data-sha256", secondSha);

    await page.goto(`${origin}${setsRoute(tenantId, projectId)}`);
    const indexRow = at(page, S_SETS.row).first();
    await expect(indexRow.locator(`[data-testid="${S_SETS.rowName}"]`), "the set stands on the index under its name").toHaveText(SET_NAME);
    await expect(indexRow.locator(`[data-testid="${S_SETS.rowDigest}"]`), "and the index shows the digest it now stands pinned at").toHaveText(secondDigest);
    await checkpoint(page, testInfo, "j-012-repinned");
  });
});
