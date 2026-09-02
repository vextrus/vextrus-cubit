// J-003 — S-Audit: the per-project audit surfaces (R-SPINE-081). A person signs in, reaches their
// project, opens its audit address, and meets the act log explorer with its three filters and the
// two panels whose posture the installation itself decides.
//
// The gate runs `pnpm e2e --journey J-003`, and Playwright exits 1 on an unmatched grep — so the
// J-003 tag in the titles below is what makes this spec runnable at all. It deliberately carries no
// other journey's tag: the golden path is not what this file walks.
//
// The identity and the project are FIXED and reached idempotently: the lane's database outlives a
// run (V-E2E), so an address already enrolled and a project already created are answers this walk
// takes rather than failures — and a fixed identity is what lets the checkpoint compare pixels
// against a committed baseline at all.
import { expect, test } from "@playwright/test";
import { isTrue, scalar } from "../../db/__tests__/support/live-sql";
import { e2eDatabaseUrl } from "./support/scratch-db";
import { SAuthPage, S_AUTH } from "./pages/s-auth.page";
import { SAuditPage } from "./pages/s-audit.page";
import { SHomePage } from "./pages/s-home.page";
import { ShellPage, SHELL } from "./pages/shell.page";
import { checkpoint } from "./support/checkpoint";
import { newestMail } from "./support/outbox";

const EMAIL = "j003-audit@cubit.test";
const PASSWORD = "audit-journey-password";
const WORKSPACE = "Ashuganj Works";
const PROJECT = "Ashuganj Terminal";

/**
 * The relations the two panels probe for. Their one home is `AUDIT_PANEL_TABLES` in
 * src/modules/spine/audit, which a journey may not import — that module opens the database seam,
 * and a Playwright worker loading it would connect a driver from the test process. These two
 * mirror that entry name for name (ARCH-02/B-17: mirrored under the seam ban, never a second
 * answer — they are re-pointed with it under B-20).
 */
const MODEL_LEDGER_TABLE = "model_calls";
const JOB_HISTORY_TABLE = "jobs";

/**
 * Does this installation hold that relation? Each panel's posture is a function of its own input
 * existing and nothing else, so the journey asks the same question of the same lane database
 * rather than freezing whichever answer today's cluster happens to give (B-19 — arming by input
 * existence). One home, two callers (B-17).
 *
 * Asked through the shared db test helper (ARCH-02) as the app role the product itself reads with,
 * so `to_regclass` is resolved against the very `search_path` the panel's probe was answered on;
 * SEAM-TENANT's driver ban is why this is psql and not a pool.
 */
function tableExists(table: string): boolean {
  return isTrue(scalar(e2eDatabaseUrl(), `select to_regclass('${table}') is not null;`));
}

/** The width the frame paints all four of its regions at (R-UI-030, lg and up). */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-003 — the project's audit surfaces", () => {
  test("J-003: the act log explorer stands on a project, with the model ledger armed and the jobs panel disarmed", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const audit = new SAuditPage(page);

    /* --- enrolment, idempotent: the lane's database is additive across runs --- */
    await auth.open(S_AUTH.signUp);
    await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE);
    await expect(auth.notice.or(auth.refusal), "the sign-up door answers — a notice or a registered refusal, never nothing").toBeVisible();
    if ((await auth.notice.count()) > 0) {
      const verifyMail = await newestMail(EMAIL, "verify-email");
      await auth.openWithToken(S_AUTH.verify, verifyMail.token);
      await auth.expectNotice();
    } else {
      await auth.refusedWith("ACCOUNT_ALREADY_EXISTS");
    }

    await auth.open(S_AUTH.signIn);
    await auth.signInWith(EMAIL, PASSWORD);
    await expect(page, "signing in leaves a person on the nameplate").toHaveURL(`${origin}${SHELL.home}`);

    await shell.workspaceDoor.click();
    await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));
    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(tenantId.length, "the workspace door names the tenant the URL is keyed by").toBe(36);

    /* --- the project this screen is about: created on the first run, reused on every one after --- */
    const card = home.cardNamed(PROJECT);
    if ((await card.count()) === 0) {
      await home.createWith({ name: PROJECT, code: "AT-001", client: "Ashuganj Holdings", district: "Brahmanbaria", buildingType: 0, storeys: "6" });
    }
    await expect(card, "the project this journey reads the audit of stands on S-Home").toBeVisible();
    const projectId = (await card.getAttribute("data-project")) ?? "";
    expect(projectId.length, "the card names the project it is for").toBe(36);

    /* --- the audit address, reached by URL: visible navigation to it is the shell's own debt --- */
    await audit.open(tenantId, projectId);
    await expect(page).toHaveURL(`${origin}/t/${tenantId}/p/${projectId}/audit`);

    await expect(audit.filterType, "the act type filter is offered").toBeVisible();
    await expect(audit.filterActor, "the actor filter is offered").toBeVisible();
    await expect(audit.filterSubject, "the subject filter is offered").toBeVisible();
    await expect(audit.rows, "no act has been committed on this project, so the log lists none").toHaveCount(0);
    await expect(audit.empty, "and the region says why it is empty rather than leaving a bare gap").toBeVisible();

    /* --- the panels' posture is the installation's answer, not a roster's (I-35) --- */
    const ledgerArmed = tableExists(MODEL_LEDGER_TABLE);
    await expect(
      audit.modelLedger,
      `the model ledger's posture is the installation's own answer: ${MODEL_LEDGER_TABLE} ${ledgerArmed ? "exists in this lane, so the panel arms" : "does not exist in this lane, so the panel stays disarmed"}`,
    ).toHaveAttribute("data-armed", String(ledgerArmed));
    const jobsArmed = tableExists(JOB_HISTORY_TABLE);
    await expect(
      audit.jobs,
      `job history's posture is the installation's own answer: ${JOB_HISTORY_TABLE} ${jobsArmed ? "exists in this lane, so the panel arms" : "does not exist in this lane, so the panel stays disarmed"}`,
    ).toHaveAttribute("data-armed", String(jobsArmed));

    /* --- s-audit/explorer: axe over the page, then the committed Linux baseline --- */
    await checkpoint(page, testInfo, "s-audit-explorer");
    await expect(page).toHaveScreenshot(["s-audit", "explorer.png"], { mask: audit.masks(), animations: "disabled" });
  });
});
