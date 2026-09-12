/**
 * Two inputs the toolchain's own scripts were not stating (banked findings, v22 §N follow-up).
 *
 * 1. The unit lane's verdict is read by the ENGINE, and the terminal is not a verdict it can read.
 *    Without a structured report it knows the lane was green and never which test FILES ran, so the
 *    acceptance dedup that asks "is this claim already proved by a test that executed?" claims
 *    nothing at all. The report is asked for by the caller, so a human pays nothing for it.
 *
 * 2. `build-if-stale` compares the built output's mtime against its inputs. Next inlines
 *    `NEXT_PUBLIC_*` at BUILD time, so an edit to a `.env*` file changes the built product while
 *    touching nothing under `src/` — and the input walk skips dotfiles. A journey written for the
 *    new value was served the previous bundle: a green that measured the wrong product.
 */
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { unitLaneCommand } from "../../scripts/verify.mjs";
import { inputFilesOf } from "../../scripts/lib/build-inputs.mjs";

describe("the unit lane writes a report the engine can read", () => {
  test("with no address stated, the lane is what it always was", () => {
    const command = unitLaneCommand({});
    expect(command.filter((word) => word.startsWith("--reporter") || word.startsWith("--outputFile")), "a human pays nothing for the engine's instrument").toEqual([]);
    expect(command.slice(0, 3)).toEqual(["node", "node_modules/vitest/vitest.mjs", "run"]);
  });

  test("an address stated is where the json report is written, beside the reporter a human reads", () => {
    const command = unitLaneCommand({ CUBIT_VERIFY_REPORT_JSON: "/tmp/verify-report.json" });
    expect(command, "the default reporter is kept BESIDE the json one — a lane that swapped them takes the failure list away").toContain("--reporter=default");
    expect(command).toContain("--reporter=json");
    expect(command.at(-1)).toBe("--outputFile=/tmp/verify-report.json");
  });

  test("an empty address is no address", () => {
    expect(unitLaneCommand({ CUBIT_VERIFY_REPORT_JSON: "" })).toEqual(unitLaneCommand({}));
  });
});

describe("build-if-stale counts every .env file as an input", () => {
  test("each .env* of the tree is a named input, and a directory so named is not", () => {
    const root = mkdtempSync(join(tmpdir(), "cubit-inputs-"));
    for (const file of [".env", ".env.local", ".env.production", "next.config.ts", "not-an-env"]) writeFileSync(join(root, file), "x");
    mkdirSync(join(root, ".env.d"));

    const files = inputFilesOf(root);
    for (const env of [".env", ".env.local", ".env.production"]) {
      expect(files, `${env} is inlined into the client bundle at build time and must move the build`).toContain(env);
    }
    expect(files, "a DIRECTORY named .env.d is not a file the build reads").not.toContain(".env.d");
    expect(files, "the shipped inputs are still stated").toContain("next.config.ts");
    expect(files.filter((name) => name === "not-an-env"), "and nothing else is invented").toEqual([]);
  });

  test("a tree with no .env file states exactly the shipped inputs", () => {
    const root = mkdtempSync(join(tmpdir(), "cubit-inputs-bare-"));
    expect(inputFilesOf(root).filter((name) => name.startsWith(".env"))).toEqual([]);
  });
});
