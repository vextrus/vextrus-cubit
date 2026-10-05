// Shared helpers for ticket f2's acceptance tests (not a test file: the glob is `*.test.mjs`).
// The guard is fed one PreToolUse event on stdin, `{tool_name, tool_input, cwd}`, exactly as Claude Code
// does, and its verdict read back. The seams (ticket f2, section 3; leakscan-cli.md section 8):
//   CLAUDE_PROJECT_DIR      the session's project folder
//   CLAUDE_CODE_REMOTE      "true" in a cloud session; every helper sets or deletes it explicitly
//   VEXTRUS_MAIN_CHECKOUT   the path treated as the main checkout (default /home/riz/vextrus-cubit)
//   VEXTRUS_LEAKSCAN_HOME   holds `corpus` (one file) and `ok/` (the stamps)
// Every commit, stamp and record below is made in a temporary folder; nothing real is read or written.
// The commands are test inputs only; nothing here runs them.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const GUARD = fileURLToPath(new URL("../../guard.mjs", import.meta.url));
export const STATE = fileURLToPath(new URL("../../state.mjs", import.meta.url));
export const REAL_MAIN = "/home/riz/vextrus-cubit";

/** A fresh temporary folder (its real path, so the guard's comparisons see what git sees). */
export function tempDir(prefix = "f2-") {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

/** A git environment cut off from the user's and the system's configuration (no global hooks path). */
export function gitEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  env.GIT_CONFIG_GLOBAL = "/dev/null";
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_AUTHOR_NAME = "Acceptance";
  env.GIT_AUTHOR_EMAIL = "acceptance@example.invalid";
  env.GIT_COMMITTER_NAME = "Acceptance";
  env.GIT_COMMITTER_EMAIL = "acceptance@example.invalid";
  env.GIT_AUTHOR_DATE = "2026-10-05T00:00:00Z";
  env.GIT_COMMITTER_DATE = "2026-10-05T00:00:00Z";
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}

/** Runs git in `cwd` and returns its trimmed stdout; fails the test on a non-zero exit. */
export function git(cwd, ...args) {
  const run = spawnSync("git", args, { cwd, env: gitEnv(), encoding: "utf8" });
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout.trim();
}

/** A temporary repository on `branch` with one commit, `origin/main` pointing at it. */
export function tempRepo({ branch = "main", files = { "docs/a.md": "a\n" } } = {}) {
  const repo = tempDir("f2-repo-");
  git(repo, "init", "-q", "-b", branch);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git(repo, "add", "--", ...Object.keys(files));
  git(repo, "commit", "-q", "-m", "base: the first commit");
  const base = git(repo, "rev-parse", "HEAD");
  git(repo, "update-ref", "refs/remotes/origin/main", base);
  return { repo, base };
}

/** Writes `path` (relative to the repository), stages it and commits with `message`; returns the sha. */
export function commitFile(repo, path, text, message) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
  git(repo, "add", "--", path);
  git(repo, "commit", "-q", "-m", message);
  return git(repo, "rev-parse", "HEAD");
}

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** A leak-scan home with an invented corpus; returns its path and the corpus file's sha256. */
export function leakHome(corpusText = "ZEBRA QUARRY HOLDINGS PVT 7731\nMARIGOLD TANNERY LANE 42\n") {
  const home = tempDir("f2-leakhome-");
  writeFileSync(join(home, "corpus"), corpusText, { mode: 0o600 });
  mkdirSync(join(home, "ok"), { recursive: true });
  return { home, corpusHash: sha256(Buffer.from(corpusText)) };
}

/** Writes the stamp `ok/<name>` with exactly the contract's two fields (leakscan-cli.md section 4). */
export function writeStamp(home, name, corpus, range) {
  mkdirSync(join(home, "ok"), { recursive: true });
  writeFileSync(join(home, "ok", name), JSON.stringify({ corpus, range }));
}

/** A verify record shaped by verify-record.schema.json, at `<git-common-dir>/vextrus/verify-<tree>.json`. */
export function writeVerifyRecord(repo, tree, { exitCodes = [0, 0], recordTree = tree, raw = null } = {}) {
  const common = git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const folder = join(common, "vextrus");
  mkdirSync(folder, { recursive: true });
  const record = {
    schema_version: 1,
    tree: recordTree,
    written_at: "2026-10-05T00:00:00Z",
    ok: exitCodes.every((code) => code === 0),
    checks: exitCodes.map((code, i) => ({
      name: i === 0 ? "pytest" : "ruff",
      command: i === 0 ? "uv run pytest -rf" : "uv run ruff check .",
      exit_code: code,
      raw_exit_code: code,
      flakes: [],
      output_file: `.private/work/check-${i}.txt`,
    })),
  };
  writeFileSync(join(folder, `verify-${tree}.json`), raw ?? JSON.stringify(record));
}

/**
 * Feeds the guard one event and returns `{rule, reason}` for a refusal, or null when it lets the act through.
 * `project`: CLAUDE_PROJECT_DIR (undefined deletes it; "" sets it empty). `cwd`: the event's cwd (and the
 * child's working folder when it exists). `main`: VEXTRUS_MAIN_CHECKOUT (null deletes it, so the guard's
 * own default applies). `remote`: CLAUDE_CODE_REMOTE=true. `home`: VEXTRUS_LEAKSCAN_HOME.
 */
export function judge({ tool = "Bash", input, project, cwd, main, remote = false, home, childCwd, stdin } = {}) {
  const env = gitEnv();
  delete env.CLAUDE_CODE_REMOTE;
  delete env.VEXTRUS_MAIN_CHECKOUT;
  delete env.VEXTRUS_LEAKSCAN_HOME;
  delete env.VEXTRUS_LEAKSCAN_ALLOWLIST;
  if (project === undefined) delete env.CLAUDE_PROJECT_DIR;
  else env.CLAUDE_PROJECT_DIR = project;
  if (remote) env.CLAUDE_CODE_REMOTE = "true";
  if (main !== null && main !== undefined) env.VEXTRUS_MAIN_CHECKOUT = main;
  if (home !== undefined) env.VEXTRUS_LEAKSCAN_HOME = home;
  const eventCwd = cwd ?? project ?? tmpdir();
  const run = spawnSync(process.execPath, [GUARD], {
    input: stdin ?? JSON.stringify({ tool_name: tool, tool_input: input, cwd: eventCwd }),
    encoding: "utf8",
    cwd: childCwd ?? existingOr(eventCwd),
    env,
  });
  assert.equal(run.status, 0, `the guard exited ${run.status}: ${run.stderr}`);
  if (run.stdout.trim() === "") return null;
  const out = JSON.parse(run.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, "deny");
  const reason = out.permissionDecisionReason;
  return { rule: reason.split(":")[0], reason };
}

function existingOr(path) {
  try {
    return realpathSync(path);
  } catch {
    return tmpdir();
  }
}

/** The refusing rule's name, or null. */
export const ruleOf = (options) => judge(options)?.rule ?? null;

/** A main checkout (VEXTRUS_MAIN_CHECKOUT) and a builder's worktree folder, both temporary repositories. */
export function mainAndWorktree() {
  const main = tempRepo().repo;
  const worktree = tempRepo({ branch: "s12-fx-builder" }).repo;
  return { main, worktree };
}
