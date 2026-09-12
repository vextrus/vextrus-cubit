/**
 * The stage S-Coverage's journeys stand on (inc-216-coverage-grid: R-TO-052, L-QTY-05, J-022).
 *
 * Mechanics only — nothing here judges the product. A measured campaign is `stageRegister`'s, whole
 * and unchanged (B-17: one home for the register's stage); what this file adds is the one thing a
 * COVERAGE journey needs beyond it — a class sighted on a level nothing published a line for, so the
 * residue bears an unmeasured cell beside its measured one.
 *
 * Why that is needed rather than another kind: the catalogue as it stands bears exactly one
 * (class, kind) pair, `column` × `rcc.concrete` (`src/core/catalogue/bears.ts`), and this increment
 * seeds none — so the only way a campaign can hold an unmeasured borne cell is a LEVEL it sighted
 * and did not measure. The cell is read back off the product's own residue rather than assumed, so a
 * catalogue that grows a bears row simply gives the journeys more to choose from.
 *
 * The Builder may edit this file (test contract).
 */
import { expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { CLASS_COLUMN, DISCIPLINE, RCC_CONCRETE, stageRegister, type StagedRegister } from "./register-stage";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/** Import a product module by repo-relative path, asserting it exists first. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const specifier: string = join(REPO_ROOT, relative);
  return (await import(specifier)) as T;
}

/** The level the staged register measured on, and the one it sighted and left unmeasured. */
export const MEASURED_LEVEL = "GF";
export const UNMEASURED_LEVEL = "L1";

/** The mark the unmeasured level's column is sighted under — no sibling of the measured level's. */
export const UNMEASURED_MARK = "C9";

/** The cell the coverage journeys act over, and the class and kind it stands on. */
export type CoverageCellRef = { kind: string; class: string; levelId: string };

export type StagedCoverage = StagedRegister & {
  /** The level whose cells were sighted and never measured. */
  unmeasuredLevelId: string;
  /** The cell J-022 holds out of the bill: borne, sighted and bearing no published line. */
  unmeasured: CoverageCellRef;
  /** The cell the campaign measured — the one whose doors are absent (I-194). */
  measured: CoverageCellRef;
};

type ActsSeam = {
  preview: (ctx: { tenantId: string; userId: string; actorKind: string }, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  commit: (ctx: { tenantId: string; userId: string; actorKind: string }, input: Record<string, unknown>, digest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: Record<string, unknown>) => string;
};

type LevelsSeam = { levelsOf?: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> };

type RegisterSeam = {
  registerSighting: (scope: { tenantId: string; projectId: string; setRevisionId: string }, sighting: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

/** The signed-in person, as the shell states them — the same read `stageRegister` makes. */
async function userIdOf(page: Page): Promise<string> {
  const userId = await page.locator(testIdSelector(TESTIDS.shell.user)).getAttribute("data-user-id");
  expect(userId, "the journey is signed in, so the shell names the person acting").toBeTruthy();
  return userId as string;
}

/** One column sighting on the unmeasured level, shaped as the register's own door takes one. */
function sightingOn(levelId: string): Record<string, unknown> {
  return {
    discipline: DISCIPLINE,
    elementType: CLASS_COLUMN,
    mark: UNMEASURED_MARK,
    view: { viewClass: "PLAN", captionAnchorSourceKey: "S-101:t:12" },
    x: 2000,
    y: 250,
    level: { levelId },
    standing: "MEASURED",
    content: {
      evidence: ["S-101:e:91"],
      attributes: { concrete_grade: "C30/37" },
      geometry: { outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], span: { length: "300.0", breadth: "300.0" } },
      source: { sheet: "S-101", anchor: "S-101:t:12" },
    },
  };
}

/**
 * A measured campaign whose residue bears both readings: the measured cell the register published,
 * and one cell sighted on a second level that no rail was ever run over.
 */
export async function stageCoverage(page: Page, options: { label?: string } = {}): Promise<StagedCoverage> {
  const label = options.label ?? "coverage";
  const staged = await stageRegister(page, { label });
  const scope = { tenantId: staged.tenantId, projectId: staged.projectId };
  const actor = { tenantId: staged.tenantId, userId: await userIdOf(page), actorKind: "human" };

  /* --- a second level, authored by the act that authors levels --- */
  const acts = await productModule<ActsSeam>("src/core/acts/index.ts");
  const insertion = { type: "INSERT_LEVEL", projectId: staged.projectId, levels: [{ label: UNMEASURED_LEVEL, ordinal: 1 }] };
  const consequence = await acts.preview(actor, insertion);
  await acts.commit(actor, insertion, acts.consequenceDigest(consequence));

  const levels = await productModule<LevelsSeam>("src/modules/takeoff/levels/index.ts");
  const stack = levels.levelsOf === undefined ? [] : await levels.levelsOf(scope);
  const authored = stack.find((level) => String(level["label"]) === UNMEASURED_LEVEL);
  expect(authored, `the level ${UNMEASURED_LEVEL} stands on the staged project: ${JSON.stringify(stack)}`).toBeTruthy();
  const unmeasuredLevelId = String((authored as Record<string, unknown>)["levelId"]);

  const ground = stack.find((level) => String(level["label"]) === MEASURED_LEVEL);
  expect(ground, `and the measured level ${MEASURED_LEVEL} stands beside it`).toBeTruthy();
  const measuredLevelId = String((ground as Record<string, unknown>)["levelId"]);

  /* --- one column sighted there, and no rail run over it: sighted, and never measured --- */
  const register = await productModule<RegisterSeam>("src/modules/takeoff/register/index.ts");
  const answer = await register.registerSighting({ ...scope, setRevisionId: staged.setRevisionId }, sightingOn(unmeasuredLevelId));
  expect(answer["registered"], `the sighting of ${UNMEASURED_MARK} on ${UNMEASURED_LEVEL} registered: ${JSON.stringify(answer)}`).toBe(true);

  return {
    ...staged,
    unmeasuredLevelId,
    unmeasured: { kind: RCC_CONCRETE, class: CLASS_COLUMN, levelId: unmeasuredLevelId },
    measured: { kind: RCC_CONCRETE, class: CLASS_COLUMN, levelId: measuredLevelId },
  };
}
