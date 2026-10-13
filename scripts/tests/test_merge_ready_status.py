"""merge_ready's ledger check (`merges_since`) and a builder's status reply (S26-FX1, Q-R6): an empty
commit whose only factory trailer is `Factory-Status:` keeps the reviewed head's PASS (its tree is the
reviewed tree); a commit with any tree change, or a second factory trailer, needs a new review."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from scripts import merge_ready

ATTRIBUTION = "Co-Authored-By: Claude <noreply@example.com>\n"
REPLY = f"status: answer\n\nFactory-Status: on the third test of five\n\n{ATTRIBUTION}"


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        check=True,
    )
    return done.stdout.strip()


def commit(repo: Path, message: str, *, change: str | None = None) -> str:
    if change is not None:
        (repo / change).write_text(change)
        git(repo, "add", change)
    git(repo, "commit", "-q", "--allow-empty", "--cleanup=verbatim", "-m", message)
    return git(repo, "rev-parse", "HEAD")


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    git(tmp_path, "init", "-q", "-b", "main")
    commit(tmp_path, "base", change="base")
    git(tmp_path, "switch", "-q", "-c", "feature")
    return tmp_path


def since(repo: Path, reviewed: str, head: str) -> str | None:
    return merge_ready.merges_since(repo, reviewed, head, git(repo, "rev-parse", "main"))


def test_an_empty_status_reply_after_the_reviewed_head_keeps_the_review(repo: Path) -> None:
    reviewed = commit(repo, "work", change="work")
    commit(repo, REPLY)
    head = commit(repo, REPLY.replace("third", "fourth"))
    assert since(repo, reviewed, head) is None


@pytest.mark.parametrize(
    "message",
    [
        REPLY,  # a status line, but the commit changes a file below
        "work\n\nFactory-State: BLOCKED\nFactory-Reason: r\nFactory-Status: x\n",
    ],
)
def test_a_commit_that_changes_the_tree_needs_a_new_review(repo: Path, message: str) -> None:
    reviewed = commit(repo, "work", change="work")
    head = commit(repo, message, change="more")
    assert since(repo, reviewed, head) is not None


def test_an_empty_commit_with_another_factory_trailer_needs_a_new_review(repo: Path) -> None:
    reviewed = commit(repo, "work", change="work")
    head = commit(repo, "status\n\nFactory-Status: x\nFactory-State: BLOCKED\nFactory-Reason: r\n")
    assert since(repo, reviewed, head) is not None


def test_an_empty_commit_without_a_status_line_needs_a_new_review(repo: Path) -> None:
    reviewed = commit(repo, "work", change="work")
    head = commit(repo, "just a note\n")
    assert since(repo, reviewed, head) is not None
