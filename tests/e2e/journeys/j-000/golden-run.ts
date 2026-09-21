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
 * WHAT THIS PROLOGUE CANNOT REACH, AND WHY THAT IS A FINDING RATHER THAN A LICENCE. The register's
 * objects are made by the partition job's EXPANSION stage, and only for set revisions that already
 * name the drawing — while the reading a sheet gets is asked for ONCE, by the screen session that
 * took the upload. A customer therefore has no order of clicks that pins a set ahead of the
 * partition: holding the shipped worker back to make room for the pin loses the reading request
 * altogether (proved twice, 240 s of an empty sheet index). Nothing in the UI re-partitions an
 * ingested sheet either. So the two legs that need register objects — the column lines and the
 * coverage grid — stand as declared stubs naming the door the product owes, which is exactly what
 * AM-09 §2 prescribes: "A leg that cannot be reached through the UI is a missing screen, not a
 * licence to stage." The set is still pinned here, by clicks, because the pin itself is a customer act.
 *
 * J-000 IS THE ONLY JOURNEY THAT STILL WALKS THIS (v22 speed, the founder's second decision).
 *
 * Every other journey that needs a signed-in owner with a workspace, a project and an ingested
 * drawing now SIGNS IN as this worker's seeded tenant — `signInAsSeededTenant` over the fixture the
 * lane installs in its global setup (tests/e2e/support/seeded-tenant.ts): one form post instead of
 * sign-up, refusal-or-notice, outbox, verification link, sign-in, workspace door, find-or-create
 * project, upload, wait for the reading. J-000 keeps every one of those clicks because J-000 IS the
 * story — the prologue is not its setup, it is its subject.
 *
 * FINDING, stated where it will be read: at the time this was written `goldenRun()` had exactly
 * three callers and all three were J-000's own legs (m1-confirm-disciplines, m2-run-partition,
 * m2-affirm-scale). The other journeys never shared this prologue; they each walked one of their
 * OWN, against a fixed address, idempotently. Those are what the seeded tenant is for.
 *
 * ONE PROLOGUE PER WORKER, PER LANE. Establishing it costs an upload and a real `cad/` extraction, so
 * it is memoised: the first leg that asks pays, every later leg in the same worker restores the
 * session's cookies and walks straight to its own screen. A second Playwright worker holds its own
 * account and its own project — the run file is keyed on `parallelIndex` as well as the lane, which
 * is what keeps the legs parallelisable at all (P9) and what stops two workers of one lane from
 * acting on one tenant.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../../pages/s-auth.page";
import { SDrawingsPage, S_DRAWINGS } from "../../pages/s-drawings.page";
import { SHomePage, S_HOME } from "../../pages/s-home.page";
import { SLevelsPage } from "../../pages/s-levels.page";
import { SScalePage } from "../../pages/s-scale.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { ShellPage, SHELL } from "../../pages/shell.page";
import { newestMail } from "../../support/outbox";
import { startJourneyWorker, type JourneyWorker } from "../../support/worker";
import { appears, everyRow, heldAttribute, steadyText } from "../../support/retrying-read";
import { SViewerPage, VIEWER_BUDGETS } from "../../viewer/s-viewer.page";
import { TESTIDS, testIdSelector } from "../../../../src/ui/testids";

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
  /** Whether `measuredRun` has walked the campaign to its first measure run on this project. */
  readonly measured?: boolean;
}

/**
 * THE LEVELS THE GOLDEN PATH INSERTS, and the range it authors for the typical floor plan.
 *
 * F-RCC6's typical floor plan is captioned bare ("TYPICAL FLOOR PLAN"; its note says 1F TO 5F), so
 * the plan states no membership of its own and its columns register on no level until a person
 * inserts the levels and authors the range (L-CAD-07, TYPICAL_RANGE_UNSTATED). The foundation plan's
 * footings need neither: foundation classes take the lawful-null level basis and stand in the
 * register from the pin.
 */
export const LEVELS: readonly { readonly label: string; readonly ordinal: number }[] = Object.freeze(
  // GF through ROOF, as the fixture's schedules band their members (columns GF–5F, beams 1F–ROOF): a
  // member whose band ends on a level the stack does not hold is SECTION_BAND_UNCOVERED and offers
  // nothing (L-FRM-02), so the stack a customer inserts is the building's, not the typical plan's alone.
  ["GF", "1F", "2F", "3F", "4F", "5F", "ROOF"].map((label, index) => ({ label, ordinal: index })),
);
export const TYPICAL_RANGE = Object.freeze({ from: "1F", to: "5F" });

/**
 * WHERE THE RUN IS WRITTEN DOWN, AND WHY IT HAS TO BE. Playwright gives each test FILE its own
 * module registry, so a module-level memo does not survive from one leg file to the next — and the
 * prologue costs an upload and a real `cad/` reading of F-RCC6, about four minutes. Paid once per
 * leg that would be twenty minutes of golden path per run, five times over in a regression sweep.
 * So the run is written to a file the next leg reads: the workspace, the project and the SESSION.
 * It is not staged state — every row behind it was made by a click, and a leg that finds the file
 * stale simply walks the prologue again — and it is written down PER LANE, for the reason below.
 */
const STATE_DIR = join(process.cwd(), "test-results");

/**
 * ONE RUN PER LANE, AND WHY IT IS NOT ONE RUN.
 *
 * The lane walks every journey TWICE — once dark, once light (playwright.config.ts) — and the two
 * walks are two independent walks of the same journey, not two readings of one. A leg of this
 * journey is an ACT: m1 confirms the discipline standing on the offer, m2 affirms the scale the
 * panel proposed, and an act done once is done. Share one golden run between the lanes and the
 * second lane arrives at a project where the offer it is written to confirm has already been
 * confirmed — which is exactly what it did: with this file keyed on nothing but its own name, dark
 * established the run, confirmed the disciplines and wrote itself down; light restored it and stood
 * 120 s in front of a screen that had no offer left to make (and m2's dialog, asked to affirm a
 * scale already of record, stayed open on the answer). Both were red in the light lane alone, in a
 * run of ONE spec file — so it was never a leg order and never the picture tenant.
 *
 * The lane's name is therefore part of the run's name — AND SO IS THE WORKER'S (P4b §1). The same
 * argument that separates the two lanes separates two workers of one lane: a leg is an ACT, and with
 * `CUBIT_E2E_WORKERS=2` a free worker re-hashes onto the other lane's tail, so dark/m1-confirm-disciplines
 * and dark/m2-affirm-scale ran CONCURRENTLY against one tenant — m1's "a confirmed group is no longer
 * an offer" was satisfied by the OTHER worker's confirmation, which is a green nobody earned. Keyed
 * on `parallelIndex` too, each worker walks its own prologue and holds its own workspace, project,
 * session and storage prefix (`<STORAGE_ROOT>/<tenantId>/…`) — which is the isolation this lane can
 * actually have, one served product being handed one DATABASE_URL (tests/e2e/support/worker.ts's
 * header states why a per-worker database is not one this server can serve).
 *
 * THE PRICE, STATED. A second worker of a lane pays the prologue again — one upload and one real
 * `cad/` reading, about four minutes — rather than restoring the first's. That is the cost of two
 * workers being two independent walks; sharing the run made them one walk read twice, and the
 * saving was the defect.
 */
const stateFile = (): string => join(STATE_DIR, `j-000-golden-run.${test.info().project.name}.w${test.info().parallelIndex}.json`);

let established: Promise<GoldenRun> | null = null;
let worker: JourneyWorker | null = null;

/**
 * What a leg needs of the run beyond its standing. `unmeasured`: the leg walks a door that only an
 * unmeasured campaign still offers (m2-affirm-scale affirms a proposal — and `measuredRun` affirms
 * every proposal on its way to Measure). Playwright dequeues leg files in roster order, so on one
 * worker the affirm leg runs before the measured ones; but a worker that failed is REPLACED by a new
 * process under the same `parallelIndex`, and that process restores the measured run its
 * predecessor wrote (found 2026-09-21: a sweep with ten moved pictures restarted a worker into
 * m2-affirm-scale with every view already "Affirmed", 2.0 m red for a cause nobody printed). A run
 * that cannot offer what the leg needs is not the leg's run: the prologue is walked again, and says so.
 */
export interface GoldenNeed {
  readonly unmeasured?: boolean;
}

/** The golden run this leg walks: restored from the run before it, or established from nothing. */
export async function goldenRun(page: Page, need: GoldenNeed = {}): Promise<GoldenRun> {
  established ??= (async (): Promise<GoldenRun> => (await restore(page)) ?? (await establish(page)))();
  let run = await established;
  if (need.unmeasured === true && run.measured === true) {
    walkedAgain(`the run written for this worker (project ${run.projectId}) has been measured, and this leg needs the campaign before Measure`);
    established = establish(page);
    run = await established;
  }
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
 * WHY A MISS IS ANNOUNCED. Every path out of `restore` that is not "the run is still good" costs the
 * caller four minutes of prologue, and a cost nobody prints is a cost nobody can attribute: a run
 * that walked the prologue three times because a leg file raced the writer looks exactly like a slow
 * box. So each miss names itself, in one line, on the lane's own stdout (B-19 — a flake is a defect
 * with a cause, and the cause has to be printed to be a cause).
 */
function walkedAgain(reason: string): null {
  process.stdout.write(`J-000 golden run: walking the prologue again — ${reason}\n`);
  return null;
}

/**
 * The run the leg before this one left, if it is still there. The check is the product's own answer:
 * the session is adopted and the drawings screen asked for the sheet the golden path stands on — a
 * run whose account, project or reading is gone simply answers "no" and the prologue runs again.
 *
 * NOTHING HERE MAY THROW (P4b §2). The file is shared state between processes: a worker of this lane
 * writing its run while another reads it handed the reader zero bytes, and the `SyntaxError` out of
 * an unguarded `JSON.parse` came out of `goldenRun()` — every leg in that file red, with a message
 * that named neither the file nor the race. A run file is a CACHE. A torn one, an absent one and one
 * whose shape is not a run are all the same lawful answer — "walk it again" — and each says which.
 */
async function restore(page: Page): Promise<GoldenRun | null> {
  const file = stateFile();
  if (!existsSync(file)) return walkedAgain(`no run is written down at ${file}`);

  let saved: GoldenRun;
  try {
    const written = readFileSync(file, "utf8");
    if (written.trim() === "") return walkedAgain(`the run file ${file} is empty — a writer was in the middle of it`);
    saved = JSON.parse(written) as GoldenRun;
  } catch (torn) {
    return walkedAgain(`the run file ${file} did not parse (${torn instanceof Error ? torn.message : String(torn)}) — a torn read of a file another process was writing`);
  }
  if (typeof saved?.tenantId !== "string" || typeof saved.projectId !== "string" || !Array.isArray(saved.cookies)) {
    return walkedAgain(`the run file ${file} parsed but names no workspace, project and session — it is not a run`);
  }

  await page.context().addCookies(saved.cookies);
  const drawings = new SDrawingsPage(page);
  await drawings.open(saved.tenantId, saved.projectId).catch(() => undefined);
  const standing = await drawings
    .cardForLayout(SHEET)
    .waitFor({ state: "visible", timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  return standing ? saved : walkedAgain(`the product no longer stands the run written at ${file}: "${SHEET}" is not on the drawings screen of project ${saved.projectId}`);
}

/**
 * Write the run down for the next leg file — ATOMICALLY (P4b §2).
 *
 * `writeFileSync` truncates the target and then fills it, so for as long as the fill takes there is
 * a file of zero bytes at the name another worker is reading. The bytes are laid down under a name
 * only this process uses — the pid is in it, so two writers never share the temporary either — and
 * `rename` publishes them in one step: a reader sees the old run or the new one, never half of one.
 */
function remember(run: GoldenRun): void {
  const file = stateFile();
  mkdirSync(dirname(file), { recursive: true });
  const partial = `${file}.${process.pid}.tmp`;
  writeFileSync(partial, JSON.stringify(run), "utf8");
  renameSync(partial, file);
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
  const projectId = (await heldAttribute(card, "data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");

  /* --- the shipped worker first: the reading S-Drawings asks for on upload is asked for ONCE, by
     the screen session that took the file. Holding the worker back to get the set pinned ahead of
     the partition lost that request altogether — 240 s of an empty sheet index, twice. So the
     consumer is up before the file is dropped, exactly as J-010 and m1-upload-and-open have it. --- */
  await goldenWorker();

  /* --- F-RCC6, dropped on S-Drawings --- */
  await drawings.open(tenantId, projectId);
  await drawings.dropFile(FIXTURE);
  await expect(drawings.dropzoneItems.first(), "the dropped drawing is stored by the upload seam").toHaveAttribute("data-state", "stored", {
    timeout: READING_BUDGET_MS,
  });

  // STAY ON THE SCREEN THAT TOOK THE FILE. X-1 puts a job's progress where the work was started, and
  // that is not a figure of speech: the reading is asked for by THIS page session, and navigating
  // away in the same breath as the upload took the ask with it — a sheet index that stayed empty for
  // 240 s, twice, with the worker idle behind it. So the timeline is watched here, on the screen
  // that started the jobs, exactly as m1-upload-and-open watches it, and the sheet card is the
  // answer that follows.
  await expect(drawings.timeline, "the jobs the upload asked for finish where the work was started (X-1)").toHaveAttribute("data-state", "done", {
    timeout: READING_BUDGET_MS,
  });
  await expect(drawings.cardForLayout(SHEET), `the sheet "${SHEET}" fanned out as a card of its own`).toHaveCount(1, { timeout: READING_BUDGET_MS });

  /* --- the set, created and PINNED through its own screen: a real act, and the campaign it opens --- */
  await pinASetOverTheDrawing(page, tenantId, projectId);

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

/* ------------------------------------------------------------- the measured campaign (M2's legs) */

/** What the register's count line reads while nothing has been measured. */
const NO_LINES = "0 of 0 lines";

/**
 * THE GOLDEN RUN, MEASURED: the levels inserted, the typical plan's range authored, the Measure door
 * pressed and its run finished — every step a click, none staged (AM-09 §2). The two M2 legs that
 * read the campaign (the column lines, the coverage grid) start from here, and a second worker of
 * the lane walks it again on its own project exactly as it walks the prologue.
 *
 * Memoised the way the prologue is: the run file carries `measured`, and a run that says so is
 * trusted only if the product still stands it — the register holding lines is the product's own
 * answer, and a run that has lost them is walked again.
 */
export async function measuredRun(page: Page): Promise<GoldenRun> {
  const run = await goldenRun(page);
  if (run.measured === true && (await standsMeasured(page, run))) return run;
  await measureCampaign(page, run);
  const measured: GoldenRun = { ...run, measured: true };
  remember(measured);
  established = Promise.resolve(measured);
  return measured;
}

/** Does the register of this run hold published lines? The product's answer, read where a customer reads it. */
async function standsMeasured(page: Page, run: GoldenRun): Promise<boolean> {
  const takeoff = new STakeoffPage(page);
  await takeoff.open(run.tenantId, run.projectId);
  const count = await steadyText(takeoff.linesCount, "the register's count line").catch(() => NO_LINES);
  if (count !== NO_LINES) return true;
  process.stdout.write(`J-000 golden run: measuring the campaign again — the register of project ${run.projectId} reads "${count}"\n`);
  return false;
}

/**
 * Insert the levels, author the typical plan's range, press Measure, and wait for the run to publish.
 * The worker is up first: the measure run is a job, and a door pressed with no consumer behind it
 * would wait for nobody.
 */
async function measureCampaign(page: Page, run: GoldenRun): Promise<void> {
  await goldenWorker();
  const levels = new SLevelsPage(page);
  const takeoff = new STakeoffPage(page);

  /* --- a scale of record for every view the panel proposes one for: a rail measures nothing on a
     view no affirmation act names (R-TO-021, VIEW_SCALE_UNAFFIRMED) — the affirm-scale leg walks
     this same door for one view; the campaign needs it for the views its members stand on --- */
  await affirmScales(page, run);

  /* --- the stack: every level of the typical range, through the one insert door (J-031's door) --- */
  await levels.open(run.tenantId, run.projectId);
  for (const level of LEVELS) {
    await levels.proposeLevel(level.label, level.ordinal);
    await levels.confirmAct();
    await expect(levels.rowAtOrdinal(level.ordinal), `${level.label} stands at ordinal ${level.ordinal}`).toContainText(level.label);
  }

  /* --- the range the caption's note states, authored for the one view that stands for a range --- */
  const range = levels.rangeRows.first();
  await expect(range, "the typical floor plan stands as the one view with no typical range").toBeVisible();
  await levels.authorRange(range, TYPICAL_RANGE.from, TYPICAL_RANGE.to);
  await levels.confirmAct();

  /* --- the Measure door, and the run it queues --- */
  await takeoff.open(run.tenantId, run.projectId);
  await takeoff.measure.click();
  await expect(takeoff.timeline, "the run is watched where it was started (R-UI-024)").toBeVisible();
  await expect(takeoff.measureStep, "the measure run finishes").toHaveAttribute("data-status", "succeeded", { timeout: READING_BUDGET_MS });
  await expect(takeoff.linesCount, "and the register counts the lines the rails published").not.toHaveText(NO_LINES, { timeout: READING_BUDGET_MS });
}

/**
 * Affirm a scale of record for every view the panel proposes one for, in one act: open the sheet,
 * check every view that carries a proposal, and press the one affirm door every checked member can
 * stand at (L-MEA-05: an act names one rank for all its views; the file's own units are the rank
 * every view reaches, at worst). A view the drawing offers no scale for is left as the panel states
 * it — its members stay unmeasured and the coverage grid says so (R-TO-021).
 */
async function affirmScales(page: Page, run: GoldenRun): Promise<void> {
  const drawings = new SDrawingsPage(page);
  const viewer = new SViewerPage(page);
  const scale = new SScalePage(page);

  await drawings.open(run.tenantId, run.projectId);
  await drawings.cell(drawings.cardForLayout(SHEET), S_DRAWINGS.open).click();
  await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
  await scale.open();
  await expect(scale.rows, "every view of the sheet is listed, with its proposals or its declared absence").not.toHaveCount(0, { timeout: 120_000 });

  let checked = 0;
  for (const row of await everyRow(scale.rows, "the scale panel's view rows")) {
    if ((await heldAttribute(row, "data-state")) === "affirmed") continue;
    const proposal = row.getByTestId(TESTIDS.viewer.scaleProposal).first();
    if (!(await appears(proposal))) continue;
    await proposal.click();
    await row.getByTestId(TESTIDS.viewer.scaleMember).click();
    checked += 1;
  }
  if (checked === 0) return;

  const door = page.locator(`${testIdSelector(TESTIDS.viewer.scaleAffirm)}:not([disabled])`).first();
  await expect(door, `an affirm door stands open at a rank every one of the ${checked} checked views can stand at`).toBeVisible({ timeout: 120_000 });
  await door.click();
  await expect(scale.dialog, "affirming a scale is an act, and an act is previewed in the one ConsequenceDialog").toBeVisible();
  await expect(scale.dialog, "which names the act it is about to commit").toHaveAttribute("data-act-type", "AFFIRM_SCALE");
  await scale.confirm.click();
  await expect(scale.dialog, "the committed act closes the dialog").toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator(`${testIdSelector(TESTIDS.viewer.scaleView)}[data-state="affirmed"]`), "the checked views now carry a scale of record").toHaveCount(checked, {
    timeout: 60_000,
  });
}
