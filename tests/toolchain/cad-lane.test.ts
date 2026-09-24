// The cad lane's price (V-VERIFY, v22 speed). The lane deselects a corpus's regeneration when
// nothing that corpus reads has moved, so the thing worth proving is the DECISION, corpus by corpus:
// what counts as moved for which corpus, what the diff is taken against, and — the only direction
// that can lose evidence — that a git which cannot answer regenerates everything rather than skips.
//
// Driven with an injected git, so every branch is provable on a tree of whatever shape this test
// happens to run on.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CAD_WORKERS,
  FIXTURE_CORPORA,
  FIXTURE_REGENERATION_TESTS,
  REGENERATION_ENVIRONMENT,
  REGENERATION_PROOF_PATH,
  cadLane,
  cadPytestArgv,
  changedPaths,
  corpusInputs,
  gitBlobId,
  readRegenerationProofs,
  recordRegenerationProofs,
  regenerationInputsDigest,
  regenerationSkippedLine,
  touchesCorpus,
  touchesFixtureInputs,
} from "../../scripts/lib/cad-lane.mjs";
import { GOLDEN_PYTEST, LANE_COMMANDS } from "../../scripts/verify.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

type GitRun = (argv: string[]) => { status: number | null; stdout: string };

/** A git that answers a named branch, a base, a committed diff, a working tree and the index's blobs. */
function fakeGit(answers: { branch?: string; committed?: string[]; working?: string[]; index?: string[]; fails?: string }): GitRun {
  return (argv) => {
    const command = argv.join(" ");
    const fail = { status: 1, stdout: "" };
    if (answers.fails !== undefined && command.startsWith(answers.fails)) return fail;
    if (command === "rev-parse --abbrev-ref HEAD") return { status: 0, stdout: `${answers.branch ?? "v22/speed-verify"}\n` };
    if (command === "rev-parse HEAD^") return { status: 0, stdout: "deadbeef\n" };
    if (command === "merge-base HEAD main") return { status: 0, stdout: "cafef00d\n" };
    if (command.startsWith("diff --name-only")) return { status: 0, stdout: `${(answers.committed ?? []).join("\n")}\n` };
    if (command.startsWith("status --porcelain")) return { status: 0, stdout: (answers.working ?? []).map((name) => ` M ${name}`).join("\n") };
    // `ls-files -s` prints `<mode> <blob> <stage>\t<path>` per tracked file under the paths asked.
    if (command.startsWith("ls-files -s")) return { status: 0, stdout: (answers.index ?? []).map((line) => `${line}\n`).join("") };
    throw new Error(`the lane asked git something this test does not answer: ${command}`);
  };
}

const corpus = (id: string) => {
  const found = FIXTURE_CORPORA.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no corpus ${id}`);
  return found;
};
const ALL = FIXTURE_CORPORA.map((entry) => entry.id);
const ignoring = (ids: string[]) => ids.map((id) => `--ignore=${corpus(id).test}`);

describe("each corpus is armed by its own inputs, and only by them", () => {
  test.each([
    ["the BNBC generator package", "fixtures/gen/rcc6_bnbc/emit/sheets/beams.py", ["rcc6-bnbc"]],
    ["the BNBC model, which F-ARCH reads its structure from", "fixtures/gen/rcc6_bnbc/model.py", ["rcc6-bnbc", "arch"]],
    ["the F-RCC6 generator", "fixtures/gen/rcc6.py", ["rcc6"]],
    ["the BNBC corpus", "fixtures/rcc6-bnbc/manifest.json", ["rcc6-bnbc"]],
    ["the F-RCC6 corpus", "fixtures/rcc6/rcc6.dxf", ["rcc6"]],
    ["the extractor the structural generators import", "cad/src/vextrus_cad/geometry.py", ["rcc6", "rcc6-bnbc"]],
    ["the BNBC suite", "cad/tests/rcc6_bnbc/test_rcc6_bnbc_size.py", ["rcc6-bnbc"]],
    ["BNBC's regeneration test itself", "cad/tests/sanity/test_rcc6_bnbc_regenerate.py", ["rcc6-bnbc"]],
    ["the F-ARCH generator", "fixtures/gen/arch/model.py", ["arch"]],
    ["the F-ARCH corpus", "fixtures/arch/arch.dxf", ["arch"]],
    ["the F-ARCH suite", "cad/tests/arch/test_arch_size.py", ["arch"]],
    ["F-ARCH's regeneration test itself", "cad/tests/sanity/test_arch_regenerate.py", ["arch"]],
    ["the lock every recomputation runs under", "cad/uv.lock", ALL],
  ])("%s moving arms exactly its corpora", (_what, path, armed) => {
    expect(FIXTURE_CORPORA.filter((entry) => touchesCorpus(entry, [path])).map((entry) => entry.id)).toEqual(armed);
    expect(touchesFixtureInputs(["src/app/page.tsx", path, "docs/README.md"])).toBe(true);
  });

  test.each([
    ["a screen", "src/app/page.tsx"],
    ["the gate itself", "scripts/verify.mjs"],
    ["a journey", "tests/e2e/j-001.spec.ts"],
    ["a cad test that reads committed bytes", "cad/tests/sanity/test_rcc6_dxf_sanity.py"],
    ["another fixture", "fixtures/model/model.json"],
    ["the generators' README", "fixtures/gen/README.md"],
  ])("%s moving arms none", (_what, path) => {
    expect(touchesFixtureInputs([path])).toBe(false);
  });

  test("nothing moved at all is not a reason to regenerate", () => {
    expect(touchesFixtureInputs([])).toBe(false);
  });

  test("a corpus directory is a prefix with its slash: F-RCC6's corpus is not F-RCC6-BNBC's", () => {
    expect(touchesCorpus(corpus("rcc6"), ["fixtures/rcc6-bnbc/rcc6-bnbc.dxf"])).toBe(false);
    expect(touchesCorpus(corpus("rcc6-bnbc"), ["fixtures/rcc6/rcc6.dxf"])).toBe(false);
  });
});

describe("what the diff is taken against", () => {
  test("on a lane branch: everything the branch changed against main, plus the working tree", () => {
    const seen: string[] = [];
    const git = fakeGit({ branch: "v22/speed-verify", committed: ["scripts/verify.mjs"], working: ["cad/src/vextrus_cad/model.py"] });
    const paths = changedPaths("/nowhere", (argv) => {
      seen.push(argv.join(" "));
      return git(argv);
    });
    expect(seen, "a lane branch must be diffed against its merge-base with main").toContain("merge-base HEAD main");
    expect(seen).toContain("diff --name-only cafef00d..HEAD");
    expect(paths).toEqual(["scripts/verify.mjs", "cad/src/vextrus_cad/model.py"]);
  });

  test("on main: the commit being gated, not the whole history", () => {
    const seen: string[] = [];
    changedPaths("/nowhere", (argv) => {
      seen.push(argv.join(" "));
      return fakeGit({ branch: "main", committed: ["src/app/page.tsx"] })(argv);
    });
    expect(seen).toContain("rev-parse HEAD^");
    expect(seen).toContain("diff --name-only deadbeef..HEAD");
    expect(seen, "main has no merge-base with itself worth asking for").not.toContain("merge-base HEAD main");
  });

  test("an uncommitted edit counts — the gate is run mid-edit more often than on a clean tree", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: [], working: ["fixtures/gen/rcc6_bnbc/__main__.py"] }), { readProofs: () => ({}) });
    expect(lane.regenerate).toEqual(["rcc6-bnbc"]);
  });
});

describe("a git that cannot answer never buys a skip", () => {
  test.each(["rev-parse --abbrev-ref", "merge-base", "diff --name-only", "status --porcelain"])("%s failing regenerates every corpus", (failing) => {
    expect(changedPaths("/nowhere", fakeGit({ fails: failing }))).toBeNull();
    const lane = cadLane("/nowhere", fakeGit({ fails: failing }));
    expect(lane.regenerate, "an unknown diff was read as an empty one").toEqual(ALL);
    expect(lane.argv).toEqual(["pytest", "cad", ...CAD_WORKERS]);
    expect(lane.note).toBeNull();
  });
});

/**
 * THE SESSION 8 PROOF: an F-ARCH edit does not re-run BNBC's regeneration. One global input list
 * made every edit under fixtures/gen/ pay BNBC's ~80 s once; each corpus now answers for itself.
 */
describe("an F-ARCH edit recomputes F-ARCH and never F-RCC6-BNBC", () => {
  test("the argv deselects BNBC's and F-RCC6's regeneration and keeps F-ARCH's", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["fixtures/gen/arch/model.py", "fixtures/arch/takeoff.golden.json"] }), { readProofs: () => ({}) });
    expect(lane.regenerate).toEqual(["arch"]);
    expect(lane.argv).toEqual(["pytest", "cad", ...ignoring(["rcc6", "rcc6-bnbc"]), ...CAD_WORKERS]);
    expect(lane.argv).not.toContain(`--ignore=${corpus("arch").test}`);
    expect(lane.note).toBe(regenerationSkippedLine([{ id: "rcc6", why: "unmoved" }, { id: "rcc6-bnbc", why: "unmoved" }]));
    expect(lane.note).toContain("rcc6-bnbc (nothing it reads moved)");
  });

  test("a BNBC model edit recomputes both — F-ARCH stands on BNBC's structure", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["fixtures/gen/rcc6_bnbc/model.py"] }), { readProofs: () => ({}) });
    expect(lane.regenerate).toEqual(["rcc6-bnbc", "arch"]);
    expect(lane.argv).toEqual(["pytest", "cad", ...ignoring(["rcc6"]), ...CAD_WORKERS]);
  });

  test("an extractor edit recomputes the structural corpora and not F-ARCH, which imports none of it", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["cad/src/vextrus_cad/report.py"] }), { readProofs: () => ({}) });
    expect(lane.regenerate).toEqual(["rcc6", "rcc6-bnbc"]);
    expect(lane.argv).toEqual(["pytest", "cad", ...ignoring(["arch"]), ...CAD_WORKERS]);
  });
});

describe("what the lane runs, and what it says about it", () => {
  test("nothing moved: the whole suite with every regeneration deselected, said out loud", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["src/app/page.tsx"], working: ["docs/x.md"] }), {
      readProofs: () => {
        throw new Error("no proof is consulted where nothing moved");
      },
    });
    expect(lane.regenerate).toEqual([]);
    expect(lane.argv).toEqual(["pytest", "cad", ...FIXTURE_REGENERATION_TESTS.map((path) => `--ignore=${path}`), ...CAD_WORKERS]);
    expect(lane.note).toBe(regenerationSkippedLine(ALL.map((id) => ({ id, why: "unmoved" as const }))));
    expect(lane.digests).toEqual({});
  });

  test("every regeneration test is a file the lane could ignore — the paths the lane is invoked with", () => {
    // The paths are the ones the LANE is invoked with (from the checkout), not pytest's rootdir
    // node ids — a `--deselect` spelled the other way deselects nothing and says nothing about it.
    for (const path of FIXTURE_REGENERATION_TESTS) expect(existsSync(join(REPO_ROOT, path)), `${path} is not a file the lane could ignore`).toBe(true);
    expect(FIXTURE_REGENERATION_TESTS).toEqual(FIXTURE_CORPORA.map((entry) => entry.test));
  });

  test("every input a corpus names is on the tree — a misspelt prefix would arm nothing, silently", () => {
    for (const entry of FIXTURE_CORPORA) {
      for (const input of corpusInputs(entry)) expect(existsSync(join(REPO_ROOT, input)), `${entry.id}: ${input}`).toBe(true);
    }
  });

  test("the suite itself is never narrowed — everything that reads committed bytes still runs", () => {
    expect(cadPytestArgv([])[1]).toBe("cad");
    expect(cadPytestArgv(ALL)).toEqual(["pytest", "cad", ...CAD_WORKERS]);
  });

  test("the suites that run the collection themselves still ask for all or none of the recomputations", () => {
    expect(cadPytestArgv({ regenerate: false })).toEqual(cadPytestArgv([]));
    expect(cadPytestArgv({ regenerate: true })).toEqual(cadPytestArgv(ALL));
  });

  test("the golden lane's pytest half is the one `pnpm test:golden` runs, F-ARCH's suite included", () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const script = manifest.scripts["test:golden"] ?? "";
    expect(script.endsWith(`pytest -q ${GOLDEN_PYTEST.join(" ")}`), script).toBe(true);
    expect(GOLDEN_PYTEST).toContain("cad/tests/arch");
  });

  test("verify's cad lane collects every golden suite, whichever recomputations it sets aside — so verify's golden lane leaves them to it", () => {
    for (const argv of [cadPytestArgv([]), cadPytestArgv(ALL)]) {
      expect(argv.slice(0, 2)).toEqual(["pytest", "cad"]);
      const ignored = argv.filter((arg) => arg.startsWith("--ignore=")).map((arg) => arg.slice("--ignore=".length));
      for (const path of GOLDEN_PYTEST) {
        expect(path.startsWith("cad/"), path).toBe(true);
        expect(ignored.some((gone) => path === gone || path.startsWith(`${gone}/`) || gone.startsWith(`${path}/`)), `${path} is set aside by the cad lane`).toBe(false);
      }
    }
    expect(LANE_COMMANDS["golden"], "verify's golden lane is its vitest half alone").toEqual([["node", "node_modules/vitest/vitest.mjs", "run", "--config", "tests/golden/vitest.config.ts"]]);
    expect(LANE_COMMANDS["cad"]?.[1]?.slice(0, 2)).toEqual(["pytest", "cad"]);
  });
});

/**
 * A green regeneration leaves a proof, per corpus, of the bytes it ran over; the same bytes buy that
 * corpus's skip a second time, and one byte moved does not.
 */
describe("a corpus's proof buys its skip a second time — and only for the same bytes", () => {
  const moved = { committed: ["fixtures/gen/arch/model.py"] };
  const index = [
    "100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tfixtures/gen/arch/model.py",
    "100644 dddddddddddddddddddddddddddddddddddddddd 0\tfixtures/gen/rcc6_bnbc/emit/dxf.py",
  ];

  test("the digest follows the corpus's own blobs and working bytes — a deleted file digests as absent", () => {
    const root = mkdtempSync(join(tmpdir(), "cad-lane-digest-"));
    try {
      mkdirSync(join(root, "fixtures/gen/arch"), { recursive: true });
      writeFileSync(join(root, "fixtures/gen/arch/x.py"), "a");
      const git = fakeGit({ ...moved, index, working: ["fixtures/gen/arch/x.py"] });
      const one = regenerationInputsDigest(root, corpus("arch"), git);
      expect(one).toMatch(/^[0-9a-f]{64}$/);
      expect(regenerationInputsDigest(root, corpus("arch"), git), "the same bytes digest the same").toBe(one);
      writeFileSync(join(root, "fixtures/gen/arch/x.py"), "b");
      expect(regenerationInputsDigest(root, corpus("arch"), git), "a working-tree byte moved").not.toBe(one);
      writeFileSync(join(root, "fixtures/gen/arch/x.py"), "a");
      expect(regenerationInputsDigest(root, corpus("arch"), git), "and moved back").toBe(one);
      const otherBlob = fakeGit({ ...moved, index: ["100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tfixtures/gen/arch/model.py", index[1] as string], working: ["fixtures/gen/arch/x.py"] });
      expect(regenerationInputsDigest(root, corpus("arch"), otherBlob), "an index blob of its own moved").not.toBe(one);
      rmSync(join(root, "fixtures/gen/arch/x.py"));
      expect(regenerationInputsDigest(root, corpus("arch"), git), "a file deleted from the tree is not the file that was there").not.toBe(one);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a corpus's digest ignores another corpus's bytes — a BNBC emitter blob moving leaves F-ARCH's proof standing", () => {
    const before = fakeGit({ ...moved, index });
    const after = fakeGit({ ...moved, index: [index[0] as string, "100644 eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee 0\tfixtures/gen/rcc6_bnbc/emit/dxf.py"] });
    expect(regenerationInputsDigest("/nowhere", corpus("arch"), after)).toBe(regenerationInputsDigest("/nowhere", corpus("arch"), before));
    expect(regenerationInputsDigest("/nowhere", corpus("rcc6-bnbc"), after)).not.toBe(regenerationInputsDigest("/nowhere", corpus("rcc6-bnbc"), before));
  });

  test("the digest is content-addressed: committing exactly the proved bytes digests the same as before the commit", () => {
    const root = mkdtempSync(join(tmpdir(), "cad-lane-commit-"));
    try {
      mkdirSync(join(root, "fixtures/gen/arch"), { recursive: true });
      writeFileSync(join(root, "fixtures/gen/arch/x.py"), "edited");
      const before = fakeGit({ ...moved, index: [...index, "100644 cccccccccccccccccccccccccccccccccccccccc 0\tfixtures/gen/arch/x.py"], working: ["fixtures/gen/arch/x.py"] });
      const edited = regenerationInputsDigest(root, corpus("arch"), before);
      const committedBlob = gitBlobId(Buffer.from("edited"));
      const after = fakeGit({ ...moved, index: [...index, `100644 ${committedBlob} 0\tfixtures/gen/arch/x.py`] });
      expect(regenerationInputsDigest(root, corpus("arch"), after), "the commit moved no byte the regeneration reads").toBe(edited);
      expect(committedBlob, "git's own blob id of the bytes (printf edited | git hash-object --stdin)").toBe("deb1bc2c60dc0eed5edb7e42cea94c7cb03c0050");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a git that cannot list the index yields no digest, and the corpus regenerates without consulting a proof", () => {
    expect(regenerationInputsDigest("/nowhere", corpus("arch"), fakeGit({ ...moved, fails: "ls-files" }))).toBeNull();
    const lane = cadLane("/nowhere", fakeGit({ ...moved, fails: "ls-files" }), {
      readProofs: () => {
        throw new Error("the proof must not be consulted here");
      },
    });
    expect(lane.regenerate).toEqual(["arch"]);
    expect(lane.digests).toEqual({});
  });

  test("a proof of exactly this corpus's tree: deselected, said out loud with the digest — the others unaffected", () => {
    const git = fakeGit({ committed: ["fixtures/gen/arch/model.py", "fixtures/gen/rcc6_bnbc/emit/dxf.py"], index });
    const arch = regenerationInputsDigest("/nowhere", corpus("arch"), git) as string;
    const proof = { digest: arch, provedAt: "2026-09-23T10:00:00.000Z" };
    const lane = cadLane("/nowhere", git, { readProofs: () => ({ arch: proof }) });
    expect(lane.regenerate, "BNBC's own edit is not bought off by F-ARCH's proof").toEqual(["rcc6-bnbc"]);
    expect(lane.argv).toEqual(["pytest", "cad", ...ignoring(["rcc6", "arch"]), ...CAD_WORKERS]);
    expect(lane.note).toContain(`arch (its inputs digest ${arch.slice(0, 12)}`);
    expect(lane.note).toContain(REGENERATION_PROOF_PATH);
    expect(Object.keys(lane.digests)).toEqual(["rcc6-bnbc"]);
  });

  test("a proof of another tree, or none, regenerates — and hands the digest up for the proof a green run leaves", () => {
    const git = fakeGit({ ...moved, index });
    const digest = regenerationInputsDigest("/nowhere", corpus("arch"), git) as string;
    for (const readProofs of [() => ({}), () => ({ arch: { digest: "0".repeat(64), provedAt: "2026-09-23T10:00:00.000Z" } })]) {
      const lane = cadLane("/nowhere", git, { readProofs });
      expect(lane.regenerate).toEqual(["arch"]);
      expect(lane.digests).toEqual({ arch: digest });
    }
  });

  test("proofs are written per corpus under node_modules/.cache, merged with the others, and a torn or malformed one reads as none", () => {
    const root = mkdtempSync(join(tmpdir(), "cad-lane-proof-"));
    try {
      expect(readRegenerationProofs(root)).toEqual({});
      const a = "ab".repeat(32);
      const b = "cd".repeat(32);
      recordRegenerationProofs(root, { arch: a }, "2026-09-23T10:00:00.000Z");
      const both = recordRegenerationProofs(root, { "rcc6-bnbc": b }, "2026-09-23T11:00:00.000Z");
      expect(both, "a later corpus's proof keeps the earlier one's").toEqual({
        arch: { digest: a, provedAt: "2026-09-23T10:00:00.000Z" },
        "rcc6-bnbc": { digest: b, provedAt: "2026-09-23T11:00:00.000Z" },
      });
      expect(existsSync(join(root, REGENERATION_PROOF_PATH)), "machine-local, never a committed path").toBe(true);
      expect(readRegenerationProofs(root)).toEqual(both);
      writeFileSync(join(root, REGENERATION_PROOF_PATH), '{"corpora": {"arch": {"digest": "torn');
      expect(readRegenerationProofs(root), "a torn proof").toEqual({});
      writeFileSync(join(root, REGENERATION_PROOF_PATH), JSON.stringify({ corpora: { arch: { digest: "not-a-digest", provedAt: "x" } } }));
      expect(readRegenerationProofs(root), "a malformed proof").toEqual({});
      writeFileSync(join(root, REGENERATION_PROOF_PATH), JSON.stringify({ digest: a, provedAt: "2026-09-21T10:00:00.000Z" }));
      expect(readRegenerationProofs(root), "the one-proof file of before session 8 proves no corpus").toEqual({});
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the proof's path is gitignored ground — node_modules — and the environment it covers is on the tree", () => {
    expect(REGENERATION_PROOF_PATH.startsWith("node_modules/")).toBe(true);
    for (const pin of REGENERATION_ENVIRONMENT) expect(existsSync(join(REPO_ROOT, pin)), `${pin} pins the extractor's environment`).toBe(true);
  });
});
