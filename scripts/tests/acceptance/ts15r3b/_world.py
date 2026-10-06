"""The world S15-R3b's acceptance tests run `review.py` and the replay driver in: no network, no real
`claude`, no real ledger.

Copied from S14-R2's `scripts/tests/acceptance/ts14r2/_world.py` (never imported from it) and extended
for R3b:

- `world.merge(n)` merges PR `n` into main with a merge commit and updates origin's main, and `gh` then
  answers the PR as GitHub answers a merged one: `state` MERGED, `closed`, `mergedAt`, `mergeCommit
  {oid}` and `baseRefOid` (main's sha just before the merge); `gh api .../pulls/<n>` gives `merged`,
  `merge_commit_sha` and `base {ref, sha}`. An open PR's `baseRefOid` is main's sha when it was cut;
- the base holds two contract docs under `docs/specs/factory/contracts/`, one naming
  `scripts/factory/gadget.py` by path and one naming `scripts.factory.thing` by module, beside the code
  they name, a code file no contract names (`scripts/factory/thingamajig.py`) and docs and prompts;
- `world.replay_head(n)` runs `review.py run <n> --replay-head`, and `world.driver(...)` runs
  `python -m scripts.factory.replay ...`, both from the main checkout with the fakes on PATH;
  `world.ledger_files()` is every file under the ledger folder with its bytes.

From R2's world, as it was: the fake `claude` answers each lens by its `--model` (`opus` or `sonnet` in
the model id) and the batched refuter (`--agent refuter`) by its own scripted reply; a scripted lens
can hang until it is killed (its pid is kept in `hung-pids`) or answer with no `structured_output`;
and the fake `uv` answers `uv run python -m scripts.factory.launch …` as a fake launcher (`OK launched
<session>`, exit 0), logging its argv, its cwd and the text of the `--prompt-file` and `--review-file`
it is given.

`World(tmp_path)` builds:

- a bare `origin` and its clone `main`, the main checkout `review.py` is run from (its cwd): the ledger
  is `main/.private/work/factory/ledger`, as `scripts.ledger.default_ledger_dir()` finds it from the
  git common dir; the review slots are `main/.private/work/factory/review/slot<N>`, the runnable
  worktrees `main/.claude/worktrees/rv<N>`, the cost log `main/.private/work/factory/review-cost.jsonl`
  (research/review.md 3, issue #452);
- PRs: `world.pr(n, {path: text})` commits the change on a branch cut from main and pushes it to
  `refs/pull/<n>/head`, as GitHub keeps it;
- a fake `gh` on PATH answering the PR (`pr view --json …` with `-q`/`--jq` through the real `jq`,
  `pr checks`, `pr diff`, `pr comment`, and `api` for `pulls/<n>`, `commits/<sha>/check-runs` and
  `commits/<sha>/status`); every argv is logged;
- a fake `claude` on PATH: each call is logged (argv, cwd, the files its arguments name, stdin, the
  lens's `VEXTRUS_DB_NAME`, the HEAD of its cwd and of the matching `slot<N>`) and answers one
  `--output-format json` result object whose `structured_output` is the scripted reply for its
  `--agent` (the A0 probe's shape: `structured_output`, `result`, `total_cost_usd`, `usage`,
  `duration_ms`); a lens call also writes the scripted attack files into its cwd;
- a fake `uv` on PATH: `uv run pytest …` (and `uv run python -m pytest …`) is a fake pytest in which a
  test file whose name holds `fails` fails by name (`FAILED <file>::test_attack`, exit 1) and any
  other passes (exit 0); a missing file is a collection error (exit 4). Every other `uv run X` runs X
  (`python` is this interpreter); every other `uv` command does nothing;
- a leak-scan home (`VEXTRUS_LEAKSCAN_HOME`, the leak scan's test seam) holding a one-string
  synthetic corpus, so `scripts.ledger record`'s scan runs for real and is clean.

`review.py` is run as `python -m scripts.factory.review run <PR> …` with this repository on
PYTHONPATH (the same as `uv run python -m scripts.factory.review run <PR>` from the main checkout).
"""

import contextlib
import json
import os
import re
import select
import shutil
import signal
import stat
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
LENS_COST = 0.143
CORPUS_STRING = "QUOKKA TANGERINE FIXTURE"
HANG = 300  # seconds: protection against a hung run only; no test asserts on time

GREEN = [
    {
        "__typename": "CheckRun",
        "name": "changes",
        "status": "COMPLETED",
        "conclusion": "SUCCESS",
        "workflowName": "ci",
    },
    {
        "__typename": "CheckRun",
        "name": "python (rest)",
        "status": "COMPLETED",
        "conclusion": "SUCCESS",
        "workflowName": "ci",
    },
    {
        "__typename": "CheckRun",
        "name": "ci",
        "status": "COMPLETED",
        "conclusion": "SUCCESS",
        "workflowName": "ci",
    },
]
RED = [
    {
        "__typename": "CheckRun",
        "name": "changes",
        "status": "COMPLETED",
        "conclusion": "SUCCESS",
        "workflowName": "ci",
    },
    {
        "__typename": "CheckRun",
        "name": "python (rest)",
        "status": "COMPLETED",
        "conclusion": "FAILURE",
        "workflowName": "ci",
    },
    {
        "__typename": "CheckRun",
        "name": "ci",
        "status": "COMPLETED",
        "conclusion": "FAILURE",
        "workflowName": "ci",
    },
]

BADGE = "export const Badge = () => null\nexport const n = 1\nexport const m = 2\n"
SMALL = {"web/src/components/badge.tsx": BADGE}  # a small PR: three lines, no trust boundary

BASE_FILES = {
    ".gitignore": "/.private/\n/.claude/worktrees/\n",
    "README.md": "base\n",
    "tools/leakscan/allowlist.txt": "".join(
        f"{line}\n"
        for line in (
            "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
            "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
        )
    ),
    "web/src/components/badge.tsx": "export const Badge = () => null\n",
    "web/src/messages/rates.ts": "export const rates = {}\n",
    "docs/notes/howto.md": "# How to\n",
    "vextrus/rates/table.py": "RATES: dict[str, int] = {}\n",
    ".claude/hooks/guard.mjs": "// the guard\n",
    "scripts/factory/thing.py": "def thing() -> int:\n    return 1\n",
    "scripts/factory/gadget.py": "def gadget() -> int:\n    return 2\n",
    "scripts/factory/thingamajig.py": "def thingamajig() -> int:\n    return 3\n",
    "docs/specs/factory/contracts/thing-cli.md": (
        "# The thing's command line\n\n"
        "`uv run python -m scripts.factory.thing run <PR>` prints one JSON object and exits 0.\n"
    ),
    "docs/specs/factory/contracts/gadget.md": (
        "# The gadget\n\nThe gadget is `scripts/factory/gadget.py`; it returns 2.\n"
    ),
    "docs/specs/factory/contracts/status.schema.json": '{"type": "object"}\n',
    "docs/specs/factory.md": "# The factory\n\nReviews run by code.\n",
    "docs/handoff/session-13-prompt.md": "# Session 13\n\nStart here.\n",
    ".claude/agents/helper.md": "---\nname: helper\n---\nHelp.\n",
    ".claude/skills/orchestrate-wave/commands.md": (
        "# Commands\n\n- `uv run python -m scripts.land <PR>`\n"
    ),
}

GH = r"""#!@PYTHON@
import fcntl, json, re, subprocess, sys
from pathlib import Path

STATE = Path(@STATE@)
LOG = Path(@LOG@)
MAIN = @MAIN@


def fail(message, code=1):
    sys.stderr.write(message + "\n")
    sys.exit(code)


argv = sys.argv[1:]
with LOG.open("a") as log:
    fcntl.flock(log, fcntl.LOCK_EX)
    log.write(json.dumps(argv) + "\n")
args, skip = [], False
for part in argv:
    if skip:
        skip = False
    elif part in ("--repo", "-R"):
        skip = True
    elif not part.startswith("--repo="):
        args.append(part)


def option(name, *aliases):
    for index, part in enumerate(args):
        for flag in (name, *aliases):
            if part == flag and index + 1 < len(args):
                return args[index + 1]
            if part.startswith(flag + "="):
                return part.split("=", 1)[1]
    return None


def positional(after):
    rest = args[after:]
    flags_with_values = {"--json", "-q", "--jq", "--body-file", "-F", "--body", "-b", "--method", "-X",
                         "-t", "--template", "-H", "--header", "-f", "--field", "--raw-field", "--input"}
    found, skip = [], False
    for part in rest:
        if skip:
            skip = False
        elif part in flags_with_values:
            skip = True
        elif not part.startswith("-"):
            found.append(part)
    return found


def emit(payload):
    query = option("-q", "--jq")
    if query is None:
        print(json.dumps(payload))
        return
    done = subprocess.run(
        ["jq", "-r", "-c", query], input=json.dumps(payload), capture_output=True, text=True
    )
    if done.returncode != 0:
        fail("jq: " + done.stderr.strip())
    sys.stdout.write(done.stdout)


def state():
    return json.loads(STATE.read_text())


def pr_of(text):
    number = re.sub(r"^.*/pull/", "", text)
    pr = state()["prs"].get(number)
    if pr is None:
        fail(
            "GraphQL: Could not resolve to a PullRequest with the number of "
            + number
            + ". (repository.pullRequest)"
        )
    return pr


def git(*parts):
    return subprocess.run(["git", "-C", MAIN, *parts], capture_output=True, text=True).stdout


if args[:2] == ["pr", "view"]:
    pr = pr_of((positional(2) or [""])[0])
    fields = option("--json")
    if fields is None:
        fail("unscripted: gh pr view without --json")
    payload = {}
    for field in fields.split(","):
        if field not in pr["payload"]:
            fail('Unknown JSON field: "' + field + '"')
        payload[field] = pr["payload"][field]
    emit(payload)
    sys.exit(0)
if args[:2] == ["pr", "checks"]:
    if option("--json") is not None:
        fail("unknown flag: --json")
    pr = pr_of((positional(2) or [""])[0])
    failing = False
    for check in pr["payload"]["statusCheckRollup"]:
        word = "pass" if check["conclusion"] == "SUCCESS" else "fail"
        failing = failing or word == "fail"
        print(check["name"] + "\t" + word + "\t1m0s\thttps://github.com/vextrus/vextrus-cubit/actions/runs/1")
    sys.exit(1 if failing else 0)
if args[:2] == ["pr", "diff"]:
    pr = pr_of((positional(2) or [""])[0])
    head = pr["payload"]["headRefOid"]
    if "--name-only" in args:
        sys.stdout.write(git("diff", "--name-only", "origin/main..." + head))
    else:
        sys.stdout.write(git("diff", "origin/main..." + head))
    sys.exit(0)
if args[:2] == ["pr", "comment"]:
    number = (positional(2) or [""])[0]
    pr_of(number)
    with STATE.open("r+") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        current = json.loads(handle.read())
        current["comment_id"] += 1
        current.setdefault("comments", []).append({"pr": number, "argv": argv})
        handle.seek(0)
        handle.truncate()
        handle.write(json.dumps(current))
        comment = current["comment_id"]
    print("https://github.com/vextrus/vextrus-cubit/pull/" + number + "#issuecomment-" + str(comment))
    sys.exit(0)
if args[:1] == ["api"]:
    method = (option("--method", "-X") or "GET").upper()
    path = (positional(1) or [""])[0].lstrip("/").replace("{owner}/{repo}", "vextrus/vextrus-cubit")
    if method != "GET":
        fail("unscripted: gh api " + method + " " + path)
    found = re.fullmatch(r"repos/vextrus/vextrus-cubit/pulls/([0-9]+)", path)
    if found:
        pr = pr_of(found[1])["payload"]
        emit({"number": pr["number"], "state": pr["state"].lower(), "draft": False,
              "head": {"sha": pr["headRefOid"], "ref": pr["headRefName"]},
              "base": {"ref": "main", "sha": pr["baseRefOid"]},
              "merged": pr["state"] == "MERGED", "merged_at": pr["mergedAt"],
              "merge_commit_sha": (pr["mergeCommit"] or {}).get("oid"),
              "title": pr["title"], "mergeable": pr["state"] == "OPEN"})
        sys.exit(0)
    found = re.fullmatch(r"repos/vextrus/vextrus-cubit/commits/([^/]+)/(check-runs|status)", path)
    if found:
        prs = [
            pr["payload"] for pr in state()["prs"].values() if pr["payload"]["headRefOid"] == found[1]
        ]
        if not prs:
            fail("gh: No commit found for SHA: " + found[1] + " (HTTP 422)")
        rollup = prs[0]["statusCheckRollup"]
        if found[2] == "check-runs":
            emit({"total_count": len(rollup), "check_runs": [
                {"name": c["name"], "status": "completed", "conclusion": c["conclusion"].lower(),
                 "head_sha": found[1]} for c in rollup]})
        else:
            failed = any(c["conclusion"] == "FAILURE" for c in rollup)
            emit({"state": "failure" if failed else "success", "sha": found[1], "statuses": []})
        sys.exit(0)
    fail("gh: Not Found (HTTP 404)")
fail("unscripted: gh " + " ".join(argv))
"""

CLAUDE = r"""#!@PYTHON@
import fcntl, json, os, re, signal, subprocess, sys
from pathlib import Path

ROOT = Path(@ROOT@)


def git(where, *parts):
    done = subprocess.run(["git", "-C", str(where), *parts], capture_output=True, text=True)
    return done.stdout.strip() if done.returncode == 0 else None


argv = sys.argv[1:]
cwd = os.getcwd()
stdin = "" if sys.stdin is None or sys.stdin.isatty() else sys.stdin.read()


def flag(name):
    for index, part in enumerate(argv):
        if part == name and index + 1 < len(argv):
            return argv[index + 1]
        if part.startswith(name + "="):
            return part.split("=", 1)[1]
    return None


agent = flag("--agent")
model = flag("--model") or ""
kind = "*"
if agent == "refuter":
    kind = "refuter"
elif "opus" in model:
    kind = "opus"
elif "sonnet" in model:
    kind = "sonnet"
files = {}
for part in argv:
    for candidate in (part, part.lstrip("@")):
        if 0 < len(candidate) < 4096 and "\n" not in candidate:
            path = Path(cwd, candidate)
            try:
                if path.is_file():
                    files[candidate] = path.read_text(errors="replace")
            except OSError:
                pass
slot = None
found = re.search(r"/rv([0-9]+)$", cwd)
if found:
    slot_dir = Path(cwd).parents[2] / ".private" / "work" / "factory" / "review" / ("slot" + found[1])
    slot_head = git(slot_dir, "rev-parse", "HEAD") if slot_dir.is_dir() else None
    slot = {"n": int(found[1]), "path": str(slot_dir), "head": slot_head}
head = git(cwd, "rev-parse", "HEAD")
scenario = json.loads((ROOT / "claude-scenario.json").read_text())
pr = None
for number, pr_head in scenario["heads"].items():
    ancestor = ["git", "-C", cwd, "merge-base", "--is-ancestor", pr_head, head or ""]
    if head is not None and subprocess.run(ancestor).returncode == 0:
        pr = number
entry = {"argv": argv, "cwd": cwd, "agent": agent, "kind": kind, "stdin": stdin, "files": files,
         "head": head, "pr": pr, "pid": os.getpid(),
         "db": os.environ.get("VEXTRUS_DB_NAME"), "slot": slot}
with (ROOT / "claude-calls.jsonl").open("a") as log:
    fcntl.flock(log, fcntl.LOCK_EX)
    log.write(json.dumps(entry) + "\n")
replies = scenario["replies"]
reply = replies.get(kind, replies["*"])
pr_head = scenario["heads"].get(pr or "", "0" * 40)
if kind in scenario.get("hang", []):
    with (ROOT / "hung-pids").open("a") as out:
        out.write(str(os.getpid()) + "\n")
    while True:  # a lens past its cap: it never answers; only a signal ends it
        signal.pause()


def fill(value):
    if isinstance(value, str):
        return value.replace("{head}", pr_head)
    if isinstance(value, list):
        return [fill(item) for item in value]
    if isinstance(value, dict):
        return {key: fill(item) for key, item in value.items()}
    return value


reply = fill(reply)
if agent != "refuter":
    for name, text in scenario.get("write", {}).items():
        target = Path(cwd, name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
hold = ROOT / "hold-once"
try:
    os.rename(hold, ROOT / "hold-taken")
    held = True
except OSError:
    held = False
if held:
    with open(ROOT / "started.fifo", "w") as started:
        started.write("started\n")
    with open(ROOT / "release.fifo") as release:
        release.read()
result = {
    "type": "result", "subtype": "success", "is_error": False, "duration_ms": 9400,
    "duration_api_ms": 6300,
    "num_turns": 4, "result": json.dumps(reply), "structured_output": reply,
    "session_id": "fake-session",
    "total_cost_usd": scenario.get("cost", 0.0),
    "usage": {"input_tokens": 6, "cache_creation_input_tokens": 31431,
              "cache_read_input_tokens": 55106, "output_tokens": 641},
    "permission_denials": [],
}
if kind in scenario.get("absent", []):
    del result["structured_output"]
    result["result"] = "I reviewed the change and it looks fine."
print(json.dumps(result))
"""

UV = r"""#!@PYTHON@
import fcntl, json, os, sys
from pathlib import Path

ROOT = Path(@ROOT@)
argv = sys.argv[1:]
with (ROOT / "uv-calls.jsonl").open("a") as log:
    fcntl.flock(log, fcntl.LOCK_EX)
    entry = {"argv": argv, "cwd": os.getcwd(), "db": os.environ.get("VEXTRUS_DB_NAME")}
    log.write(json.dumps(entry) + "\n")
if argv[:1] != ["run"]:
    sys.exit(0)
VALUED = ("--with", "--project", "--directory", "--python", "--group", "--extra", "--env-file")
rest, skip = [], False
for part in argv[1:]:
    if skip:
        skip = False
    elif not rest and part in VALUED:
        skip = True
    elif not rest and part.startswith("-"):
        continue
    else:
        rest.append(part)
if not rest:
    sys.exit(2)
if rest[0].startswith("python") and rest[1:3] == ["-m", "scripts.factory.launch"]:
    # The fake launcher: nothing is launched; the command and the files it names are kept.
    def named(flag):
        for index, part in enumerate(rest):
            if part == flag and index + 1 < len(rest):
                return rest[index + 1]
            if part.startswith(flag + "="):
                return part.split("=", 1)[1]
        return None

    def text_of(name):
        if name is None:
            return None
        path = Path(os.getcwd(), name)
        try:
            return path.read_text()
        except OSError:
            return None

    with (ROOT / "launch-calls.jsonl").open("a") as log:
        fcntl.flock(log, fcntl.LOCK_EX)
        log.write(json.dumps({
            "argv": argv, "cwd": os.getcwd(),
            "prompt": text_of(named("--prompt-file")),
            "review": text_of(named("--review-file")),
        }) + "\n")
    with (ROOT / "launch-count").open("a") as count:
        count.write("x")
    print("OK launched session_01FakeReviewer" + str((ROOT / "launch-count").stat().st_size))
    sys.exit(0)
if rest[0] == "pytest":
    tests = rest[1:]
elif rest[0].startswith("python") and rest[1:3] == ["-m", "pytest"]:
    tests = rest[3:]
elif rest[0].startswith("python"):
    os.execv(sys.executable, [sys.executable, *rest[1:]])
else:
    os.execvp(rest[0], rest)
named = [part.split("::")[0] for part in tests if part.split("::")[0].endswith(".py")]
if not named:
    print("no tests ran in 0.01s")
    sys.exit(5)
for name in named:
    if not Path(os.getcwd(), name).is_file():
        print("ERROR: file or directory not found: " + name)
        print("no tests ran in 0.01s")
        sys.exit(4)
failing = [name for name in named if "fails" in Path(name).name]
if failing:
    print("=========================== short test summary info ============================")
    for name in failing:
        print("FAILED " + name + "::test_attack - AssertionError: the failing scenario")
    print(str(len(failing)) + " failed, " + str(len(named) - len(failing)) + " passed in 0.01s")
    sys.exit(1)
print(str(len(named)) + " passed in 0.01s")
"""


def git(where: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(where), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def _script(path: Path, text: str, **values: str) -> None:
    for key, value in values.items():
        text = text.replace(f"@{key}@", value)
    path.write_text(text)
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def review_reply(
    verdict: str = "PASS", findings: list[dict[str, Any]] | None = None, head: str = "{head}"
) -> dict[str, Any]:
    """A lens's `structured_output`: the REVIEW schema of today's review-pr.js, plus each finding's
    `repro` (research/review.md 3, step 4). `{head}` becomes the PR's head."""
    return {"verdict": verdict, "head": head, "findings": findings or [], "report": "fixture lens reply"}


def finding(score: int, repro: str | None) -> dict[str, Any]:
    """A finding on the small PR's file; `repro` names its failing-test file (None: no repro)."""
    return {
        "score": score,
        "file": "web/src/components/badge.tsx",
        "line": 2,
        "summary": "the badge shows a count the takeoff does not hold",
        "repro": None
        if repro is None
        else {"test_file": repro, "command": f"uv run pytest -rf {repro}", "expect_fail": True},
    }


ATTACK = "def test_attack() -> None:\n    assert False, 'the failing scenario'\n"


class World:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.origin = root / "origin.git"
        self.main = root / "main"
        self.bin = root / "bin"
        self.leak_home = root / "leakhome"
        self.bin.mkdir()
        self.leak_home.mkdir()
        (self.leak_home / "corpus").write_text(f"{CORPUS_STRING}\n")
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(self.origin)], check=True)
        subprocess.run(["git", "init", "-q", "-b", "main", str(self.main)], check=True)
        for key, value in (
            ("user.email", "writer@example.com"),
            ("user.name", "writer"),
            ("commit.gpgsign", "false"),
        ):
            git(self.main, "config", key, value)
        git(self.main, "remote", "add", "origin", str(self.origin))
        for name, text in BASE_FILES.items():
            path = self.main / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
        git(self.main, "add", "-A")
        git(self.main, "commit", "-q", "-m", "base")
        git(self.main, "push", "-q", "origin", "main")
        git(self.main, "fetch", "-q", "origin")
        self.gh_state = root / "gh-state.json"
        self.gh_state.write_text(json.dumps({"prs": {}, "comment_id": 5000}))
        python = sys.executable
        _script(
            self.bin / "gh",
            GH,
            PYTHON=python,
            STATE=repr(str(self.gh_state)),
            LOG=repr(str(root / "gh-argv.jsonl")),
            MAIN=repr(str(self.main)),
        )
        _script(self.bin / "claude", CLAUDE, PYTHON=python, ROOT=repr(str(root)))
        _script(self.bin / "uv", UV, PYTHON=python, ROOT=repr(str(root)))
        self.heads: dict[str, str] = {}
        self.extra_env: dict[str, str] = {}
        self.lenses()

    # ---------------------------------------------------------------- the PRs

    def pr(
        self, number: int, changes: dict[str, str], *, rollup: list[dict[str, Any]] | None = None
    ) -> str:
        """Commit `changes` (path: whole new text) on a branch cut from main; push it as PR `number`."""
        branch = f"pr{number}"
        cut_from = git(self.main, "rev-parse", "main")
        git(self.main, "switch", "-q", "-c", branch, "main")
        for name, text in changes.items():
            path = self.main / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            git(self.main, "add", name)
        git(self.main, "commit", "-q", "-m", f"the change of PR {number}")
        head = git(self.main, "rev-parse", "HEAD")
        git(
            self.main,
            "push",
            "-q",
            "origin",
            f"HEAD:refs/heads/{branch}",
            f"HEAD:refs/pull/{number}/head",
        )
        git(self.main, "switch", "-q", "main")
        numstat = [
            line.split("\t")
            for line in git(self.main, "diff", "--numstat", f"main...{head}").splitlines()
        ]
        files: list[dict[str, Any]] = [
            {"path": path, "additions": int(add), "deletions": int(dele)} for add, dele, path in numstat
        ]
        additions = sum(int(add) for add, _, _ in numstat)
        deletions = sum(int(dele) for _, dele, _ in numstat)
        state = json.loads(self.gh_state.read_text())
        state["prs"][str(number)] = {
            "payload": {
                "number": number,
                "state": "OPEN",
                "isDraft": False,
                "closed": False,
                "headRefOid": head,
                "headRefName": branch,
                "baseRefName": "main",
                "baseRefOid": cut_from,
                "mergeCommit": None,
                "mergedAt": None,
                "title": f"PR {number}",
                "body": "",
                "url": f"https://github.com/vextrus/vextrus-cubit/pull/{number}",
                "mergeable": "MERGEABLE",
                "mergeStateStatus": "CLEAN",
                "labels": [],
                "author": {"login": "builder"},
                "files": files,
                "additions": additions,
                "deletions": deletions,
                "changedFiles": len(files),
                "statusCheckRollup": GREEN if rollup is None else rollup,
            }
        }
        self.gh_state.write_text(json.dumps(state))
        self.heads[str(number)] = head
        self._write_scenario()
        return head

    def edit_pr(self, number: int, **fields: Any) -> None:
        """Change what `gh` answers for the PR (its `state`, `headRefOid`, `statusCheckRollup`)."""
        state = json.loads(self.gh_state.read_text())
        state["prs"][str(number)]["payload"].update(fields)
        self.gh_state.write_text(json.dumps(state))

    def merge(self, number: int) -> str:
        """Merge PR `number` into main (a merge commit, as GitHub's merge button makes) and update
        origin's main; `gh` then answers the PR as merged. Returns the merge commit."""
        before = git(self.main, "rev-parse", "main")
        git(self.main, "merge", "-q", "--no-ff", "-m", f"Merge pull request #{number}", f"pr{number}")
        merged = git(self.main, "rev-parse", "main")
        git(self.main, "push", "-q", "origin", "main")
        self.edit_pr(
            number,
            state="MERGED",
            closed=True,
            mergeable="UNKNOWN",
            mergeStateStatus="UNKNOWN",
            baseRefOid=before,
            mergeCommit={"oid": merged},
            mergedAt="2026-10-01T10:00:00Z",
        )
        return merged

    def move_main(self, changes: dict[str, str]) -> None:
        for name, text in changes.items():
            (self.main / name).write_text(text)
            git(self.main, "add", name)
        git(self.main, "commit", "-q", "-m", "main moves on")
        git(self.main, "push", "-q", "origin", "main")

    # ---------------------------------------------------------------- the lenses

    def lenses(
        self,
        reply: dict[str, Any] | None = None,
        *,
        opus: Any = None,
        sonnet: Any = None,
        write: dict[str, str] | None = None,
        refuter: Any = None,
        hang: tuple[str, ...] = (),
        absent: tuple[str, ...] = (),
    ) -> None:
        """Script the fake `claude`. A lens started with an `opus` model answers `opus`, one with a
        `sonnet` model `sonnet`, each falling back to `reply`; the refuter (`--agent refuter`) answers
        `refuter` (default: it judges nothing). A lens call writes `write` (path: text) into its cwd, as
        an adversary writes its attack test. A lens whose model kind is in `hang` never answers; one in
        `absent` answers with no `structured_output`."""
        self._replies: dict[str, Any] = {
            "*": reply or review_reply(),
            "refuter": refuter if refuter is not None else {"findings": []},
        }
        if opus is not None:
            self._replies["opus"] = opus
        if sonnet is not None:
            self._replies["sonnet"] = sonnet
        self._write = write or {}
        self._hang = list(hang)
        self._absent = list(absent)
        self._write_scenario()

    def _write_scenario(self) -> None:
        (self.root / "claude-scenario.json").write_text(
            json.dumps(
                {
                    "heads": self.heads,
                    "replies": self._replies,
                    "write": self._write,
                    "cost": LENS_COST,
                    "hang": self._hang,
                    "absent": self._absent,
                }
            )
        )

    # ---------------------------------------------------------------- running review.py

    def env(self) -> dict[str, str]:
        env = {
            key: value
            for key, value in os.environ.items()
            if key
            not in ("CLAUDE_CODE_REMOTE", "CLAUDE_PROJECT_DIR", "VEXTRUS_DB_NAME", "PYTEST_ADDOPTS")
            and not key.startswith("GIT_")
        }
        env["PATH"] = f"{self.bin}{os.pathsep}{os.environ.get('PATH', '')}"
        env["PYTHONPATH"] = str(REPO)
        env["VEXTRUS_MAIN_CHECKOUT"] = str(self.main)
        env["VEXTRUS_LEAKSCAN_HOME"] = str(self.leak_home)
        env["GIT_TERMINAL_PROMPT"] = "0"
        env.update(self.extra_env)
        return env

    def command(self, *args: str) -> list[str]:
        return [sys.executable, "-m", "scripts.factory.review", "run", *args]

    def run(self, *args: str, hang: int = HANG) -> subprocess.CompletedProcess[str]:
        """`review.py run <args>`."""
        return self.review("run", *args, hang=hang)

    def review(self, *args: str, hang: int = HANG) -> subprocess.CompletedProcess[str]:
        """`python -m scripts.factory.review <args>` from the main checkout."""
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.review", *args],
            cwd=self.main,
            env=self.env(),
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=hang,
            check=False,
        )

    def replay_head(self, number: int, hang: int = HANG) -> subprocess.CompletedProcess[str]:
        """`review.py run <number> --replay-head` from the main checkout."""
        return self.run(str(number), "--replay-head", hang=hang)

    def driver(self, *args: str, hang: int = HANG) -> subprocess.CompletedProcess[str]:
        """`python -m scripts.factory.replay <args>` from the main checkout, with the fakes on PATH."""
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.replay", *args],
            cwd=self.main,
            env=self.env(),
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=hang,
            check=False,
        )

    def ledger_files(self) -> dict[str, bytes]:
        """Every file under the ledger folder (its path below it) with its bytes; {} when none."""
        if not self.ledger.is_dir():
            return {}
        return {
            str(path.relative_to(self.ledger)): path.read_bytes()
            for path in sorted(self.ledger.rglob("*"))
            if path.is_file()
        }

    def launch_calls(self) -> list[dict[str, Any]]:
        """What the fake launcher was asked (`uv run python -m scripts.factory.launch …`)."""
        return self._lines(self.root / "launch-calls.jsonl")

    def hung_pids(self) -> list[int]:
        return [int(line) for line in self._read(self.root / "hung-pids") if line.strip()]

    def kill_hung(self) -> None:
        """End every lens the fake left hanging (a test's cleanup, whatever review.py did)."""
        for pid in self.hung_pids():
            with contextlib.suppress(OSError):
                os.kill(pid, signal.SIGKILL)

    def popen(self, *args: str) -> subprocess.Popen[str]:
        return subprocess.Popen(
            self.command(*args),
            cwd=self.main,
            env=self.env(),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

    # ---------------------------------------------------------------- what happened

    @staticmethod
    def _lines(path: Path) -> list[dict[str, Any]]:
        if not path.is_file():
            return []
        return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

    def claude_calls(self) -> list[dict[str, Any]]:
        return self._lines(self.root / "claude-calls.jsonl")

    def lens_calls(self) -> list[dict[str, Any]]:
        """The review lenses' calls (every `claude` call but a refuter's)."""
        return [call for call in self.claude_calls() if call["agent"] != "refuter"]

    def uv_calls(self) -> list[dict[str, Any]]:
        return self._lines(self.root / "uv-calls.jsonl")

    def gh_calls(self) -> list[list[str]]:
        found: list[list[str]] = [json.loads(line) for line in self._read(self.root / "gh-argv.jsonl")]
        return found

    @staticmethod
    def _read(path: Path) -> list[str]:
        return path.read_text().splitlines() if path.is_file() else []

    def comments(self) -> list[dict[str, Any]]:
        found: list[dict[str, Any]] = json.loads(self.gh_state.read_text()).get("comments", [])
        return found

    @property
    def ledger(self) -> Path:
        return self.main / ".private" / "work" / "factory" / "ledger"

    def record(self, pr: int, head: str) -> dict[str, Any] | None:
        path = self.ledger / f"{pr}-{head}.json"
        if not path.is_file():
            return None
        loaded: dict[str, Any] = json.loads(path.read_text())
        return loaded

    def records(self) -> list[str]:
        return sorted(path.name for path in self.ledger.glob("*.json")) if self.ledger.is_dir() else []

    def seed_record(self, pr: int, head: str, round_: int) -> None:
        """A ledger record in `scripts.ledger`'s own shape, as an earlier round left it."""
        self.ledger.mkdir(parents=True, exist_ok=True)
        (self.ledger / f"{pr}-{head}.json").write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "pr": pr,
                    "head": head,
                    "round": round_,
                    "verdict": "FIX",
                    "counts": {
                        "reviewers": 2,
                        "findings": 1,
                        "findings_ge_50": 1,
                        "confirmed": 1,
                        "refuted": 0,
                        "unproven": 0,
                        "unrefuted_ge_50": 0,
                    },
                    "decision_input_sha256": "ab" * 32,
                    "comment_id": 100 + round_,
                    "exception": None,
                    "source": "review-pr",
                    "recorded_at": "2026-10-05T10:00:00Z",
                }
            )
        )

    def cost_lines(self) -> list[dict[str, Any]]:
        return self._lines(self.main / ".private" / "work" / "factory" / "review-cost.jsonl")

    def slots(self) -> list[Path]:
        review = self.main / ".private" / "work" / "factory" / "review"
        return sorted(review.glob("slot*")) if review.is_dir() else []

    def runnable(self) -> list[Path]:
        worktrees = self.main / ".claude" / "worktrees"
        return sorted(worktrees.glob("rv*")) if worktrees.is_dir() else []

    def worktrees(self) -> list[str]:
        listed = git(self.main, "worktree", "list", "--porcelain")
        return [
            line.removeprefix("worktree ")
            for line in listed.splitlines()
            if line.startswith("worktree ")
        ]

    def started(self, before: list[str]) -> list[str]:
        """What a refused run must not have done (empty: nothing started); `before` = records() then."""
        problems = []
        if self.claude_calls():
            problems.append(f"claude was started {len(self.claude_calls())} time(s)")
        if self.slots():
            problems.append(f"a review slot was made: {self.slots()[0].name}")
        if self.runnable():
            problems.append(f"a runnable worktree was made: {self.runnable()[0].name}")
        if len(self.worktrees()) != 1:
            problems.append(f"git worktrees: {self.worktrees()}")
        if self.records() != before:
            problems.append(f"the ledger changed: {self.records()}")
        if self.comments():
            problems.append("a comment was posted")
        return problems


def why(done: subprocess.CompletedProcess[str]) -> str:
    """The run's exit and the tail of its output, for an assertion message."""
    return f"exit {done.returncode}; stdout: {done.stdout[-1500:]!r}; stderr: {done.stderr[-1500:]!r}"


def wait_for_fifo(fd: int, process: subprocess.Popen[str]) -> bool:
    """Wait until the held lens says it started (True), or the run ended first (False)."""
    while True:
        ready, _, _ = select.select([fd], [], [], 1.0)
        if ready:
            data = os.read(fd, 64)
            if data:
                return True
        if process.poll() is not None:
            ready, _, _ = select.select([fd], [], [], 0)
            return bool(ready and os.read(fd, 64))


def values(blob: Any) -> list[Any]:
    """Every scalar inside a JSON value (keys not included)."""
    if isinstance(blob, dict):
        return [item for value in blob.values() for item in values(value)]
    if isinstance(blob, list):
        return [item for value in blob for item in values(value)]
    return [blob]


def node() -> str:
    found = shutil.which("node")
    assert found is not None, "node is needed to drive the guard (.claude/hooks/guard.mjs)"
    return found


# ------------------------------------------------------------------------------------- R2's helpers

NORMAL = {"vextrus/rates/table.py": "".join(f"RATE_{i}: int = {i}\n" for i in range(600))}
WORDS = NORMAL | {"web/src/messages/rates.ts": "export const rates = { title: 'Rates' }\n"}
PASSING = "def test_attack() -> None:\n    pass\n"


def item(
    score: int, line: int, summary: str, repro: str | None, file: str = "web/src/components/badge.tsx"
) -> dict[str, Any]:
    """A finding in the REVIEW schema; `repro` names its test file (None: no repro). In the fake
    pytest a file whose name holds `fails` fails by name, any other passes."""
    return {
        "score": score,
        "file": file,
        "line": line,
        "summary": summary,
        "repro": None
        if repro is None
        else {"test_file": repro, "command": f"uv run pytest -rf {repro}", "expect_fail": True},
    }


def judged(found: dict[str, Any], verdict: str) -> dict[str, Any]:
    """One item of the batched refuter's reply: the finding it judged (by its file and line, with its
    score and summary) and its verdict, CONFIRMED, REFUTED or UNPROVEN."""
    return {
        "file": found["file"],
        "line": found["line"],
        "score": found["score"],
        "summary": found["summary"],
        "verdict": verdict,
        "evidence": f"the fixture refuter's evidence for {found['file']}:{found['line']}",
    }


def flag(argv: list[str], name: str) -> str | None:
    """The value of `name` in `argv` (`--name value` or `--name=value`), or None."""
    for index, part in enumerate(argv):
        if part == name and index + 1 < len(argv):
            return argv[index + 1]
        if part.startswith(name + "="):
            return part.split("=", 1)[1]
    return None


def model_effort(call: dict[str, Any]) -> tuple[str | None, str | None]:
    return flag(call["argv"], "--model"), flag(call["argv"], "--effort")


def prompt_text(call: dict[str, Any]) -> str:
    """Everything a `claude` call was told: its arguments, its stdin and every file they name."""
    return "\n".join([*call["argv"], call["stdin"], *call["files"].values()])


def alive(pid: int) -> bool:
    """True while `pid` runs (a zombie, ended but not yet reaped, is not alive)."""
    try:
        stat_line = Path(f"/proc/{pid}/stat").read_text()
    except OSError:
        return False
    return stat_line.rsplit(")", 1)[1].split()[0] not in ("Z", "X")


def mentions(text: str, found: dict[str, Any]) -> bool:
    """True when `text` has a line naming the finding's `file:line`, its score and its summary."""
    place = re.compile(rf"{re.escape(found['file'])}:{found['line']}(?![0-9])")
    score = re.compile(rf"(?<![0-9]){found['score']}(?![0-9])")
    return any(
        place.search(line)
        and score.search(line.replace(f"{found['file']}:{found['line']}", ""))
        and found["summary"] in line
        for line in text.splitlines()
    )


def names_place(text: str, found: dict[str, Any]) -> bool:
    return re.search(rf"{re.escape(found['file'])}:{found['line']}(?![0-9])", text) is not None


def fresh(factory: Any) -> Iterator[World]:
    """A new World for one test; any lens the fake left hanging is ended after it (each test module's
    `world` fixture yields from this)."""
    made = World(factory.mktemp("world"))
    try:
        yield made
    finally:
        made.kill_hung()


# ------------------------------------------------------------------------------------ R3b's helpers


def printed(done: subprocess.CompletedProcess[str]) -> dict[str, Any]:
    """The one JSON object a review run prints: the last non-empty line of its stdout."""
    lines = [line for line in done.stdout.splitlines() if line.strip()]
    assert lines, f"nothing on stdout; {why(done)}"
    try:
        found = json.loads(lines[-1])
    except ValueError as error:
        raise AssertionError(f"the last stdout line is not JSON: {lines[-1]!r}; {why(done)}") from error
    assert isinstance(found, dict), f"the last stdout line is not a JSON object; {why(done)}"
    return found


def labels(done: subprocess.CompletedProcess[str]) -> list[str]:
    """The labels of the lenses the run started, from its printed object (`lenses[].label`)."""
    return sorted(str(lens.get("label")) for lens in printed(done).get("lenses") or [])


def lens_models(done: subprocess.CompletedProcess[str]) -> dict[str, str]:
    """Each started lens's label and model, from the run's printed object."""
    return {str(lens.get("label")): str(lens.get("model")) for lens in printed(done).get("lenses") or []}


def tree_has(world: World, commit: str, path: str) -> bool:
    """True when `path` is in the tree of `commit` (a commit in the main checkout's object store)."""
    done = subprocess.run(
        ["git", "-C", str(world.main), "cat-file", "-e", f"{commit}:{path}"], capture_output=True
    )
    return done.returncode == 0


def show(world: World, commit: str, path: str) -> str:
    return git(world.main, "show", f"{commit}:{path}")
