/**
 * AC-1 — the one home for the environment the product reads (`src/core/env.ts`).
 *
 * Everything is driven through the three names the test contract publishes — `ENV_NAMES`,
 * `ENV_DECLARATION` and `validateEnv` — and the verdicts AC-1 spells out. The declaration is read
 * as the product's own answer for which tier needs what: the per-entry assertions below are about
 * the SHAPE of an entry, and the four verdicts are the behaviour AC-1 fixes, so an increment that
 * later declares an eighth name or moves a name between tiers is judged by this suite rather than
 * reddened by it — except for the roster itself, which AC-1 pins to exactly seven.
 */
import { describe, expect, test } from "vitest";
import { envModule, requiredBy, ruleFor, type EnvEntry, type Tier } from "./support/env-stage";

/** The seven names AC-1 names, as a set. The order they are declared in is the product's business. */
const THE_SEVEN: readonly string[] = ["DATABASE_URL", "STORAGE_ROOT", "CUBIT_PUBLIC_ORIGIN", "WORKER_HEALTH_PORT", "CUBIT_MODEL_FIXTURE_ROOT", "CUBIT_STORAGE_SIGNING_SECRET", "CUBIT_CAD_COMMAND"];

/** The tiers the declaration may speak of (C-05). */
const TIERS: readonly Tier[] = ["web", "worker"];

/** A well-formed database URL, as AC-1 spells it — no database is opened by any case here. */
const A_DATABASE_URL = "postgres://u@h/db";

function sorted(names: readonly string[]): string[] {
  return [...names].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

describe("AC-1 — the declaration", () => {
  test("AC-1: ENV_NAMES is the frozen roster of exactly the seven names the tiers read", async () => {
    const { ENV_NAMES } = await envModule();
    expect(sorted(ENV_NAMES)).toEqual(sorted(THE_SEVEN));
    expect(Object.isFrozen(ENV_NAMES), "ENV_NAMES is the product's roster: a caller must not be able to extend it").toBe(true);
  });

  test("AC-1: ENV_DECLARATION carries one entry per declared name, each with a zod shape, the tiers that require it and its outside-dev flag", async () => {
    const { ENV_NAMES, ENV_DECLARATION } = await envModule();
    expect(sorted(ENV_DECLARATION.map((entry: EnvEntry) => entry.name))).toEqual(sorted(ENV_NAMES));
    for (const entry of ENV_DECLARATION) {
      expect(typeof entry.shape?.safeParse, `${entry.name} declares no zod shape`).toBe("function");
      expect(Array.isArray(entry.requiredBy), `${entry.name} declares no requiredBy list`).toBe(true);
      for (const tier of entry.requiredBy) expect(TIERS, `${entry.name} is required by a tier that does not exist`).toContain(tier);
      expect(typeof entry.requiredOutsideDev, `${entry.name} declares no requiredOutsideDev flag`).toBe("boolean");
    }
  });

  test("AC-1: every declared shape carries that name's own rule — it admits what the rule admits and refuses what the rule forbids", async () => {
    const { ENV_DECLARATION } = await envModule();
    for (const entry of ENV_DECLARATION) {
      const { accepted, refused } = ruleFor(entry.name);
      expect(accepted.length + refused.length, `${entry.name}'s shape would be judged by no value at all`).toBeGreaterThan(0);
      for (const value of accepted) {
        expect(entry.shape.safeParse(value).success, `${entry.name}'s shape refused ${JSON.stringify(value)}, which its declared rule admits`).toBe(true);
      }
      for (const value of refused) {
        expect(entry.shape.safeParse(value).success, `${entry.name}'s shape admitted ${JSON.stringify(value)}, which its declared rule forbids`).toBe(false);
      }
    }
  });
});

describe("AC-1 — validateEnv answers a verdict and never throws", () => {
  test("AC-1: a complete worker environment is accepted, WORKER_HEALTH_PORT coerced from its string to a number", async () => {
    const { validateEnv } = await envModule();
    const verdict = validateEnv("worker", { DATABASE_URL: A_DATABASE_URL, WORKER_HEALTH_PORT: "0" });
    expect(verdict).toMatchObject({ ok: true });
    if (!verdict.ok) return;
    expect(verdict.env["WORKER_HEALTH_PORT"]).toBe(0);
  });

  test("AC-1: the web tier is accepted without WORKER_HEALTH_PORT — the health port is the worker's alone", async () => {
    const { ENV_DECLARATION, validateEnv } = await envModule();
    expect(requiredBy(ENV_DECLARATION, "web"), "the web tier is declared to need the worker's health port").not.toContain("WORKER_HEALTH_PORT");
    expect(validateEnv("web", { DATABASE_URL: A_DATABASE_URL })).toMatchObject({ ok: true });
  });

  test("AC-1: a blank required value reads as absent, not as malformed", async () => {
    const { validateEnv } = await envModule();
    expect(validateEnv("worker", { DATABASE_URL: "   ", WORKER_HEALTH_PORT: "3300" })).toMatchObject({ ok: false, missing: ["DATABASE_URL"], invalid: [] });
  });

  test("AC-1: a malformed value is invalid, not missing", async () => {
    const { validateEnv } = await envModule();
    expect(validateEnv("worker", { DATABASE_URL: A_DATABASE_URL, WORKER_HEALTH_PORT: "http" })).toMatchObject({ ok: false, missing: [], invalid: ["WORKER_HEALTH_PORT"] });
  });

  test("AC-1: an empty environment is answered, not thrown at — every name that tier requires comes back missing", async () => {
    const { ENV_DECLARATION, validateEnv } = await envModule();
    const verdict = validateEnv("worker", {});
    expect(verdict).toMatchObject({ ok: false });
    if (verdict.ok) return;
    expect(sorted(verdict.missing)).toEqual(sorted(requiredBy(ENV_DECLARATION, "worker")));
    expect(verdict.invalid).toEqual([]);
  });
});
