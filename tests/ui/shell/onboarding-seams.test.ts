/**
 * Public acceptance for AC-4's seam and copy halves (R-UI-033).
 *
 * The onboarding SCREEN — shell-empty teaching the next action, the SAMPLE offer as a single
 * visible click target, and the seam's answer rendered at shell-sample-outcome after a real click
 * — is walked in a browser against a freshly signed-up workspace with no projects, and by the
 * journey this increment delivers (tests/e2e/shell.spec.ts, checkpoint j004-shell-onboarding).
 * What a unit lane can judge without a second, weaker mount of the same screen is what this file
 * judges: that the seams the screen is built on exist and answer as declared, and that the offer's
 * words live in the string table.
 *
 * `.ts`, not `.tsx`: tsconfig includes `tests/**\/*.ts`, so `pnpm verify`'s `tsc` reads this file.
 */
import { describe, expect, test } from "vitest";
import { loadStrings, productModule } from "../../server/support/wire";

const WORKSPACE_SEAM = "src/server/shell/workspace.ts";
const SAMPLE_SEAM = "src/server/shell/sample-seed.ts";

/** A button's words, not a paragraph's: the offer is one click target with a label (AC-4). */
const LABEL_MAX = 48;

/** All shell copy lives under `shell_`-prefixed keys (increment interfaces). */
const SHELL_PREFIX = "shell_";

async function shellKeys(): Promise<[string, string][]> {
  const { strings } = await loadStrings();
  return Object.entries(strings).filter(([key]) => key.startsWith(SHELL_PREFIX));
}

describe("AC-4: the shell's server seams are the ones the increment declares", () => {
  test("AC-4: src/server/shell/workspace.ts exports workspaceFor and renameWorkspace", async () => {
    const workspace = await productModule<Record<string, unknown>>(WORKSPACE_SEAM);
    expect(typeof workspace["workspaceFor"], `${WORKSPACE_SEAM} must export workspaceFor — the session's workspace, resolved through the existing db seam (interfaces)`).toBe("function");
    expect(typeof workspace["renameWorkspace"], `${WORKSPACE_SEAM} must export renameWorkspace — the membership-checked write of tenants.name (interfaces)`).toBe("function");
  });

  test("AC-4: src/server/shell/sample-seed.ts exports sampleSeed, and its M0 answer is the declared unavailable one", async () => {
    const seam = await productModule<Record<string, unknown>>(SAMPLE_SEAM);
    expect(typeof seam["sampleSeed"], `${SAMPLE_SEAM} must export sampleSeed (interfaces)`).toBe("function");

    const sampleSeed = seam["sampleSeed"] as (input?: unknown) => unknown;
    let answer: unknown;
    try {
      answer = await sampleSeed();
    } catch (thrown) {
      expect.fail(`sampleSeed() threw (${String(thrown)}) — until the I-003 fixture set ships the shipped answer is { available: false }, never a fault (AC-4)`);
    }

    // SampleSeedAnswer = { seeded: true; goTo: string } | { available: false }, and M0 ships the
    // second arm. The union is asserted, not just the arm, so the seam the Builder writes is the
    // one I-003 can later extend without re-baselining this file.
    const shape = answer as { seeded?: unknown; goTo?: unknown; available?: unknown };
    expect(shape, "sampleSeed answers with a SampleSeedAnswer object").toBeTypeOf("object");
    const seeded = shape.seeded === true && typeof shape.goTo === "string" && shape.goTo.length > 0;
    const unavailable = shape.available === false;
    expect(seeded || unavailable, `sampleSeed must answer { seeded: true, goTo } or { available: false } — it answered ${JSON.stringify(answer)}`).toBe(true);
    expect(unavailable, `the M0 shipped answer is { available: false } (the SAMPLE fixture set arrives with I-003) — it answered ${JSON.stringify(answer)}`).toBe(true);
  });
});

describe("AC-4: the onboarding copy is the string table's", () => {
  test("AC-4: the shell declares its copy under shell_-prefixed keys, every one of them a real string", async () => {
    const keys = await shellKeys();
    expect(keys.length, `the shell's copy lives in the string table under ${SHELL_PREFIX}-prefixed keys (interfaces, R-SPINE-060) — none are declared`).toBeGreaterThan(0);
    for (const [key, value] of keys) {
      expect(typeof value === "string" && value.trim().length > 0, `strings.${key} must be a non-empty string`).toBe(true);
    }
  });

  test("AC-4: the SAMPLE offer's label is declared in the table and carries the word SAMPLE", async () => {
    const labels = (await shellKeys()).filter(([, value]) => value.includes("SAMPLE") && value.trim().length <= LABEL_MAX);
    expect(
      labels.length,
      `AC-4: the SAMPLE offer is a single visible click target whose label includes the word SAMPLE, sourced from the string table — no ${SHELL_PREFIX} key holds a label (${LABEL_MAX} characters or fewer) containing it`,
    ).toBeGreaterThan(0);
  });
});
