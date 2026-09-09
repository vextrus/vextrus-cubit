/**
 * The stage J-021's REGISTER leg walks (test contract: `stageRegister`).
 *
 * Mechanics only — nothing here judges the product. The person, the project, the drawing and its
 * reading come from the stage J-021's own views leg already runs on (`../viewer/viewer-partition-stage`):
 * one invariant, one home (B-17, ARCH-02). What this file adds is what a REGISTER needs beyond a
 * partitioned sheet — a level, a pinned drawing-set revision (which is what opens the campaign), the
 * column sightings the workspace lists, and the second sighting of one identity the register refuses.
 *
 * Every step is a shipped seam, driven in-process under the journey lane's database exactly as the
 * partition stage drives its own: no table is written by hand and no id is invented.
 *
 * `DATABASE_URL` is pointed at the journeys' database by the stage this file builds on, BEFORE any
 * product module here opens a pool — hence the import order below.
 */
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { stagePartitionedSheet } from "../viewer/viewer-partition-stage";

/** The checkout these journeys run against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A product module of the checkout, by repo-relative path (the journey lane's own idiom). */
async function productModule<T>(relative: string): Promise<T> {
  const specifier: string = join(REPO_ROOT, relative);
  return (await import(specifier)) as T;
}

/** The discipline, level, class and marks the register leg reads (AC-1's checkpoint). */
export const DISCIPLINE = "STRUCTURAL";
export const LEVEL_LABEL = "GF";
export const CLASS_COLUMN = "column";
export const MARKS: readonly string[] = ["C1", "C2", "C3"];

/** What the leg is driven against. */
export type StagedRegister = {
  tenantId: string;
  projectId: string;
  campaignId: string;
  setRevisionId: string;
  objectKeys: string[];
};

type ActorCtx = { tenantId: string; userId: string; actorKind: string };

type ActsSeam = {
  preview: (ctx: ActorCtx, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  commit: (ctx: ActorCtx, input: Record<string, unknown>, digest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: Record<string, unknown>) => string;
};

type SetsSeam = {
  drawingLineagesOf: (scope: { tenantId: string; projectId: string }) => Promise<{ drawingId: string; name: string }[]>;
  createSet: (scope: { tenantId: string; projectId: string }, by: { userId: string }, name: string) => Promise<Record<string, unknown>>;
  toggleMember: (scope: { tenantId: string; projectId: string }, setId: string, drawingId: string) => Promise<Record<string, unknown>>;
};

type RegisterSeam = {
  registerSighting: (scope: { tenantId: string; projectId: string; setRevisionId: string }, sighting: Record<string, unknown>) => Promise<Record<string, unknown>>;
  registerObjectsOf: (scope: { tenantId: string; projectId: string; setRevisionId: string }) => Promise<Record<string, unknown>[]>;
};

type CampaignsSeam = { campaignsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> };

/** The user the browser is signed in as, read from the session the partition stage established. */
async function userIdOf(page: Page): Promise<string> {
  const held = await page.evaluate(() => document.querySelector('[data-testid="shell-user"]')?.getAttribute("data-user-id") ?? null);
  expect(held, "the shell states which account is signed in — the actor every act below is performed by").toBeTruthy();
  return held as string;
}

/** One column sighting, as the register's door is given one (the door's own `Sighting`). */
function sightingOf(mark: string, at: number, levelId: string): Record<string, unknown> {
  return {
    discipline: DISCIPLINE,
    elementType: CLASS_COLUMN,
    mark,
    view: { viewClass: "PLAN", captionAnchorSourceKey: "S-101:t:12" },
    x: 1000 + at * 100,
    y: 250,
    level: { levelId },
    standing: "MEASURED",
    content: {
      evidence: ["S-101:e:41"],
      attributes: { concrete_grade: "C30/37" },
      geometry: { outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], span: { length: "300.0", breadth: "300.0" } },
      source: { sheet: "S-101", anchor: "S-101:t:12" },
    },
  };
}

/**
 * A project whose register holds three column objects on one level of a pinned revision, with one
 * sighting refused as a double count — the shape J-021's register leg reads.
 */
export async function stageRegister(page: Page, options: { label?: string } = {}): Promise<StagedRegister> {
  const label = options.label ?? "register";
  const sheet = await stagePartitionedSheet(page, { label });
  const userId = await userIdOf(page);
  const actor: ActorCtx = { tenantId: sheet.tenantId, userId, actorKind: "human" };
  const scope = { tenantId: sheet.tenantId, projectId: sheet.projectId };

  const acts = await productModule<ActsSeam>("src/core/acts/index.ts");
  const perform = async (input: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const consequence = await acts.preview(actor, input);
    return acts.commit(actor, input, acts.consequenceDigest(consequence));
  };

  /* --- the level the sightings stand on --- */
  await perform({ type: "INSERT_LEVEL", projectId: sheet.projectId, levels: [{ label: LEVEL_LABEL, ordinal: 0 }] });
  const levels = await productModule<{ levelsOf?: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> }>("src/modules/takeoff/levels/index.ts");
  const stack = levels.levelsOf === undefined ? [] : await levels.levelsOf(scope);
  const ground = stack.find((level) => String(level["label"]) === LEVEL_LABEL);
  expect(ground, `the level ${LEVEL_LABEL} stands on the staged project: ${JSON.stringify(stack)}`).toBeTruthy();
  const levelId = String((ground as Record<string, unknown>)["levelId"]);

  /* --- the pinned revision, which is what opens the campaign (L-REG-07) --- */
  const sets = await productModule<SetsSeam>("src/modules/takeoff/sets/index.ts");
  const created = await sets.createSet(scope, { userId }, `${label}-set-${randomUUID().slice(0, 8)}`);
  const setId = String(created["setId"]);
  await sets.toggleMember(scope, setId, sheet.drawingId);
  await perform({ type: "PIN_DRAWING_SET", projectId: sheet.projectId, setId });

  const campaigns = await productModule<CampaignsSeam>("src/core/campaigns/index.ts");
  const open = await campaigns.campaignsOf(scope);
  expect(open.length, `pinning the set opened a campaign: ${JSON.stringify(open)}`).toBeGreaterThan(0);
  const campaign = open[open.length - 1] as Record<string, unknown>;
  const campaignId = String(campaign["campaignId"]);
  const setRevisionId = String(campaign["setRevisionId"]);

  /* --- the objects, and the second sighting of one identity the register refuses --- */
  const register = await productModule<RegisterSeam>("src/modules/takeoff/register/index.ts");
  const registerScope = { tenantId: sheet.tenantId, projectId: sheet.projectId, setRevisionId };
  const sightings = MARKS.map((mark, at) => sightingOf(mark, at, levelId));
  for (const sighting of sightings) {
    const answer = await register.registerSighting(registerScope, sighting);
    expect(answer["registered"], `the sighting of ${String(sighting["mark"])} registered: ${JSON.stringify(answer)}`).toBe(true);
  }
  const twice = await register.registerSighting(registerScope, sightings[0] as Record<string, unknown>);
  expect(twice["registered"], `a second sighting of one identity is refused: ${JSON.stringify(twice)}`).toBe(false);

  const rows = await register.registerObjectsOf(registerScope);
  return { tenantId: sheet.tenantId, projectId: sheet.projectId, campaignId, setRevisionId, objectKeys: rows.map((row) => String(row["objectKey"])) };
}
