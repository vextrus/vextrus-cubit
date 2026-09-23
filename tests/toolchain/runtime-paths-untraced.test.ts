// A runtime path is not a build input (session 7). Turbopack reads a `join`/`resolve` over
// `process.cwd()`, or over a directory it cannot see, as a FILE PATTERN, and traces every file the
// pattern matches into the build. The product's runtime directories grow with every run:
// - storage/, 22,737 objects (36d16d6e);
// - the mail outbox, 10,492 mails;
// - a `<dynamic>/<dynamic>.json` read, 11,184 files of the checkout.
// So one journey's leavings turned the next `next build` cold, and verify's build lane read 10.2 s
// where it reads 3. Each such path carries `/* turbopackIgnore: true */` (the documents/tree.ts
// precedent). This suite holds the tree to it, because a build-time trace is otherwise invisible to
// the unit lane.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ANNOTATION = "/* turbopackIgnore: true */";

/** Every product module under src/ — the files `next build` compiles, not the suites beside them. */
function productModules(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__") continue;
      found.push(...productModules(path));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      found.push(path);
    }
  }
  return found;
}

/** A module's code with its doc blocks and line comments set aside; the one-star annotation stays. */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("every product path derived from process.cwd() tells the bundler it is not a build input", () => {
  const unannotated: string[] = [];
  for (const path of productModules(join(ROOT, "src"))) {
    const code = codeOf(path);
    // A path call whose arguments reach process.cwd() directly. A cwd handed to a helper as a
    // candidate (documents/tree.ts, ingest/cli.ts) is resolved under the helper's own annotation.
    for (const match of code.matchAll(/\b(?:join|resolve)\(([^()]*?)process\.cwd\(\)/g)) {
      if (!(match[1] ?? "").includes(ANNOTATION)) unannotated.push(relative(ROOT, path));
    }
  }
  expect(unannotated, "a join/resolve over process.cwd() is a file pattern the build traces").toEqual([]);
});

test("every join under a runtime directory the bundler cannot see is annotated too", () => {
  const sites: readonly (readonly [string, RegExp, number])[] = [
    // the outbox's sweep reads and its delivery write
    ["src/server/auth/mail.ts", /\bjoin\(([^,]*)directory,/g, 2],
    // a recorded answer, read by its request hash
    ["src/core/model/fixture.ts", /\bjoin\(([^,]*)fixtureRoot,/g, 1],
  ];
  for (const [file, site, count] of sites) {
    const hits = [...codeOf(join(ROOT, file)).matchAll(site)];
    expect(hits, `${file} joins under its runtime directory where it did`).toHaveLength(count);
    for (const hit of hits) expect(hit[1] ?? "", `${file}: every such join carries the annotation`).toContain(ANNOTATION);
  }
});
