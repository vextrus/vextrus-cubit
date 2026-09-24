/**
 * The stage J-043 stands on (docs/design/s-ask.md §6).
 *
 * Mechanics only — nothing here judges the product. The register is `stageRegister`'s (B-17: one
 * home): a pinned campaign whose plan draws four columns in production's key shapes (VD-1) — C1, C2
 * and C3 measured into published `rcc.concrete` lines, C4 registered and deferred as
 * INTERPRETED_UNCORROBORATED — so every figure an answer states links to real entities the viewer
 * selects and flies to. What this file adds is what the walk compares the answers with, read back
 * through the register's own reader and the canon's own exact arithmetic, never a constant: the
 * column concrete the register states for the same lines, and the column the stage left without one.
 *
 * `DATABASE_URL` is pointed at the journeys' database by the stage this file builds on, BEFORE any
 * product module here opens a pool — hence the import order below.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { INTERPRETED_MARK, LEVEL_LABEL, RCC_CONCRETE, stageRegister, type StagedRegister } from "./register-stage";

/** The checkout these journeys run against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A product module of the checkout, by repo-relative path (the journey lane's own idiom). */
async function productModule<T>(relative: string): Promise<T> {
  const specifier: string = join(REPO_ROOT, relative);
  return (await import(specifier)) as T;
}

type RegisterUiSeam = {
  registerViewOf: (scope: { tenantId: string; projectId: string }) => Promise<{
    lines: { lineId: string; kind: string; class: string; value: string | null; coverage: string; repudiated: boolean }[];
    objects: { objectKey: string; class: string; mark: string; level: string }[];
  }>;
};

type CanonSeam = { exact: (value: string) => { plus: (other: unknown) => unknown; toFixed: () => string } };

/** What J-043 walks against. */
export type StagedAsk = StagedRegister & {
  /** The mark the walk counts on the ground floor: one the register holds there, measured. */
  countedMark: string;
  /** The level the stage's columns stand on. */
  level: string;
  /** The exact column concrete of the campaign's COMPLETE lines — the register footer's figure. */
  columnConcrete: string;
  /** How many complete lines it was summed from. */
  completeLines: number;
  /** The column registered with no line, which the answer must name as left out. */
  lineless: string;
};

export async function stageAsk(page: Page, options: { label?: string } = {}): Promise<StagedAsk> {
  const staged = await stageRegister(page, { label: options.label ?? "ask" });
  const registerUi = await productModule<RegisterUiSeam>("src/modules/takeoff/register-ui/server.ts");
  const canon = await productModule<CanonSeam>("src/core/units/canon.ts");
  const view = await registerUi.registerViewOf({ tenantId: staged.tenantId, projectId: staged.projectId });

  const complete = view.lines.filter((line) => line.class === "column" && line.kind === RCC_CONCRETE && line.coverage === "COMPLETE" && line.value !== null && !line.repudiated);
  expect(complete.length, `the staged campaign publishes complete column concrete lines to sum: ${JSON.stringify(view.lines)}`).toBeGreaterThan(0);
  const sum = complete.reduce<{ plus: (other: unknown) => unknown; toFixed: () => string }>((held, line) => held.plus(canon.exact(line.value as string)) as never, canon.exact("0"));

  const counted = view.objects.find((object) => object.class === "column" && object.level === LEVEL_LABEL && object.mark !== INTERPRETED_MARK);
  expect(counted, `the register holds a measured column on ${LEVEL_LABEL}: ${JSON.stringify(view.objects)}`).toBeTruthy();
  const marks = view.objects.filter((object) => object.class === "column" && object.level === LEVEL_LABEL && object.mark === counted?.mark);
  expect(marks.length, `exactly one column marked ${String(counted?.mark)} stands on ${LEVEL_LABEL}, so the count the walk reads is 1`).toBe(1);

  return {
    ...staged,
    countedMark: (counted as { mark: string }).mark,
    level: LEVEL_LABEL,
    columnConcrete: sum.toFixed(),
    completeLines: complete.length,
    lineless: INTERPRETED_MARK,
  };
}
