// The app's module graph holds no process boundary (ARCH-01, AS-01). SEAM-CAD crosses one — the
// `cad/` CLI is spawned from `src/modules/takeoff/ingest/cli.ts` — and only the worker's composition
// root may hold it: a bundler follows a barrel's every re-export, traces a server module's filesystem
// reach, and a build that held the CLI client once walked the whole checkout and died on
// `cad/.venv/bin/python3` (uv's interpreter symlink, which points outside the root). The gate went
// GREEN on a workaround and RED without it, on the same product code. This test walks the static
// import graph from every file under `src/app` and `src/server` and asserts the client — and any
// `child_process` import at all — is unreachable from it.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CLI_CLIENT = "src/modules/takeoff/ingest/cli.ts";
const ROOTS = ["src/app", "src/server"];
const SOURCE = /\.(ts|tsx|mts|cts)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$|(^|\/)__tests__\//;
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;'"]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/** Every source file under a directory, repo-relative, tests excluded. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (SOURCE.test(entry) && !TEST_FILE.test(relative(REPO_ROOT, p))) out.push(relative(REPO_ROOT, p));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

/** A relative specifier resolved to a repo-relative source file, or null for a package / a non-source import. */
function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(REPO_ROOT, dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile() && SOURCE.test(candidate)) return relative(REPO_ROOT, candidate);
  }
  return null;
}

/** The static import graph reachable from the roots: file → the files and packages it imports. */
function reachable(roots: string[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const stack = roots.flatMap((r) => sourcesUnder(join(REPO_ROOT, r)));
  while (stack.length) {
    const file = stack.pop()!;
    if (graph.has(file)) continue;
    const text = readFileSync(join(REPO_ROOT, file), "utf8");
    const specs: string[] = [];
    for (const m of text.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec) continue;
      // A type-only import is erased by the compiler and carries no module into a bundle.
      if (/(?:^|\n)\s*(?:import|export)\s+type\s/.test(m[0])) continue;
      specs.push(spec);
      const target = resolveImport(file, spec);
      if (target) stack.push(target);
    }
    graph.set(file, specs);
  }
  return graph;
}

describe("the app's module graph holds no process boundary (ARCH-01, AS-01)", () => {
  const graph = reachable(ROOTS);

  test("the CLI client is unreachable from src/app and src/server", () => {
    expect(graph.size, "the walk found the app").toBeGreaterThan(10);
    expect([...graph.keys()]).not.toContain(CLI_CLIENT);
  });

  test("no file reachable from the app imports child_process", () => {
    const offenders = [...graph.entries()].filter(([, specs]) => specs.some((s) => s === "child_process" || s === "node:child_process")).map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  test("the request door and the job door are two files, and only the worker imports the job door", () => {
    expect(existsSync(join(REPO_ROOT, "src/modules/takeoff/ingest/request.ts"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "src/modules/takeoff/ingest/job.ts"))).toBe(true);
    const barrel = readFileSync(join(REPO_ROOT, "src/modules/takeoff/ingest/index.ts"), "utf8");
    expect(barrel).not.toMatch(/from "\.\/cli"/);
    expect(barrel).not.toMatch(/from "\.\/pipeline"/);
    const importers = sourcesUnder(join(REPO_ROOT, "src")).filter((f) => /takeoff\/ingest\/job"/.test(readFileSync(join(REPO_ROOT, f), "utf8")));
    expect(importers).toEqual(["src/worker/handlers/ingest.ts"]);
  });
});
