/**
 * The re-baseline proof for tests/e2e/baselines/design/j-003/ruleset-pin-visible.png (B-20).
 *
 * The arbitration on tests/e2e/journeys/j-003-projects.spec.ts:122 amended that checkpoint to carry
 * V-E2E's per-journey masks, and a mask paints over the capture only — the committed baseline had to
 * be re-taken through the masks or the comparison would be reading pink against pixels. B-20 puts
 * the whole proof of such a re-baseline on the branch that performs it, and that proof has two
 * halves. The second half — that the new bytes PICTURE the screen that stands — is V-E2E's own
 * instrument and already runs in the journey: the masked `toHaveScreenshot` at the checkpoint
 * compares this very file against the served page. This file is the first half, and states one
 * thing and no more: the bytes are not the bytes the branch started from, so the regeneration was
 * not skipped and the image is not stale.
 *
 * The pin is a negative, so a later increment that lawfully re-baselines this image again still
 * passes; only a branch that ships the masked checkpoint while leaving its baseline untouched fails.
 * It lives here because tests/e2e/journeys/j-003-projects.spec.ts is the Verifier's file, and it is
 * an assertion about committed bytes rather than about a running browser, so the unit lane executes
 * it on every `pnpm verify`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/** The image as it stood at 5acee6a, the commit this branch was cut from. */
const BEFORE_SHA256 = "fc67f01abb56170aa64fc032786c030cc3e46554aa5bf8e9af7c74aa00502dee";
const BASELINE = join("tests", "e2e", "baselines", "design", "j-003", "ruleset-pin-visible.png");

test("J-003's ruleset-pin baseline was regenerated for the masked checkpoint — its bytes changed (B-20)", () => {
  const bytes = readFileSync(join(process.cwd(), BASELINE));
  const now = createHash("sha256").update(bytes).digest("hex");
  expect(
    now,
    `${BASELINE} is byte-for-byte what it was before this branch. The checkpoint that compares it now masks the account chip, the content digest and each lineage step's last line (arbitrated), and masks paint the capture rather than the baseline — so the baseline is owed a regeneration through those masks. Whether the new bytes picture the screen that stands is judged by that checkpoint's own toHaveScreenshot, not here.`,
  ).not.toBe(BEFORE_SHA256);
});
