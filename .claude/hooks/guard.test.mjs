// The guard's test (the M0 plan, 01c; s02 review R3): feeds guard.mjs commands on stdin, as Claude Code
// does, and reads its verdict. Run: node --test .claude/hooks/
// The commands below are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const guard = fileURLToPath(new URL("./guard.mjs", import.meta.url));

/** The rule that refuses `command`, or null when the guard lets it through. */
function verdict(tool, input) {
  const run = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({ tool_name: tool, tool_input: input }),
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  if (run.stdout.trim() === "") return null;
  const out = JSON.parse(run.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, "deny");
  return out.permissionDecisionReason.split(":")[0];
}
const bash = (command) => verdict("Bash", { command });

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
    MERGE_BY_AGENT: "gh pr merge 3",
    PRIVILEGE_RAISED: "sudo apt-get install x",
    LABORATORY_READ: "cat ~/vextrus-cad/keys.json",
    POWERSHELL: "powershell.exe -c dir",
  };
  for (const [rule, command] of Object.entries(cases)) assert.equal(bash(command), rule, command);
  assert.equal(verdict("Edit", { file_path: ".private/reference/a.dwg" }), "REFERENCE_EDITED");
});
