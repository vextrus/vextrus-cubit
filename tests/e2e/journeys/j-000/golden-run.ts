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
import { SSchedulesPage } from "../../pages/s-schedules.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { ShellPage, SHELL } from "../../pages/shell.page";
import { newestMail } from "../../support/outbox";
import { startJourneyWorker, type JourneyWorker } from "../../support/worker";
import { appears, everyAttribute, everyRow, heldAttribute, steadyText } from "../../support/retrying-read";
import { settled } from "../../support/settled";
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
  /** The M3 fixture's own project on the same workspace, once `bnbcRun` has walked it (AM-17). */
  readonly bnbc?: BnbcRun;
}

/** What the M3 prologue leaves behind: the project F-RCC6-BNBC stands in, and how far it was walked. */
export interface BnbcRun {
  readonly projectId: string;
  /** Whether `bnbcTranscribed` has affirmed the scales, transcribed the stack and the notes and authored the ranges. */
  readonly transcribed?: boolean;
  /** Whether `bnbcMeasured` has pressed Measure on it and the register counts lines. */
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
async function pinASetOverTheDrawing(page: Page, tenantId: string, projectId: string, setName: string = SET_NAME): Promise<void> {
  await page.goto(setsRoute(tenantId, projectId));
  await expect(page.getByTestId("set-create-form"), "the sets index stands, with the door that names a set").toBeVisible({ timeout: 60_000 });
  await page.getByTestId("set-name-input").fill(setName);
  await page.getByTestId("set-create").click();
  await expect(page, "the named set stands open at its own address").toHaveURL(new RegExp(`/t/${tenantId}/p/${projectId}/drawings/sets/[0-9a-f-]{36}$`), {
    timeout: 60_000,
  });

  const row = page.getByTestId("set-drawing").first();
  await expect(row, "the uploaded drawing is offered to the set").toBeVisible({ timeout: 60_000 });
  // The set page arrived by the create act's own navigation: its row is VISIBLE from the server's
  // paint before the toggle is live, so the step waits for the screen to stop arriving before it
  // clicks, and gives the write — a server round trip and a revalidation — a reading's budget rather
  // than the 5 s default. The session-7 gate's J-000 read "false" 14 times over 5 s here, under the
  // load of the lanes before it, on a walk every other run that day passed.
  await settled(page);
  await row.getByTestId("set-member-toggle").click();
  await expect(row, "a toggle writes the draft at once (I-96)").toHaveAttribute("data-member", "true", { timeout: 60_000 });

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

/* ------------------------------------------------------ the M3 fixture's campaign (M3's leg, AM-17) */

/**
 * THE M3 YARDSTICK (AM-01): F-RCC6-BNBC, 27 sheets, uploaded through the product exactly as F-RCC6
 * is — into a SECOND project on the golden run's own workspace, because a campaign is one measurement
 * effort against one pinned set revision (AS-06) and the M2 legs read the F-RCC6 project as they
 * left it. Every step below is a click; nothing is staged (AM-09 §2).
 */
export const BNBC_FIXTURE = join(process.cwd(), "fixtures", "rcc6-bnbc", "rcc6-bnbc.dxf");
export const BNBC_PROJECT_NAME = "Bashundhara G+6";
export const BNBC_SET_NAME = "Golden Path Set (F-RCC6-BNBC)";

/** How long the 27-sheet reading, its rasters, its partition and its measure run may each take. */
export const BNBC_READING_BUDGET_MS = 600_000;

/** The two sheets whose texts propose the detailing figures a person transcribes (J-032, AM-03(h)). */
export const BNBC_NOTES_SHEETS: readonly string[] = Object.freeze(["S-01 GENERAL NOTES (1 OF 2)", "S-02 GENERAL NOTES (2 OF 2) & LAP-DEVELOPMENT TABLE"]);

/**
 * THE STACK, AS THE DRAWING STATES IT. S-25's BUILDING SECTION A-A carries one level mark per storey
 * (`GF EL +0.000` … `ROOF EL +21.641`), so the partition proposes the stack and a person confirms it
 * whole (L-MEA-07, R-UI-023). The metric marks state an elevation and no unit, so the proposal carries
 * no metric storey height (L-CAD-03: a reading never invents what the drawing withheld) and a person
 * transcribes each one — `height`: the distance to the mark above, in the metres the section's `EL`
 * figures are stated in, citing the mark it is read off (TRANSCRIBED, L-QTY-01; STOREY_HEIGHT_UNCITED
 * refuses a reading that cites none). ROOF is the top of the section and states no height above it.
 * Where no stack is offered, the same eight labels are inserted by hand through J-031's door, in
 * this order.
 *
 * The ground storey is stated TWICE (T-NOT-LEVEL): the section's left side marks `P.L= +0'-0"` beside
 * GF and `EL +11'-0"` beside 1F, so the confirmed stack already carries GF's height read in feet and
 * inches (132 in, citing `P.L=`'s mark 1D90), and the metric `+3.353` a person transcribes is that
 * design rounded to three places. The two readings agree and GF stands at the exact one — `metres`
 * 3.3528, the storey F-RCC6-BNBC's model states (D-001) — where the metric print alone stood GF at
 * 3.353 and measured every column through it 0.2 mm tall. Every storey above is stated once, and
 * stands at what the person transcribed.
 */
export const BNBC_STOREYS: readonly { readonly label: string; readonly height: string; readonly sourceKey: string; readonly metres: string }[] = Object.freeze([
  { label: "GF", height: "3.353", sourceKey: "DXF_HANDLE:1D4C", metres: "3.3528" },
  { label: "1F", height: "3.048", sourceKey: "DXF_HANDLE:1D4E", metres: "3.048" },
  { label: "2F", height: "3.048", sourceKey: "DXF_HANDLE:1D50", metres: "3.048" },
  { label: "3F", height: "3.048", sourceKey: "DXF_HANDLE:1D52", metres: "3.048" },
  { label: "4F", height: "3.048", sourceKey: "DXF_HANDLE:1D54", metres: "3.048" },
  { label: "5F", height: "3.048", sourceKey: "DXF_HANDLE:1D56", metres: "3.048" },
  { label: "6F", height: "3.048", sourceKey: "DXF_HANDLE:1D58", metres: "3.048" },
]);

/** The ground storey's imperial reading, as the confirmed stack carries it (D-001, T-NOT-LEVEL). */
export const BNBC_GF_IMPERIAL_SOURCE = "DXF_HANDLE:1D90";
export const BNBC_LEVELS: readonly string[] = Object.freeze([...BNBC_STOREYS.map((storey) => storey.label), "ROOF"]);
export const BNBC_HEIGHT_UNIT = "m";
export const BNBC_HEIGHT_BASIS = "TRANSCRIBED";

/**
 * THE FOUNDATION NECK, AS A PERSON ENTERS IT (I-339). Every ground-storey column of F-RCC6-BNBC rises
 * from the top of its cap, 2'-0" beneath GF, and no text or attribute of the drawing states that storey
 * — S-25's section marks GF and nothing below it, and the only statement of the depth is geometry: the
 * foot of the section's column lines (`1D59`, drawn from 609.6 below GF). So a person inserts `FDN`
 * beneath GF through J-031's door and ENTERS its height, 0.6096 m, citing that line — and the one
 * resolver stands every ground-storey vertical on it too (I-338). Entered at the exact 2'-0": the
 * −0.610 a metric print would round it to stands the neck's concrete over the golden.
 *
 * Inserted BEFORE the section's stack is confirmed, at ordinal −1: an insert moves every live level at
 * or above the ordinal it names (L-MEA-07), so the neck inserted first leaves GF at 0 and every storey
 * where the section's own proposal puts it.
 */
export const BNBC_NECK = Object.freeze({ label: "FDN", ordinal: -1, height: "0.6096", basis: "ENTERED", sourceKey: "DXF_HANDLE:1D59", metres: "0.6096" });

/** How many levels the transcribed stack holds: the section's eight, and the neck beneath them. */
export const BNBC_STACK_SIZE = BNBC_LEVELS.length + 1;

/**
 * THE TYPICAL RANGES A PERSON AUTHORS (L-CAD-07). A plan whose caption states no level stands for a
 * range of floors it must be told: the typical beam layout is titled "(2ND TO 6TH FLOOR)" on its
 * sheet, the typical slab plan stands beside it for the same floors, and the one column layout plan
 * is the plan of every storey the column schedule bands (GF to 6F). Each is authored on the levels
 * rail's own row for the view, by the caption the partition read.
 */
export const BNBC_TYPICAL_RANGES: readonly { readonly caption: string; readonly from: string; readonly to: string }[] = Object.freeze([
  { caption: "COLUMN LAYOUT PLAN", from: "GF", to: "6F" },
  { caption: "TYPICAL FLOOR BEAM LAYOUT", from: "2F", to: "6F" },
  { caption: "TYPICAL SLAB REINFORCEMENT PLAN", from: "2F", to: "6F" },
]);

/** A golden run that holds the M3 fixture's project. */
export type BnbcGoldenRun = GoldenRun & { readonly bnbc: BnbcRun };

/** How many offered discipline groups the M3 drawing can fan out into before the loop is a defect. */
const OFFERED_GROUPS_CAP = 8;

/**
 * The M3 fixture's project, uploaded, its disciplines confirmed and its set pinned — restored from
 * the run written down for this worker, or walked from the golden run's own workspace.
 */
export async function bnbcRun(page: Page): Promise<BnbcGoldenRun> {
  const run = await goldenRun(page);
  if (run.bnbc !== undefined && (await standsBnbc(page, run))) return run as BnbcGoldenRun;
  const bnbc = await establishBnbc(page, run);
  const carried: BnbcGoldenRun = { ...run, bnbc };
  remember(carried);
  established = Promise.resolve(carried);
  return carried;
}

/**
 * The M3 fixture's campaign, MEASURED: scales affirmed on every sheet that proposes one, the stack
 * confirmed and every storey height transcribed, the typical ranges authored, the general notes
 * transcribed, Measure pressed and its run finished — every step a click (AM-09 §2). Memoised the
 * way `measuredRun` is: trusted only while the product still stands it.
 */
/**
 * The M3 fixture's campaign TRANSCRIBED: scales affirmed on every sheet that proposes one, the stack
 * confirmed or inserted and every storey height read off the section's marks, the typical ranges
 * authored, the general notes transcribed — J-031's and J-032's doors, by clicks (AM-09 §2), and
 * nothing measured yet. Memoised like the rest: trusted only while the product still stands it.
 */
export async function bnbcTranscribed(page: Page): Promise<BnbcGoldenRun> {
  const run = await bnbcRun(page);
  if (run.bnbc.transcribed === true && (await standsTranscribedAt(page, run.tenantId, run.bnbc.projectId))) return run;
  await transcribeBnbc(page, run);
  const transcribed: BnbcGoldenRun = { ...run, bnbc: { ...run.bnbc, transcribed: true } };
  remember(transcribed);
  established = Promise.resolve(transcribed);
  return transcribed;
}

export async function bnbcMeasured(page: Page): Promise<BnbcGoldenRun> {
  const run = await bnbcTranscribed(page);
  if (run.bnbc.measured === true && (await standsMeasuredAt(page, run.tenantId, run.bnbc.projectId))) return run;
  await measureBnbc(page, run);
  const measured: BnbcGoldenRun = { ...run, bnbc: { ...run.bnbc, measured: true } };
  remember(measured);
  established = Promise.resolve(measured);
  return measured;
}

/** Does the product still stand the M3 project this run wrote down? Its notes sheet on the drawings screen says. */
async function standsBnbc(page: Page, run: GoldenRun): Promise<boolean> {
  const drawings = new SDrawingsPage(page);
  await drawings.open(run.tenantId, run.bnbc?.projectId ?? "").catch(() => undefined);
  const standing = await drawings
    .cardForLayout(BNBC_NOTES_SHEETS[0] as string)
    .waitFor({ state: "visible", timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!standing) walkedAgain(`the product no longer stands the M3 project ${run.bnbc?.projectId ?? "(none)"} written for this worker`);
  return standing;
}

/** Does the stack of this project still stand with every level the section states? The levels screen says. */
async function standsTranscribedAt(page: Page, tenantId: string, projectId: string): Promise<boolean> {
  const levels = new SLevelsPage(page);
  await levels.open(tenantId, projectId);
  const rows = await everyRow(levels.rows, "the stack's levels", { min: 0 }).catch(() => []);
  if (rows.length === BNBC_STACK_SIZE) return true;
  process.stdout.write(`J-000 golden run: transcribing the M3 campaign again — the stack of project ${projectId} holds ${rows.length} level(s)\n`);
  return false;
}

/** Does the register of this project hold published lines? The same reading `standsMeasured` makes. */
async function standsMeasuredAt(page: Page, tenantId: string, projectId: string): Promise<boolean> {
  const takeoff = new STakeoffPage(page);
  await takeoff.open(tenantId, projectId);
  const count = await steadyText(takeoff.linesCount, "the register's count line").catch(() => NO_LINES);
  if (count !== NO_LINES) return true;
  process.stdout.write(`J-000 golden run: measuring the M3 campaign again — the register of project ${projectId} reads "${count}"\n`);
  return false;
}

/** A second project on the run's workspace, F-RCC6-BNBC dropped on it, its disciplines confirmed, a set pinned. */
async function establishBnbc(page: Page, run: GoldenRun): Promise<BnbcRun> {
  const home = new SHomePage(page);
  const drawings = new SDrawingsPage(page);

  await home.open(S_HOME.workspace(run.tenantId));
  await home.createWith({ name: BNBC_PROJECT_NAME, buildingType: 0 });
  const card = home.cardNamed(BNBC_PROJECT_NAME).first();
  await expect(card, "the M3 project stands on S-Home").toBeVisible();
  const projectId = (await heldAttribute(card, "data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");

  // The worker first, for the reason the prologue states it: the reading is asked for ONCE, by the
  // screen session that takes the file.
  await goldenWorker();
  await drawings.open(run.tenantId, projectId);
  await drawings.dropFile(BNBC_FIXTURE);
  await expect(drawings.dropzoneItems.first(), "the M3 drawing is stored by the upload seam").toHaveAttribute("data-state", "stored", { timeout: BNBC_READING_BUDGET_MS });
  await expect(drawings.timeline, "the jobs the upload asked for finish where the work was started (X-1)").toHaveAttribute("data-state", "done", { timeout: BNBC_READING_BUDGET_MS });
  await expect(drawings.cardForLayout(BNBC_NOTES_SHEETS[0] as string), "the general-notes sheet fanned out as a card of its own").toHaveCount(1, { timeout: BNBC_READING_BUDGET_MS });

  /* --- every discipline the reading offers, confirmed as the group it is offered as (L-REG-03) --- */
  for (let confirmed = 0; confirmed < OFFERED_GROUPS_CAP; confirmed += 1) {
    const offer = drawings.groups.first();
    if (!(await appears(offer, 5_000))) break;
    const offered = (await heldAttribute(offer, "data-discipline")) ?? "";
    expect(offered, "an offered group names the discipline it proposes").not.toBe("");
    await drawings.confirmGroup(offered);
    await expect(drawings.groupFor(offered), `the ${offered} group is no longer an offer standing open`).toHaveCount(0, { timeout: 60_000 });
  }

  await pinASetOverTheDrawing(page, run.tenantId, projectId, BNBC_SET_NAME);
  return { projectId };
}

/**
 * Affirm a scale of record on EVERY sheet whose panel proposes one — the M3 drawing draws its plans
 * on many sheets, and a rail measures nothing on a view no affirmation act names (R-TO-021). Each
 * sheet is opened from its own card, as a person opens it, and `affirmScales`' one-act rule holds.
 */
async function affirmScalesOnEverySheet(page: Page, tenantId: string, projectId: string): Promise<void> {
  const drawings = new SDrawingsPage(page);
  const viewer = new SViewerPage(page);
  const scale = new SScalePage(page);

  await drawings.open(tenantId, projectId);
  const sheets = (await everyRow(drawings.cards, "the M3 drawing's sheet cards")).length;
  expect(sheets, "the M3 drawing fanned out into its sheets").toBeGreaterThan(20);

  for (let index = 0; index < sheets; index += 1) {
    await drawings.open(tenantId, projectId);
    await drawings.cell(drawings.cards.nth(index), S_DRAWINGS.open).click();
    await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: 60_000 });
    await scale.open();
    // Three settled readings of the whole list, never a wait per row (viewer.md "View rows"): each
    // row's `data-state` (`affirmed`, or the absence code verbatim — a row that proposes and stands
    // unaffirmed carries the absence code too, because no scale of record stands on it yet), each
    // row's view key, and the view keys of the rows that hold a proposal (every proposal's own row:
    // the nearest ancestor keyed by a view). The panel lists the whole record's views on every sheet
    // (54 on the M3 drawing, 10 of them proposing), so a two-second `appears` wait on every refused
    // row, sheet after sheet, cost 1,368 of a 1,800 s budget before this read was made — the leg
    // timed out in this loop.
    const states = await everyAttribute(scale.rows, "data-state", "the scale panel's view states", { min: 0 });
    const keys = await everyAttribute(scale.rows, "data-view-key", "the scale panel's view keys", { min: 0 });
    const proposing = new Set(await everyAttribute(scale.proposals.locator("xpath=ancestor::*[@data-view-key][1]"), "data-view-key", "the rows that propose a scale", { min: 0 }));
    let checked = 0;
    for (const [at, state] of states.entries()) {
      if (state === "affirmed" || !proposing.has(keys[at] ?? "")) continue;
      const row = scale.rows.nth(at);
      const proposal = row.getByTestId(TESTIDS.viewer.scaleProposal).first();
      if (!(await appears(proposal))) continue;
      await proposal.click();
      await row.getByTestId(TESTIDS.viewer.scaleMember).click();
      checked += 1;
    }
    if (checked === 0) continue;
    const door = page.locator(`${testIdSelector(TESTIDS.viewer.scaleAffirm)}:not([disabled])`).first();
    await expect(door, `an affirm door stands open at a rank every one of the ${checked} checked views can stand at`).toBeVisible({ timeout: 60_000 });
    await door.click();
    await expect(scale.dialog, "affirming a scale is an act, previewed in the one ConsequenceDialog").toBeVisible();
    await scale.confirm.click();
    await expect(scale.dialog, "the committed act closes the dialog").toHaveCount(0, { timeout: 60_000 });
  }
}

/**
 * The stack the section proposes, confirmed whole; or the same labels inserted by hand where nothing is
 * offered — beneath them the foundation neck a person enters by hand, which the drawing states nowhere
 * (I-339).
 */
async function transcribeStack(page: Page, tenantId: string, projectId: string): Promise<void> {
  const takeoff = new STakeoffPage(page);
  const levels = new SLevelsPage(page);

  /* --- the neck beneath GF, through J-031's door, FIRST: an insert moves what stands at or above it --- */
  await levels.open(tenantId, projectId);
  await levels.proposeLevel(BNBC_NECK.label, BNBC_NECK.ordinal);
  await expect(levels.dialog, "inserting a level by hand is an act, previewed in the one dialog").toHaveAttribute("data-act-type", "INSERT_LEVEL");
  await levels.confirmAct();
  await expect(levels.rowAtOrdinal(BNBC_NECK.ordinal), `${BNBC_NECK.label} stands at ordinal ${BNBC_NECK.ordinal}, beneath where GF will stand`).toContainText(BNBC_NECK.label);

  await takeoff.open(tenantId, projectId);
  const offer = takeoff.levelStack.getByTestId(TESTIDS.offered.groupConfirm).first();
  if (await appears(offer, 5_000)) {
    await offer.click();
    await expect(levels.dialog, "confirming the proposed stack is one act — every level at once (R-UI-023)").toHaveAttribute("data-act-type", "INSERT_LEVEL");
    await levels.confirmAct();
  } else {
    process.stdout.write("J-000 golden run: the register offers no proposed level stack for the M3 drawing — the stack is inserted by hand through J-031's door\n");
    await levels.open(tenantId, projectId);
    for (const [ordinal, label] of BNBC_LEVELS.entries()) {
      await levels.proposeLevel(label, ordinal);
      await levels.confirmAct();
    }
  }

  await levels.open(tenantId, projectId);
  await expect(levels.rows, "the eight levels of the section stand in the stack, and the neck beneath them").toHaveCount(BNBC_STACK_SIZE);
  await expect(levels.rowAtOrdinal(BNBC_NECK.ordinal), `${BNBC_NECK.label} still stands at ordinal ${BNBC_NECK.ordinal}: nothing was inserted beneath it`).toContainText(BNBC_NECK.label);
  for (const [ordinal, label] of BNBC_LEVELS.entries()) {
    await expect(levels.rowAtOrdinal(ordinal), `${label} stands at ordinal ${ordinal}`).toContainText(label);
  }

  /* --- one storey height per level, read off the section's own marks (TRANSCRIBED, L-QTY-01) --- */
  for (const [ordinal, storey] of BNBC_STOREYS.entries()) {
    const row = levels.rowAtOrdinal(ordinal);
    await row.click();
    await expect(levels.inspector, `${storey.label} fills the shell's one inspector`).toBeVisible();
    await levels.inspector.getByTestId(TESTIDS.levels.heightValue).fill(storey.height);
    await levels.chooseIn(levels.inspector.getByTestId(TESTIDS.levels.heightUnit), BNBC_HEIGHT_UNIT);
    await levels.chooseIn(levels.inspector.getByTestId(TESTIDS.levels.heightBasis), BNBC_HEIGHT_BASIS);
    await levels.inspector.getByTestId(TESTIDS.levels.heightSource).fill(storey.sourceKey);
    await levels.authorHeight.click();
    await expect(levels.dialog, "reading a height is an act, previewed in the one dialog").toHaveAttribute("data-act-type", "AUTHOR_STOREY_HEIGHT");
    await levels.confirmAct();
    // Agreed, and not contested: on GF the transcription is the second reading of a height the stack
    // already carries in feet and inches, and the two agree at the places `+3.353` is printed to (D-001).
    await expect(row, `${storey.label} reads ${storey.height} ${BNBC_HEIGHT_UNIT} off the section, and stands agreed`).toHaveAttribute("data-standing", "AGREED");
  }

  /* --- the neck's height, ENTERED: no mark states it, and the reading cites the geometry that does (I-339) --- */
  const neck = levels.rowAtOrdinal(BNBC_NECK.ordinal);
  await neck.click();
  await expect(levels.inspector, `${BNBC_NECK.label} fills the shell's one inspector`).toBeVisible();
  await levels.inspector.getByTestId(TESTIDS.levels.heightValue).fill(BNBC_NECK.height);
  await levels.chooseIn(levels.inspector.getByTestId(TESTIDS.levels.heightUnit), BNBC_HEIGHT_UNIT);
  await levels.chooseIn(levels.inspector.getByTestId(TESTIDS.levels.heightBasis), BNBC_NECK.basis);
  await levels.inspector.getByTestId(TESTIDS.levels.heightSource).fill(BNBC_NECK.sourceKey);
  await levels.authorHeight.click();
  await expect(levels.dialog, "entering a height is an act, previewed in the one dialog").toHaveAttribute("data-act-type", "AUTHOR_STOREY_HEIGHT");
  await levels.confirmAct();
  await expect(neck, `${BNBC_NECK.label} stands at the ${BNBC_NECK.height} ${BNBC_HEIGHT_UNIT} entered off the column line's foot, agreed`).toHaveAttribute("data-standing", "AGREED");
}

/**
 * The typical ranges the sheets state, authored on the rail's own rows for the views whose captions
 * state none — and the rail is the CAMPAIGN's index (s-levels I-240): a view is listed there only
 * once a measure run has read the pinned revision and deferred its expansion, so this is walked
 * after the first run, never before it. Answers how many ranges it stated.
 */
async function authorTypicalRanges(page: Page, tenantId: string, projectId: string): Promise<number> {
  const levels = new SLevelsPage(page);
  await levels.open(tenantId, projectId);
  let authored = 0;
  for (const range of BNBC_TYPICAL_RANGES) {
    const row = levels.rangeRows.filter({ hasText: range.caption }).first();
    if (!(await appears(row, 5_000))) {
      process.stdout.write(`J-000 golden run: the levels rail offers no unstated range for "${range.caption}" on the M3 drawing — nothing to author\n`);
      continue;
    }
    await levels.authorRange(row, range.from, range.to);
    await levels.confirmAct();
    await expect(row, `the range ${range.from}–${range.to} authored for "${range.caption}" takes the row off the rail`).toHaveCount(0, { timeout: 60_000 });
    authored += 1;
  }
  return authored;
}

/** The general notes, transcribed sheet by sheet as J-032 transcribes them: the grammar's proposals, taken as proposed. */
async function transcribeNotes(page: Page, tenantId: string, projectId: string): Promise<void> {
  const schedules = new SSchedulesPage(page);
  await schedules.open(tenantId, projectId);
  for (const sheet of BNBC_NOTES_SHEETS) {
    const row = schedules.sheetRowForLayout(sheet);
    await expect(row, `the sheet rail lists "${sheet}", which holds general notes`).toBeVisible({ timeout: 60_000 });
    await row.click();
    await expect(schedules.notes, `the notes panel of "${sheet}" stands`).toBeVisible({ timeout: 60_000 });
    if (!(await appears(schedules.transcribe, 5_000))) {
      process.stdout.write(`J-000 golden run: "${sheet}" offers no reading to transcribe — its figures already stand, or it proposes none\n`);
      continue;
    }
    await schedules.transcribe.click();
    await schedules.confirmAct();
  }
}

/**
 * THE CAP ON ONE ACTION OF THE M3 STAGING. The lane sets no action or navigation timeout, so a
 * tab whose main thread stops answering holds a step for the leg's whole budget with nothing
 * named (runs 6 and 7 of session 5: twenty-five minutes on a page that had answered every request
 * in a tenth of a second). A step that takes a minute is a defect with a cause, and the cap makes
 * it red in a minute with the action's own name. An expectation that lawfully waits longer — the
 * measure run's `BNBC_READING_BUDGET_MS` — states its own timeout and is not capped by this.
 */
const M3_ACTION_CAP_MS = 60_000;

/** Every action and navigation of this page from here on is capped; a longer wait states its own. */
function capActions(page: Page): void {
  page.setDefaultTimeout(M3_ACTION_CAP_MS);
  page.setDefaultNavigationTimeout(M3_ACTION_CAP_MS);
}

/** Affirm, transcribe, transcribe: the M3 campaign walked to the point Measure can be pressed. */
async function transcribeBnbc(page: Page, run: BnbcGoldenRun): Promise<void> {
  await goldenWorker();
  capActions(page);
  const { tenantId } = run;
  const { projectId } = run.bnbc;
  await affirmScalesOnEverySheet(page, tenantId, projectId);
  await transcribeStack(page, tenantId, projectId);
  await transcribeNotes(page, tenantId, projectId);
}

/** One press of Measure, watched to its end: the run succeeds and the register counts lines. */
async function pressMeasure(page: Page, tenantId: string, projectId: string): Promise<void> {
  const takeoff = new STakeoffPage(page);
  await takeoff.open(tenantId, projectId);
  // The screen is settled before the door is pressed: a press that lands on a button the screen has
  // not hydrated yet is swallowed, and the run then waits its whole budget for a run nobody started
  // (run 6 of the M3 leg: twenty minutes on two 600 s waits with no job in the queue).
  await settled(page);
  await takeoff.measure.click();
  await expect(takeoff.timeline, "the run is watched where it was started (R-UI-024)").toBeVisible();
  // The tracked timeline holds only the runs THIS screen session started, so a step standing here
  // is the press's own run; a press that started none is red here, in seconds, not at the budget.
  await expect(takeoff.measureStep, "the press started a run this screen follows").toHaveAttribute("data-status", /queued|running|succeeded/, { timeout: 30_000 });
  await expect(takeoff.measureStep, "the measure run finishes").toHaveAttribute("data-status", "succeeded", { timeout: BNBC_READING_BUDGET_MS });
  await expect(takeoff.linesCount, "and the register counts the lines the rails published").not.toHaveText(NO_LINES, { timeout: BNBC_READING_BUDGET_MS });
}

/**
 * Measure: the transcribed M3 campaign walked to a register that counts lines. The first run reads
 * the pinned revision and defers the expansion of every plan whose caption states no typical range
 * (TYPICAL_RANGE_UNSTATED); the levels rail then lists those views — it is the campaign's index,
 * not the drawing's (s-levels I-240) — a person states the ranges the sheets carry, and the
 * campaign is measured again over the storeys they name. Exactly what a customer does.
 */
async function measureBnbc(page: Page, run: BnbcGoldenRun): Promise<void> {
  await goldenWorker();
  capActions(page);
  const { tenantId } = run;
  const { projectId } = run.bnbc;
  await pressMeasure(page, tenantId, projectId);
  const authored = await authorTypicalRanges(page, tenantId, projectId);
  if (authored > 0) await pressMeasure(page, tenantId, projectId);
}
