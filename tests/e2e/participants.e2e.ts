/**
 * Public acceptance for AC-6 — the participants screen, walked in a real browser against the built
 * product (V-E2E), on this spec's own per-run identity.
 *
 * It carries the `J-003` tag because the gate runs the journeys one grep per journey
 * (`pnpm e2e --journey J-003`), and a spec whose title chain carries no tag is executed by nothing.
 *
 * Everything is addressed through the closed test contract — the route and the fourteen test ids
 * the increment declares — plus the copy the screen's Design Decision fixes verbatim
 * (`spine_participants_assign_submit`) and the refusal copy read back out of the shipped registry
 * rather than transcribed. No class, no selector and no source text is read.
 *
 * B-19: nothing here is a snapshot. The history's length is compared against itself across the act
 * that appends to it (before + 1), never against a number; the row attributes are graded on the
 * closed pair AC-1 declares and on non-emptiness, never against a frozen role roster; and the
 * project the walk drives is created by the walk.
 *
 * DEEP-ROUTE CHROME (arbitration on this increment, TEST_AMENDED). The crumb and the rail on this
 * route are the SHELL's contract, not this screen's: docs/design/s-settings-participants.md § 1
 * fixes them as "the shell's, unchanged" under ruleset I-30 — `areaOf` answers `projects`, the
 * Projects rail row states it is current, and the crumb links back. A richer crumb naming the
 * project or the screen is a shell-contract change owned by the `src/ui/shell/**` node with its own
 * B-20 re-baseline, and B-17 forbids this screen shadowing the crumb locally. So this spec grades
 * conformance to the recorded design — the two-entry shape, unmodified by the depth of the route —
 * and nothing here asks the crumb to name the project or the screen.
 *
 * SCOPE OF THE VISUAL SUB-CLAUSE (AC-6, B-20). AC-6 also asks that the open dialog match the
 * committed baseline `tests/e2e/baselines/design/consequence-dialog-open.png`. The pixel comparison
 * belongs where the Design Decision § 7 puts it — the increment's own
 * `tests/e2e/journeys/j-003-projects.spec.ts`, at the crop (`dialog-content`), masks and tolerance
 * that Decision fixes. This spec does not restate that comparison: two specs comparing two
 * different crops, taken on two different per-run identities, against one committed file is a
 * flake, not a proof. What it does assert is the half a second spec CAN own without owning the
 * pixels — that at the open-dialog moment the dialog stands in the state the Decision describes,
 * and that a real baseline for it was committed by this increment (a file that exists, is a PNG,
 * and holds a capture rather than nothing). A baseline of that name can only come into being from a
 * `toHaveScreenshot` of that name having run.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { REFUSALS } from "../../src/core/errors";
import { SAuthPage, S_AUTH } from "./pages/s-auth.page";
import { ShellPage, SHELL, SHELL_AREAS } from "./pages/shell.page";
import { SHomePage } from "./pages/s-home.page";
import { checkpoint } from "./support/checkpoint";
import { newestMail } from "./support/outbox";

/** This spec's own identity, so its project never lands in another spec's workspace. */
const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j003p-${RUN}@cubit.test`;
const PASSWORD = `participants-journey-${RUN}`;
const WORKSPACE = `Participants ${RUN}`;
// Deliberately NOT the workspace's own name: the crumb names the workspace, so a project sharing
// that name would make "the crumb does not name the project" pass on the wrong text (B-19).
const PROJECT = `Roles ${RUN}`;

/** The test contract's ids, spelled once. */
const ID = Object.freeze({
  list: "participants-list",
  row: "participants-row",
  history: "participants-history",
  historyRow: "participants-history-row",
  form: "participants-assign-form",
  subject: "participants-assign-subject",
  role: "participants-assign-role",
  direction: "participants-assign-direction",
  refusal: "participants-refusal",
  dialog: "consequence-dialog",
  subjectRow: "consequence-subject-row",
  digestLine: "consequence-digest-line",
  confirm: "consequence-confirm",
} as const);

/** The act, the two directions AC-1 closes over, and the two roles this walk moves. */
const ACT_TYPE = "ASSIGN_PARTICIPANT_ROLE";
const GRANT = "GRANT";
const WITHDRAW = "WITHDRAW";
const MEASURER = "MEASURER";
const PRINCIPAL = "PRINCIPAL";
const LAST_PRINCIPAL = "PROJECT_WOULD_HAVE_NO_PRINCIPAL";

/** The submit's label, verbatim from the Design Decision § 3 (`spine_participants_assign_submit`). */
const SUBMIT_LABEL = "Preview this change";

/** The baseline AC-6 names, and the eight bytes every PNG opens with. */
const BASELINE = join("tests", "e2e", "baselines", "design", "consequence-dialog-open.png");
const PNG_MAGIC = "89504e470d0a1a0a";

const route = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`;

/** One chip of a fieldset, addressed by the text it carries (enum values are content, I-47). */
function chip(page: Page, fieldset: string, label: string): Locator {
  return page
    .getByTestId(fieldset)
    .locator("[aria-pressed]")
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) });
}

/**
 * Choose a chip of a single-selection group (I-48). A chip already pressed is left alone: pressing
 * the selected member of a single-select group is not a thing a person does, and what this walk
 * needs is the selection, not the click.
 */
async function choose(chosen: Locator, what: string): Promise<void> {
  await expect(chosen, `${what} stands in its group`).toHaveCount(1);
  if ((await chosen.getAttribute("aria-pressed")) !== "true") await chosen.click();
  await expect(chosen, `${what} is the group's selection`).toHaveAttribute("aria-pressed", "true");
}

/** Every history row's direction and role, as the rows themselves carry them. */
async function historyRows(page: Page): Promise<{ direction: string | null; role: string | null }[]> {
  const rows = page.getByTestId(ID.historyRow);
  const total = await rows.count();
  const read: { direction: string | null; role: string | null }[] = [];
  for (let index = 0; index < total; index += 1) {
    const row = rows.nth(index);
    read.push({ direction: await row.getAttribute("data-direction"), role: await row.getAttribute("data-role") });
  }
  return read;
}

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-003 — participants: the roles a project holds, moved by act", () => {
  test("J-003: a role is granted through the ConsequenceDialog, and the last PRINCIPAL cannot be withdrawn", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(600_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);

    /* --- the registered refusal this walk must see rendered, read from its one home (B-17) --- */
    const registered = (REFUSALS as unknown as Record<string, { message: string; remedy: string } | undefined>)[LAST_PRINCIPAL];
    expect(registered, `${LAST_PRINCIPAL} must be registered in src/core/errors.ts — the taxonomy is closed (R-SPINE-062)`).toBeDefined();

    /* --- this spec's own identity, through the shipped doors --- */
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
    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";

    /* --- a project of that workspace: its creator is its first PRINCIPAL, by law (L-ACT-03) --- */
    await home.createWith({
      name: PROJECT,
      code: "PA-001",
      client: "Participants Holdings",
      siteAddress: "Plot 9, Airport Road",
      district: "Dhaka",
      buildingType: 1,
      storeys: "6",
      gfaM2: "3200",
      notes: "The project this journey moves roles on.",
    });
    const card = home.cardNamed(PROJECT);
    await expect(card, "the created project stands on S-Home").toBeVisible();
    const projectId = (await card.getAttribute("data-project")) ?? "";
    expect(projectId, "the card names the project it is for").not.toBe("");

    /* --- the screen itself: list, history and the assign form (I-53: reached by URL) --- */
    await page.goto(route(tenantId, projectId));

    /*
     * AC-6 / Decision § 1 — the deep route wears the shell's crumb and rail UNCHANGED.
     *
     * Derived, never transcribed: the area's name is read off the rail row and compared with the
     * crumb's own current entry, so no copy string is frozen here; the link is compared with the
     * workspace address this walk already holds. The only count pinned is the one the Decision
     * itself defines — two entries, the workspace link and the area crumb — which is exactly the
     * claim "unmodified by the depth of the route" makes.
     */
    await shell.expectFrame();
    const crumb = shell.breadcrumb;
    for (const area of SHELL_AREAS) {
      const current = await shell.nav(area).getAttribute("aria-current");
      // Both spellings the two Decisions use for "this row is the one" are accepted: the shell's
      // own § 1 says `page`, the participants Decision § 1 paraphrases it as `true`, and ARIA holds
      // them equivalent. Grading the meaning rather than one document's spelling keeps this off a
      // red only an out-of-scope shell edit could clear (B-20).
      const states: (string | null)[] = area === "projects" ? ["page", "true"] : [null];
      expect(states, `the rail states ${area === "projects" ? "Projects is" : `${area} is not`} the area this route selects (areaOf → projects)`).toContain(current);
    }

    // The entries a reader is given, decoration excluded — the `›` between them is aria-hidden.
    const crumbs = crumb.locator("ol > li:not([aria-hidden='true'])");
    await expect(crumbs, "the crumb is the shell's two entries — the workspace and the area — with no third naming the project or the screen").toHaveCount(2);

    const areaCrumb = crumbs.nth(1).locator("a");
    await expect(areaCrumb, "and the second of them links back, because a reader this deep in the area is not at its home").toHaveCount(1);
    expect(
      new URL((await areaCrumb.getAttribute("href")) ?? "", origin).pathname.replace(/\/+$/, ""),
      "back to the projects area's home, which is the workspace root",
    ).toBe(SHELL.workspace(tenantId));

    const areaLabel = ((await crumbs.nth(1).innerText()) ?? "").trim();
    expect(areaLabel, "the area crumb names the area").not.toBe("");
    await expect(shell.nav("projects"), "with the rail's own word for it — one home for the area's name (B-17)").toContainText(areaLabel);
    await expect(crumb, "the crumb does not name the project: a deeper crumb is a shell-contract change, not this screen's (arbitration)").not.toContainText(PROJECT);

    const list = page.getByTestId(ID.list);
    await expect(list, "the screen renders the project's current roles").toBeVisible();
    const rows = page.getByTestId(ID.row);
    expect(await rows.count(), "a project holds at least one participant at every moment (R-SPINE-011)").toBeGreaterThan(0);
    for (let index = 0; index < (await rows.count()); index += 1) {
      expect(((await rows.nth(index).getAttribute("data-user")) ?? "").trim(), "each row names the member it is for (Decision § 7)").not.toBe("");
    }
    await expect(list, "the creator holds PRINCIPAL, and the list shows the roles that are in effect").toContainText(PRINCIPAL);

    await expect(page.getByTestId(ID.history), "the screen renders the project's role history").toBeVisible();
    const opening = await historyRows(page);
    expect(opening.length, "the creating grant is on the record, so the history is never empty (L-ACT-03)").toBeGreaterThan(0);
    for (const row of opening) {
      expect([GRANT, WITHDRAW], `every history row names its direction, one of the two the act carries: ${JSON.stringify(row)}`).toContain(row.direction);
      expect((row.role ?? "").trim(), `every history row names the role it moved: ${JSON.stringify(row)}`).not.toBe("");
    }
    expect(
      opening.filter((row) => row.direction === GRANT && row.role === PRINCIPAL).length,
      "the grant that made the creator PRINCIPAL reads back as a GRANT row of that role",
    ).toBeGreaterThan(0);

    await expect(page.getByTestId(ID.form), "the assign form stands on the screen").toBeVisible();

    /* --- the grant, through the dialog: preview, digest line, confirm (R-UI-021) --- */
    const label = EMAIL.split("@")[0] ?? EMAIL;
    const self = page.getByTestId(ID.subject).locator("[aria-pressed]").filter({ hasText: label });
    await choose(self, "the session's own account, offered by the member picker (I-51)");
    await choose(chip(page, ID.role, MEASURER), `the ${MEASURER} chip of the closed role enum`);
    await choose(chip(page, ID.direction, GRANT), `the ${GRANT} chip`);

    await page.getByRole("button", { name: SUBMIT_LABEL }).click();

    const dialog = page.getByTestId(ID.dialog);
    await expect(dialog, "submitting the form previews the act and opens the one act pattern (R-UI-021)").toBeVisible();
    await expect(dialog, "the dialog names the act it is confirming").toHaveAttribute("data-act-type", ACT_TYPE);
    const digestLine = page.getByTestId(ID.digestLine);
    await expect(digestLine, "the digest line is visible BEFORE the confirm — a commit never stands without one").toBeVisible();
    expect(((await digestLine.innerText()) ?? "").trim(), "and it carries the digest the server computed, not an empty line").not.toBe("");
    expect(await page.getByTestId(ID.subjectRow).count(), "the dialog renders the subjects the Consequence names").toBeGreaterThan(0);
    await expect(page.getByTestId(ID.subjectRow).first(), `the consequence is the one the form asked for: ${MEASURER}`).toContainText(MEASURER);

    await checkpoint(page, testInfo, "j-003-consequence-dialog-open");

    // The visual half, scoped to what a second spec may own (see the header): the baseline AC-6
    // names was committed by this increment, and is a real capture.
    const baselineAt = join(process.cwd(), BASELINE);
    expect(existsSync(baselineAt), `${BASELINE} is committed — the open dialog's baseline AC-6 names (B-20; generate it with \`pnpm e2e --journey J-003 --update-snapshots=missing\`)`).toBe(true);
    const bytes = readFileSync(baselineAt);
    expect(bytes.subarray(0, 8).toString("hex"), `${BASELINE} is a PNG`).toBe(PNG_MAGIC);
    expect(bytes.byteLength, `${BASELINE} holds a capture, not an empty file`).toBeGreaterThan(1024);

    await page.getByTestId(ID.confirm).click();
    await expect(dialog, "a committed act closes the dialog (Decision I-49)").toHaveCount(0);

    await expect(
      page.locator(`[data-testid="${ID.historyRow}"][data-direction="${GRANT}"][data-role="${MEASURER}"]`),
      `the committed grant is the visible answer: a ${GRANT} row of ${MEASURER} in the history`,
    ).toHaveCount(1);
    await expect
      .poll(async () => (await historyRows(page)).length, { message: "one act appends exactly one history row" })
      .toBe(opening.length + 1);
    await expect(list, "and the granted role is now in effect on the current-roles list").toContainText(MEASURER);

    await checkpoint(page, testInfo, "j-003-role-granted");

    /* --- the last PRINCIPAL, protected in the browser as it is at the seam (R-SPINE-011) --- */
    const granted = await historyRows(page);
    await choose(self, "the session's own account");
    await choose(chip(page, ID.role, PRINCIPAL), `the ${PRINCIPAL} chip`);
    await choose(chip(page, ID.direction, WITHDRAW), `the ${WITHDRAW} chip`);
    await page.getByRole("button", { name: SUBMIT_LABEL }).click();

    const refusal = page.getByTestId(ID.refusal);
    await expect(refusal, "the refusal is answered in the screen's own answer slot (Decision § 1)").toContainText(registered?.message ?? "");
    await expect(refusal, "with the remedy the registry carries beside it").toContainText(registered?.remedy ?? "");
    await expect(refusal.locator(`[data-code="${LAST_PRINCIPAL}"]`), `rendered as the registered ${LAST_PRINCIPAL}, by the one refusal renderer`).toHaveCount(1);
    await expect(refusal, "the taxonomy code is never user-facing copy (refusal-state § 3)").not.toContainText(LAST_PRINCIPAL);
    await expect(dialog, "a refused preview opens no dialog — there is nothing to confirm (Decision I-49)").toHaveCount(0);
    expect(await historyRows(page), "and a refused withdrawal appends nothing to the record").toEqual(granted);

    await checkpoint(page, testInfo, "j-003-last-principal-protected");
  });
});
