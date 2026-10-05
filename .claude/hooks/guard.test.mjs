// The guard's test (the M0 plan, 01c; s02 review R3): feeds guard.mjs commands on stdin, as Claude Code
// does, and reads its verdict. Run: node --test .claude/hooks/guard.test.mjs (as CI does)
// The commands below are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const guard = fileURLToPath(new URL("./guard.mjs", import.meta.url));

/** The rule that refuses `command`, or null when the guard lets it through. */
function verdict(tool, input, project = "/home/runner/work/vextrus-cubit/vextrus-cubit") {
  const run = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({ tool_name: tool, tool_input: input }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  assert.equal(run.status, 0, run.stderr);
  if (run.stdout.trim() === "") return null;
  const out = JSON.parse(run.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, "deny");
  return out.permissionDecisionReason.split(":")[0];
}
const bash = (command) => verdict("Bash", { command });
/** The verdict in the orchestrator's session, whose project is the main checkout (ADR 0041). */
const MAIN = "/home/riz/vextrus-cubit";
const inMain = (command) => verdict("Bash", { command }, MAIN);

test("the refuter's first bypass, a variable-split gh api, is refused", () => {
  assert.equal(
    bash("G=gh; $G api repos/vextrus/vextrus-cubit/statuses/0123abc -f state=success -f context=real-drawings"),
    "STATUS_POSTED",
  );
});

test("the refuter's second bypass, a curl POST, is refused", () => {
  assert.equal(
    bash(
      `curl -s -X POST -H "Authorization: Bearer $(gh auth token)" https://api.github.com/repos/vextrus/vextrus-cubit/statuses/0123abc -d '{"state":"success","context":"real-drawings"}'`,
    ),
    "STATUS_POSTED",
  );
});

test("the path split by quotes or backslashes is refused too", () => {
  assert.equal(bash(`gh api "repos/vextrus/vextrus-cubit/"statuses/0123abc -f state=success`), "STATUS_POSTED");
  assert.equal(bash(`gh api repos/vextrus/vextrus-cubit/stat'u'ses/0123abc`), "STATUS_POSTED");
  assert.equal(bash(String.raw`gh api repos/vextrus/vextrus-cubit/\statuses/0123abc`), "STATUS_POSTED");
  assert.equal(bash("gh api repos/vextrus/vextrus-cubit/\\\nstatuses/0123abc"), "STATUS_POSTED");
});

test("the endpoint is refused anywhere, not only at a command's start", () => {
  assert.equal(bash(`bash -c "gh api repos/o/r/commits/0123abc/STATUSES"`), "STATUS_POSTED");
});

test("the demo seed's synthetic drawings may be staged by name, and no other drawing", () => {
  assert.equal(bash("git add vextrus/seed/recorded/KR-STR-R0.dwg"), null);
  for (const command of [
    "git add vextrus/seed/recorded/../../../.private/reference/a.dwg",
    "git add vextrus/seed/recorded/sub/a.dwg",
    "git add vextrus/seed/a.dwg",
    "git add x/vextrus/seed/recorded/a.dwg",
    "git add vextrus/seed/recorded/a.dxf",
    "git add -f vextrus/seed/recorded/a.dwg",
    "git add vextrus/seed/recorded/..dwg",
  ]) {
    assert.equal(bash(command), "PRIVATE_STAGED", command);
  }
});

test("ordinary work passes", () => {
  for (const command of [
    "git status",
    "gh pr view 3",
    "gh api repos/vextrus/vextrus-cubit/pulls/3/files",
    "uv run pytest tools/lint",
    "node --test .claude/hooks/",
  ]) {
    assert.equal(bash(command), null, command);
  }
});

test("every earlier rule still refuses its act", () => {
  const cases = {
    SECRET_PRINTED: "echo $TYPESAFE_API_KEY",
    STAGE_ALL: "git add -A",
    PRIVATE_STAGED: "git add .private/work/x.txt",
    GIT_CLEAN: "git clean -fd",
    RECURSIVE_DELETE: "rm -rf build",
    HISTORY_REWRITTEN: "git push --force origin main",
    HOOKS_SKIPPED: "git commit --no-verify -m x",
    PRIVILEGE_RAISED: "sudo apt-get install x",
    LABORATORY_READ: "cat ~/vextrus-cad/keys.json",
    POWERSHELL: "powershell.exe -c dir",
  };
  for (const [rule, command] of Object.entries(cases)) assert.equal(bash(command), rule, command);
  assert.equal(verdict("Edit", { file_path: ".private/reference/a.dwg" }), "REFERENCE_EDITED");
});

// ADR 0041: sessions are autonomous. The orchestrator merges, pushes and posts gates through the poster.
const SHA = "0123456789abcdef0123456789abcdef01234567";
const POSTER = "sudo -n -u vxkeys /usr/local/lib/vextrus/post-status";
const SCORER = "sudo -n -u vxkeys /usr/local/bin/vx-score";

test("merging passes", () => {
  for (const command of [
    "gh pr merge 3 --merge",
    "gh pr merge 104 --squash --delete-branch",
    "gh api -X PUT repos/vextrus/vextrus-cubit/pulls/3/merge",
    "git merge origin/main",
  ]) {
    assert.equal(bash(command), null, command);
  }
});

// Spec 3.6 (f2): a session whose project is neither the main checkout nor a cloud copy is a local builder,
// and a local builder never pushes (this case passed before f2). The orchestrator's pushes need a leak stamp
// (tests/acceptance/guard-stamp-ready.test.mjs).
test("a local builder's push is refused", () => {
  const env = { ...process.env };
  delete env.CLAUDE_CODE_REMOTE;
  const run = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push -u origin autonomy-harness" } }),
    encoding: "utf8",
    env: { ...env, CLAUDE_PROJECT_DIR: "/home/runner/work/vextrus-cubit/vextrus-cubit" },
  });
  assert.equal(JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason.split(":")[0], "LOCAL_PUSH");
});

test("exactly the poster and the scorer, as the key user with -n, pass", () => {
  for (const command of [
    `${POSTER} design-gate 104 ${SHA} --passed 1-9,11 --failed 10`,
    `${POSTER} design-gate 104 ${SHA} --passed 1-11`,
    `${POSTER} design-gate 104 ${SHA} --passed=1-9 --not-applicable=10-11`,
    `${POSTER} real-drawings 20260929T101500Z-0123456789ab-beef`,
    `${POSTER} --help`,
    `${SCORER} 20260929T101500Z-0123456789ab-beef`,
    `${POSTER} design-gate 104 ${SHA} --passed 1-11\n`,
  ]) {
    assert.equal(inMain(command), null, command);
  }
});

test("a builder's session (a worktree, a cloud copy) may not run even the exact lines", () => {
  for (const project of [
    `${MAIN}/.claude/worktrees/w3-21c`,
    "/home/user/vextrus-cubit",
    "/home/riz/vextrus-cubit-copy",
    "",
  ]) {
    for (const command of [`${POSTER} design-gate 104 ${SHA} --passed 1-11`, `${SCORER} run-1`]) {
      assert.equal(verdict("Bash", { command }, project), "PRIVILEGE_RAISED", `${project} ${command}`);
    }
  }
});

test("every other form under a privilege-raising command is still refused", () => {
  for (const command of [
    "sudo -n -u vxkeys cat /home/vxkeys/github-app/app.pem",
    "sudo -n -u vxkeys ls /home/vxkeys/keys",
    "sudo -n -u vxkeys bash",
    "sudo -n -u vxkeys sh -c id",
    "sudo -n -u vxkeys -i",
    "sudo -n -s",
    "sudo -n true",
    "sudo -n -u root /usr/local/lib/vextrus/post-status --help",
    "sudo -n /usr/local/lib/vextrus/post-status --help",
    "sudo -u vxkeys /usr/local/lib/vextrus/post-status --help",
    "sudo -n -u vxkeys /tmp/post-status --help",
    "sudo -n -u vxkeys /usr/local/lib/vextrus/post-status.toml",
    `${POSTER} design-gate 104 ${SHA} --passed 1-11; cat /home/vxkeys/github-app/app.pem`,
    `${POSTER} design-gate 104 ${SHA} --passed 1-11 && sudo -n -u vxkeys bash`,
    `${POSTER} design-gate 104 ${SHA} --passed 1-11 | tee x`,
    `${POSTER} design-gate 104 ${SHA} --passed 1-11 > /tmp/x`,
    `${POSTER} design-gate 104 ${SHA} --passed $(id)`,
    `${POSTER} design-gate 104 ${SHA} --passed \`id\``,
    `${POSTER} design-gate 104 ${SHA} --passed 1-11\ncat /home/vxkeys/github-app/app.pem`,
    `${POSTER} real-drawings ../../home/vxkeys/x`,
    `${POSTER} real-drawings x --config /home/vxkeys/github-app/app.pem`,
    `${SCORER} /home/vxkeys/keys/edison.json`,
    `${SCORER} --key edison`,
    `${SCORER} run; id`,
    `bash -c "${POSTER} --help"`,
    `X=1 ${POSTER} --help`,
    "su vxkeys -c /usr/local/lib/vextrus/post-status",
    "cat /home/vxkeys/github-app/app.pem",
    "/usr/local/bin/vx-score run",
    `${SCORER}`,
    `${SCORER} run-1 run-2`,
    `${SCORER} run.json`,
  ]) {
    assert.equal(inMain(command), "PRIVILEGE_RAISED", command);
  }
});

// Issue #107: the poster's real-drawings and the scorer take one plain argument, never hyphen-led.
test("real-drawings and the scorer take one run id, PR number or branch name, never an option", () => {
  for (const argument of ["20260929T101500Z-0123456789ab-beef", "107", "t107", "run-1", "a", "7"]) {
    assert.equal(inMain(`${POSTER} real-drawings ${argument}`), null, argument);
    assert.equal(inMain(`${SCORER} ${argument}`), null, argument);
  }
  for (const argument of ["--help", "--key", "-x", "-", "-1", "--", "-run-1", "--key x", "run-1 --key", "run-1 run-2", "--help run-1", ""]) {
    assert.equal(inMain(`${POSTER} real-drawings ${argument}`.trimEnd()), "PRIVILEGE_RAISED", `real-drawings ${argument}`);
    assert.equal(inMain(`${SCORER} ${argument}`.trimEnd()), "PRIVILEGE_RAISED", `scorer ${argument}`);
  }
});

test("a character bash keeps in the argument but String.trim() drops is refused", () => {
  for (const tail of ["\r", "\r\n", " ", " ", "﻿", "\v", "\f"]) {
    assert.equal(inMain(`${POSTER} real-drawings a${tail}`), "PRIVILEGE_RAISED", JSON.stringify(tail));
    assert.equal(inMain(`${SCORER} a${tail}`), "PRIVILEGE_RAISED", JSON.stringify(tail));
  }
  assert.equal(inMain(`${SCORER} a\t\n`), null);
});

test("the ruleset, branch protection and admin merges are refused; reading them passes", () => {
  for (const command of [
    "gh api -X DELETE repos/vextrus/vextrus-cubit/rulesets/123",
    "gh api --method PUT repos/vextrus/vextrus-cubit/rulesets/123 --input r.json",
    "gh api -XPATCH repos/vextrus/vextrus-cubit/rulesets/123 -f enforcement=disabled",
    "gh api -X DELETE repos/vextrus/vextrus-cubit/branches/main/protection",
    "gh api repos/vextrus/vextrus-cubit/branches/main/protection/required_status_checks -F strict=false",
    `gh api graphql -f query='mutation { deleteRepositoryRuleset(input: {repositoryRulesetId: "x"}) { clientMutationId } }'`,
    "gh pr merge 3 --merge --admin",
  ]) {
    assert.equal(inMain(command), "RULESET_CHANGED", command);
  }
  for (const command of [
    "gh api repos/vextrus/vextrus-cubit/rulesets",
    "gh ruleset view 123",
    "gh api repos/vextrus/vextrus-cubit/branches/main/protection",
  ]) {
    assert.equal(inMain(command), null, command);
  }
});

test("statuses and check runs through the API stay refused", () => {
  assert.equal(bash(`gh api repos/vextrus/vextrus-cubit/statuses/${SHA} -f state=success -f context=design-gate`), "STATUS_POSTED");
  assert.equal(bash(`gh api -X POST repos/vextrus/vextrus-cubit/check-runs -f name=real-drawings`), "STATUS_POSTED");
});

test("force pushes, rewrites, skipped hooks, secrets, staging all and recursive deletes stay refused", () => {
  const cases = {
    "git push --force origin autonomy-harness": "HISTORY_REWRITTEN",
    "git push --force-with-lease origin x": "HISTORY_REWRITTEN",
    "git push -f": "HISTORY_REWRITTEN",
    "git filter-repo --path x": "HISTORY_REWRITTEN",
    "git push --no-verify origin x": "HOOKS_SKIPPED",
    "cat ~/.bashrc": "SECRET_PRINTED",
    "git add -A": "STAGE_ALL",
    "rm -r web/dist": "RECURSIVE_DELETE",
  };
  for (const [command, rule] of Object.entries(cases)) assert.equal(bash(command), rule, command);
});

// ---------------------------------------------------------------- f2: the builder's own bypass spellings
// Each case below is a spelling the f2 builder found passing its first repair (and main's guard). The
// acceptance tests (tests/acceptance/) pin the ticket's rows; these pin the extra spellings.
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";

/** The verdict with an explicit project, main checkout and session kind (a temporary folder as cwd). */
function seen(command, { project = "/home/runner/work/vextrus-cubit/vextrus-cubit", main = MAIN, remote = false, cwd, home } = {}) {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: project, VEXTRUS_MAIN_CHECKOUT: main };
  delete env.CLAUDE_CODE_REMOTE;
  delete env.VEXTRUS_LEAKSCAN_HOME;
  if (home !== undefined) env.VEXTRUS_LEAKSCAN_HOME = home;
  if (remote) env.CLAUDE_CODE_REMOTE = "true";
  const where = cwd ?? realpathSync(mkdtempSync(`${tmpdir()}/f2-guard-`));
  const run = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: where }),
    encoding: "utf8",
    env,
  });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim() === "" ? null : JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason.split(":")[0];
}

test("f2 bypass: a GitHub body built at run time is refused", () => {
  for (const command of [
    'gh pr create --title t --body "$(cat body.md)"',
    'gh issue comment 5 -b "$BODY"',
    "gh pr edit 5 --body `cat body.md`",
    'gh api repos/o/r/issues/5/comments -f body="$(cat body.md)"',
  ]) {
    assert.equal(seen(command, { project: MAIN }), "GH_BODY", command);
  }
});

test("f2 bypass: curl or wget writing to GitHub's API is refused", () => {
  assert.equal(seen("curl -X POST https://api.github.com/repos/o/r/issues/5/comments -d @body.json", { project: MAIN }), "GH_BODY");
  assert.equal(seen("curl -s https://api.github.com/repos/o/r/pulls/5", { project: MAIN }), null);
});

test("f2 bypass: pushes hidden from the push parser are refused for a builder", () => {
  for (const command of [
    "git subtree push --prefix docs origin x",
    "git submodule foreach 'git push origin HEAD'",
    'git rebase --exec "git push origin HEAD" HEAD~1',
    "G=git; $G push origin HEAD",
    'c="git push origin HEAD"; eval $c',
    "echo push | xargs git",
  ]) {
    assert.equal(seen(command), "LOCAL_PUSH", command);
  }
});

test("f2 bypass: env -C moves a main-checkout push to a folder the guard must judge", () => {
  // The folder does not exist, so the push cannot be judged and is refused (fails closed).
  assert.notEqual(seen("env -C /nonexistent/elsewhere git push origin HEAD:refs/heads/x", { project: MAIN }), null);
});

test("f2 bypass: the hooks path set by environment, a global config or a file write is refused", () => {
  for (const command of [
    "export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null; git commit -m x",
    "HOME=/tmp/fakehome git commit -m x",
    'printf "[core]\\n\\thooksPath = /dev/null\\n" >> .git/config',
    "sed -i 's/hooks/x/' .git/config",
  ]) {
    assert.equal(seen(command), "HOOKS_PATH", command);
  }
  assert.equal(seen("cat .git/config"), null);
});

test("f2 bypass: git update-ref -d deletes a branch like branch -D", () => {
  assert.equal(seen("git update-ref -d refs/heads/x"), "DISCARD");
});

test("f2 bypass: a for loop on pgrep -f is a self-matching wait", () => {
  assert.equal(seen("for i in $(seq 100); do pgrep -f x || break; sleep 5; done"), "SELF_MATCHING_WAIT");
});

test("f2 bypass: a raw cloud session through npx is refused", () => {
  assert.equal(seen('npx @anthropic-ai/claude-code --cloud "x"'), "RAW_SESSION");
});

test("f2 bypass: staging agent memory by a glob, or paths built at run time, is refused", () => {
  assert.equal(seen("git add '.claude/agent-mem*'"), "STAGE_DIR");
  assert.equal(seen("git add $(git ls-files -o)"), "STAGE_DIR");
});

test("f2 bypass: node --test and pytest inside a review folder are refused", () => {
  const review = "/home/riz/vextrus-cubit/.private/work/factory/review/pr-5";
  assert.notEqual(seen(`node --test ${review}/x.test.mjs`, { project: MAIN }), null);
  assert.notEqual(seen(`cd ${review} && uv run pytest`, { project: MAIN }), null);
});

test("f2 bypass: awk's ENVIRON and gh auth token print secrets", () => {
  assert.equal(seen(`awk 'BEGIN{print ENVIRON["TYPESAFE_API_KEY"]}'`), "SECRET_PRINTED");
  assert.equal(seen("gh auth token"), "SECRET_PRINTED");
  assert.equal(seen("gh auth status"), null);
});

// ---------------------------------------------------------------- f2: what is pushed or posted is what was judged
import { writeFileSync as writeFile } from "node:fs";

/** A temporary repository standing in for the main checkout, with one commit and origin/main on it. */
function tempMain() {
  const repo = realpathSync(mkdtempSync(`${tmpdir()}/f2-main-`));
  const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } }).stdout.trim();
  git("init", "-q", "-b", "main");
  writeFile(`${repo}/a.md`, "a\n");
  git("add", "a.md");
  git("commit", "-q", "-m", "base");
  git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
  return { repo, git };
}

test("f2 bypass: a push from the main checkout shares its call only with read-only filters", () => {
  const { repo } = tempMain();
  for (const command of [
    'git commit --amend -m "x" && git push origin HEAD:refs/heads/x',
    "git checkout other && git push origin HEAD:refs/heads/x",
    "git push origin HEAD:refs/heads/x; git push origin HEAD:refs/heads/y",
  ]) {
    assert.equal(seen(command, { project: repo, main: repo, cwd: repo }), "LEAK_STAMP", command);
  }
});

test("f2 bypass: a cloud push shares its call with no commit (the READY gate judges the head it sees)", () => {
  const { repo, git } = tempMain();
  git("checkout", "-q", "-b", "claude/own");
  assert.equal(seen('git commit -q --allow-empty -m "x" -m "Factory-State: READY" && git push origin HEAD', { project: repo, cwd: repo, remote: true }), "READY_UNVERIFIED");
});

test("f2 bypass: a body file changed in the same call as its gh write is refused", () => {
  const { repo } = tempMain();
  assert.equal(seen("echo more >> body.md && gh pr create --title t --body-file body.md", { project: repo, main: repo, cwd: repo }), "GH_BODY");
});

test("f2 bypass: an annotated tag or a submodule push from the main checkout is refused", () => {
  const { repo, git } = tempMain();
  git("tag", "-a", "v1", "-m", "a tag message no scan covers");
  assert.equal(seen("git push origin v1", { project: repo, main: repo, cwd: repo }), "LEAK_STAMP");
  assert.equal(seen("git push --recurse-submodules=on-demand origin HEAD:refs/heads/x", { project: repo, main: repo, cwd: repo }), "LEAK_STAMP");
});

test("f2 over-blocking: a script that copies the environment and loops over a dict passes", () => {
  const command = "python3 - <<'EOF'\nimport os, subprocess\nenv = os.environ.copy()\nfor k, v in {'a': 1}.items():\n    print(k)\nsubprocess.run(['true'], env=env)\nEOF";
  assert.equal(seen(command), null);
  assert.equal(seen(`python3 -c "import os; print(os.environ)"`), "SECRET_PRINTED");
});

test("f2 bypass: bracket globs name secret files and agent memory too", () => {
  assert.equal(seen("cat ~/.pg[p]ass"), "SECRET_PRINTED");
  assert.equal(seen("git add '.claude/agent-memor[y]/'"), "STAGE_DIR");
});


// ---------------------------------------------------------------- f2 review round 1 (PR #291)
import { createHash } from "node:crypto";
import { mkdirSync as makeDir } from "node:fs";

/** A temporary main checkout whose HEAD holds a valid stamp, a branch `unstamped`, and its leak home. */
function stampedMain() {
  const { repo, git } = tempMain();
  const home = realpathSync(mkdtempSync(`${tmpdir()}/f2-home-`));
  const corpus = "ZEBRA QUARRY HOLDINGS PVT 7731\n";
  writeFile(`${home}/corpus`, corpus);
  makeDir(`${home}/ok`);
  const base = git("rev-parse", "HEAD");
  git("checkout", "-q", "-b", "x");
  writeFile(`${repo}/b.md`, "b\n");
  git("add", "b.md");
  git("commit", "-q", "-m", "b");
  const head = git("rev-parse", "HEAD");
  writeFile(`${home}/ok/${head}`, JSON.stringify({ corpus: createHash("sha256").update(corpus).digest("hex"), range: `${base}..${head}` }));
  git("branch", "unstamped", base);
  git("checkout", "-q", "-b", "y");
  writeFile(`${repo}/c.md`, "c\n");
  git("add", "c.md");
  git("commit", "-q", "-m", "c");
  git("branch", "-f", "unstamped", "HEAD");
  git("checkout", "-q", "x");
  return { repo, home, git };
}

test("f2 round 1: a glob reaches a secret only with a leading dot (no over-blocking)", () => {
  for (const command of [
    "git log --format='%h %s' main..x -- '*/tests/acceptance/*'",
    "ls -la .private/work/session-12/f2/*",
    "wc -l tools/leakscan/*",
    "du -sh .private/work/*",
    "git diff --stat -- 'web/src/acceptance/*'",
    "for f in docs/adr/*; do head -1 $f; done",
    "ls *.*",
  ]) {
    assert.equal(seen(command), null, command);
  }
  for (const command of ["cat ~/.pg*", "cat ~/.[p]gpass", "cat ~/.config/g*/hosts.yml"]) assert.equal(seen(command), "SECRET_PRINTED", command);
});

test("f2 round 1: an unquoted heredoc runs its substitutions", () => {
  assert.equal(seen("cat > notes.md <<EOF\npushed: $(git push origin nostamp)\nEOF"), "LOCAL_PUSH");
  assert.equal(seen("cat <<EOF\n$(rm -rf build)\nEOF"), "RECURSIVE_DELETE");
  assert.equal(seen("cat <<EOF\n$(cat ~/.pgpass)\nEOF"), "SECRET_PRINTED");
  assert.equal(seen("cat <<'EOF'\n$(rm -rf build) is only text here\nEOF"), null);
});

test("f2 round 1: push.followTags is refused (a tag's message is never scanned)", () => {
  assert.equal(seen("git -c push.followTags=true push origin x", { project: MAIN, cwd: MAIN }), "GIT_CONFIG");
  assert.equal(seen("git config push.followTags true"), "GIT_CONFIG");
});

test("f2 round 1: the scanner runs only in its exact form, and writes only from the main checkout", () => {
  const { repo, home } = stampedMain();
  const inMain = (command) => seen(command, { project: repo, main: repo, cwd: repo, home });
  for (const command of [
    "uv run python -m tools.leakscan build --sou /tmp/empty",
    "uv run python -m tools.leakscan build --s /tmp/empty",
    "uv run python -m tools.leakscan build --sou=/tmp/empty",
    "uv run -m tools.leakscan build --source /tmp/empty",
    "uv run python -mtools.leakscan build --source /tmp/empty",
    "uv run python -m tools.leakscan.__main__ build --source /tmp/empty",
    "PYTHONPATH=/tmp/evil uv run python -m tools.leakscan range a..b",
    "uv run --project /tmp/evil python -m tools.leakscan range a..b",
  ]) {
    assert.equal(inMain(command), "RECORD_FORGED", command);
  }
  assert.equal(inMain("uv run python -m tools.leakscan build"), null);
  assert.equal(inMain("uv run --no-sync python -m tools.leakscan range origin/main..HEAD --ref x"), null);
  // A builder's worktree runs that branch's scanner: it may scan, but never stamp or build.
  const builder = (command) => seen(command, { project: "/home/runner/work/wt", main: repo, cwd: repo, home });
  assert.equal(builder("uv run python -m tools.leakscan range origin/main..HEAD"), "RECORD_FORGED");
  assert.equal(builder("uv run python -m tools.leakscan build"), "RECORD_FORGED");
  assert.equal(builder("uv run python -m tools.leakscan range origin/main..HEAD --no-stamp"), null);
});

test("f2 round 1: an empty corpus vouches for no push, even with a stamp made against it", () => {
  const { repo, home, git } = stampedMain();
  writeFile(`${home}/corpus`, "");
  const head = git("rev-parse", "x");
  const base = git("rev-parse", "main");
  writeFile(`${home}/ok/${head}`, JSON.stringify({ corpus: createHash("sha256").update("").digest("hex"), range: `${base}..${head}` }));
  assert.notEqual(seen("git push origin x", { project: repo, main: repo, cwd: repo, home }), null);
});

test("f2 round 1: words split at run time cannot smuggle refspecs or options", () => {
  const { repo, home } = stampedMain();
  const inMain = (command) => seen(command, { project: repo, main: repo, cwd: repo, home });
  assert.equal(inMain("git push origin x"), null);
  assert.equal(inMain("git push origin unstamped"), "LEAK_STAMP");
  assert.equal(inMain("git push origin HEAD:x${IFS}unstamped:refs/heads/y"), "LEAK_STAMP");
  assert.equal(inMain("git push origin${IFS}unstamped"), "LEAK_STAMP");
  assert.equal(inMain("gh pr comment 5 --body-file body.md ${IFS}--body-file${IFS}other.md"), "GH_BODY");
});

test("f2 round 1: a push from code or from shell text on stdin is still a push", () => {
  for (const command of [
    `python3 -c 'import subprocess;subprocess.run(["git","push","origin","HEAD"])'`,
    "python3 - <<'X'\nimport subprocess\nsubprocess.run(['git','push','origin','HEAD'])\nX",
    "echo 'git push origin HEAD' | sh",
    "sh <<< 'git push origin HEAD'",
    "bash <(echo git push origin HEAD)",
    "source <(echo git push origin HEAD)",
    `perl -e 'system("git push origin HEAD")'`,
    `node -e 'require("child_process").execSync("git push origin HEAD")'`,
    "git ${X}push origin HEAD",
    "function f { git push origin HEAD; }; f",
  ]) {
    assert.equal(seen(command), "LOCAL_PUSH", command);
  }
  assert.equal(seen("sh <<< 'rm -rf x'"), "RECURSIVE_DELETE");
  assert.equal(seen("printf 'rm -rf x' > c.sh; bash c.sh"), "RECURSIVE_DELETE");
  assert.equal(seen("echo 'import os;print(os.environ)' | python3"), "SECRET_PRINTED");
  assert.equal(seen("python3 <<< 'import os;print(os.environ)'"), "SECRET_PRINTED");
});

test("f2 round 1: everyday commands near the new rules still pass", () => {
  for (const command of [
    "uv run pytest tools/leakscan",
    "python3 -m pytest tools/leakscan -q",
    "cat tools/leakscan/cli.py",
    "git add tools/leakscan/scan.py",
    "node --test .claude/hooks/",
    "bash scripts/real-drawings --help",
    "uv run python -m scripts.merge_ready 5",
    'git commit -m "fix: the push rule"',
  ]) {
    assert.equal(seen(command), null, command);
  }
});


// ---------------------------------------------------------------- f2 review round 3 (PR #291, round 2's findings)
test("f2 round 3: interpreter code that only says push is not a push", () => {
  const { repo } = tempMain();
  for (const command of [
    `node -e "const a=[]; a.push(1); console.log(a)"`,
    `node --input-type=module -e "const xs=[]; xs.push('a')"`,
    "node - <<'EOF'\nconst xs=[];xs.push(1);console.log(xs);\nEOF",
    `python3 -c "print('push')"`,
    "node -e 'const a=[]; for (const f of process.argv.slice(1)) a.push(f); console.log(a.length)' x y",
    `gh pr view 291 --json commits | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=[];JSON.parse(s).commits.forEach(c=>o.push(c.oid));console.log(o)})'`,
    "cat > /tmp/x.mjs <<'EOF'\nconst a=[];a.push(1);\nEOF\nnode /tmp/x.mjs",
  ]) {
    assert.equal(seen(command), null, command);
  }
  assert.equal(seen("uv run python - <<'EOF'\nprint('push rate', 1)\nEOF", { project: repo, main: repo, cwd: repo }), null);
  assert.equal(seen(`node -e 'require("child_process").execSync("git push origin HEAD")'`), "LOCAL_PUSH");
});

test("f2 round 3: git's dashed exec-path forms are git", () => {
  const { repo, home } = stampedMain();
  assert.equal(seen("/usr/lib/git-core/git-push --no-verify origin x", { project: repo, main: repo, cwd: repo, home }), "HOOKS_SKIPPED");
  assert.equal(seen("/usr/lib/git-core/git-push --force origin main"), "HISTORY_REWRITTEN");
  assert.equal(seen("git-push origin +HEAD:main"), "HISTORY_REWRITTEN");
  assert.equal(seen("git-push origin HEAD"), "LOCAL_PUSH");
  assert.equal(seen("/usr/lib/git-core/git-commit --no-verify -m x"), "HOOKS_SKIPPED");
  assert.equal(seen("/usr/lib/git-core/git-config core.hooksPath /tmp/x"), "HOOKS_PATH");
  assert.equal(seen("/usr/lib/git-core/git-checkout -- ."), "DISCARD");
  assert.equal(seen("/usr/lib/git-core/git-add -A"), "STAGE_ALL");
  const { repo: own, git } = tempMain();
  git("checkout", "-q", "-b", "claude/own");
  assert.equal(seen("/usr/lib/git-core/git-push origin HEAD:main", { project: own, cwd: own, remote: true }), "CLOUD_PUSH");
});

test("f2 round 3: git's long-option prefixes are judged by their full names", () => {
  const { repo, home } = stampedMain();
  const inMain = (command) => seen(command, { project: repo, main: repo, cwd: repo, home });
  for (const command of ["git push --mirr origin", "git push --prun origin HEAD:refs/heads/x", "git push --del origin x", "git push --pru origin x"]) {
    assert.equal(inMain(command), "HISTORY_REWRITTEN", command);
  }
  for (const command of ["git push --foll origin x", "git push --follow-tag origin x", "git push --tag origin x", "git push --ta origin", "git push --al origin", "git push --branc origin", "git push --zzz origin x"]) {
    assert.equal(inMain(command), "LEAK_STAMP", command);
  }
  assert.equal(inMain("git push --no-verif --al origin"), "HOOKS_SKIPPED");
  assert.equal(seen("git commit --no-verif -m x"), "HOOKS_SKIPPED");
  assert.equal(seen("git reset --har"), "DISCARD");
  assert.equal(seen("git branch --del --forc x"), "DISCARD");
  const { repo: own, git } = tempMain();
  git("checkout", "-q", "-b", "claude/own");
  const inCloud = (command) => seen(command, { project: own, cwd: own, remote: true });
  assert.equal(inCloud("git push --foll origin HEAD"), "CLOUD_PUSH");
  assert.equal(inCloud("git push --mirr origin"), "HISTORY_REWRITTEN");
  assert.equal(inCloud("git push --del origin feat"), "HISTORY_REWRITTEN");
  assert.equal(inCloud("git push --set-up origin HEAD"), null);
});

test("f2 round 3: here-strings touching their command or behind a fd are read", () => {
  const { repo, home } = stampedMain();
  assert.equal(seen("sh<<<'git push origin HEAD'"), "LOCAL_PUSH");
  assert.equal(seen("sh 0<<<'git push origin HEAD'"), "LOCAL_PUSH");
  assert.equal(seen("sh<<<'git push origin unstamped'", { project: repo, main: repo, cwd: repo, home }), "LEAK_STAMP");
  assert.equal(seen("bash 0<<< 'git push origin unstamped'", { project: repo, main: repo, cwd: repo, home }), "LEAK_STAMP");
  assert.equal(seen("bash<<<'rm -rf x'"), "RECURSIVE_DELETE");
  assert.equal(seen("bash 0<<< 'rm -rf x'"), "RECURSIVE_DELETE");
  assert.equal(seen("python3<<<'import os;print(os.environ)'"), "SECRET_PRINTED");
});

test("f2 round 3: the scanner run as a bare module from tools/ is not its exact form", () => {
  const { repo, home } = stampedMain();
  assert.equal(seen("cd tools && PYTHONPATH=.. uv run python -m leakscan build --source /tmp/e", { project: repo, main: repo, cwd: repo, home }), "RECORD_FORGED");
});

test("f2 round 3: a corpus under the floor vouches for no push (outside the test seam)", () => {
  const { repo, git } = tempMain();
  const home = `${repo}/.private/work/leakscan`;
  makeDir(`${home}/ok`, { recursive: true });
  const base = git("rev-parse", "HEAD");
  git("checkout", "-q", "-b", "x");
  writeFile(`${repo}/b.md`, "b\n");
  git("add", "b.md");
  git("commit", "-q", "-m", "b");
  const head = git("rev-parse", "HEAD");
  const stamp = (corpus) => {
    writeFile(`${home}/corpus`, corpus);
    writeFile(`${home}/ok/${head}`, JSON.stringify({ corpus: createHash("sha256").update(corpus).digest("hex"), range: `${base}..${head}` }));
  };
  stamp("ZEBRA QUARRY HOLDINGS PVT 7731\n");
  assert.notEqual(seen("git push origin x", { project: repo, main: repo, cwd: repo }), null);
  stamp(Array.from({ length: 120 }, (_, i) => `INVENTED STRING NUMBER ${i}\n`).join(""));
  assert.equal(seen("git push origin x", { project: repo, main: repo, cwd: repo }), null);
});

test("T-GUARD-A: a look the loop reaches through a shell, a heredoc or a function stays a wait", () => {
  for (const command of [
    "while bash -c 'pgrep -f x'; do sleep 1; done",
    "while true; do eval 'pgrep -f x' || break; done",
    "while true; do ps aux | sort | grep x || break; sleep 1; done",
    "while true; do sh <<'EOF'\npgrep -f x\nEOF\nsleep 1; done",
    "f() { pgrep -f x; }; while f; do sleep 1; done",
    "function f { pgrep -f x; }; until ! f; do sleep 1; done",
    "x=$(for i in 1 2; do pgrep -f x; done); echo $x",
  ]) {
    assert.equal(bash(command), "SELF_MATCHING_WAIT", command);
  }
  for (const command of [
    "# while it builds\npgrep -f x",
    "python3 -c 'print()'; for i in 1 2; do echo $i; done; pgrep -f x",
    "for i in 1 2; do echo $i; done; ps aux | sort | grep -c x",
  ]) {
    assert.equal(bash(command), null, command);
  }
});

test("T-GUARD-A: a record reached by a glob, `..` or a cd is judged as named", () => {
  for (const command of [
    "cat .private/work/*/corpus",
    "grep -r x .private/work/leakscan",
    "cat .private/work/factory/x/../ledger/a.json > /tmp/a && cp /tmp/a .private/work/factory/x/../ledger/b.json",
    "cd .private/work/leakscan && cat corpus",
    "cd .private/work/factory/ledger && python3 w.py",
    "ls .private/work/factory/ledger | sort -o .private/work/factory/ledger/a.json",
    "rg --pre ./x.sh y .private/work/factory/ledger",
    "ls .private/work/leakscan/ok | uniq - .private/work/leakscan/ok/a",
    `python3 -c "from scripts import ledger; ledger.main(['record'])"`,
  ]) {
    assert.equal(bash(command), "RECORD_FORGED", command);
  }
  for (const command of [
    "cat .private/work/*/ok/a1b2",
    "python3 - <<'EOF'\nfrom pathlib import Path\nPath('n.md').write_text('python -m tools.leakscan range')\nEOF",
    "cat tools/leakscan/corpus.py",
    "ls tools/leakscan/",
  ]) {
    assert.equal(bash(command), null, command);
  }
});

test("T-GUARD-A: a git config read with a valued option is a read; two operands are a write", () => {
  assert.equal(bash("git config --file x.cfg --get core.hooksPath"), null);
  assert.equal(bash("git config --type path core.hooksPath"), null);
  assert.equal(bash("git config --type path core.hooksPath /tmp/x"), "HOOKS_PATH");
  assert.equal(bash("git config --show-origin core.hooksPath /tmp/x"), "HOOKS_PATH");
});

test("T-GUARD-A refuter: writers and printers dressed as viewers near the records stay refused", () => {
  const OK = ".private/work/leakscan/ok/a1b2";
  const CORPUS = ".private/work/leakscan/corpus";
  for (const command of [
    `echo '{}' | sort --out=${OK}`,
    `echo '{}' | sort --outp=${OK}`,
    `echo x | sort --out=.private/work/factory/ledger/r.json`,
    `printf 'cp /tmp/f ${OK}\\n' | sort -S 1 --compress-program=sh`,
    `env -S 'cp /tmp/f ${OK}'`,
    `env --split-string='cp /tmp/f ${OK}'`,
    `CDPATH=.private/work/leakscan cd ok && echo x > a1b2`,
    `pushd .private/work/leakscan/ok && pushd /tmp && popd && echo x > a1b2`,
    `LESSOPEN='|cp /tmp/f ${OK} %s' less ${OK}`,
    `ugrep --save-config=${OK}`,
    `tree -R -L 1 -H . .private/work/leakscan/ok`,
    `file -f ${CORPUS}`,
    `wc --files0-from=${CORPUS}`,
    `du --files0-from=${CORPUS}`,
    `find -files0-from ${CORPUS}`,
    `tree --fromfile ${CORPUS}`,
    `sha256sum -c ${CORPUS}`,
    "cd .private/work/leakscan && grep -rv qqqq",
    "cd .private/work/leakscan && rg -v qqqq",
    "timeout 5 cat .private/work/leakscan/corpus",
  ]) {
    assert.equal(bash(command), "RECORD_FORGED", command);
  }
});

test("T-GUARD-A refuter: the scanner and the ledger writer by --module, combined flags or stdin are their runs", () => {
  for (const command of [
    "uv run --module scripts.ledger record --ticket x",
    "uv run --module=scripts.ledger record --ticket x",
    "python3 -Im scripts.ledger record --ticket x",
    "python - record --ticket x < scripts/ledger.py",
    "uv run --module tools.leakscan build --source /tmp/x",
    "python3 -Im tools.leakscan build --source /tmp/x",
    "python3 - build < tools/leakscan/__main__.py",
  ]) {
    assert.equal(bash(command), "RECORD_FORGED", command);
  }
});

test("T-GUARD-A: a loop running watch on pgrep -f is still a wait", () => {
  assert.equal(bash("while true; do watch -n1 pgrep -f x; done"), "SELF_MATCHING_WAIT");
  assert.equal(bash("watch -n1 pgrep -f x"), null);
});

test("T-GUARD-A: --git-dir wins over GIT_DIR, as in git, so the push is judged where it goes", async () => {
  const { git, ruleOf, tempRepo } = await import("./tests/acceptance/_guard.mjs");
  const repo = (branch) => {
    const { repo: r } = tempRepo({ branch, files: { [`docs/${branch.replace("/", "-")}.md`]: "x\n" } });
    git(r, "remote", "add", "origin", "https://example.invalid/vextrus/vextrus-cubit.git");
    return r;
  };
  const own = repo("claude/own");
  const other = repo("main");
  const { repo: main } = tempRepo();
  const cloudPush = (command) => ruleOf({ input: { command }, project: own, cwd: own, main, remote: true });
  assert.equal(cloudPush(`GIT_DIR=${own}/.git git --git-dir=${other}/.git push origin HEAD`), "CLOUD_PUSH");
  assert.equal(cloudPush(`GIT_DIR=${other}/.git git --git-dir=${own}/.git push origin HEAD`), null);
});
