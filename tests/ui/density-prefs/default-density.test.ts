/**
 * THE GRID LAW'S DEFAULT (R-UI-083, AM-08; Design Direction 00 §4.2 "compact is the default").
 *
 * A person who never chose a density is shown the compact 28 px row. The seam's default, the store's
 * column default and the shell's own fallback are ONE value (B-17), and it is `compact`. Until
 * 2026-09-21 all three read `comfortable`, citing R-UI-005 — which names the two modes and a
 * user-reachable control, and no default — so every new account met 36 px rows against the grid law
 * (found by the session-3 probe on J-000's register, walked on an account the run had just made).
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { userPrefs } from "../../../src/core/db/schema-prefs";
import { DEFAULT_DENSITY, DENSITIES, isDensity } from "../../../src/core/prefs/density";

const at = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("the default density is the compact row the grid law names", () => {
  test("the seam's default is compact, and a mode the roster holds", () => {
    expect(DEFAULT_DENSITY).toBe("compact");
    expect(isDensity(DEFAULT_DENSITY)).toBe(true);
    expect(DENSITIES).toContain(DEFAULT_DENSITY);
  });

  test("the store's column default is the seam's, and the migration that moved it stands on the chain (history is append-only)", () => {
    expect(userPrefs.density.default).toBe(DEFAULT_DENSITY);
    expect(at("db/migrations/0053_density-default-compact.sql")).toContain(`ALTER TABLE "user_prefs" ALTER COLUMN "density" SET DEFAULT 'compact';`);
    // The first migration is left as it was written: a landed migration is superseded, never edited.
    expect(at("db/migrations/0007_user-prefs.sql")).toContain(`"density" text DEFAULT 'comfortable' NOT NULL`);
  });

  test("the shell's fallback mirrors the seam's default byte for byte — ARCH-01 bars the value import, so the pin is here (B-17)", () => {
    const shell = at("src/ui/shell/app-shell.tsx");
    expect(shell).toContain(`density = "${DEFAULT_DENSITY}",`);
    expect(shell).not.toContain(`density = "comfortable"`);
  });
});
