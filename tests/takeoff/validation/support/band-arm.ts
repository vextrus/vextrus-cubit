/**
 * One arm of the band lane, staged, measured, graded and recorded (AC-1, AC-2) — the mechanics both
 * fixtures' arms share, so each arm's cases state only what is its own. Nothing here reads product
 * source, and nothing here decides a verdict: `gradeCell` does, and this file hands it the register's
 * own figures beside the golden's.
 *
 * The three bindings that make a band arm a claim about the PRODUCT rather than about the stage live
 * here: `sums` is reconciled against the published register itself, the kinds the register ran are
 * reconciled against `RAILS`, and every graded cell is recorded in the ledger and read back out of it.
 * Each is scoped to the campaigns THIS arm opened, so two arms may share one scratch database.
 */
import { expect } from "vitest";
import { goldenDocument } from "../../../golden/support/golden-fixture";
import { bandStage, canon, cellKey, productModule, type BandStage, type CellLevel } from "./band-acceptance";
import { campaignIds, campaignScope, cellCitations, editionCitation, publishedKinds, registerGroups } from "./register-read";
import { VECTOR, validationDoor, validationLaw, type GradedLevel, type Scope } from "./validation-acceptance";

/** The verdicts the grader answers with. */
export const PASS = "PASS";
export const OVER = "OVER";

/** The rails roster: what the product answers, keyed by kind (AM-11, L-MEA-08). */
const RAILS_MODULE = "src/modules/takeoff/rails/index.ts";

/** The fixture whose arm is staged through the cad-CLI ingest rather than by transcription (AM-01). */
export const INGESTED_FIXTURE = "rcc6";

/** What `measureBand` answers (interfaces): the register's sums per 'class|kind|level', and the gaps. */
export type MeasuredBand = { sums: Map<string, string>; ungradable?: readonly unknown[] };

/** One arm: the band support, what it staged, the measure it took, and the campaigns it opened. */
export type StagedArm = { band: BandStage; staged: unknown; measured: MeasuredBand; campaigns: string[] };

/** One level of one cell, as the grader is handed it. */
export type LevelReading = { level: string; golden: string; measured: string };

/** A cell graded: the verdict of the cell, and of each level under it. */
export type GradedCell = { verdict: string; levels: readonly GradedLevel[] };

const arms = new Map<string, Promise<StagedArm>>();

/**
 * Stage one fixture's arm and measure it, once. Lazy rather than a hook: a module this increment has
 * not landed yet must fail the CASE that wanted it, by name — a throwing hook leaves every case
 * skipped, and judges nothing.
 */
export function stagedArm(fixtureId: string): Promise<StagedArm> {
  const held = arms.get(fixtureId);
  if (held !== undefined) return held;
  const opening = (async (): Promise<StagedArm> => {
    const band = await bandStage();
    const before = new Set(campaignIds());
    const staged = fixtureId === INGESTED_FIXTURE ? await band.stageRcc6Band() : await band.stageBnbcBand();
    const measured = (await band.measureBand(staged)) as MeasuredBand;
    expect(measured.sums instanceof Map, `measureBand over ${fixtureId} answers \`sums\` keyed 'class|kind|level' (interfaces)`).toBe(true);
    const campaigns = campaignIds().filter((id) => !before.has(id));
    expect(campaigns.length, `staging the ${fixtureId} arm opened at least one campaign — a campaign is what a batch is handed to the gate for (AC-1)`).toBeGreaterThan(0);
    return { band, staged, measured, campaigns };
  })();
  arms.set(fixtureId, opening);
  return opening;
}

/** The golden's own cells for a fixture, as the band lane reads them. */
export async function goldenCells(fixtureId: string): Promise<Map<string, readonly CellLevel[]>> {
  const { band } = await stagedArm(fixtureId);
  return band.goldenCellsOf(fixtureId);
}

/**
 * Every cell of the fixture's golden with at least one gradable level, graded by the product's own
 * `gradeCell` over the register's figures and the golden's.
 */
export async function gradedCells(fixtureId: string): Promise<{ readings: Map<string, LevelReading[]>; verdicts: Map<string, GradedCell> }> {
  const [{ measured }, cells, law] = await Promise.all([stagedArm(fixtureId), goldenCells(fixtureId), validationLaw()]);
  const readings = new Map<string, LevelReading[]>();
  const verdicts = new Map<string, GradedCell>();
  for (const [cell, levels] of cells) {
    const gradable: LevelReading[] = [];
    for (const level of levels) {
      const sum = measured.sums.get(`${cell}|${level.level}`);
      if (sum !== undefined) gradable.push({ level: level.level, golden: level.golden, measured: sum });
    }
    if (gradable.length === 0) continue;
    readings.set(cell, gradable);
    verdicts.set(cell, law.gradeCell(gradable));
  }
  return { readings, verdicts };
}

/** Every level of every cell that measured OVER its golden, named as a band suite must name one. */
export function overLevels(verdicts: Map<string, GradedCell>): string[] {
  const found: string[] = [];
  for (const [cell, graded] of verdicts) {
    for (const level of graded.levels) if (level.verdict === OVER) found.push(`OVER ${cell.replace("|", " ")} ${level.level}`);
  }
  return found.sort();
}

/**
 * `sums` IS the register's own sums — not a selection of them.
 *
 * Asked group by group against `quantity_lines`: the same number of (cell, level) groups, the same
 * cells, and per cell the same multiset of figures. A band that measured every kind and then dropped
 * the levels that embarrassed it — or that answered a figure no published line adds up to — fails here,
 * and it fails without this acceptance re-deriving what a level is called (L-QTY-06: ground truth is
 * row sums, never printed totals).
 */
export async function reconcileWithRegister(fixtureId: string): Promise<void> {
  const [{ measured, campaigns }, { exact }] = await Promise.all([stagedArm(fixtureId), canon()]);
  const groups = registerGroups(campaigns);
  expect(groups.length, `the gate published COMPLETE lines over the ${fixtureId} arm — a band over an empty register grades nothing (L-QTY-06)`).toBeGreaterThan(0);

  expect(
    measured.sums.size,
    `\`sums\` holds one figure per (class, kind, level) group this arm's campaigns published a COMPLETE line for — the register holds ${groups.length} such groups and the band answered ${measured.sums.size}: a band that drops a group it measured answers FOR the register instead of reading it (L-QTY-06)`,
  ).toBe(groups.length);

  const fromRegister = new Map<string, string[]>();
  for (const group of groups) fromRegister.set(group.cell, [...(fromRegister.get(group.cell) ?? []), group.total]);
  const fromBand = new Map<string, string[]>();
  for (const [key, figure] of measured.sums) {
    const parts = key.split("|");
    const cell = `${parts[0] ?? ""}|${parts[1] ?? ""}`;
    fromBand.set(cell, [...(fromBand.get(cell) ?? []), figure]);
  }

  expect([...fromBand.keys()].sort(), `and it answers for exactly the cells this arm's register published COMPLETE lines for (${fixtureId})`).toEqual([...fromRegister.keys()].sort());
  const normalised = (figures: readonly string[]): string[] => figures.map((figure) => exact(figure).toString()).sort();
  for (const [cell, figures] of fromRegister) {
    expect(
      normalised(fromBand.get(cell) ?? []),
      `${cell}: the band's per-level figures are the register's own exact sums (${fixtureId}) — a figure the published lines do not add up to is a figure nobody can audit (L-QTY-03, L-QTY-06)`,
    ).toEqual(normalised(figures));
  }
}

/**
 * Every kind the fixture's golden bears that `RAILS` answers was RUN, and every level of such a cell is
 * accounted for: graded, or named in `ungradable`.
 *
 * "Runs every kind RAILS answers" is the difference between a band and a band over one kind, and silence
 * is how a band loses a kind: a cell nobody measured and nobody declared ungradable reads exactly like a
 * cell that passed (which is L-QTY-07's own reason for a coverage statement).
 */
export async function reconcileKindsRun(fixtureId: string): Promise<void> {
  const [{ measured, campaigns }, cells] = await Promise.all([stagedArm(fixtureId), goldenCells(fixtureId)]);
  const rails = await productModule<{ RAILS?: Readonly<Record<string, unknown>> }>("src/modules/takeoff/rails/index.ts");
  const answered = new Set(Object.keys(rails.RAILS ?? {}));
  expect(answered.size, `${RAILS_MODULE} publishes \`RAILS\` keyed by the kinds it answers (AM-11)`).toBeGreaterThan(0);

  const published = publishedKinds(campaigns);
  const owed = [...new Set([...cells.keys()].map((cell) => cell.split("|")[1] ?? ""))].filter((kind) => answered.has(kind)).sort();
  expect(owed.length, `${fixtureId}'s golden bears kinds \`RAILS\` answers — a band with nothing to run proves nothing (AC-1)`).toBeGreaterThan(0);
  expect(
    owed.filter((kind) => !published.has(kind)),
    `every kind of ${fixtureId}'s golden that \`RAILS\` answers was RUN over this arm — these were not, so its register holds no line of them at all (AC-1: "runs every kind RAILS answers"). It published: ${JSON.stringify([...published].sort())}`,
  ).toEqual([]);

  const declared = (measured.ungradable ?? []).map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)));
  const unaccounted: string[] = [];
  for (const [cell, levels] of cells) {
    const [elementClass, kind] = cell.split("|");
    if (!answered.has(kind ?? "")) continue;
    for (const level of levels) {
      if (measured.sums.has(`${cell}|${level.level}`)) continue;
      const named = declared.some((entry) => entry.includes(elementClass ?? "") && entry.includes(kind ?? "") && entry.includes(level.level));
      if (!named) unaccounted.push(`${cell}|${level.level}`);
    }
  }
  expect(
    unaccounted,
    `every level of a cell whose kind was run is either graded or listed in \`ungradable\` naming it — these are in neither, and a level nobody measured and nobody declared reads exactly like one that passed (AC-1, L-QTY-07). \`ungradable\` said: ${JSON.stringify(declared)}`,
  ).toEqual([]);
}

/**
 * Every graded cell is RECORDED, and the ledger says what the grader said.
 *
 * One observation per cell, keyed (engine, class, kind), citing the edition digest the cell's own lines
 * were published under, the hash of the methods that produced it, the converter that read the drawing
 * and the provenance the golden document states — read back through `observationsOf`, which is where the
 * M3 exit and L-QTY-07's certificate will read it (R-TO-035).
 */
export async function recordAndReadBack(fixtureId: string): Promise<{ scope: Scope; rows: readonly Record<string, unknown>[]; verdicts: Map<string, GradedCell> }> {
  const [{ band, staged, campaigns }, { verdicts }, door, law] = await Promise.all([stagedArm(fixtureId), gradedCells(fixtureId), validationDoor(), validationLaw()]);
  expect(verdicts.size, `${fixtureId}'s arm graded at least one cell — an arm that graded nothing records nothing (AC-1)`).toBeGreaterThan(0);

  const scope = campaignScope(campaigns);
  const citations = cellCitations(campaigns);
  const edition = editionCitation(campaigns);
  const converterVersion = band.converterVersionOf(staged);
  const provenance = goldenDocument(fixtureId).provenance ?? "HAND_FROM_AUTHORED_SOURCE";

  for (const [cell, graded] of verdicts) {
    const [elementClass, kind] = cell.split("|");
    const cited = citations.get(cell);
    expect(cited, `${cell} was published by lines citing a rule and an edition — a cell with no citation cannot be recorded (L-QTY-03)`).toBeTruthy();
    await door.recordObservation(scope, {
      engine: VECTOR,
      class: elementClass ?? "",
      kind: kind ?? "",
      fixtureId,
      verdict: graded.verdict,
      rulesetEdition: edition,
      editionDigest: cited?.editionDigest ?? "",
      methodHash: law.methodHashOf(cited?.rulePairs ?? []),
      converterVersion,
      provenance,
      levels: graded.levels,
    });
  }

  const rows = await door.observationsOf(scope);
  const keyed = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = `${String(row["engine"] ?? "")}|${cellKey(String(row["class"] ?? ""), String(row["kind"] ?? ""))}`;
    keyed.set(key, [...(keyed.get(key) ?? []), row]);
  }
  for (const [cell, graded] of verdicts) {
    const held = keyed.get(`${VECTOR}|${cell}`) ?? [];
    expect(
      held.length,
      `the ledger holds EXACTLY ONE observation of (${VECTOR}, ${cell.replace("|", ", ")}) for this arm — one graded cell is one observation (AC-1); it holds ${held.length}`,
    ).toBe(1);
    expect(String(held[0]?.["verdict"] ?? ""), `and its verdict is the one the grader answered for ${cell} — a ledger that records something else records nothing (R-TO-035)`).toBe(graded.verdict);
  }
  expect(
    [...keyed.keys()].sort(),
    `and it holds an observation for every graded cell and for nothing else — the ledger is the band's record, not a selection from it (AC-1)`,
  ).toEqual([...verdicts.keys()].map((cell) => `${VECTOR}|${cell}`).sort());
  return { scope, rows, verdicts };
}
