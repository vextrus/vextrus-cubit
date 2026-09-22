// T-MH, L-MEA-01, B-23 — the method-hash stage proves what it says it proves. L-MEA-01 hashes a
// method "whole into a committed manifest that a verify stage refuses to see drift; a comment edit
// forces a version bump". Until this suite the stage hashed each manifest's DECLARATIONS and never a
// byte of code, so an edit to a method's body passed while the stage printed a green line about it.
//
// The refusals are proved on a fixture tree judged by the shipped verdict function — the same
// function the stage runs over the product — so a byte can be changed without touching the product.
// The product's own records are then held to its files by an independent sha256, and the stage is
// run as the chain runs it.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { closureOf, closureRecord, greenLines, manifestsIn, methodHashVerdict, methodsDigest } from "../../scripts/method-hashes.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const STAGE = "scripts/method-hashes.mjs";
const AREA = "src/core/rulesets/methods/demo";
const MANIFEST = `${AREA}/demo.methods.json`;
const PRISM = `${AREA}/prism.ts`;
const HELPER = `${AREA}/helper.ts`;
const SOLO = `${AREA}/solo.ts`;
const EXPR = "src/core/rulesets/methods/expr.ts";

type Declaration = { ruleId: string; version: string; law: string; module: string };
type Manifest = { methods: Record<string, Declaration> | Declaration[]; digest: string; sha256?: Record<string, Record<string, string>> };

const scratches: string[] = [];
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

function put(root: string, rel: string, text: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

function declaration(ruleId: string, version: string, module: string): Declaration {
  return { ruleId, version, law: "L-MEA-01", module };
}

/** A manifest as the product records one: the declarations, their digest, and each pair's bytes. */
function record(root: string, declared: readonly Declaration[]): void {
  const methods = Object.fromEntries(declared.map((entry) => [`${entry.ruleId}@${entry.version}`, entry]));
  const sha256 = Object.fromEntries(declared.map((entry) => [`${entry.ruleId}@${entry.version}`, closureRecord(root, entry.module)]));
  put(root, MANIFEST, `${JSON.stringify({ methods, digest: methodsDigest({ methods }), sha256 }, null, 2)}\n`);
}

/**
 * A method area of three pairs: two computed by ONE file (as `columns/concrete.ts` computes the
 * rectangular and the circular column), one of those reading an area-local helper (as plaster and
 * paint read `face.ts`), and a third alone — all three trees in the shared `expr.ts`.
 */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "cubit-method-hash-"));
  scratches.push(root);
  put(root, EXPR, "export const K = (value: string): string => value;\n");
  put(root, HELPER, 'import { K } from "../expr";\nexport const HALF = K("0.5");\n');
  put(root, PRISM, 'import { K } from "../expr";\nimport { HALF } from "./helper";\nexport const RECT = K("1");\nexport const ROUND = HALF;\n');
  put(root, SOLO, 'import { K } from "../expr";\nexport const SOLO = K("2");\n');
  record(root, [declaration("demo.prism", "1", PRISM), declaration("demo.prism.round", "1", PRISM), declaration("demo.solo", "1", SOLO)]);
  return root;
}

function verdictOf(root: string): ReturnType<typeof methodHashVerdict> {
  return methodHashVerdict(root, manifestsIn(root));
}

function edit(root: string, rel: string): void {
  writeFileSync(join(root, rel), `${readFileSync(join(root, rel), "utf8")}// a comment is an edit (L-MEA-01)\n`);
}

function sha256Of(rel: string): string {
  return createHash("sha256").update(readFileSync(join(REPO_ROOT, rel))).digest("hex");
}

describe("T-MH: a changed implementation under a standing (rule id, version) is refused by name", () => {
  test("a fixture recorded today is green, and says what it proved", () => {
    const verdict = verdictOf(fixture());
    expect(verdict.refusals, "a tree whose records are its bytes is refused nothing").toEqual([]);
    expect(verdict.pairs, "three pairs declared").toBe(3);
    expect(verdict.files, "three area files hashed — expr.ts, shared, in no closure").toBe(3);
  });

  test("one byte changed under the same version is refused, naming the file, the pair and the remedy", () => {
    const root = fixture();
    edit(root, SOLO);
    const verdict = verdictOf(root);
    expect(verdict.refusals, "exactly one refusal: the one file that moved").toHaveLength(1);
    const [said] = verdict.refusals as [string];
    expect(said, "the refusal names the file").toContain(`${SOLO} changed under demo.solo@1 `);
    expect(said, "and names the remedy: a new version, never a re-recorded sha").toMatch(/new version of that pair.*re-recording the sha under a standing pair is the edit this stage refuses/);
    expect(verdict.digestsMatched, "the declarations did not move — the digest's line stays true, and is not the whole verdict").toBe(true);
  });

  test("a version bump recorded with the new bytes is accepted", () => {
    const root = fixture();
    edit(root, SOLO);
    record(root, [declaration("demo.prism", "1", PRISM), declaration("demo.prism.round", "1", PRISM), declaration("demo.solo", "2", SOLO)]);
    expect(verdictOf(root).refusals, "demo.solo@2 is a new pair, recorded with the bytes it computes by").toEqual([]);
  });

  test("two pairs in one file: one refusal names both, and bumping one of them does not quiet the other", () => {
    const root = fixture();
    const before = JSON.parse(readFileSync(join(root, MANIFEST), "utf8")) as Manifest;
    expect(before.sha256?.["demo.prism@1"]?.[PRISM], "both pairs record the same sha for their shared file").toBe(before.sha256?.["demo.prism.round@1"]?.[PRISM]);

    edit(root, PRISM);
    const refused = verdictOf(root).refusals;
    expect(refused, "one line for the one file").toHaveLength(1);
    expect(refused[0], "naming every pair its bytes compute").toContain(`${PRISM} changed under demo.prism.round@1, demo.prism@1 `);
    expect(refused[0], "and the remedy for each").toContain("new version of each of the 2 pairs");

    const bumped = JSON.parse(readFileSync(join(root, MANIFEST), "utf8")) as Manifest;
    const prism = declaration("demo.prism", "2", PRISM);
    const methods = { ...(bumped.methods as Record<string, Declaration>) };
    delete methods["demo.prism@1"];
    methods["demo.prism@2"] = prism;
    const sha256 = { ...bumped.sha256 };
    delete sha256["demo.prism@1"];
    sha256["demo.prism@2"] = closureRecord(root, PRISM);
    put(root, MANIFEST, JSON.stringify({ methods, digest: methodsDigest({ methods }), sha256 }));
    const still = verdictOf(root).refusals;
    expect(still, "the circular half still stands on the old bytes").toHaveLength(1);
    expect(still[0], "and only it is named").toContain(`${PRISM} changed under demo.prism.round@1 `);
  });

  test("the closure: an area-local helper is its readers' code, and the shared language is not", () => {
    const root = fixture();
    expect(closureOf(root, PRISM).files, "prism.ts reaches its helper, and not expr.ts").toEqual([HELPER, PRISM]);
    edit(root, HELPER);
    const refused = verdictOf(root).refusals;
    expect(refused, "the helper's edit is refused under the two pairs that read it").toHaveLength(1);
    expect(refused[0]).toContain(`${HELPER} changed under demo.prism.round@1, demo.prism@1 `);

    const shared = fixture();
    edit(shared, EXPR);
    expect(verdictOf(shared).refusals, "expr.ts is shared infrastructure, guarded by its own proofs — no pair's version moves for it").toEqual([]);
  });

  test("a pair with no record, and a record for a pair nothing declares, are refused", () => {
    const root = fixture();
    const held = JSON.parse(readFileSync(join(root, MANIFEST), "utf8")) as Manifest;
    const sha256: Record<string, Record<string, string>> = { ...held.sha256, "demo.gone@1": { [SOLO]: "0".repeat(64) } };
    delete sha256["demo.solo@1"];
    put(root, MANIFEST, JSON.stringify({ ...held, sha256 }));
    const refused = verdictOf(root).refusals;
    expect(refused.some((line) => line.includes("records no sha256 for demo.solo@1")), refused.join("\n")).toBe(true);
    expect(refused.some((line) => line.includes("records a sha256 for demo.gone@1, which it does not declare")), refused.join("\n")).toBe(true);
  });
});

describe("T-MH: the product's manifests record today's bytes, under one spelling", () => {
  const manifests = manifestsIn(REPO_ROOT);
  const read = (rel: string): Manifest => JSON.parse(readFileSync(join(REPO_ROOT, rel), "utf8")) as Manifest;

  test("every declared pair names its file under `module`, and records the sha256 of every file its closure reaches", () => {
    expect(manifests.length, "the stage is armed over the product's shards").toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const rel of manifests) {
      const manifest = read(rel);
      for (const entry of Object.values(manifest.methods)) {
        const pair = `${entry.ruleId}@${entry.version}`;
        if (Object.keys(entry).includes("implementation")) wrong.push(`${rel}: ${pair} spells its path \`implementation\` — every shard spells it \`module\``);
        const recorded = manifest.sha256?.[pair] ?? {};
        expect(Object.keys(recorded).sort(), `${pair} records exactly its closure`).toEqual(closureOf(REPO_ROOT, entry.module).files);
        for (const [file, sha] of Object.entries(recorded)) if (sha !== sha256Of(file)) wrong.push(`${rel}: ${pair} records ${sha} for ${file}, whose bytes hash to ${sha256Of(file)}`);
      }
    }
    expect(wrong, "the records are the bytes in the tree — an independent sha256 of each file agrees").toEqual([]);
  });

  test("columns/concrete.ts computes two pairs, and both record its one sha", () => {
    const columns = read("src/core/rulesets/methods/columns/columns.methods.json");
    const file = "src/core/rulesets/methods/columns/concrete.ts";
    expect(columns.sha256?.["rcc.column.concrete@1"], "the rectangular column's closure is its one file").toEqual({ [file]: sha256Of(file) });
    expect(columns.sha256?.["rcc.column.circular.concrete@1"], "and the circular column's is the same file, the same bytes").toEqual({ [file]: sha256Of(file) });
  });

  test("the closure line is drawn where the stage's header draws it", () => {
    const masonry = read("src/core/rulesets/methods/masonry-finishes/masonry-finishes.methods.json");
    const face = "src/core/rulesets/methods/masonry-finishes/face.ts";
    for (const pair of ["finish.surface.plaster@1", "finish.surface.paint@1"]) {
      expect(Object.keys(masonry.sha256?.[pair] ?? {}), `${pair} reads face.ts — area-local, so its code`).toContain(face);
    }
    const everyFile = manifests.flatMap((rel) => Object.values(read(rel).sha256 ?? {}).flatMap((recorded) => Object.keys(recorded)));
    expect(everyFile, "expr.ts is the shared language — guarded by its own proofs, in no closure").not.toContain(EXPR);
    expect(everyFile, "law.ts is the types a method is declared in — in no closure").not.toContain("src/core/rulesets/methods/law.ts");
  });

  test("the shipped stage is green over the product and prints both proofs", () => {
    const ran = spawnSync(process.execPath, [join(REPO_ROOT, STAGE)], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    const said = `${ran.stdout ?? ""}${ran.stderr ?? ""}`;
    expect(ran.status, `\`node ${STAGE}\` exits 0 over the product:\n${said.slice(-1500)}`).toBe(0);
    const verdict = methodHashVerdict(REPO_ROOT, manifests);
    for (const line of greenLines(verdict)) expect(said, "each green line claims one proof, and both are printed").toContain(line);
  });
});
