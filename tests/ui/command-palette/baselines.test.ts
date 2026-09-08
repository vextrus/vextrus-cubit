/**
 * AC-6's B-20 half — the trigger joins the top bar, so every committed picture that holds the bar is
 * a picture of a screen that no longer exists, and this increment owns their regeneration.
 *
 * This test states ONE thing: each of the frame pictures the increment names is not the bytes it was
 * before the trigger arrived. The pins are a NEGATIVE, so a later increment that lawfully
 * re-baselines again still passes; only a branch that shipped the grown bar while leaving its
 * baselines untouched fails. What the new bytes PICTURE is V-E2E's instrument and it stands in the
 * journeys themselves (`pnpm e2e --journey J-000`, J-003, J-004 and the shell/audit/project-home
 * specs compare against these very files).
 *
 * The digests were taken from the checkout at the increment's base commit. No git is consulted: the
 * audit reads the working tree and this fixture, so it answers the same before the increment lands,
 * after it merges, and in a shallow clone with no `main` ref (the j-003 precedent).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const BASELINES = join(REPO_ROOT, "tests", "e2e", "baselines", "design");

/**
 * Every picture the increment's ownership list names as owed a regeneration, with the bytes it held
 * before the trigger arrived. Pictures the trigger does NOT shift — the viewer's entity capture, the
 * sheet card, the two job-timeline crops, the consequence dialog's card — are deliberately absent:
 * none of them is regenerated, and none of them is judged here (B-20: only what moved).
 */
const BEFORE: Readonly<Record<string, string>> = {
  "gallery-shell-light.png": "1be9f8412b0175bdf1b29a63717351af49ac1d2908972b1cc09db67013b08e11",
  "gallery-shell-dark.png": "0f90c1e606fb3f548607f8e8b8f47b27899116b55a960c18b9eb1d3792814041",
  "shell-light.png": "9829cefb5e1429edb26d85df08c35a48268940030473b8dd6c314b2d7f406407",
  "shell-dark.png": "62c5d306df3eba508eb487d6ed39b0554fe2f3fe9a7da5a841f141a450844cb9",
  "shell-tenant-switcher-open.png": "bdcbc3f8076eb9db1be1fdf0d7f119a000a88cca007c104babbabb3b4338c606",
  "shell-user-menu-open.png": "a4264469f69dc6b86c22bf6aa2e14a0c95261aeae6ffbbc3e38060e17ca20b98",
  "s-audit/explorer.png": "ae508ad0c4312c8c4cb0a8e1e34a4f3785990337cb9619d0726b59840488b0fc",
  "s-project/home.png": "a59a5a973a9049d7a1df506ad66b33d9e8281ee3fdfa08b3a4c4ae33f2ebbf09",
  "j-003/project-edited.png": "33450c563e58a2307fba0917668ada47994d7031d45b6edc04ba85b355277f0d",
  "j-003/ruleset-pin-visible.png": "786a9c94dd2b8bece844447a706082b5a1c6430c381d65571355533a341d1702",
  "j-002-tenant-admin/panel.png": "02a1d60b79fd7d57b67a95a65353474321a9d209a17cab4944d491d42ac127cb",
  "j-002-tenant-admin/remove-refused.png": "cf4d14a81a97384b45590a9ab2a56cf73ce52d935856cec9cf8d5d3e2f7eae84",
  "j-001-auth/accept.png": "a3724eb2301c018cc7c09a5a7278c39cf02cebf3ce03c822d9702f143bc398d5",
  "j-001-auth/invite-pending.png": "e5bcbc0ed1593ba89f48e88c8ca9996e5d8073b4fcf3f48ef749d238a652df1a",
  "j-001-auth/switched.png": "fbd2f0ab803956c9eaef1a5fcb05297ca93f37162bbab324e92f26cf1d68168a",
  "j-000/workspace-named.png": "992f5d281f2881cc486c4d7b51c2f399b73c3e3b7bebf820b1b6d1aac6ffd7d6",
  "j-000/first-project-on-s-home.png": "75ef28155d49f21baad31a80ede9863f1961ab665a0fd6049c7f850bdaa24248",
};

/** The two captures the new journey owes, which do not exist before it runs (Decision §7). */
const OWED_BY_J021 = ["palette/open-light.png", "palette/open-dark.png", "palette/sheet-light.png"];

describe("AC-6 — every frame picture the trigger shifts is regenerated (B-20)", () => {
  for (const [name, wasSha256] of Object.entries(BEFORE)) {
    test(`AC-6: tests/e2e/baselines/design/${name} was regenerated for the trigger's arrival`, () => {
      const file = join(BASELINES, name);
      expect(existsSync(file), `${name} is one of the committed design baselines`).toBe(true);
      expect(
        createHash("sha256").update(readFileSync(file)).digest("hex"),
        `tests/e2e/baselines/design/${name} is byte-for-byte what it was before this increment. The CommandPaletteTrigger joins the top bar (I-135), so this picture shows a bar that no longer exists and must be regenerated in its own \`baseline:\` commit naming the run (B-20) — \`--update-snapshots=missing\` alone cannot re-bless a changed baseline. Whether the new bytes picture the standing screen is judged by the journeys that compare against them.`,
      ).not.toBe(wasSha256);
    });
  }

  test("AC-6: J-021's own baselines are committed beside the journey that takes them", () => {
    for (const name of OWED_BY_J021) {
      expect(existsSync(join(BASELINES, name)), `tests/e2e/baselines/design/${name} is the picture the j-021 checkpoint compares against (Decision §7)`).toBe(true);
    }
  });
});
