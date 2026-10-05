// Ticket f2, A4: the leak stamp and the READY gate on a push.
// Spec 5 item 3: "The guard refuses `git push` from the main checkout ... without the matching stamp."
// leakscan-cli.md 4: the stamp `ok/<head40>` is valid when its `corpus` is the sha256 of the corpus file now,
// its range ends at the pushed head, and its base is an ancestor of both origin/main and the head.
// Spec 2.2: "The guard refuses to push a READY head unless `<git-common-dir>/vextrus/verify-<HEAD's tree>.json`
// exists with every exit code 0." trailers.md 4: the ten cases, each generated here (no shared fixture files).
// Today no stamp or READY check exists and every one of these pushes passes.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { git, judge, leakHome, ruleOf, tempDir, tempRepo, writeStamp, writeVerifyRecord } from "./_guard.mjs";

/** Commits `path` with a message built from the commit's own tree; returns the commit's sha and tree. */
function commitWith(repo, path, text, message) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
  git(repo, "add", "--", path);
  const tree = git(repo, "write-tree");
  const file = join(tempDir("f2-msg-"), "message.txt");
  writeFileSync(file, message(tree));
  git(repo, "commit", "-q", "-F", file);
  return { sha: git(repo, "rev-parse", "HEAD"), tree };
}

const ATTRIBUTION = "Co-Authored-By: Acceptance <acceptance@example.invalid>\nClaude-Session: https://claude.ai/code/session_example";

// ---------------------------------------------------------------- the stamp (main checkout)

function stampedMain() {
  const { repo, base } = tempRepo();
  const { home, corpusHash } = leakHome();
  git(repo, "checkout", "-q", "-b", "x");
  const head = commitWith(repo, "docs/b.md", "b\n", () => "docs: b").sha;
  const push = (command) => judge({ input: { command }, project: repo, cwd: repo, main: repo, home });
  return { repo, base, head, home, corpusHash, push };
}

test("a push from the main checkout without a stamp for its head is refused", () => {
  const { push } = stampedMain();
  assert.equal(push("git push origin HEAD:refs/heads/x")?.rule, "LEAK_STAMP");
});

test("a push from the main checkout with a valid stamp for its head passes", () => {
  const { base, head, home, corpusHash, push } = stampedMain();
  writeStamp(home, head, corpusHash, `${base}..${head}`);
  assert.equal(push("git push origin HEAD:refs/heads/x"), null);
});

test("a stamp for another head does not vouch for this one", () => {
  const { repo, base, head, home, corpusHash, push } = stampedMain();
  writeStamp(home, head, corpusHash, `${base}..${head}`);
  commitWith(repo, "docs/c.md", "c\n", () => "docs: c");
  assert.equal(push("git push origin HEAD:refs/heads/x")?.rule, "LEAK_STAMP");
});

test("a stamp file named for the head whose range ends at another commit is refused", () => {
  const { repo, base, home, corpusHash, push } = stampedMain();
  const next = commitWith(repo, "docs/c.md", "c\n", () => "docs: c").sha;
  const other = git(repo, "rev-parse", "HEAD~1");
  writeStamp(home, next, corpusHash, `${base}..${other}`);
  assert.equal(push("git push origin HEAD:refs/heads/x")?.rule, "LEAK_STAMP");
});

test("a stamp with a stale corpus hash is refused (the guard hashes the corpus file itself)", () => {
  const { base, head, home, push } = stampedMain();
  writeStamp(home, head, "0".repeat(64), `${base}..${head}`);
  assert.equal(push("git push origin HEAD:refs/heads/x")?.rule, "LEAK_STAMP");
});

test("a stamp made before the corpus changed is refused", () => {
  const { base, head, home, corpusHash, push } = stampedMain();
  writeStamp(home, head, corpusHash, `${base}..${head}`);
  writeFileSync(join(home, "corpus"), "ZEBRA QUARRY HOLDINGS PVT 7731\nCOPPERFIELD ORCHARD TERRACE\n", { mode: 0o600 });
  assert.equal(push("git push origin HEAD:refs/heads/x")?.rule, "LEAK_STAMP");
});

test("an unparsable stamp is refused", () => {
  const { head, home, push } = stampedMain();
  writeFileSync(join(home, "ok", head), "{not json");
  assert.ok(["LEAK_STAMP", "GUARD_ERROR"].includes(push("git push origin HEAD:refs/heads/x")?.rule));
});

test("a stamp that scanned less than the push adds is refused (its base is not on origin/main)", () => {
  const { repo, head, home, corpusHash, push } = stampedMain();
  const next = commitWith(repo, "docs/c.md", "c\n", () => "docs: c").sha;
  writeStamp(home, next, corpusHash, `${head}..${next}`);
  assert.equal(push("git push origin HEAD:refs/heads/x")?.rule, "LEAK_STAMP");
});

test("a branch-name refspec is judged by the sha it resolves to", () => {
  const { repo, base, head, home, corpusHash, push } = stampedMain();
  git(repo, "checkout", "-q", "main");
  // HEAD (main, the base) has no stamp; the branch x has one.
  writeStamp(home, head, corpusHash, `${base}..${head}`);
  assert.equal(push("git push origin x"), null);
  assert.equal(push("git push origin x:refs/heads/x"), null);
  git(repo, "checkout", "-q", "-b", "y");
  const unstamped = commitWith(repo, "docs/y.md", "y\n", () => "docs: y").sha;
  git(repo, "checkout", "-q", "main");
  assert.equal(push("git push origin y")?.rule, "LEAK_STAMP");
  assert.ok(unstamped);
});

test("a sha refspec is judged by that sha", () => {
  const { repo, base, head, home, corpusHash, push } = stampedMain();
  writeStamp(home, head, corpusHash, `${base}..${head}`);
  const next = commitWith(repo, "docs/c.md", "c\n", () => "docs: c").sha;
  assert.equal(push(`git push origin ${head}:refs/heads/x`), null);
  assert.equal(push(`git push origin ${next}:refs/heads/x`)?.rule, "LEAK_STAMP");
});

// ---------------------------------------------------------------- the READY gate

/** trailers.md 4's ten cases; `gated` is true where the guard treats the tip as READY. */
const CASES = [
  { name: "ready-ok", gated: true, trailers: (tree) => `Factory-State: READY\nFactory-Verify: ${tree} ok` },
  { name: "ready-no-verify", gated: true, trailers: () => "Factory-State: READY" },
  { name: "ready-wrong-tree", gated: true, trailers: () => `Factory-State: READY\nFactory-Verify: ${"a".repeat(40)} ok` },
  { name: "ready-with-reason", gated: true, trailers: (tree) => `Factory-State: READY\nFactory-Verify: ${tree} ok\nFactory-Reason: x` },
  { name: "blocked-ok", gated: false, trailers: () => "Factory-State: BLOCKED\nFactory-Reason: the spec names no exit code" },
  { name: "blocked-no-reason", gated: false, trailers: () => "Factory-State: BLOCKED" },
  { name: "repeated-key", gated: true, trailers: (tree) => `Factory-State: READY\nFactory-State: READY\nFactory-Verify: ${tree} ok` },
  { name: "lowercase-value", gated: true, trailers: (tree) => `Factory-State: ready\nFactory-Verify: ${tree} ok` },
  { name: "none", gated: false, trailers: () => null },
  { name: "older-commit-only", gated: false, trailers: () => null, parent: (tree) => `Factory-State: READY\nFactory-Verify: ${tree} ok` },
];

const message = (subject, trailers) =>
  `${subject}\n\nNot verified: nothing (a test commit).\n\n${trailers === null ? "" : `${trailers}\n`}${ATTRIBUTION}\n`;

/** A tip for `kase` on a fresh branch of `repo`; returns the tip's sha and tree. */
function caseTip(repo, base, kase, branch) {
  git(repo, "checkout", "-q", "-B", branch, base);
  if (kase.parent) commitWith(repo, `cases/${kase.name}-parent.md`, `${kase.name} parent\n`, (tree) => message("feat: parent", kase.parent(tree)));
  return commitWith(repo, `cases/${kase.name}.md`, `${kase.name}\n`, (tree) => message(`feat: ${kase.name}`, kase.trailers(tree)));
}

function mainPusher() {
  const { repo, base } = tempRepo();
  const { home, corpusHash } = leakHome();
  return {
    repo,
    prepare(kase) {
      const tip = caseTip(repo, base, kase, `case-${kase.name}`);
      writeStamp(home, tip.sha, corpusHash, `${base}..${tip.sha}`);
      return tip;
    },
    push: () => ruleOf({ input: { command: "git push origin HEAD:refs/heads/case" }, project: repo, cwd: repo, main: repo, home }),
  };
}

function cloudPusher() {
  const main = tempRepo().repo;
  const { repo, base } = tempRepo({ branch: "claude/f9-own-branch" });
  return {
    repo,
    prepare: (kase) => caseTip(repo, base, kase, "claude/f9-own-branch"),
    push: () => ruleOf({ input: { command: "git push origin HEAD" }, project: repo, cwd: repo, main, remote: true }),
  };
}

for (const [where, make] of [["main checkout", mainPusher], ["cloud session", cloudPusher]]) {
  for (const kase of CASES) {
    if (kase.gated) {
      test(`${where}: a ${kase.name} tip is gated: refused without a verify record`, () => {
        const pusher = make();
        pusher.prepare(kase);
        assert.equal(pusher.push(), "READY_UNVERIFIED");
      });
      test(`${where}: a ${kase.name} tip passes with an all-zero verify record for its tree`, () => {
        const pusher = make();
        const tip = pusher.prepare(kase);
        writeVerifyRecord(pusher.repo, tip.tree);
        assert.equal(pusher.push(), null);
      });
    } else {
      test(`${where}: a ${kase.name} tip is not gated: it passes without a verify record`, () => {
        const pusher = make();
        pusher.prepare(kase);
        assert.equal(pusher.push(), null);
      });
    }
  }
}

const READY_OK = CASES[0];

test("a READY tip whose record has a non-zero exit code is refused", () => {
  const pusher = mainPusher();
  const tip = pusher.prepare(READY_OK);
  writeVerifyRecord(pusher.repo, tip.tree, { exitCodes: [0, 1] });
  assert.equal(pusher.push(), "READY_UNVERIFIED");
});

test("a READY tip whose record names another tree is refused", () => {
  const pusher = mainPusher();
  const tip = pusher.prepare(READY_OK);
  writeVerifyRecord(pusher.repo, tip.tree, { recordTree: "b".repeat(40) });
  assert.equal(pusher.push(), "READY_UNVERIFIED");
});

test("a READY tip whose record is malformed is refused", () => {
  const pusher = mainPusher();
  const tip = pusher.prepare(READY_OK);
  writeVerifyRecord(pusher.repo, tip.tree, { raw: "{\"schema_version\": 1, \"checks\": [" });
  assert.ok(["READY_UNVERIFIED", "GUARD_ERROR"].includes(pusher.push()));
});

test("a READY tip whose record lists no checks is refused", () => {
  const pusher = mainPusher();
  const tip = pusher.prepare(READY_OK);
  writeVerifyRecord(pusher.repo, tip.tree, { exitCodes: [] });
  assert.equal(pusher.push(), "READY_UNVERIFIED");
});

test("the words Factory-State: READY in a body line that is not a trailer do not gate the push", () => {
  const pusher = mainPusher();
  pusher.prepare({
    name: "prose",
    trailers: () => null,
    parent: null,
  });
  // Rewrite the tip with the words in a middle paragraph, followed by the attribution trailers.
  const { repo } = pusher;
  git(repo, "commit", "-q", "--amend", "-m", "docs: how to finish\n\nFactory-State: READY is what a builder writes when it is done.\n\nThe last paragraph holds only attribution.\n\nCo-Authored-By: Acceptance <acceptance@example.invalid>");
  // The amended tip needs its own stamp, as any head does.
  const sha = git(repo, "rev-parse", "HEAD");
  const base = git(repo, "rev-parse", "origin/main");
  const homeRule = ruleOf({ input: { command: "git push origin HEAD:refs/heads/case" }, project: repo, cwd: repo, main: repo, home: stampHomeFor(base, sha) });
  assert.equal(homeRule, null);
});

/** A fresh leak-scan home holding a valid stamp for `base..sha`. */
function stampHomeFor(base, sha) {
  const { home, corpusHash } = leakHome();
  writeStamp(home, sha, corpusHash, `${base}..${sha}`);
  return home;
}

test("a worktree's push finds the verify record in the clone's common git folder", () => {
  const main = tempRepo().repo;
  const { repo, base } = tempRepo({ branch: "trunk" });
  const worktree = join(tempDir("f2-wt-"), "wt");
  git(repo, "worktree", "add", "-q", "-b", "claude/f9-own-branch", worktree, base);
  const tip = commitWith(worktree, "cases/wt.md", "wt\n", (tree) => message("feat: wt", `Factory-State: READY\nFactory-Verify: ${tree} ok`));
  const push = () => ruleOf({ input: { command: "git push origin HEAD" }, project: worktree, cwd: worktree, main, remote: true });
  assert.equal(push(), "READY_UNVERIFIED");
  writeVerifyRecord(worktree, tip.tree);
  assert.equal(push(), null);
});
