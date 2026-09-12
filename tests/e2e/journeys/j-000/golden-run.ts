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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, type Cookie, type Page } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../../pages/s-auth.page";
import { SDrawingsPage } from "../../pages/s-drawings.page";
import { SHomePage, S_HOME } from "../../pages/s-home.page";
import { ShellPage, SHELL } from "../../pages/shell.page";
import { newestMail } from "../../support/outbox";
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
  /** The signed-in session, carried so a later leg file walks as the same person. */
  readonly cookies: Cookie[];
}

/**
 * WHERE THE RUN IS WRITTEN DOWN, AND WHY IT HAS TO BE. Playwright gives each test FILE its own
 * module registry, so a module-level memo does not survive from one leg file to the next — and the
 * prologue costs an upload and a real `cad/` reading of F-RCC6, about four minutes. Paid once per
 * leg that would be twenty minutes of golden path per run, five times over in a regression sweep.
 * So the run is written to a file the next leg reads: the workspace, the project and the SESSION.
 * It is not staged state — every row behind it was made by a click, and a leg that finds the file
 * stale simply walks the prologue again.
 */
const STATE_FILE = join(process.cwd(), "test-results", "j-000-golden-run.json");

let established: Promise<GoldenRun> | null = null;
let worker: JourneyWorker | null = null;

/** The golden run this leg walks: restored from the run before it, or established from nothing. */
export async function goldenRun(page: Page): Promise<GoldenRun> {
  established ??= (async (): Promise<GoldenRun> => (await restore(page)) ?? (await establish(page)))();
  const run = await established;
  await adopt(page, run);
  return run;
}

/** The shipped worker, started once per process and stopped when the leg file is done. */
export async function goldenWorker(): Promise<JourneyWorker> {
  worker ??= await startJourneyWorker();
  return worker;
}

/** Give the worker back. A leg file calls this in `test.afterAll` — a stray consumer outlives runs. */
export async function releaseGoldenWorker(): Promise<void> {
  const held = worker;
  worker = null;
  if (held !== null) await held.stop();
}

/** Put a leg's own page inside the golden run's session. */
async function adopt(page: Page, run: GoldenRun): Promise<void> {
  const held = await page.context().cookies();
  if (held.length === 0) await page.context().addCookies(run.cookies);
}

/**
 * The run the leg before this one left, if it is still there. The check is the product's own answer:
 * the session is adopted and the drawings screen asked for the sheet the golden path stands on — a
 * run whose account, project or reading is gone simply answers "no" and the prologue runs again.
 */
async function restore(page: Page): Promise<GoldenRun | null> {
  if (!existsSync(STATE_FILE)) return null;
  const saved = JSON.parse(readFileSync(STATE_FILE, "utf8")) as GoldenRun;
  await page.context().addCookies(saved.cookies);
  const drawings = new SDrawingsPage(page);
  await drawings.open(saved.tenantId, saved.projectId).catch(() => undefined);
  const standing = await drawings
    .cardForLayout(SHEET)
    .waitFor({ state: "visible", timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  return standing ? saved : null;
}

/** Write the run down for the next leg file. */
function remember(run: GoldenRun): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(run), "utf8");
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
  await goldenWorker();
  await drawings.open(tenantId, projectId);
  // NOT the job timeline: X-1 scopes that reading to the screen session that STARTED the jobs, and
  // this leg came back to the screen after pinning the set, so it reads "idle" for ever and says
  // nothing about the queue. The honest evidence that the reading finished is the reading itself —
  // the sheet the golden path stands on, fanned out as a card of its own.
  await expect(drawings.cardForLayout(SHEET), `the sheet "${SHEET}" fanned out as a card of its own`).toHaveCount(1, { timeout: READING_BUDGET_MS });

  const run: GoldenRun = { tenantId, projectId, email, cookies: await page.context().cookies() };
  remember(run);
  return run;
}

/** The sets index, as J-012 addresses it — one home for the route (ARCH-02). */
const setsRoute = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings/sets`;

/**
 * The sets screen, walked exactly as J-012 walks it: a set is NAMED (which opens it at its own
 * address), the uploaded drawing is toggled into its draft, and the draft is PINNED through the one
 * ConsequenceDialog. Every locator here is the screen's own test id, and every step is a click.
 */
async function pinASetOverTheDrawing(page: Page, tenantId: string, projectId: string): Promise<void> {
  await page.goto(setsRoute(tenantId, projectId));
  await expect(page.getByTestId("set-create-form"), "the sets index stands, with the door that names a set").toBeVisible({ timeout: 60_000 });
  await page.getByTestId("set-name-input").fill(SET_NAME);
  await page.getByTestId("set-create").click();
  await expect(page, "the named set stands open at its own address").toHaveURL(new RegExp(`/t/${tenantId}/p/${projectId}/drawings/sets/[0-9a-f-]{36}$`), {
    timeout: 60_000,
  });

  const row = page.getByTestId("set-drawing").first();
  await expect(row, "the uploaded drawing is offered to the set").toBeVisible({ timeout: 60_000 });
  await row.getByTestId("set-member-toggle").click();
  await expect(row, "a toggle writes the draft at once (I-96)").toHaveAttribute("data-member", "true");

  await page.getByTestId("set-pin").click();
  const dialog = page.getByTestId("consequence-dialog");
  await expect(dialog, "pinning is an act, and an act is previewed in the one ConsequenceDialog").toBeVisible();
  await page.getByTestId("consequence-confirm").click();
  await expect(dialog, "the pinned revision closes the dialog").toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId("set-revision"), "the pin recorded one set revision — the campaign the register measures is now open").toHaveCount(1, {
    timeout: 60_000,
  });
}
