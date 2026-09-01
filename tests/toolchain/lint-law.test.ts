// AC4, AC6 — every NEVER fires on its committed fixture and stays silent on lawful code. The
// corpus is put through the product's own flat config (Q-01): a rule that fires only on the
// straight spelling is half a rule, so the payloads carry the template-literal, computed-member,
// globalThis, packed-hex and CSS shapes too.
//
// A fixture is judged at the layer its virtual path names, not where it physically sits: the path
// is read from its last `src/` segment, exactly as the boundary rules read one (ARCH-01). The real
// paths are ignored by the flat config, so lintText is the only surface that can see them.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CORPUS_ROOT = join(REPO_ROOT, "tests", "lint-fixtures");
const MARKER = "RECORDED REASON";

/** The closed rule-id set, by the corpus directory that proves it (increment spec, test contract). */
const RULE_OF_SLUG: Readonly<Record<string, string>> = {
  boundaries: "cubit/boundaries",
  "no-colour-literal": "cubit/no-colour-literal",
  "no-raw-intl": "cubit/no-raw-intl",
  "no-db-outside-seam": "cubit/no-db-outside-seam",
  "no-model-outside-seam": "cubit/no-model-outside-seam",
  "fault-or-refusal": "cubit/fault-or-refusal",
  "no-suppressions": "cubit/no-suppressions",
  "no-explicit-any": "@typescript-eslint/no-explicit-any",
  "no-cycle": "import-x/no-cycle",
};

/** ARCH-01's matrix, branch by branch — one corpus directory each. */
const MATRIX_BRANCHES = [
  "core-to-modules",
  "core-to-server",
  "core-to-app",
  "core-to-ui",
  "core-to-worker",
  "modules-to-other-module",
  "modules-to-server",
  "modules-to-app",
  "modules-to-ui",
  "server-to-app",
  "server-to-ui",
  "server-to-worker",
  "app-to-worker",
  "ui-to-app",
  "ui-to-server",
  "ui-to-modules",
  "ui-to-core-value",
  "worker-to-server",
  "worker-to-app",
  "worker-to-ui",
];

/** The exact allowlisted paths the ban homes grant (LAW-FMT, SEAM-TENANT, R-UI-001). */
const BAN_HOMES = [
  { rule: "cubit/no-raw-intl", virtualPath: "src/core/format.ts" },
  { rule: "cubit/no-db-outside-seam", virtualPath: "src/core/db.ts" },
  { rule: "cubit/no-colour-literal", virtualPath: "src/ui/tokens.ts" },
  { rule: "cubit/no-colour-literal", virtualPath: "src/ui/tokens.css" },
];

const LINTABLE = new Set([".ts", ".tsx", ".mts", ".css"]);

/** The `cubit` plugin's rule names, read from the plugin itself so a rule added later is judged too. */
const cubitRules = new Set<string>();

/**
 * @returns the rule a corpus directory proves — the closed set by name, or a `cubit` rule of the
 * same name for a corpus a later increment lands with its rule (B-18); null when nothing claims it.
 */
function ruleOf(slug: string): string | null {
  const declared = RULE_OF_SLUG[slug];
  if (declared !== undefined) return declared;
  return cubitRules.has(slug) ? `cubit/${slug}` : null;
}

interface Fixture {
  /** Path under the corpus root, POSIX-spelled. */
  readonly id: string;
  readonly absolutePath: string;
  /** The layered path this fixture stands in for, read from its last `src/` segment. */
  readonly virtualPath: string;
  readonly slug: string;
  readonly basename: string;
}

/** @returns every lintable file in the corpus, in a stable order. */
function collect(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) return collect(abs);
      const dot = entry.lastIndexOf(".");
      return dot > 0 && LINTABLE.has(entry.slice(dot)) ? [abs] : [];
    });
}

function describeFixture(absolutePath: string): Fixture {
  const id = absolutePath.slice(CORPUS_ROOT.length + 1).split(sep).join("/");
  const marker = `/src/`;
  const at = `/${id}`.lastIndexOf(marker);
  const virtualPath = at === -1 ? `src/core/${id}` : `/${id}`.slice(at + 1);
  const basename = id.slice(id.lastIndexOf("/") + 1);
  return { id, absolutePath, virtualPath, slug: id.slice(0, id.indexOf("/")), basename };
}

const fixtures = collect(CORPUS_ROOT).map(describeFixture);
const messagesOf = new Map<string, Linter.LintMessage[]>();
let linter: ESLint;

/** @returns what the product's config reports for this source read at this layered path. */
async function lintAs(source: string, virtualPath: string): Promise<Linter.LintMessage[]> {
  const results = await linter.lintText(source, { filePath: join(REPO_ROOT, virtualPath) });
  return results.flatMap((result) => result.messages);
}

/** @returns the rule ids reported, most useful first in a failure message. */
function reported(fixture: Fixture): string {
  const messages = messagesOf.get(fixture.id) ?? [];
  if (messages.length === 0) return "nothing";
  return messages.map((message) => `${message.ruleId ?? "(parse)"}@${message.line}`).join(", ");
}

beforeAll(async () => {
  const loaded: unknown = await import(pathToFileURL(join(REPO_ROOT, "eslint.config.mjs")).href);
  const config = (loaded as { default: Linter.Config[] }).default;
  expect(Array.isArray(config), "eslint.config.mjs does not default-export a flat config array").toBe(true);
  linter = new ESLint({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: config });
  const plugin: unknown = await import(pathToFileURL(join(REPO_ROOT, "scripts/eslint/index.mjs")).href);
  for (const name of Object.keys((plugin as { cubit: { rules: Record<string, unknown> } }).cubit.rules)) cubitRules.add(name);
  for (const fixture of fixtures) {
    messagesOf.set(fixture.id, await lintAs(readFileSync(fixture.absolutePath, "utf8"), fixture.virtualPath));
  }
}, 120_000);

describe("AC4: every NEVER fires on its committed fixture", () => {
  // The seam bans are armed here and extended as layers land (B-18), so this asserts that every
  // rule in the closed set has its corpus directory — not that the corpus has nothing else. A later
  // increment that lands a rule with its fixtures adds a directory; that is lawful, and a test that
  // went red for it would be freezing a listing the Bible says will grow.
  test("AC4: every rule in the closed set has its corpus directory", () => {
    const slugs = readdirSync(CORPUS_ROOT).filter((entry) => statSync(join(CORPUS_ROOT, entry)).isDirectory());
    const missing = Object.keys(RULE_OF_SLUG).filter((slug) => !slugs.includes(slug));
    expect(missing, "a rule in the closed set has no committed fixture corpus").toEqual([]);
  });

  test("AC4: every corpus directory names the rule it proves", () => {
    const slugs = readdirSync(CORPUS_ROOT).filter((entry) => statSync(join(CORPUS_ROOT, entry)).isDirectory());
    const unclaimed = slugs.filter((slug) => ruleOf(slug) === null);
    expect(unclaimed, "a corpus directory proves no rule — name it after the rule it fires, so the suite can judge it").toEqual([]);
  });

  test.each(Object.entries(RULE_OF_SLUG))("AC4: %s has a bad fixture and a good one", (slug, ruleId) => {
    const own = fixtures.filter((fixture) => fixture.slug === slug);
    expect(own.filter((fixture) => fixture.basename.startsWith("bad")).length, `${slug} proves ${ruleId} on no bad fixture`).toBeGreaterThan(0);
    expect(own.filter((fixture) => fixture.basename.startsWith("good")).length, `${slug} has no lawful counterpart`).toBeGreaterThan(0);
  });

  test("AC4: every bad fixture reports its own rule", () => {
    const silent = fixtures
      .filter((fixture) => fixture.basename.startsWith("bad"))
      .filter((fixture) => !(messagesOf.get(fixture.id) ?? []).some((message) => message.ruleId === ruleOf(fixture.slug)))
      .map((fixture) => `${fixture.id} (as ${fixture.virtualPath}) did not report ${ruleOf(fixture.slug) ?? "any rule"} — it reported ${reported(fixture)}`);
    expect(silent, "a NEVER stayed silent on the payload committed to prove it fires").toEqual([]);
  });

  test("AC4: every lawful fixture lints clean", () => {
    const noisy = fixtures
      .filter((fixture) => !fixture.basename.startsWith("bad"))
      .filter((fixture) => (messagesOf.get(fixture.id) ?? []).length > 0)
      .map((fixture) => `${fixture.id} (as ${fixture.virtualPath}) reported ${reported(fixture)}`);
    expect(noisy, "a rule fired on lawful code — a NEVER that over-reaches is refused too").toEqual([]);
  });

  test("AC4: every reported payload line carries a recorded reason (Q-08)", () => {
    const unmarked: string[] = [];
    for (const fixture of fixtures.filter((entry) => entry.basename.startsWith("bad"))) {
      const lines = readFileSync(fixture.absolutePath, "utf8").split("\n");
      for (const message of messagesOf.get(fixture.id) ?? []) {
        const line = lines[message.line - 1] ?? "";
        if (!line.includes(MARKER)) unmarked.push(`${fixture.id}:${message.line} (${message.ruleId ?? "parse error"}) — ${line.trim()}`);
      }
    }
    expect(unmarked, `a deliberate payload sits on a line with no '// ${MARKER} <CODE>' marker`).toEqual([]);
  });
});

describe("AC6: the ARCH-01 matrix is complete branch by branch", () => {
  test("AC6: every direction in the matrix has its own bad fixture", () => {
    const branches = readdirSync(join(CORPUS_ROOT, "boundaries")).filter((entry) =>
      statSync(join(CORPUS_ROOT, "boundaries", entry)).isDirectory(),
    );
    // Every branch of today's matrix, plus its lawful counterpart. The matrix is extended as layers
    // land (B-18), so a branch this list does not name yet is not an error here — a missing one is.
    const missing = [...MATRIX_BRANCHES, "good"].filter((branch) => !branches.includes(branch));
    expect(missing, "a matrix direction has no fixture proving the rule covers it").toEqual([]);
  });

  test.each(MATRIX_BRANCHES)("AC6: %s is refused where it is written", (branch) => {
    const own = fixtures.filter((fixture) => fixture.id.startsWith(`boundaries/${branch}/`) && fixture.basename.startsWith("bad"));
    expect(own.length, `boundaries/${branch} has no bad fixture`).toBeGreaterThan(0);
    const offendingLayer = branch.slice(0, branch.indexOf("-to-"));
    for (const fixture of own) {
      expect(fixture.virtualPath.startsWith(`src/${offendingLayer}/`), `${fixture.id} lints as ${fixture.virtualPath}, which is not in the offending layer`).toBe(true);
      expect(
        (messagesOf.get(fixture.id) ?? []).some((message) => message.ruleId === "cubit/boundaries"),
        `${fixture.id} reported ${reported(fixture)}`,
      ).toBe(true);
    }
  });

  // LAW-FMT bans `en-BD` outright: it is not a CLDR locale and falls back to Western grouping. The
  // ban home is the one place a locale tag can lawfully be written, so it is the one place the ban
  // has to hold — a rule that stopped at the allowlist would leave this NEVER with nowhere to fire.
  test.each(["src/core/format.ts", "src/server/report.ts"])("AC6: en-BD is refused in %s", async (virtualPath) => {
    const banned = await lintAs(`export const tag = "en-BD";\n`, virtualPath);
    expect(
      banned.some((message) => message.ruleId === "cubit/no-raw-intl"),
      `en-BD lints clean at ${virtualPath} — LAW-FMT bans it, this file included`,
    ).toBe(true);
    const lawful = await lintAs(`export const tag = "en-GB";\n`, virtualPath);
    expect(lawful.filter((message) => message.ruleId === "cubit/no-raw-intl"), `a lawful locale tag was refused at ${virtualPath}`).toEqual([]);
  });

  test.each(BAN_HOMES)("AC6: $rule allows $virtualPath and nothing beside it", async ({ rule, virtualPath }) => {
    const home = fixtures.find((fixture) => fixture.virtualPath === virtualPath);
    expect(home, `no fixture stands in for the allowlisted ${virtualPath}`).toBeDefined();
    expect(messagesOf.get(home!.id) ?? [], `${rule} fired inside its own ban home ${virtualPath}`).toEqual([]);

    // The ban home is an exact path, not a pattern: the same source one filename to the side is
    // refused (ARCH-02 — one home, and only one).
    const beside = virtualPath.replace(/\/([^/.]+)\./, "/$1-beside.");
    const messages = await lintAs(readFileSync(home!.absolutePath, "utf8"), beside);
    expect(
      messages.some((message) => message.ruleId === rule),
      `${rule} allowed ${beside} too — the allowlist is reading a pattern, not the exact path`,
    ).toBe(true);
  });
});
