/**
 * THE GOLDEN RUN — the state every leg past M0 starts from, reached the way a customer reaches it.
 *
 * AM-09 §2: "No leg is hand-staged: a journey never installs product state by calling module
 * functions, importing server actions or writing to the database — it clicks what a customer
 * clicks." Every other journey in this tree stands on a stage that imports `runIngestJob`,
 * `runPartitionJob`, `registerSighting` and `evaluateOffers` in-process; the golden path may not.
 * So this file does the prologue with a browser and nothing else: sign up, name the workspace,
 * create the project, upload F-RCC6 through the Dropzone, create and PIN a drawing set, and only
 * then start the shipped worker so the queued ingest — and the partition it chains — run against a
 * set revision that already names the drawing.
 *
 * THE ORDER IS THE WHOLE TRICK, and it is a product fact, not a convenience. The register's objects
 * are made by the partition job's expansion stage for set revisions that name the drawing, and
 * NOTHING in the UI re-partitions an already-ingested sheet. A journey that pins after the partition
 * has run therefore meets an empty register for ever. The lane's worker is not product state — it is
 * the shipped consumer of the shipped queue — so holding it back until the pin is placed is the one
 * lawful way to put a customer's two acts in the order the product needs, with no stage at all.
 *
 * ONE PROLOGUE PER PROCESS. Establishing it costs an upload and a real `cad/` extraction, so it is
 * memoised: the first leg that asks pays, every later leg in the same worker restores the session's
 * cookies and walks straight to its own screen. A second Playwright worker holds its own account and
 * its own project, which is what keeps the legs parallelisable at all (P9).
 */
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../../pages/s-auth.page";
import { SDrawingsPage, S_DRAWINGS } from "../../pages/s-drawings.page";
import { SHomePage, S_HOME } from "../../pages/s-home.page";
import { ShellPage, SHELL } from "../../pages/shell.page";
import { newestMail } from "../../support/outbox";
import { settled } from "../../support/settled";
import { startJourneyWorker, type JourneyWorker } from "../../support/worker";

/** The corpus the golden path uploads, and the sheet its later legs stand on. */
export const FIXTURE = join(process.cwd(), "fixtures", "rcc6", "rcc6.dxf");
export const SHEET = "FOUNDATION PLAN";

/** The discipline F-RCC6's sheets are confirmed under, and the set the campaign is opened on. */
export const DISCIPLINE = "STRUCT";
export const SET_NAME = "Golden Path Set";

/** How long one reading of F-RCC6 and its partition may take: one `uv run` and the rasters. */
export const READING_BUDGET_MS = 240_000;

/** What the prologue leaves behind, for the leg that asked for it. */
export interface GoldenRun {
  readonly tenantId: string;
  readonly projectId: string;
  readonly email: string;
  /** The shipped worker, running for as long as this process's legs need jobs run. */
  readonly worker: JourneyWorker;
}

let established: Promise<GoldenRun> | null = null;

/** The golden run this worker walks: established once, restored on every later ask. */
export async function goldenRun(page: Page): Promise<GoldenRun> {
  established ??= establish(page);
  const run = await established;
  await restore(page, run);
  return run;
}

/** Put a leg's own page inside the golden run's session and on its workspace. */
async function restore(page: Page, run: GoldenRun): Promise<void> {
  if (page.url().includes(`/t/${run.tenantId}/`)) return;
  await page.goto(S_HOME.workspace(run.tenantId));
  await settled(page);
}

/** Sign up, make the project, upload F-RCC6, pin a set over it, then let the queue run. */
async function establish(page: Page): Promise<GoldenRun> {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const email = `j000-legs-${stamp}@cubit.test`;
  const password = `golden-path-legs-${stamp}`;

  const auth = new SAuthPage(page);
  const shell = new ShellPage(page);
  const home = new SHomePage(page);
  const drawings = new SDrawingsPage(page);

  /* --- a person who did not have an account now has one (M0's leg, walked for its state) --- */
  await auth.open(S_AUTH.signUp);
  await auth.signUpWith(email, password, `Golden Legs ${stamp}`);
  await auth.expectNotice();
  const verifyMail = await newestMail(email, "verify-email");
  await auth.openWithToken(S_AUTH.verify, verifyMail.token);
  await auth.expectNotice();
  await auth.open(S_AUTH.signIn);
  await auth.signInWith(email, password);
  await expect(page, "signing in lands on the nameplate").toHaveURL(new RegExp(`${SHELL.home}$`));

  await shell.workspaceDoor.click();
  await expect(page, "the workspace door lands on an address naming the workspace").toHaveURL(/\/t\/[0-9a-f-]{36}$/);
  const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
  expect(tenantId, "the workspace has an id").not.toBe("");

  await home.open(S_HOME.workspace(tenantId));
  await home.createWith({ name: "Riverside Tower", buildingType: 0 });
  const card = home.cardNamed("Riverside Tower");
  await expect(card, "the first project stands on S-Home").toBeVisible();
  const projectId = (await card.getAttribute("data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");

  /* --- F-RCC6, dropped on S-Drawings. No worker runs yet, so ingest QUEUES (see the header) --- */
  await drawings.open(tenantId, projectId);
  await drawings.dropFile(FIXTURE);
  await expect(drawings.dropzoneItems.first(), "the dropped drawing is stored by the upload seam").toHaveAttribute("data-state", "stored", {
    timeout: READING_BUDGET_MS,
  });

  /* --- the set, created and PINNED through its own screen, before anything has read the file --- */
  await pinASetOverTheDrawing(page, tenantId, projectId);

  /* --- now the shipped worker drains the queue: ingest, and the partition ingest chains --- */
  const worker = await startJourneyWorker();
  await drawings.open(tenantId, projectId);
  await expect(drawings.timeline, "the jobs the upload asked for finish where the work was started (X-1)").toHaveAttribute("data-state", "done", {
    timeout: READING_BUDGET_MS,
  });
  await expect(drawings.cardForLayout(SHEET), `the sheet "${SHEET}" fanned out as a card of its own`).toHaveCount(1, { timeout: READING_BUDGET_MS });

  return { tenantId, projectId, email, worker };
}

/** The sets screen, walked: a set is made, the drawing joined to it, and the revision pinned. */
async function pinASetOverTheDrawing(page: Page, tenantId: string, projectId: string): Promise<void> {
  await page.goto(`${S_DRAWINGS.route(tenantId, projectId)}/sets`);
  await settled(page);
  await page.getByTestId("set-create").click();
  const form = page.getByTestId("set-create-form");
  await expect(form, "the create door opens the set's own form").toBeVisible();
  await form.getByRole("textbox").first().fill(SET_NAME);
  await form.getByRole("button", { name: /create|save|make/i }).first().click();

  const browser = page.getByTestId("set-browser");
  await expect(browser, "the new set opens its browser").toBeVisible({ timeout: 30_000 });
  const member = page.getByTestId("set-member-toggle").first();
  await expect(member, "the uploaded drawing is offered to the set").toBeVisible({ timeout: 30_000 });
  await member.click();

  await page.getByTestId("set-pin").click();
  const dialog = page.getByTestId("consequence-dialog");
  await expect(dialog, "pinning is an act, and an act is previewed in the one ConsequenceDialog").toBeVisible();
  await page.getByTestId("consequence-confirm").click();
  await expect(dialog, "the pinned revision closes the dialog").toHaveCount(0, { timeout: 30_000 });
}
