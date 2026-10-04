"""Ticket f4, tier 2: `ledger.py fetch-verdict` records a cloud reviewer's verdict only after its local
checks (docs/specs/factory.md 2.2 "Review record"; `contracts/review-verdict.schema.json`,
`contracts/launch-cli.md` 5): the review branch's tip is one commit on the PR head that adds only the
verdict file, whose nonce, head and PR match the launch record and the PR's current head.

Seam (fixed by the ticket): `scripts.ledger.main(["fetch-verdict", "12", "--launch", <record>, "--round",
"1"], scan=, post=, ledger_dir=, head_of=)`; `head_of(pr)` is the PR's current head. Run in a clone of a
real bare origin.
"""

import json
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.tf4._schema import contract, errors

NONCE = "abcd1234" + "0f1e2d3c4b5a69788796a5b4"
BRANCH = "review/12-abcd1234"
VERDICT_PATH = ".review/12-abcd1234.json"


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def write(root: Path, files: dict[str, str]) -> None:
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        git(root, "add", name)


class Origin:
    """A bare origin and the main checkout's clone; the PR's head H on branch `ticket`."""

    def __init__(self, tmp: Path) -> None:
        self.bare = tmp / "origin.git"
        self.clone = tmp / "clone"
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(self.bare)], check=True)
        subprocess.run(
            ["git", "clone", "-q", str(self.bare), str(self.clone)], check=True, capture_output=True
        )
        for key, value in (
            ("user.email", "test@example.invalid"),
            ("user.name", "test"),
            ("commit.gpgsign", "false"),
        ):
            git(self.clone, "config", key, value)
        git(self.clone, "checkout", "-q", "-b", "main")
        write(self.clone, {"README.md": "x\n"})
        git(self.clone, "commit", "-q", "-m", "init")
        self.base = git(self.clone, "rev-parse", "HEAD")
        git(self.clone, "push", "-q", "origin", "main")
        git(self.clone, "checkout", "-q", "-b", "ticket")
        write(self.clone, {"app.py": "x = 1\n"})
        git(self.clone, "commit", "-q", "-m", "ticket: the change")
        self.head = git(self.clone, "rev-parse", "HEAD")
        git(self.clone, "push", "-q", "origin", "ticket")

    def review_branch(
        self, files: dict[str, str], *, parent: str | None = None, merge: bool = False
    ) -> None:
        """What a cloud reviewer pushes: one commit on `parent` (default: the head), to its branch."""
        git(self.clone, "checkout", "-q", "--detach", parent or self.head)
        write(self.clone, files)
        git(self.clone, "commit", "-q", "-m", "review: verdict")
        if merge:
            side = git(self.clone, "rev-parse", "HEAD")
            git(self.clone, "checkout", "-q", "--detach", self.head)
            git(self.clone, "merge", "-q", "--no-ff", "--no-edit", side)
        git(self.clone, "push", "-q", "origin", f"HEAD:refs/heads/{BRANCH}")
        git(self.clone, "checkout", "-q", "main")

    def has_branch(self) -> bool:
        return bool(git(self.bare, "branch", "--list", BRANCH))


def verdict_file(head: str, **changes: Any) -> str:
    verdict: dict[str, Any] = {
        "pr": 12,
        "head_sha": head,
        "nonce": NONCE,
        "agent": "pr-reviewer",
        "verdict": "PASS",
        "findings": [],
    }
    verdict.update(changes)
    return json.dumps(verdict) + "\n"


def launch_record(tmp: Path, head: str) -> Path:
    """`launch-cli.md` 5's record of the reviewer's launch: the nonce only inside `review`."""
    record = {
        "ticket": "f4-review-12",
        "branch": BRANCH,
        "where": "cloud",
        "role": "reviewer",
        "effort": "high",
        "model": "claude-opus-5-5",
        "budget_minutes": 30,
        "session_id": "session_0123",
        "cli_version": "2.1.300",
        "started_at": "2026-10-05T10:00:00Z",
        "governor": {},
        "leak_scan": {"status": "clean", "line": "leakscan: hits=0 scanned=40 corpus=0123456789ab"},
        "judge": {"ok": True, "code": "ok", "reason": "cloned"},
        "stop_sent": False,
        "untestable": None,
        "review": {"pr": 12, "head_sha": head, "nonce": NONCE, "branch": BRANCH},
    }
    path = tmp / "launch.json"
    path.write_text(json.dumps(record))
    return path


class Poster:
    def __init__(self) -> None:
        self.calls: list[tuple[int, str]] = []

    def __call__(self, pr: int, body: str) -> int:
        self.calls.append((pr, body))
        return 5150


def fetch(
    origin: Origin,
    tmp: Path,
    monkeypatch: pytest.MonkeyPatch,
    head_of: Callable[[int], str] | None = None,
) -> tuple[int, Path]:
    from scripts.ledger import main

    monkeypatch.chdir(origin.clone)
    store = tmp / "ledger"
    store.mkdir(exist_ok=True)
    code = main(
        ["fetch-verdict", "12", "--launch", str(launch_record(tmp, origin.head)), "--round", "1"],
        scan=lambda text: 0,
        post=Poster(),
        ledger_dir=store,
        head_of=head_of or (lambda pr: origin.head),
    )
    return code, store


@pytest.mark.parametrize(
    ("verdict", "findings"),
    [("PASS", []), ("FIX", [{"score": 80, "file": "app.py", "line": 1, "summary": "x is never read"}])],
)
def test_a_valid_verdict_is_recorded_and_the_review_branch_deleted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, verdict: str, findings: list[dict[str, Any]]
) -> None:
    origin = Origin(tmp_path)
    origin.review_branch({VERDICT_PATH: verdict_file(origin.head, verdict=verdict, findings=findings)})
    code, store = fetch(origin, tmp_path, monkeypatch)
    assert code == 0
    record = json.loads((store / f"12-{origin.head}.json").read_text())
    assert errors(record, contract("ledger-record.schema.json")) == []
    assert (record["verdict"], record["round"], record["source"]) == (verdict, 1, "fetch-verdict")
    assert not origin.has_branch()


BAD: dict[str, Callable[[Origin], None]] = {
    "parent-not-head": lambda o: o.review_branch({VERDICT_PATH: verdict_file(o.head)}, parent=o.base),
    "two-paths": lambda o: o.review_branch({VERDICT_PATH: verdict_file(o.head), "app.py": "x = 2\n"}),
    "another-path": lambda o: o.review_branch({"app.py": "x = 2\n"}),
    "merge-tip": lambda o: o.review_branch({VERDICT_PATH: verdict_file(o.head)}, merge=True),
    "other-nonce": lambda o: o.review_branch({VERDICT_PATH: verdict_file(o.head, nonce="f" * 32)}),
    "other-head": lambda o: o.review_branch({VERDICT_PATH: verdict_file(o.base)}),
    "other-pr": lambda o: o.review_branch({VERDICT_PATH: verdict_file(o.head, pr=13)}),
    "verdict-outside-agents-enum": lambda o: o.review_branch(
        {VERDICT_PATH: verdict_file(o.head, verdict="CONFIRMED")}
    ),
    "extra-key": lambda o: o.review_branch({VERDICT_PATH: verdict_file(o.head, note="trust me")}),
}


@pytest.mark.parametrize("case", sorted(BAD))
def test_a_verdict_failing_a_local_check_is_refused_with_no_record(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, case: str
) -> None:
    origin = Origin(tmp_path)
    BAD[case](origin)
    code, store = fetch(origin, tmp_path, monkeypatch)
    assert code == 3
    assert list(store.iterdir()) == []


def test_a_head_that_moved_during_the_review_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    origin = Origin(tmp_path)
    origin.review_branch({VERDICT_PATH: verdict_file(origin.head)})
    code, store = fetch(origin, tmp_path, monkeypatch, head_of=lambda pr: "9" * 40)
    assert code == 3
    assert list(store.iterdir()) == []
