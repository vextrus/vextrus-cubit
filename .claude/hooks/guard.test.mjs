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

test("merging and pushing pass", () => {
  for (const command of [
    "gh pr merge 3 --merge",
    "gh pr merge 104 --squash --delete-branch",
    "gh api -X PUT repos/vextrus/vextrus-cubit/pulls/3/merge",
    "git push -u origin autonomy-harness",
    "git merge origin/main",
  ]) {
    assert.equal(bash(command), null, command);
  }
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
