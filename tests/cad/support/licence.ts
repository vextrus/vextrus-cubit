// Reading a Python manifest, lockfile and source tree for the AGPL PDF-library ban (L-CAD-04),
// well enough that acceptance can enforce the ban itself rather than trust a test that says it does.
//
// Nothing here is product code: cad/pyproject.toml is a manifest and cad/src is scanned for a
// forbidden *name*, exactly as tests/cad/licence.test.ts scans package.json and pnpm-lock.yaml.
import { readdirSync } from "node:fs";
import { join } from "node:path";

/** PEP 503: `PyMuPDF`, `py_mupdf` and `py.mupdf` are one distribution name. */
export function normalisePythonName(raw: string): string {
  return raw.trim().toLowerCase().replace(/[-_.]+/g, "-");
}

/**
 * A TOML or Python document with its comments and docstrings removed. Prose that *names* the ban is
 * not a breach of it, and a licence scan must not mistake one for the other.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/'''[\s\S]*?'''/g, "''")
    .split("\n")
    .map((line) => {
      let quote: string | null = null;
      for (let i = 0; i < line.length; i += 1) {
        const character = line[i]!;
        if (quote !== null) {
          if (character === quote) quote = null;
          continue;
        }
        if (character === '"' || character === "'") quote = character;
        else if (character === "#") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

/** The distribution names inside a TOML array of PEP 508 requirement strings. */
function requirementNamesIn(array: string): string[] {
  return [...array.matchAll(/["']([^"']+)["']/g)]
    .map((match) => /^[A-Za-z0-9._-]+/.exec(match[1]!.trim())?.[0] ?? "")
    .filter((name) => name.length > 0);
}

/**
 * Every requirement a TOML document declares, from any dependency array whatever table holds it:
 * `[project] dependencies`, `[project.optional-dependencies]`, `[dependency-groups]`, `[tool.uv]
 * dev-dependencies`. Derived from the document rather than from a fixed list of table names, so a
 * manifest laid out differently is still read.
 */
export function declaredPythonRequirements(toml: string): string[] {
  const names: string[] = [];
  let table = "";
  let collecting = false;
  let buffer = "";

  for (const raw of withoutComments(toml).split("\n")) {
    const line = raw.trim();
    if (collecting) {
      buffer += ` ${line}`;
      if (line.includes("]")) {
        names.push(...requirementNamesIn(buffer));
        collecting = false;
        buffer = "";
      }
      continue;
    }

    const heading = /^\[+([^\]]+)\]+$/.exec(line);
    if (heading !== null) {
      table = heading[1]!;
      continue;
    }

    const assignment = /^["']?([A-Za-z0-9_.-]+)["']?\s*=\s*(\[.*)$/.exec(line);
    if (assignment === null) continue;
    if (!/dependencies/i.test(assignment[1]!) && !/dependenc/i.test(table)) continue;

    const value = assignment[2]!;
    if (value.includes("]")) names.push(...requirementNamesIn(value));
    else {
      collecting = true;
      buffer = value;
    }
  }
  return names;
}

/** Every distribution a uv lockfile resolves — the transitive half of the Python ban. */
export function lockedPythonDistributions(lock: string): string[] {
  return [...withoutComments(lock).matchAll(/^\s*name\s*=\s*["']([^"']+)["']/gm)].map((match) => normalisePythonName(match[1]!));
}

/** Every Python module under a directory. */
export function pythonModulesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...pythonModulesUnder(path));
    else if (entry.name.endsWith(".py")) found.push(path);
  }
  return found;
}

/** Does this Python source name one of the banned libraries outside its comments and docstrings? */
export function namesBannedLibrary(source: string, banned: readonly string[]): string[] {
  const code = withoutComments(source);
  return banned.filter((name) => new RegExp(`\\b${name}\\b`, "i").test(code));
}
