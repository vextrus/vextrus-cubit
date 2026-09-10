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
// white-box: AC-2 — the ban this file judges ("zero `NOT EXISTS` under src/core/residue/channels/**, exactly one in residue.ts") is a claim about source text, so the tree's one lexer is what reads it: judged is code and the literals code states, never prose (B-17 — one lexical machine, not a second grep beside it).
import { dialectOf, scanned } from "../support/source-lex";

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

/**
 * The corpus directories whose payload proves a committed SCAN rather than an ESLint rule, each
 * named with the test that fires on it.
 *
 * A NEVER the Bible states is not always an ESLint rule: L-CAD-06's ban on spelling a view type
 * outside the module that declares the vocabulary is a committed test (inc-200 — no M2 node is
 * toolchain-tagged and `scripts/eslint/**` is locked), and its payload still belongs in the one
 * fixture corpus this tree keeps rather than in a second home beside it (B-17). Such a directory is
 * excluded from the two questions that only make sense of a rule — which rule id it claims, and
 * whether ESLint reported that id — and from nothing else: it still owes a bad fixture and a lawful
 * counterpart, its lawful half still has to lint clean, and any message it does report still has to
 * sit on a marked line. Naming the corpus here is a declared exception, never a blanket: a directory
 * that is neither a rule's nor named here still fails the claim check below.
 *
 * The value is the repo-relative path of the test that proves the corpus fires, and it is resolved
 * rather than read: ARCH-01 asks for "a fixture test proving it fires" and Q-07 fixes what naming a
 * test is worth — "a name in a comment or in a lane nothing runs exercises nothing". So the entry
 * below is checked to be a file, to name this corpus, and to sit where the armed lane runs it.
 *
 * `view-type-literals` is L-CAD-06's ban on spelling a view type outside the module that declares
 * the vocabulary, proved as a committed scan (inc-200).
 */
const SCAN_CORPORA: Readonly<Record<string, string>> = {
  "view-type-literals": "src/modules/takeoff/partition/views/__tests__/view-type-literals.test.ts",
  // `conversion-literals` is L-FRM-06's ban on spelling a conversion factor outside the unit canon,
  // proved as a committed scan for the same reason (`scripts/eslint/**` is locked at M2). The prover
  // sits beside the scanner it drives, as the view-type one does.
  "conversion-literals": "src/core/units/__tests__/literal-scan.test.ts",
  // `no-gate-outside-worker` is SEAM-GATE's ban on reaching `src/core/gate` from `src/modules/**` or
  // `src/app/**` — the gate is the sole writer of quantity lines and rail observations (L-MEA-08),
  // and a sole writer nothing else can call is the only kind there is. Committed as a scan for the
  // same reason as the two above, with its prover beside the scanner it drives (inc-209).
  "no-gate-outside-worker": "src/core/gate/__tests__/gate-import-scan.test.ts",
  // `residue-not-exists` is L-QTY-05's ban on spelling `NOT EXISTS` — in SQL or as drizzle's
  // `notExists` — anywhere but the one residue query: a channel reader answers what it SAW, and a
  // second home for "this is absent" is the defect. Committed as a scan for the same reason as the
  // three above (`scripts/eslint/**` is locked at M2), with its prover beside the query it governs
  // (inc-216). Unlike the three above, the SUBSTANCE of this ban is not deferred to that prover:
  // "zero under channels/**, exactly one in residue.ts, fires on bad, clean on good" is asserted
  // below, against the tree, so the ban holds whatever the prover beside the query happens to say.
  "residue-not-exists": "src/core/residue/__tests__/not-exists-scan.test.ts",
};

/**
 * Where the unit lane's committed include collects a suite from: `tests/**` and a `__tests__`
 * directory under `src/**`. A prover named outside these is a prover no lane executes.
 */
const ARMED_LANE = [/^src\/(?:[^/]+\/)*__tests__\/[^/]+\.test\.tsx?$/u, /^tests\/(?:[^/]+\/)*[^/]+\.test\.tsx?$/u];

/** The two trees under `tests/` the same config excludes: payload and journeys, neither a unit lane. */
const NOT_A_LANE = ["tests/e2e/", "tests/lint-fixtures/"];

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
  // white-box: AC4 — the corpus under tests/lint-fixtures/** IS this criterion's subject: a payload of source text is the only thing a linter can be run on, and walking the corpus is how each payload reaches the product's own flat config below (nothing under src/, scripts/ or db/ is read here).
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
    // white-box: AC4 — the fixture's text is the INPUT the product is driven with, not an assertion: it is handed to the shipped flat config through lintText, and every assertion below is on what ESLint reported.
    messagesOf.set(fixture.id, await lintAs(readFileSync(fixture.absolutePath, "utf8"), fixture.virtualPath));
  }
}, 120_000);

describe("AC4: every NEVER fires on its committed fixture", () => {
  // The seam bans are armed here and extended as layers land (B-18), so this asserts that every
  // rule in the closed set has its corpus directory — not that the corpus has nothing else. A later
  // increment that lands a rule with its fixtures adds a directory; that is lawful, and a test that
  // went red for it would be freezing a listing the Bible says will grow.
  test("AC4: every rule in the closed set has its corpus directory", () => {
    // white-box: AC4 — "every NEVER has a committed fixture" is a claim about which payloads the tree carries; a rule with no corpus has nothing to run on, so its absence cannot be observed by running anything.
    const slugs = readdirSync(CORPUS_ROOT).filter((entry) => statSync(join(CORPUS_ROOT, entry)).isDirectory());
    const missing = Object.keys(RULE_OF_SLUG).filter((slug) => !slugs.includes(slug));
    expect(missing, "a rule in the closed set has no committed fixture corpus").toEqual([]);
  });

  test("AC4: every corpus directory names the rule it proves, or the scan that does", () => {
    // white-box: AC4 — the same reading from the other side: an unclaimed corpus directory is a payload no NEVER answers for, and only the listing of the corpus can show it.
    const slugs = readdirSync(CORPUS_ROOT).filter((entry) => statSync(join(CORPUS_ROOT, entry)).isDirectory());
    const unclaimed = slugs.filter((slug) => ruleOf(slug) === null && SCAN_CORPORA[slug] === undefined);
    expect(unclaimed, "a corpus directory proves no rule — name it after the rule it fires, or declare the committed scan it proves, so the suite can judge it").toEqual([]);
  });

  test("AC4: a declared scan corpus owes a bad fixture and a lawful counterpart, like any other", () => {
    for (const [slug, proves] of Object.entries(SCAN_CORPORA)) {
      const own = fixtures.filter((fixture) => fixture.slug === slug);
      expect(own.filter((fixture) => fixture.basename.startsWith("bad")).length, `${slug} (proved by ${proves}) has no bad fixture`).toBeGreaterThan(0);
      expect(own.filter((fixture) => fixture.basename.startsWith("good")).length, `${slug} has no lawful counterpart`).toBeGreaterThan(0);
    }
  });

  test("AC4: the test a scan corpus is excused by exists, names the corpus, and sits in an armed lane", () => {
    for (const [slug, proves] of Object.entries(SCAN_CORPORA)) {
      const absolute = join(REPO_ROOT, proves);
      const exists = statSync(absolute, { throwIfNoEntry: false });
      expect(
        exists?.isFile() ?? false,
        `${slug} is excused from the rule questions because ${proves} proves it fires — and that path is not a file in the tree, so the excuse rests on nothing (ARCH-01)`,
      ).toBe(true);

      // white-box: AC4 (ARCH-01, Q-07) — the excuse IS a claim about another file's text: that the
      // named prover reaches THIS corpus. Nothing at runtime distinguishes a prover that scans this
      // payload from one that scans another, so the reference is resolved by reading it. Only the
      // reference is judged; whether the scan fires is asserted where the criterion places it, in
      // the prover itself, never re-run from here.
      const source = readFileSync(absolute, "utf8");
      const names = source.includes(`tests/lint-fixtures/${slug}/bad`) || (source.includes(slug) && source.includes("bad"));
      expect(names, `${proves} never names the ${slug} corpus or its bad payload — a prover that does not reach the payload proves nothing about it (Q-08)`).toBe(true);

      const armed = ARMED_LANE.some((shape) => shape.test(proves)) && !NOT_A_LANE.some((tree) => proves.startsWith(tree));
      expect(armed, `${proves} does not sit where the unit lane's committed include collects a suite — a name in a lane nothing runs exercises nothing (Q-07)`).toBe(true);
    }
  });

  test.each(Object.entries(RULE_OF_SLUG))("AC4: %s has a bad fixture and a good one", (slug, ruleId) => {
    const own = fixtures.filter((fixture) => fixture.slug === slug);
    expect(own.filter((fixture) => fixture.basename.startsWith("bad")).length, `${slug} proves ${ruleId} on no bad fixture`).toBeGreaterThan(0);
    expect(own.filter((fixture) => fixture.basename.startsWith("good")).length, `${slug} has no lawful counterpart`).toBeGreaterThan(0);
  });

  test("AC4: every bad fixture reports its own rule", () => {
    const silent = fixtures
      .filter((fixture) => fixture.basename.startsWith("bad"))
      // A scan corpus is judged by the scan its ban is committed as (SCAN_CORPORA), not by ESLint:
      // asking whether a rule fired on a payload no rule governs would fail every honest fixture.
      // For `residue-not-exists` that judgement is made here, in "AC-2: L-QTY-05's one NOT EXISTS".
      .filter((fixture) => SCAN_CORPORA[fixture.slug] === undefined)
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
      // white-box: AC4 (Q-08) — the criterion IS a property of the fixture's text: a deliberate payload must sit on a line carrying its recorded reason, and a comment marker has no runtime observable at all.
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
    // white-box: AC6 — "the matrix is complete branch by branch" is a claim about which payloads the corpus carries; a direction with no fixture is a direction nothing can be run on.
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
    // white-box: AC6 — the home fixture's text is the INPUT the shipped config is driven with a second time, at a path one filename to the side; the assertion is on what ESLint then reported.
    const messages = await lintAs(readFileSync(home!.absolutePath, "utf8"), beside);
    expect(
      messages.some((message) => message.ruleId === rule),
      `${rule} allowed ${beside} too — the allowlist is reading a pattern, not the exact path`,
    ).toBe(true);
  });
});

/**
 * L-QTY-05's ban, spelled as AC-2 states it: the SQL phrase case-insensitively and however a wrapped
 * statement breaks it across whitespace, and drizzle's `notExists` operator — an identifier, and so
 * matched exactly.
 */
const NOT_EXISTS = /not\s+exists|\bnotExists\b/giu;

/**
 * The lexical modes a spelling counts in: code, and the literals code states — SQL reaches a driver
 * as a string, so a scan blind to literals would be blind to every straight spelling. Prose states
 * nothing, which is what the lawful half of the corpus is built to prove.
 */
const SPELLED_IN = new Set<string>(["code", "single", "double", "template", "regex"]);

/** The channel module the clause bans the phrase inside, and the one file it allows it in. */
const RESIDUE_CHANNELS = "src/core/residue/channels";
const RESIDUE_QUERY = "src/core/residue/residue.ts";

/** The three readers the increment's interfaces declare; a fourth landed later is judged with them. */
const DECLARED_READERS = ["register.ts", "partition.ts", "layout.ts"];

const NOT_EXISTS_SLUG = "residue-not-exists";

interface Spelling {
  /** Repo-relative, POSIX-spelled. */
  readonly file: string;
  readonly line: number;
  readonly phrase: string;
}

/**
 * Every spelling of the ban one file STATES, read through the tree's one source lexer
 * (`tests/support/source-lex`, B-17) so what is judged is code and the literals code states.
 */
function spellingsOf(absolutePath: string): Spelling[] {
  // white-box: AC-2 — L-QTY-05's ban IS a property of source text ("`NOT EXISTS` … appears once, in the residue query"): a spelling that is never executed has no runtime observable, so reading the file is the only way the ban can be judged at all. What is read is the channel module, the residue query and this increment's own declared corpus, and nothing else.
  const source = readFileSync(absolutePath, "utf8");
  const mask = new Array<string>(source.length).fill(" ");
  for (const { index, char, mode } of scanned(source, dialectOf(absolutePath))) {
    mask[index] = char === "\n" ? "\n" : SPELLED_IN.has(mode) ? char : " ";
  }
  const judged = mask.join("");
  const file = absolutePath.slice(REPO_ROOT.length + 1).split(sep).join("/");
  const found: Spelling[] = [];
  NOT_EXISTS.lastIndex = 0;
  for (let match = NOT_EXISTS.exec(judged); match !== null; match = NOT_EXISTS.exec(judged)) {
    // A phrase may wrap; the line it is found on is where it begins — the line a reader would strike.
    found.push({ file, line: judged.slice(0, match.index).split("\n").length, phrase: match[0] });
  }
  return found;
}

const spelledAt = (spellings: readonly Spelling[]): string[] => spellings.map((one) => `${one.file}:${one.line} (${one.phrase})`);

/**
 * AC-2's substance, asserted here rather than deferred to the prover the corpus is excused by: a
 * committed scan is a NEVER like any other, and the tests above only judge that the excuse names a
 * real file in an armed lane. What the clause actually says — `NOT EXISTS` is banned inside the
 * channel module, appears once in the residue query, fires on the declared payload and stays silent
 * on its lawful counterpart — is checked against the tree itself, so a prover that scanned nothing
 * would leave every claim below standing on its own.
 */
describe("AC-2: L-QTY-05's one NOT EXISTS", () => {
  test("AC-2: no channel reader spells the phrase — a reader answers what it SAW", () => {
    // white-box: AC-2 — the ban IS a property of source text ("zero occurrences under
    // src/core/residue/channels/**"): a spelling that never runs has no runtime observable at all,
    // so only reading the text can find one. The governed files are DISCOVERED by walking the
    // channel module rather than transcribed, so a fourth reader landed later is judged by the same
    // scan with no edit here (B-19).
    const channelsRoot = join(REPO_ROOT, RESIDUE_CHANNELS);
    const readers = collect(channelsRoot);
    const names = readers.map((path) => path.slice(channelsRoot.length + 1).split(sep).join("/"));
    const missing = DECLARED_READERS.filter((reader) => !names.includes(reader));
    expect(missing, `${RESIDUE_CHANNELS} is missing a declared reader — a scan over a tree that is not there is silent for the wrong reason`).toEqual([]);
    expect(
      spelledAt(readers.flatMap(spellingsOf)),
      "a channel reader spells an absence — its answer is a Sighting[], and an empty list is the only way it says nothing (L-QTY-05)",
    ).toEqual([]);
  });

  test("AC-2: the residue query spells it exactly once — the one home the clause allows", () => {
    // white-box: AC-2 — the same reading from the other side, and the same reason: the clause allows
    // the phrase exactly once, and a count of spellings in a file is a property of its text. The one
    // total pinned here is pinned to the thing that defines it — L-QTY-05's "appears once".
    const spelled = spellingsOf(join(REPO_ROOT, RESIDUE_QUERY));
    expect(
      spelledAt(spelled),
      `${RESIDUE_QUERY} is the one place L-QTY-05 allows the phrase, and it holds it exactly once — not none, and never twice`,
    ).toHaveLength(1);
  });

  test("AC-2: the declared corpus discriminates — every bad payload spells it, every lawful half is silent", () => {
    // white-box: AC-2 — the corpus under tests/lint-fixtures/** IS the subject: a payload of source
    // text is the only thing a scan can be run on, and driving it is how the ban's discrimination is
    // observed (nothing under src/, scripts/ or db/ is read here).
    const own = fixtures.filter((fixture) => fixture.slug === NOT_EXISTS_SLUG);
    expect(own.length, `the ${NOT_EXISTS_SLUG} corpus carries no payload at all`).toBeGreaterThan(0);

    const bad = own.filter((fixture) => fixture.basename.startsWith("bad"));
    const silent = bad.filter((fixture) => spellingsOf(fixture.absolutePath).length === 0).map((fixture) => fixture.id);
    expect(silent, "a payload committed to prove the ban fires states nothing the ban names — the scan would be silent on it for the wrong reason").toEqual([]);

    // Both shapes AC-2 names, so a corpus that carried only the straight SQL spelling could not stand
    // in for a ban that also covers drizzle's operator.
    const phrases = bad.flatMap((fixture) => spellingsOf(fixture.absolutePath)).map((one) => one.phrase);
    expect(phrases.some((phrase) => /not\s+exists/iu.test(phrase)), "the corpus never writes the SQL phrase the ban is about").toBe(true);
    expect(phrases, "the corpus never writes drizzle's `notExists`, which asks the same question in TypeScript").toContain("notExists");

    const lawful = own.filter((fixture) => !fixture.basename.startsWith("bad"));
    expect(lawful.length, `${NOT_EXISTS_SLUG} has no lawful counterpart to be clean on`).toBeGreaterThan(0);
    // The silence is only worth something if the lawful half really carries the trap: a file that
    // never mentions the phrase would pass a plain grep too.
    // white-box: AC-2 — the trap IS a property of the lawful payload's text: "clean on good.ts" is worth nothing unless good.ts writes the very phrase in prose, and a comment has no runtime observable. The file read is this increment's own declared corpus under tests/lint-fixtures/**, never product source.
    const trapped = lawful.filter((fixture) => readFileSync(fixture.absolutePath, "utf8").toUpperCase().includes("NOT EXISTS"));
    expect(trapped.length, `${NOT_EXISTS_SLUG}'s lawful half never writes the phrase in prose — then its silence proves nothing about reading code rather than text`).toBeGreaterThan(0);
    expect(
      lawful.flatMap((fixture) => spelledAt(spellingsOf(fixture.absolutePath))),
      "the lawful half of the corpus states the ban in its CODE — a scan that read prose would refuse a file for explaining the ban it obeys (L-QTY-05)",
    ).toEqual([]);
  });
});
