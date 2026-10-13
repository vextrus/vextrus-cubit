"""The world S26-FX4's acceptance tests run `review.py` in: S14-R1's `World` (a bare origin and its main
checkout, a fake `gh`, a fake `claude`, the leak-scan home), with three changes:

- `uv run pytest <file>` runs the REAL pytest on the file in its cwd (the stock fake decides by the
  file's name), so one attack test fails on one head and passes on the fix by what the tree holds;
- `push(n, changes, parent=...)` puts a new head on PR n (a fix commit, a main merge, a rewrite), and
  the fake `claude` answers for it;
- `ci_flips_red()`: `gh` answers the PR's checks as they are on its first `pr view` and red ever after
  (a head whose CI was still running when the review began, and failed while the lenses ran).

What a lens was handed is its logged prompt plus every file its prompt or arguments name.
"""

import json
import re
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any

from scripts.tests.acceptance.ts14r1._world import RED, World, git, review_reply

PR = 12
BADGE = "web/src/components/badge.tsx"
TOTAL = "web/src/components/total.tsx"
NOTE = "docs/notes/howto.md"

# Words that mark where a line came from; a delta review's material carries the fix's, never the others.
ROUND_ONE_CHANGE = "ROUND_ONE_CHANGE"
ROUND_TWO_CHANGE = "ROUND_TWO_CHANGE"
THE_FIX_ITSELF = "THE_FIX_ITSELF"
MAIN_ONLY_TEXT = "MAIN_ONLY_TEXT"
SIDE_ONLY_TEXT = "SIDE_ONLY_TEXT"

# The head round 1 reviews: the badge has no COUNT_OK (round 1's attack fails), the total no TOTAL_OK.
H1 = {
    BADGE: f"export const Badge = () => '{ROUND_ONE_CHANGE}'\n",
    TOTAL: "export const Total = 0\n",
}
# Round 1's fix (reviewed by round 2): COUNT_OK added; TOTAL_OK still missing (round 2's attack fails).
H2 = {BADGE: f"{H1[BADGE]}export const COUNT_OK = '{ROUND_TWO_CHANGE}'\n"}
# Round 2's fix, the delta round 3 reviews: TOTAL_OK added, nothing else.
H3 = {TOTAL: f"export const Total = 0\nexport const TOTAL_OK = '{THE_FIX_ITSELF}'\n"}

R1_ATTACK_FILE = "review_attacks/lens-b/test_r1_count.py"
R2_ATTACK_FILE = "review_attacks/lens-b/test_r2_total.py"
R1_ATTACK = (
    "from pathlib import Path\n\n\n"
    "def test_attack() -> None:\n"
    f"    assert 'COUNT_OK' in Path('{BADGE}').read_text()\n"
)
R2_ATTACK = (
    "from pathlib import Path\n\n\n"
    "def test_attack() -> None:\n"
    f"    assert 'TOTAL_OK' in Path('{TOTAL}').read_text()\n"
)

PENDING_STATES = {
    "in progress": ("IN_PROGRESS", ""),
    "queued": ("QUEUED", ""),
}

UV = r"""#!@PYTHON@
import fcntl, json, os, sys
from pathlib import Path

ROOT = Path(@ROOT@)
argv = sys.argv[1:]
with (ROOT / "uv-calls.jsonl").open("a") as log:
    fcntl.flock(log, fcntl.LOCK_EX)
    log.write(json.dumps({"argv": argv, "cwd": os.getcwd()}) + "\n")
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
if rest[0] == "pytest":
    tests = rest[1:]
elif rest[0].startswith("python") and rest[1:3] == ["-m", "pytest"]:
    tests = rest[3:]
elif rest[0].startswith("python"):
    os.execv(sys.executable, [sys.executable, *rest[1:]])
else:
    os.execvp(rest[0], rest)
os.environ.pop("PYTEST_ADDOPTS", None)
os.execv(sys.executable, [sys.executable, "-m", "pytest", "-p", "no:cacheprovider", *tests])
"""

FLIP = r"""#!@PYTHON@
import fcntl, json, os, sys
from pathlib import Path

STATE = Path(@STATE@)
INNER = @INNER@
RED = json.loads(@RED@)
argv = sys.argv[1:]
done = __import__("subprocess").run([sys.executable, INNER, *argv])
if argv[:2] == ["pr", "view"]:
    with STATE.open("r+") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        current = json.loads(handle.read())
        for pr in current["prs"].values():
            pr["payload"]["statusCheckRollup"] = RED
        handle.seek(0)
        handle.truncate()
        handle.write(json.dumps(current))
sys.exit(done.returncode)
"""


def _script(path: Path, text: str, **values: str) -> None:
    for key, value in values.items():
        text = text.replace(f"@{key}@", value)
    path.write_text(text)
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def finding(score: int, file: str, repro: str | None) -> dict[str, Any]:
    return {
        "score": score,
        "file": file,
        "line": 1,
        "summary": "the figure the screen shows is not the one the model holds",
        "repro": None
        if repro is None
        else {"test_file": repro, "command": f"uv run pytest -rf {repro}", "expect_fail": True},
    }


def pending(state: str) -> list[dict[str, Any]]:
    """A rollup whose `ci` workflow has not finished: `ci` and one of its jobs still running."""
    status, conclusion = PENDING_STATES[state]
    return [
        {"__typename": "CheckRun", "name": "changes", "status": "COMPLETED", "conclusion": "SUCCESS",
         "workflowName": "ci"},
        {"__typename": "CheckRun", "name": "python (rest)", "status": status, "conclusion": conclusion,
         "workflowName": "ci"},
        {"__typename": "CheckRun", "name": "ci", "status": status, "conclusion": conclusion,
         "workflowName": "ci"},
    ]  # fmt: skip


class DeltaWorld(World):
    def __init__(self, root: Path) -> None:
        super().__init__(root)
        _script(self.bin / "uv", UV, PYTHON=sys.executable, ROOT=repr(str(root)))

    # ---------------------------------------------------------------- heads

    def push(self, number: int, changes: dict[str, str], *, parent: str | None = None) -> str:
        """Commit `changes` on PR `number`'s branch (on `parent` when given: a rewrite) and make it the
        PR's head."""
        branch = f"pr{number}"
        git(self.main, "switch", "-q", branch)
        if parent is not None:
            git(self.main, "reset", "-q", "--hard", parent)
        for name, text in changes.items():
            path = self.main / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            git(self.main, "add", name)
        git(self.main, "commit", "-q", "-m", f"a fix on PR {number}")
        return self._publish(number, branch)

    def merge_into(self, number: int, ref: str) -> str:
        """Merge `ref` into PR `number`'s branch (a clean merge) and make it the PR's head."""
        branch = f"pr{number}"
        git(self.main, "switch", "-q", branch)
        git(self.main, "merge", "-q", "--no-edit", "--no-ff", ref)
        return self._publish(number, branch)

    def side_branch(self, changes: dict[str, str]) -> str:
        """A commit cut from main that main never takes (another branch's work)."""
        git(self.main, "switch", "-q", "-c", "side", "main")
        for name, text in changes.items():
            path = self.main / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            git(self.main, "add", name)
        git(self.main, "commit", "-q", "-m", "work of another branch")
        head = git(self.main, "rev-parse", "HEAD")
        git(self.main, "switch", "-q", "main")
        return head

    def _publish(self, number: int, branch: str) -> str:
        head = git(self.main, "rev-parse", "HEAD")
        git(
            self.main,
            "push",
            "-q",
            "--force",
            "origin",
            f"HEAD:refs/heads/{branch}",
            f"HEAD:refs/pull/{number}/head",
        )
        git(self.main, "switch", "-q", "main")
        self.edit_pr(number, headRefOid=head)
        self.heads[str(number)] = head
        self._write_scenario()
        return head

    # ---------------------------------------------------------------- CI

    def ci_flips_red(self) -> None:
        """`gh` answers the checks as they are on its first `pr view`, and red on every later read."""
        inner = self.bin / "gh-inner"
        (self.bin / "gh").rename(inner)
        _script(
            self.bin / "gh",
            FLIP,
            PYTHON=sys.executable,
            STATE=repr(str(self.gh_state)),
            INNER=repr(str(inner)),
            RED=repr(json.dumps(RED)),
        )

    # ---------------------------------------------------------------- what a lens was handed

    def handed(self, call: dict[str, Any]) -> str:
        """The lens's prompt, the files its arguments name, and every file its prompt names."""
        parts = [call["stdin"], *call["files"].values()]
        for name in re.findall(r"(/[^\s'\"`,;()]+)", call["stdin"]):
            path = Path(name.rstrip(".:"))
            if path.is_file():
                parts.append(path.read_text(errors="replace"))
        return "\n".join(parts)

    def marker_comments(self) -> list[dict[str, Any]]:
        """The ledger's marker comments as the PR shows them, rebuilt from the records' own fields (the
        fake `gh` keeps no body)."""
        found = []
        for name in self.records():
            record = json.loads((self.ledger / name).read_text())
            body = (
                f"<!-- vextrus-review round={record['round']} head={record['head']} "
                f"verdict={record['verdict']} findings={record['counts']['findings']} -->"
            )
            found.append({"id": record["comment_id"], "body": body})
        return found

    def gate(self, number: int, head: str) -> list[str]:
        """`scripts.merge_ready.review_problems` for the PR at `head`: empty when it may merge."""
        from scripts.merge_ready import review_problems

        base = git(self.main, "rev-parse", "origin/main")
        files = git(self.main, "diff", "--name-only", f"{base}...{head}").splitlines()
        facts = {
            "pr": number,
            "head": head,
            "base": base,
            "title": "a badge count",
            "body": "Verify: pytest 0.\n",
            "branch": f"pr{number}",
            "comments": self.marker_comments(),
            "files": files,
            "diff": git(self.main, "diff", f"{base}...{head}"),
            "messages": ["a fix"],
        }
        return review_problems(
            facts,
            ledger_dir=self.ledger,
            repo=self.main,
            scan=lambda _kind, _text: 0,
            issue_open=lambda _number: True,
        )


def two_rounds_of_fix(world: DeltaWorld) -> tuple[str, str]:
    """PR 12 reviewed twice, each round FIX on a confirmed finding that could block: round 1 at H1
    (its attack: the badge lacks COUNT_OK), round 2 at H2 (its attack: the total lacks TOTAL_OK)."""
    h1 = world.pr(PR, H1)
    world.lenses(
        review_reply("FIX", [finding(80, BADGE, R1_ATTACK_FILE)]), write={R1_ATTACK_FILE: R1_ATTACK}
    )
    done = world.run(str(PR), "--round", "1")
    assert done.returncode == 0, f"round 1 did not record: {done.stderr[-1500:]}"
    h2 = world.push(PR, H2)
    world.lenses(
        review_reply("FIX", [finding(80, TOTAL, R2_ATTACK_FILE)]), write={R2_ATTACK_FILE: R2_ATTACK}
    )
    done = world.run(str(PR), "--round", "2")
    assert done.returncode == 0, f"round 2 did not record: {done.stderr[-1500:]}"
    for head in (h1, h2):
        record = world.record(PR, head)
        assert record is not None
        assert record["verdict"] == "FIX", record
    world.lenses(review_reply("PASS"))  # the delta's lens finds nothing; it writes no attack
    return h1, h2


def delta(world: DeltaWorld) -> subprocess.CompletedProcess[str]:
    """Round 3, the fix-only delta review (the owner's Q-R1, `review.round_cap = delta-review`)."""
    return world.run(
        str(PR), "--round", "3", "--exception", "delta-review", "--reason", "the round cap: the fix only"
    )
