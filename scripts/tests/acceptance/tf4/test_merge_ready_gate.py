"""Ticket f4, T6: the gate to merge reads the local review ledger (docs/specs/factory.md 2.2 "Gate to
merge"; `contracts/ledger-record.schema.json`, `contracts/trailers.md` 2).

Four refusals beside today's GitHub checks: (a) no ledger PASS for the head, or the newest marker comment
is not the ledger's (a newer head only when every commit since is a clean merge of main); (b) a third
round with no exception; (c) a cut, not-done or deferred item that links no open issue; (d) the leak scan
fails on any part of the PR.

Seams (fixed by the ticket): `scripts.merge_ready.review_problems(facts, *, ledger_dir, repo, scan,
issue_open) -> list[str]` and `scripts.merge_ready.main(argv, get=, facts=, ledger_dir=, repo=, scan=,
issue_open=)`; `scan(kind, text)` returns the hit count for one of seven kinds; `issue_open(n)`.
"""

import copy
import json
import subprocess
from collections import Counter
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.tf4._schema import contract, errors

PR = 12
KINDS = {"diff", "messages", "files", "branch", "title", "body", "comments"}


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def commit(root: Path, message: str, files: dict[str, str]) -> str:
    for name, text in files.items():
        (root / name).write_text(text)
        git(root, "add", name)
    git(root, "commit", "-q", "-m", message)
    return git(root, "rev-parse", "HEAD")


class Repo:
    """main at B0; the PR's branch at H0, which changes `shared.txt`."""

    def __init__(self, root: Path) -> None:
        self.root = root
        git(root, "init", "-q", "-b", "main")
        git(root, "config", "user.email", "test@example.invalid")
        git(root, "config", "user.name", "test")
        git(root, "config", "commit.gpgsign", "false")
        self.main = commit(root, "init", {"shared.txt": "a\n", "other.txt": "o\n"})
        git(root, "checkout", "-q", "-b", "ticket")
        self.h0 = commit(root, "ticket: the change", {"shared.txt": "branch\n"})

    def main_moves(self, files: dict[str, str]) -> str:
        git(self.root, "checkout", "-q", "main")
        self.main = commit(self.root, "main moves on", files)
        git(self.root, "checkout", "-q", "ticket")
        return self.main


@pytest.fixture
def repo(tmp_path: Path) -> Repo:
    root = tmp_path / "repo"
    root.mkdir()
    return Repo(root)


@pytest.fixture
def store(tmp_path: Path) -> Path:
    path = tmp_path / "ledger"
    path.mkdir()
    return path


def marker(head: str, verdict: str = "PASS", round_: int = 1, findings: int = 0) -> str:
    return f"<!-- vextrus-review round={round_} head={head} verdict={verdict} findings={findings} -->"


def ledger_record(
    store: Path,
    head: str,
    *,
    verdict: str = "PASS",
    comment_id: int = 100,
    round_: int = 1,
    exception: dict[str, str] | None = None,
    drop: str | None = None,
) -> dict[str, Any]:
    """A record shaped by the contract, written where `ledger.py record` writes it."""
    record: dict[str, Any] = {
        "schema_version": 1,
        "pr": PR,
        "head": head,
        "round": round_,
        "verdict": verdict,
        "counts": {
            "reviewers": 2,
            "findings": 0 if verdict == "PASS" else 1,
            "findings_ge_50": 0 if verdict == "PASS" else 1,
            "confirmed": 0 if verdict == "PASS" else 1,
            "refuted": 0,
            "unproven": 0,
            "unrefuted_ge_50": 0,
        },
        "decision_input_sha256": "ab" * 32,
        "comment_id": comment_id,
        "exception": exception,
        "source": "review-pr",
        "recorded_at": "2026-10-05T10:00:00Z",
    }
    if drop is None:
        assert errors(record, contract("ledger-record.schema.json")) == []
    else:
        del record[drop]
    (store / f"{PR}-{head}.json").write_text(json.dumps(record))
    return record


def facts_for(repo: Repo, head: str, **changes: Any) -> dict[str, Any]:
    facts: dict[str, Any] = {
        "pr": PR,
        "head": head,
        "base": repo.main,
        "title": "f4: the review gate",
        "body": "Not verified: the live gh calls.\n\nVerify: pytest 0, ruff 0.\n",
        "branch": "s12-f4-review-gate",
        "comments": [{"id": 50, "body": "a plain comment"}, {"id": 100, "body": marker(head)}],
        "files": ["shared.txt"],
        "diff": "+branch\n",
        "messages": ["ticket: the change"],
    }
    facts.update(changes)
    return facts


def no_hits(kind: str, text: str) -> int:
    return 0


def all_open(number: int) -> bool:
    return True


def gate(
    facts: dict[str, Any],
    store: Path,
    repo: Repo,
    scan: Callable[[str, str], int] = no_hits,
    issue_open: Callable[[int], bool] = all_open,
) -> list[str]:
    from scripts.merge_ready import review_problems

    return review_problems(facts, ledger_dir=store, repo=repo.root, scan=scan, issue_open=issue_open)


def test_no_ledger_record_is_refused_even_when_everything_else_is_clean(repo: Repo, store: Path) -> None:
    found = gate(facts_for(repo, repo.h0), store, repo)
    assert found
    assert any("ledger" in problem.lower() for problem in found)


def test_a_ledger_pass_whose_comment_is_the_newest_marker_may_merge(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0)
    assert gate(facts_for(repo, repo.h0), store, repo) == []


@pytest.mark.parametrize("verdict", ["FIX", "BLOCK"])
def test_a_ledger_fix_or_block_is_refused(repo: Repo, store: Path, verdict: str) -> None:
    ledger_record(store, repo.h0, verdict=verdict)
    comments = [{"id": 100, "body": marker(repo.h0, verdict, findings=1)}]
    assert gate(facts_for(repo, repo.h0, comments=comments), store, repo)


def test_a_forged_pass_marker_without_a_ledger_record_is_refused(repo: Repo, store: Path) -> None:
    comments = [{"id": 300, "body": marker(repo.h0)}]
    assert gate(facts_for(repo, repo.h0, comments=comments), store, repo)


def test_a_newer_forged_marker_than_the_ledgers_comment_is_refused(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0, comment_id=100)
    comments = [{"id": 100, "body": marker(repo.h0)}, {"id": 200, "body": marker(repo.h0)}]
    assert gate(facts_for(repo, repo.h0, comments=comments), store, repo)


def test_a_ledger_comment_missing_from_the_pr_is_refused(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0, comment_id=100)
    comments = [{"id": 50, "body": "a plain comment"}]
    assert gate(facts_for(repo, repo.h0, comments=comments), store, repo)


def test_a_clean_merge_of_main_after_the_reviewed_head_may_merge(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0)
    repo.main_moves({"other.txt": "main\n"})
    git(repo.root, "merge", "-q", "--no-edit", "main")
    h1 = git(repo.root, "rev-parse", "HEAD")
    assert gate(facts_for(repo, h1), store, repo) == []


def test_a_merge_resolved_by_hand_after_the_reviewed_head_needs_re_review(
    repo: Repo, store: Path
) -> None:
    ledger_record(store, repo.h0)
    repo.main_moves({"shared.txt": "main\n"})
    merged = subprocess.run(
        ["git", "-C", str(repo.root), "merge", "-q", "--no-edit", "main"],
        capture_output=True,
        check=False,
    )
    assert merged.returncode != 0, "the fixture needs a conflict"
    (repo.root / "shared.txt").write_text("resolved by hand\n")
    git(repo.root, "add", "shared.txt")
    git(repo.root, "commit", "-q", "--no-edit")
    h1 = git(repo.root, "rev-parse", "HEAD")
    found = gate(facts_for(repo, h1), store, repo)
    assert any("re-review the resolution" in problem for problem in found)


def test_an_ordinary_commit_after_the_reviewed_head_is_refused(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0)
    h1 = commit(repo.root, "ticket: one more change", {"other.txt": "unreviewed\n"})
    assert gate(facts_for(repo, h1), store, repo)


def test_a_third_round_with_no_exception_is_refused(repo: Repo, store: Path) -> None:
    record = ledger_record(store, repo.h0, round_=3, exception={"kind": "crash", "reason": "x"})
    record["exception"] = None  # what the contract's round-3 rule forbids, written by hand
    (store / f"{PR}-{repo.h0}.json").write_text(json.dumps(record))
    comments = [{"id": 100, "body": marker(repo.h0, round_=3)}]
    assert gate(facts_for(repo, repo.h0, comments=comments), store, repo)


def test_a_third_round_with_a_recorded_exception_may_merge(repo: Repo, store: Path) -> None:
    exception = {"kind": "crash", "reason": "the export crashed on an empty Building"}
    ledger_record(store, repo.h0, round_=3, exception=exception)
    comments = [{"id": 100, "body": marker(repo.h0, round_=3)}]
    assert gate(facts_for(repo, repo.h0, comments=comments), store, repo) == []


def test_a_record_missing_a_required_key_is_refused(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0, drop="counts")
    assert gate(facts_for(repo, repo.h0), store, repo)


CUT_LINK = "https://github.com/vextrus/vextrus-cubit/issues/7"


@pytest.mark.parametrize(
    ("body", "open_issues", "allowed"),
    [
        ("## Cut\n- the land script: #7\n", {7}, True),
        (f"## Cut\n- the land script: {CUT_LINK}\n", {7}, True),
        ("## Cut\n- the land script\n", {7}, False),
        ("## Cut\n- the land script: #7\n", set(), False),
        ("### not done\n- the cloud review\n", {7}, False),
        ("# DEFERRED\n- the Jev shadow\n", {7}, False),
        ("## Deferred\n- the Jev shadow: #7\n- the cloud review\n", {7}, False),
        ("## Cut\nNone.\n", set(), True),
        ("## Cut\n- the land script: #7\n\n## Notes\n- a free note\n", {7}, True),
        ("## Notes\n- the land script, not cut\n", set(), True),
    ],
    ids=[
        "hash-link-open",
        "url-link-open",
        "no-link",
        "closed-issue",
        "not-done-any-level",
        "deferred-upper-case",
        "one-of-two-unlinked",
        "none",
        "next-heading-ends-it",
        "other-heading",
    ],
)
def test_every_cut_not_done_or_deferred_item_links_an_open_issue(
    repo: Repo, store: Path, body: str, open_issues: set[int], allowed: bool
) -> None:
    ledger_record(store, repo.h0)
    found = gate(
        facts_for(repo, repo.h0, body=f"Not verified: the live gh calls.\n\n{body}"),
        store,
        repo,
        issue_open=lambda number: number in open_issues,
    )
    assert (found == []) is allowed, found


def test_the_leak_scan_runs_once_on_each_of_the_seven_parts(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0)
    seen: list[str] = []

    def scan(kind: str, text: str) -> int:
        seen.append(kind)
        return 0

    assert gate(facts_for(repo, repo.h0), store, repo, scan=scan) == []
    assert Counter(seen) == Counter(KINDS)


def test_a_leak_hit_is_refused_naming_the_part_and_count_never_the_text(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0)
    title = "f4: QUIETWORDZXQ in the title"

    def scan(kind: str, text: str) -> int:
        return 2 if kind == "title" else 0

    found = gate(facts_for(repo, repo.h0, title=title), store, repo, scan=scan)
    assert found
    assert any("title" in problem and "2" in problem for problem in found)
    assert not any("QUIETWORDZXQ" in problem for problem in found)


def test_an_unavailable_leak_scan_is_refused(repo: Repo, store: Path) -> None:
    ledger_record(store, repo.h0)

    def scan(kind: str, text: str) -> int:
        raise OSError("no corpus")

    found = gate(facts_for(repo, repo.h0), store, repo, scan=scan)
    assert any("leak scan unavailable" in problem for problem in found)


def green_pull(head: str) -> dict[str, Any]:
    """Today's GitHub gate, all clean, for this head."""
    gates = [
        {"context": name, "state": "SUCCESS", "description": "", "creator": {"login": "vextrus-status"}}
        for name in ("real-drawings", "design-gate")
    ]
    runs = [{"name": "ci", "status": "COMPLETED", "conclusion": "SUCCESS"}]
    commit_node = {
        "oid": head,
        "status": {"contexts": gates},
        "checkSuites": {"nodes": [{"checkRuns": {"nodes": runs}}]},
    }
    return {"state": "OPEN", "headRefOid": head, "commits": {"nodes": [{"commit": commit_node}]}}


def test_main_refuses_a_green_pr_with_no_ledger_pass_and_passes_one_with_it(
    repo: Repo, store: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    from scripts.merge_ready import main, problems

    pull = green_pull(repo.h0)
    assert problems(copy.deepcopy(pull)) == []
    facts = facts_for(repo, repo.h0)
    options: dict[str, Any] = {
        "get": lambda pr: copy.deepcopy(pull),
        "facts": lambda pr: copy.deepcopy(facts),
        "ledger_dir": store,
        "repo": repo.root,
        "scan": no_hits,
        "issue_open": all_open,
    }
    assert main([str(PR)], **options) == 1
    refused = capsys.readouterr().out
    assert any(
        line.startswith("merge-ready: ") and "ledger" in line.lower() for line in refused.splitlines()
    )
    ledger_record(store, repo.h0)
    assert main([str(PR)], **options) == 0
    assert f"merge-ready: PR {PR} may be merged" in capsys.readouterr().out
    assert main(["twelve"], **options) == 2
