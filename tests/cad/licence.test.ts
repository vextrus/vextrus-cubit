// AC-7 — the AGPL PDF-library ban, enforced on both runtimes (L-CAD-04).
//
// Both halves are judged the same way here: the manifest and the lockfile of each runtime are read
// as text, because a transitive edge is as much "shipped code" as a direct dependency. The Python
// half additionally runs the Builder's `cad/tests/test_licence.py` — but the ban itself is checked
// from this side, over cad/pyproject.toml's dependency tables and every module under cad/src, so
// the criterion does not rest on trusting that a test file the Builder wrote can fail.
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, requireCadPackage, runInCadProject } from "./support/artifact";
import {
  declaredPythonRequirements,
  lockedPythonDistributions,
  namesBannedLibrary,
  normalisePythonName,
  pythonModulesUnder,
} from "./support/licence";

/** The AGPL PDF stack L-CAD-04 bans, split by the runtime each name can enter through. */
const NODE_BANNED = ["@vivliostyle/cli", "mupdf", "pymupdf"];
const PYTHON_BANNED = ["pymupdf", "fitz", "mutool"];

/** The same Python ban as distribution names, PEP 503-normalised for manifest comparison. */
const BANNED_PYTHON_DISTRIBUTIONS = new Set([...PYTHON_BANNED, "mupdf"].map((name) => normalisePythonName(name)));

/** The node manifests a banned package could enter through. */
const NODE_MANIFESTS = ["package.json", "pnpm-lock.yaml"];

const PYTHON_MANIFEST = join(REPO_ROOT, "cad", "pyproject.toml");
const PYTHON_LOCKFILE = join(REPO_ROOT, "cad", "uv.lock");
const PYTHON_SOURCE_ROOT = join(REPO_ROOT, "cad", "src");
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

  it("AC-7: no Python manifest declares an AGPL PDF library, and no module under cad/src names one", () => {
    // The independent half of the Python ban, read the same way the node manifests are read above.
    // Without it the criterion would rest on `pytest cad/tests/test_licence.py` exiting 0, which a
    // test that asserts nothing also does.
    requireCadPackage();
    expect(existsSync(PYTHON_MANIFEST), `${PYTHON_MANIFEST} is missing — the cad package's manifest does not exist yet`).toBe(true);

    const declared = declaredPythonRequirements(readFileSync(PYTHON_MANIFEST, "utf8"));
    expect(declared.length, "cad/pyproject.toml declares no requirements at all — ezdxf alone is one").toBeGreaterThan(0);
    expect(
      declared.filter((name) => BANNED_PYTHON_DISTRIBUTIONS.has(normalisePythonName(name))),
      "cad/pyproject.toml declares an AGPL PDF library — L-CAD-04 bans it from shipped code",
    ).toEqual([]);

    // The lockfile is the transitive half, as pnpm-lock.yaml is on the node side; it is scanned
    // whenever the resolution is committed.
    if (existsSync(PYTHON_LOCKFILE)) {
      expect(
        lockedPythonDistributions(readFileSync(PYTHON_LOCKFILE, "utf8")).filter((name) => BANNED_PYTHON_DISTRIBUTIONS.has(name)),
        "cad/uv.lock resolves an AGPL PDF library — a transitive edge ships too",
      ).toEqual([]);
    }

    const modules = pythonModulesUnder(PYTHON_SOURCE_ROOT);
    expect(modules.length, `${PYTHON_SOURCE_ROOT} holds no Python module to scan`).toBeGreaterThan(0);
    const offenders = modules
      .filter((path) => namesBannedLibrary(readFileSync(path, "utf8"), PYTHON_BANNED).length > 0)
      .map((path) => relative(REPO_ROOT, path));
    expect(offenders, "a module under cad/src names an AGPL PDF library — L-CAD-04 bans it from shipped code").toEqual([]);
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
