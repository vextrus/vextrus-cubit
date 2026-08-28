// AC-7 — the AGPL PDF-library ban, enforced on both runtimes (L-CAD-04).
//
// The node half is this file: the manifest and the lockfile are read as text, because a
// transitive edge is as much "shipped code" as a direct dependency. The Python half is the
// Builder's `cad/tests/test_licence.py`; this suite runs it and checks it is not vacuous — a
// licence test that never names the banned libraries cannot fail by construction.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, requireCadPackage, runInCadProject } from "./support/artifact";

/** The AGPL PDF stack L-CAD-04 bans, split by the runtime each name can enter through. */
const NODE_BANNED = ["@vivliostyle/cli", "mupdf", "pymupdf"];
const PYTHON_BANNED = ["pymupdf", "fitz", "mutool"];

/** The node manifests a banned package could enter through. */
const NODE_MANIFESTS = ["package.json", "pnpm-lock.yaml"];

const PYTHON_LICENCE_TEST = join(REPO_ROOT, "cad", "tests", "test_licence.py");

function hits(text: string, needles: readonly string[]): string[] {
  const haystack = text.toLowerCase();
  return needles.filter((needle) => haystack.includes(needle));
}

describe("AC-7: the AGPL PDF-library ban", () => {
  it("AC-7: no node manifest names an AGPL PDF library", () => {
    for (const manifest of NODE_MANIFESTS) {
      const path = join(REPO_ROOT, manifest);
      expect(existsSync(path), `${manifest} is missing`).toBe(true);
      const named = hits(readFileSync(path, "utf8"), NODE_BANNED);
      expect(named, `${manifest} names an AGPL PDF library — L-CAD-04 bans it from shipped code`).toEqual([]);
    }
  });

  it("AC-7: the Python licence test exists, names every banned library, and passes", () => {
    requireCadPackage();
    expect(existsSync(PYTHON_LICENCE_TEST), `${PYTHON_LICENCE_TEST} is missing — the Python half of the ban does not exist yet`).toBe(true);

    // A licence test that never mentions what it bans cannot fail by construction.
    const source = readFileSync(PYTHON_LICENCE_TEST, "utf8");
    const unnamed = PYTHON_BANNED.filter((name) => !source.toLowerCase().includes(name));
    expect(unnamed, "the Python licence test never names these banned libraries, so it cannot refuse them").toEqual([]);

    const run = runInCadProject(["pytest", "cad/tests/test_licence.py", "-q"]);
    expect(run.status, `pytest cad/tests/test_licence.py exited ${run.status}\n${run.stdout}\n${run.stderr}`).toBe(0);
  }, 600_000);

  it("AC-7: verify's cad lane — ruff check cad, then pytest cad — is green", () => {
    requireCadPackage();
    const lint = runInCadProject(["ruff", "check", "cad"]);
    expect(lint.status, `ruff check cad exited ${lint.status}\n${lint.stdout}\n${lint.stderr}`).toBe(0);
    const suite = runInCadProject(["pytest", "cad", "-q"]);
    expect(suite.status, `pytest cad exited ${suite.status}\n${suite.stdout}\n${suite.stderr}`).toBe(0);
  }, 900_000);
});
