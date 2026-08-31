/**
 * AC-4, in the part a journey run cannot report about itself: that the two new journey specs are
 * COLLECTED by the invocations the criterion names, that every checkpoint the increment fixes is
 * really taken, and that each one's Linux baseline is committed under the shipped
 * `snapshotPathTemplate` (B-20 — this node mints them, so this node owes them).
 *
 * The journeys themselves are graded by running them (`pnpm e2e --journey J-001` and `--journey
 * J-002`); nothing here re-drives a browser, which would be a second opinion about a lane that
 * already has one (ARCH-02). What is asked here is the part the run is silent about: a checkpoint
 * that was never written takes no shot and reds nothing, and a baseline that was never committed
 * makes the next run mint it instead of comparing against it.
 *
 * The route to a baseline is read out of the shipped playwright config rather than spelled here, so
 * a later change to `snapshotPathTemplate` moves this assertion with it (B-19).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { inRepo, requireModule } from "./support/invitations-contract";

/** The two journeys this increment adds, with the grep each is collected by and its shot directory. */
const JOURNEYS = [
  {
    id: "J-001",
    spec: "tests/e2e/journeys/j-001-auth.spec.ts",
    shots: "j-001-auth",
    checkpoints: ["invite-pending", "accept", "switched"],
    /** The half of J-001 that already ships: the same grep must still collect it (AC-4). */
    alongside: "tests/e2e/journeys/j-001a-auth-core.spec.ts",
  },
  {
    id: "J-002",
    spec: "tests/e2e/journeys/j-002-tenant-admin.spec.ts",
    shots: "j-002-tenant-admin",
    checkpoints: ["panel", "remove-refused"],
    alongside: null,
  },
] as const;

/** Where a shot lands, as the shipped config states it — read, never assumed. */
function baselinePath(directory: string, checkpoint: string): string {
  const config = readFileSync(inRepo("playwright.config.ts"), "utf8");
  const template = /snapshotPathTemplate:\s*["']([^"']+)["']/.exec(config)?.[1];
  expect(template, "the shipped playwright config states where a baseline lands").toBeDefined();
  return (template ?? "").replace("{arg}", `${directory}/${checkpoint}`).replace("{ext}", ".png");
}

describe("AC-4: the journeys are collected, checkpointed and baselined", () => {
  for (const journey of JOURNEYS) {
    test(`AC-4: ${journey.id}'s spec is collected by the grep the runner uses, and drives its checkpoints`, () => {
      const text = readFileSync(requireModule(journey.spec), "utf8");

      // `scripts/e2e.mjs` greps the describe title, so the title is what decides collection.
      const titles = [...text.matchAll(/describe\s*(?:\.\w+)?\s*\(\s*(["'`])([\s\S]*?)\1/g)].map((match) => match[2] ?? "");
      expect(titles.length, `${journey.spec} declares a describe block`).toBeGreaterThan(0);
      expect(
        titles.some((title) => title.includes(journey.id)),
        `${journey.spec}'s describe title carries "${journey.id}" — the runner greps the title, and a spec it does not collect is a segment that is green by omission (AC-4)`,
      ).toBe(true);

      if (journey.alongside !== null) {
        const together = [...readFileSync(inRepo(journey.alongside), "utf8").matchAll(/describe\s*(?:\.\w+)?\s*\(\s*(["'`])([\s\S]*?)\1/g)].map((match) => match[2] ?? "");
        expect(
          together.some((title) => title.includes(journey.id)),
          `${journey.alongside} is still collected by the same grep — ${journey.id}'s auth-and-sessions half runs in the same invocation (AC-4)`,
        ).toBe(true);
      }

      for (const checkpoint of journey.checkpoints) {
        expect(
          text.includes(`"${checkpoint}"`) || text.includes(`'${checkpoint}'`) || text.includes(`\`${checkpoint}\``),
          `${journey.spec} takes the checkpoint "${checkpoint}" the increment names — a checkpoint nobody takes runs no axe pass and compares no shot (V-E2E, Q-11)`,
        ).toBe(true);
      }
    });

    test(`AC-4: ${journey.id}'s baselines are committed where the shipped template puts them`, () => {
      for (const checkpoint of journey.checkpoints) {
        const path = baselinePath(journey.shots, checkpoint);
        const absolute = inRepo(path);
        expect(existsSync(absolute), `${path} is committed — this node mints both journeys' baselines (B-20), and an absent one is minted by the next run instead of compared against`).toBe(true);
        expect(statSync(absolute).size, `${path} is a real screenshot, not an empty placeholder`).toBeGreaterThan(1000);
      }
    });
  }
});
