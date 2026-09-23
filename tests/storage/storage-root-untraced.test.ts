/**
 * The default storage root is a RUNTIME address, and the bundler is told not to trace it.
 *
 * `storageRoot()` answers `join(process.cwd(), "storage")` when the machine states no root. Turbopack
 * reads a `join` over `process.cwd()` as a file pattern, so the build traced every object a run had
 * laid down (22,737 of them in session 7: "The file pattern '/ROOT/storage' matches 22737 files").
 * Then one new object under `storage/` made the next `next build` compile cold. Measured on the
 * build lane's own command:
 * - warm 5.0 s, then 8.2 s after one file was added;
 * - 10.2 s in the gate after a journey, putting verify at 62.55 s against V-VERIFY's 60.
 * With the path untraced, the warning is gone, a warm build is 3.0 s, and it stays 3.0–3.2 s as
 * files are added.
 *
 * The first case pins that the answer did not move. The second pins the annotation in the call, the
 * `documents/tree.ts` precedent, because a build-time trace is otherwise invisible to this lane.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { storageRoot } from "../../src/core/storage/app";
import { ROOT_VAR } from "./support/storage-stage";

const APP = join(process.cwd(), "src/core/storage/app.ts");

afterEach(() => {
  vi.unstubAllEnvs();
});

test("a machine that states no root lays objects down under the checkout's own storage directory", () => {
  vi.stubEnv(ROOT_VAR, undefined);
  expect(storageRoot(), "the default is unchanged by the bundler annotation").toBe(join(process.cwd(), "storage"));
});

test("the default root's `join` over `process.cwd()` is annotated so the build never traces the store", () => {
  // The CODE is read, not the prose about it: doc blocks and line comments are set aside, and the
  // one-star inline annotation — the thing under test — is kept.
  const code = readFileSync(APP, "utf8")
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const calls = [...code.matchAll(/join\(([^)]*)process\.cwd\(\)/g)].map((match) => match[1] ?? "");
  expect(calls.length, "storage/app.ts derives its default root from the working directory exactly once").toBe(1);
  expect(calls[0], "and tells Turbopack the path is not a build input").toContain("/* turbopackIgnore: true */");
});
