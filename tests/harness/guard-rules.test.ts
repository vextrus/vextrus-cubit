// The session guard fires on the spellings sessions have used and stays quiet on the lawful ones
// (B-05: a guardrail with a test that proves it fires). Every rule the guard declares is exercised
// by name here, derived from its own roster (B-19).
import { describe, expect, it } from "vitest";
import { RULES, judge } from "../../scripts/harness/guard-rules.mjs";

const ROOT = "/repo";
const tracked = (path: string) => path === "db/migrations/0001_act-log.sql";
const bash = (command: string): string | null => (judge({ tool: "Bash", input: { command } }, { root: ROOT, tracked }))?.rule ?? null;
const edit = (path: string): string | null => (judge({ tool: "Edit", input: { file_path: `${ROOT}/${path}` } }, { root: ROOT, tracked }))?.rule ?? null;

const FIRES: ReadonlyArray<[string, () => string | null]> = [
  ["SECRET_PRINTED", () => bash("echo $TYPESAFE_API_KEY")],
  ["STAGE_ALL", () => bash("git add -A")],
  ["PRIVATE_STAGED", () => bash("git add .private/reference/edison/ARCHITECTURE.dwg")],
  ["GIT_CLEAN", () => bash("git clean -fdx")],
  ["HISTORY_REWRITTEN", () => bash("git push --force origin dev")],
  ["HOOKS_SKIPPED", () => bash("git commit --no-verify -m x")],
  ["BASELINE_OVERWRITTEN", () => bash("npx playwright test --update-snapshots")],
  ["POWERSHELL", () => bash("powershell.exe -Command exit")],
  ["PSQL_WRITE", () => bash('psql "$URL" -c "delete from projects"')],
  ["BIBLE_EDITED", () => edit("docs/specs/cubit.bible.xml")],
  ["HELDOUT_EDITED", () => edit(".builder-heldout/inc/a.test.ts")],
  ["REFERENCE_EDITED", () => edit(".private/reference/edison/PLUMBING.dwg")],
  ["FROZEN_FIXTURE_EDITED", () => edit("fixtures/rcc6/structural.dxf")],
  ["LANDED_MIGRATION_EDITED", () => edit("db/migrations/0001_act-log.sql")],
  ["GENERATED_EDITED", () => edit("next-env.d.ts")],
];

describe("the session guard", () => {
  it("proves every rule it declares", () => {
    expect(FIRES.map(([rule]) => rule).sort()).toEqual([...RULES].sort());
  });

  it.each(FIRES)("%s fires", (rule, call) => {
    expect(call()).toBe(rule);
  });

  it.each([
    "echo ${#TYPESAFE_API_KEY}",
    '[ -n "$TYPESAFE_API_KEY" ] && echo set',
    'echo "${TYPESAFE_API_KEY:+set}"',
    "printenv PATH",
    "export CUBIT_E2E_TRACE=on",
    "set -euo pipefail",
    "git add src/core/gate/evaluate.ts docs/design/s-levels.md",
    'git commit -m "harness: PowerShell stays denied, and the guard says so"',
    "git commit --amend --no-edit",
    'psql "$URL" -c "select count(*) from projects"',
    "pnpm e2e:retake J-010",
    "git push origin dev-lane-and-jev",
  ])("stays quiet on %s", (command) => {
    expect(bash(command)).toBeNull();
  });

  it("reads a whole command, segment by segment", () => {
    expect(bash("cd /repo && git add -A && git commit -m x")).toBe("STAGE_ALL");
    expect(bash('grep -n TYPESAFE ~/.bashrc | head -1')).toBe("SECRET_PRINTED");
    expect(bash("ls; cmd.exe /c powershell -NoProfile")).toBe("POWERSHELL");
  });

  it("leaves a new migration, product source and .private/work writable", () => {
    for (const path of ["db/migrations/0062_next.sql", "src/core/gate/evaluate.ts", ".private/work/notes.md", "docs/decisions/deviations.md"]) {
      expect(edit(path)).toBeNull();
    }
  });
});
