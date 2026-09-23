// The cad lane's price (V-VERIFY, v22 speed). The lane deselects the ~80 s fixture regeneration
// when nothing it reads has moved, so the thing worth proving is the DECISION: what counts as
// moved, what the diff is taken against, and — the only direction that can lose evidence — that a
// git which cannot answer regenerates rather than skips.
//
// Driven with an injected git, so every branch is provable on a tree of whatever shape this test
// happens to run on.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  FIXTURE_REGENERATION_TESTS,
  REGENERATION_ENVIRONMENT,
  REGENERATION_PROOF_PATH,
  REGENERATION_SKIPPED_LINE,
  cadLane,
  CAD_WORKERS,
  cadPytestArgv,
  changedPaths,
  gitBlobId,
  readRegenerationProof,
  recordRegenerationProof,
  regenerationInputsDigest,
  regenerationProvenLine,
  touchesFixtureInputs,
} from "../../scripts/lib/cad-lane.mjs";

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

describe("the cad lane runs the fixture regeneration when a fixture could have moved", () => {
  test.each([
    ["the BNBC generator package", "fixtures/gen/rcc6_bnbc/sheets.py"],
    ["the F-RCC6 generator", "fixtures/gen/rcc6.py"],
    ["the committed corpus", "fixtures/rcc6-bnbc/manifest.json"],
    ["the other corpus", "fixtures/rcc6/rcc6.dxf"],
    ["the extractor the generator imports", "cad/src/vextrus_cad/geometry.py"],
    ["the BNBC suite", "cad/tests/rcc6_bnbc/test_rcc6_bnbc_size.py"],
    ["the regeneration test itself", "cad/tests/sanity/test_rcc6_bnbc_regenerate.py"],
  ])("%s moving arms it", (_what, path) => {
    expect(touchesFixtureInputs([path])).toBe(true);
    expect(touchesFixtureInputs(["src/app/page.tsx", path, "docs/README.md"])).toBe(true);
  });

  test.each([["a screen", "src/app/page.tsx"], ["the gate itself", "scripts/verify.mjs"], ["a journey", "tests/e2e/j-001.spec.ts"], ["a cad test that reads committed bytes", "cad/tests/sanity/test_rcc6_dxf_sanity.py"], ["another fixture", "fixtures/model/model.json"]])("%s moving does not", (_what, path) => {
    expect(touchesFixtureInputs([path])).toBe(false);
  });

  test("nothing moved at all is not a reason to regenerate", () => {
    expect(touchesFixtureInputs([])).toBe(false);
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
    const lane = cadLane("/nowhere", fakeGit({ committed: [], working: ["fixtures/gen/rcc6_bnbc/__main__.py"] }));
    expect(lane.regenerate).toBe(true);
  });
});

describe("a git that cannot answer never buys a skip", () => {
  test.each(["rev-parse --abbrev-ref", "merge-base", "diff --name-only", "status --porcelain"])("%s failing regenerates", (failing) => {
    expect(changedPaths("/nowhere", fakeGit({ fails: failing }))).toBeNull();
    const lane = cadLane("/nowhere", fakeGit({ fails: failing }));
    expect(lane.regenerate, "an unknown diff was read as an empty one").toBe(true);
    expect(lane.note).toBeNull();
  });
});

describe("what the lane then runs, and what it says about it", () => {
  test("a moved fixture: the whole suite, deselecting nothing", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["cad/src/vextrus_cad/report.py"] }));
    expect(lane.argv).toEqual(["pytest", "cad", ...CAD_WORKERS]);
    expect(lane.note).toBeNull();
  });

  test("nothing moved: the same suite, with the regeneration deselected and said out loud", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["src/app/page.tsx"], working: ["docs/x.md"] }));
    expect(lane.argv).toEqual(["pytest", "cad", ...FIXTURE_REGENERATION_TESTS.map((test) => `--ignore=${test}`), ...CAD_WORKERS]);
    expect(lane.note).toBe(REGENERATION_SKIPPED_LINE);
    // The paths are the ones the LANE is invoked with (from the checkout), not pytest's rootdir
    // node ids — a `--deselect` spelled the other way deselects nothing and says nothing about it.
    for (const test of FIXTURE_REGENERATION_TESTS) expect(existsSync(join(REPO_ROOT, test)), `${test} is not a file the lane could ignore`).toBe(true);
  });

  test("the suite itself is never narrowed — everything that reads committed bytes still runs", () => {
    expect(cadPytestArgv({ regenerate: false })[1]).toBe("cad");
    expect(cadPytestArgv({ regenerate: true })).toEqual(["pytest", "cad", ...CAD_WORKERS]);
  });
});

/**
 * THE PROOF (2026-09-21). On a lane branch that touched the extractor once, the diff against main
 * names it on every gate after, and the ~80 s recomputation ran on every one — `LANE cad 137.52s`
 * against a 60 s ceiling. A green regeneration now leaves a digest of exactly the bytes it ran over,
 * and the same bytes buy the skip; one byte moved does not.
 */
describe("a green regeneration's proof buys the skip a second time — and only for the same bytes", () => {
  const moved = { committed: ["cad/src/vextrus_cad/report.py"] };
  const index = ["100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tcad/src/vextrus_cad/report.py"];
  const neverRead = (): null => {
    throw new Error("the proof must not be consulted here");
  };

  test("the inputs' digest follows the index's blobs and the working tree's bytes — and a deleted file digests as absent", () => {
    const root = mkdtempSync(join(tmpdir(), "cad-lane-digest-"));
    try {
      mkdirSync(join(root, "fixtures/gen"), { recursive: true });
      writeFileSync(join(root, "fixtures/gen/x.py"), "a");
      const git = fakeGit({ ...moved, index, working: ["fixtures/gen/x.py"] });
      const one = regenerationInputsDigest(root, git);
      expect(one).toMatch(/^[0-9a-f]{64}$/);
      expect(regenerationInputsDigest(root, git), "the same bytes digest the same").toBe(one);
      writeFileSync(join(root, "fixtures/gen/x.py"), "b");
      expect(regenerationInputsDigest(root, git), "a working-tree byte moved").not.toBe(one);
      writeFileSync(join(root, "fixtures/gen/x.py"), "a");
      expect(regenerationInputsDigest(root, git), "and moved back").toBe(one);
      const otherBlob = fakeGit({ ...moved, index: ["100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tcad/src/vextrus_cad/report.py"], working: ["fixtures/gen/x.py"] });
      expect(regenerationInputsDigest(root, otherBlob), "an index blob moved").not.toBe(one);
      rmSync(join(root, "fixtures/gen/x.py"));
      expect(regenerationInputsDigest(root, git), "a file deleted from the tree is not the file that was there").not.toBe(one);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the digest is content-addressed: committing exactly the proved bytes digests the same as before the commit", () => {
    const root = mkdtempSync(join(tmpdir(), "cad-lane-commit-"));
    try {
      mkdirSync(join(root, "fixtures/gen"), { recursive: true });
      writeFileSync(join(root, "fixtures/gen/x.py"), "edited");
      const before = fakeGit({ ...moved, index: [...index, "100644 cccccccccccccccccccccccccccccccccccccccc 0\tfixtures/gen/x.py"], working: ["fixtures/gen/x.py"] });
      const edited = regenerationInputsDigest(root, before);
      const committedBlob = gitBlobId(Buffer.from("edited"));
      const after = fakeGit({ ...moved, index: [...index, `100644 ${committedBlob} 0\tfixtures/gen/x.py`] });
      expect(regenerationInputsDigest(root, after), "the commit moved no byte the regeneration reads").toBe(edited);
      const untracked = fakeGit({ ...moved, index, working: ["fixtures/gen/x.py"] });
      expect(regenerationInputsDigest(root, untracked), "an untracked file then added digests the same too").toBe(edited);
      expect(committedBlob, "git's own blob id of the bytes (printf edited | git hash-object --stdin)").toBe("deb1bc2c60dc0eed5edb7e42cea94c7cb03c0050");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a git that cannot list the index yields no digest, and the lane regenerates without consulting a proof", () => {
    expect(regenerationInputsDigest("/nowhere", fakeGit({ ...moved, fails: "ls-files" }))).toBeNull();
    const lane = cadLane("/nowhere", fakeGit({ ...moved, fails: "ls-files" }), { readProof: neverRead });
    expect(lane.regenerate).toBe(true);
    expect(lane.argv).toEqual(["pytest", "cad", ...CAD_WORKERS]);
    expect(lane.digest).toBeNull();
  });

  test("inputs moved against main, and a proof of exactly this tree: deselected, and said out loud with the digest", () => {
    const git = fakeGit({ ...moved, index });
    const digest = regenerationInputsDigest("/nowhere", git);
    expect(digest).not.toBeNull();
    const proof = { digest: digest as string, provedAt: "2026-09-21T10:00:00.000Z" };
    const lane = cadLane("/nowhere", git, { readProof: () => proof });
    expect(lane.regenerate).toBe(false);
    expect(lane.argv).toEqual(cadPytestArgv({ regenerate: false }));
    expect(lane.note).toBe(regenerationProvenLine(proof));
    expect(lane.note).toContain((digest as string).slice(0, 12));
    expect(lane.note).toContain(REGENERATION_PROOF_PATH);
    expect(lane.note, "a reader can tell this skip from the diff's").not.toBe(REGENERATION_SKIPPED_LINE);
    expect(lane.digest).toBe(digest);
  });

  test("a proof of another tree, or none at all, regenerates — and hands the digest up for the proof a green run will leave", () => {
    const git = fakeGit({ ...moved, index });
    const digest = regenerationInputsDigest("/nowhere", git) as string;
    for (const readProof of [() => null, () => ({ digest: "0".repeat(64), provedAt: "2026-09-21T10:00:00.000Z" })]) {
      const lane = cadLane("/nowhere", git, { readProof });
      expect(lane.regenerate).toBe(true);
      expect(lane.argv).toEqual(["pytest", "cad", ...CAD_WORKERS]);
      expect(lane.note).toBeNull();
      expect(lane.digest).toBe(digest);
    }
  });

  test("nothing moved against main needs no proof and takes no digest — the diff's skip stands as it was", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["src/app/page.tsx"] }), { readProof: neverRead });
    expect(lane.regenerate).toBe(false);
    expect(lane.note).toBe(REGENERATION_SKIPPED_LINE);
    expect(lane.digest).toBeNull();
  });

  test("the proof is written under node_modules/.cache, read back as written, and a torn or malformed one reads as none", () => {
    const root = mkdtempSync(join(tmpdir(), "cad-lane-proof-"));
    try {
      expect(readRegenerationProof(root)).toBeNull();
      const digest = "ab".repeat(32);
      const written = recordRegenerationProof(root, digest, "2026-09-21T10:00:00.000Z");
      expect(written).toEqual({ digest, provedAt: "2026-09-21T10:00:00.000Z" });
      expect(existsSync(join(root, REGENERATION_PROOF_PATH)), "machine-local, never a committed path").toBe(true);
      expect(readRegenerationProof(root)).toEqual(written);
      writeFileSync(join(root, REGENERATION_PROOF_PATH), '{"digest": "torn');
      expect(readRegenerationProof(root), "a torn proof").toBeNull();
      writeFileSync(join(root, REGENERATION_PROOF_PATH), JSON.stringify({ digest: "not-a-digest", provedAt: "x" }));
      expect(readRegenerationProof(root), "a malformed proof").toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the proof's path is gitignored ground — node_modules — and the roster of inputs it covers is the lane's own", () => {
    expect(REGENERATION_PROOF_PATH.startsWith("node_modules/")).toBe(true);
    for (const pin of REGENERATION_ENVIRONMENT) expect(existsSync(join(REPO_ROOT, pin)), `${pin} pins the extractor's environment`).toBe(true);
  });
});
