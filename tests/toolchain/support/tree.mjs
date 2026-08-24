// Toolchain acceptance support (inc-000). Scratch-tree probes copy the tree into the scratch dir
// and never mutate the repo — verify.mjs/lanes.mjs must therefore work from cwd/arg, not a
// hardcoded path (inc-000 test contract, risk note 1).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

/** The tree under test: vitest runs from the package root. */
export function repoRoot() {
  return process.cwd();
}

const EXCLUDED = new Set([".git", "node_modules", ".builder-heldout", ".next", ".next-e2e", "dist", "coverage"]);

// A scratch copy keeps its own `tests/toolchain` so the `unit` lane stays armed exactly as on the
// real tree — but with one trivial test, because these very files shell out to `pnpm verify`:
// copying them verbatim would make the inner unit lane re-enter this suite without end.
const PROBE_TEST = 'import { it, expect } from "vitest";\nit("scratch probe", () => {\n  expect(1).toBe(1);\n});\n';

/** A throwaway copy of the tree outside the repo, sharing the repo's installed node_modules. */
export function scratchTree(label) {
  const base = mkdtempSync(join(process.env.TMPDIR?.trim() || tmpdir(), `toolchain-${label}-`));
  const dest = join(base, "tree");
  cpSync(repoRoot(), dest, {
    recursive: true,
    dereference: false,
    filter: (src) => src === repoRoot() || !EXCLUDED.has(basename(src)),
  });
  const modules = join(repoRoot(), "node_modules");
  if (existsSync(modules)) symlinkSync(modules, join(dest, "node_modules"), "dir");
  const toolchain = join(dest, "tests", "toolchain");
  if (existsSync(toolchain)) {
    rmSync(toolchain, { recursive: true, force: true });
    mkdirSync(toolchain, { recursive: true });
    writeFileSync(join(toolchain, "probe.test.mjs"), PROBE_TEST);
  }
  return dest;
}

export function removeTree(dir) {
  rmSync(dirname(dir), { recursive: true, force: true });
}

/** Run a package script the way a person would: `pnpm <args...>` in <dir>. */
export function pnpmRun(dir, args, env = {}, timeout = 600_000) {
  const r = spawnSync("pnpm", args, {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { code: r.status ?? 1, out, lines: out.split("\n").map((l) => l.replace(/\r$/, "")) };
}

/** The RUN/SKIP roster lines, byte-exact, in printed order (pnpm's own header is not one). */
export function rosterOf(run) {
  return run.lines.filter((l) => /^(RUN|SKIP) [a-z][a-z0-9-]*(:|$)/.test(l));
}

export function finalLineOf(run) {
  return run.lines.find((l) => /^verify: /.test(l));
}

export function laneOf(line) {
  const m = /^(?:RUN|SKIP) ([a-z][a-z0-9-]*)/.exec(line);
  return m ? m[1] : null;
}

/** The path a recorded skip names: `SKIP <lane>: input root <path> absent`. */
export function skipRootOf(line) {
  const m = /^SKIP [a-z][a-z0-9-]*: input root (.+) absent$/.exec(line);
  return m ? m[1] : null;
}

/**
 * Create <rel> under <dir> (a file when the last segment carries an extension, else a directory)
 * and hand back the undo. Returns the topmost path that had to be invented, so the undo leaves
 * the tree exactly as it was.
 */
export function createRoot(dir, rel) {
  const abs = join(dir, rel);
  let topmost = abs;
  while (!existsSync(dirname(topmost)) && dirname(topmost) !== dir) topmost = dirname(topmost);
  if (/\.[a-z0-9]+$/i.test(basename(abs))) {
    mkdirSync(dirname(abs), { recursive: true });
    if (!existsSync(abs)) writeFileSync(abs, "");
  } else {
    mkdirSync(abs, { recursive: true });
  }
  return () => rmSync(topmost, { recursive: true, force: true });
}

/**
 * JSONC minus its comments. String-aware by construction: a `//` or `/*` inside a JSON string —
 * the `https://…` of a repository or homepage field, a path — is content, not a comment, and
 * survives untouched. A regex cannot tell those apart, so this walks the text instead.
 */
function stripJsonComments(raw) {
  let out = "";
  let inString = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += raw[i + 1] ?? "";
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && raw[i + 1] === "/") {
      while (i < raw.length && raw[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (ch === "/" && raw[i + 1] === "*") {
      const end = raw.indexOf("*/", i + 2);
      i = end === -1 ? raw.length : end + 1;
      continue;
    }
    out += ch;
  }
  return out;
}

export function readJson(path) {
  return JSON.parse(stripJsonComments(readFileSync(path, "utf8").replace(/^\uFEFF/, "")));
}
