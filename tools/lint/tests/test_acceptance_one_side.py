"""S19-F1 fix round: a conflicted acceptance file resolved to exactly one side passes the merge rule;
conflict markers, a mix of the two sides, and a clean file hand-reverted to one side stay flagged."""

import subprocess
from pathlib import Path

import pytest

from tools.lint.acceptance import problems

COUNTS = "\n\nred-on-main: 1 failed\ngreen-on-throwaway: 1 passed"
TEST = "vextrus/t/tests/acceptance/t21c/test_a.py"
LINES = [f"def test_{n}():\n    assert {n}\n" for n in range(1, 8)]


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def commit(root: Path, message: str, text: str) -> None:
    if message.startswith("acceptance:"):
        message += COUNTS
    path = root / TEST
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    git(root, "add", TEST)
    git(root, "commit", "-q", "-m", message)


def text(first: str = "", last: str = "") -> str:
    lines = list(LINES)
    lines[0] += first
    lines[-1] += last
    return "".join(lines)


@pytest.fixture
def conflicted(tmp_path: Path) -> tuple[Path, str]:
    """Ticket and main change the same line of the acceptance file; `git merge main` is stopped."""
    git(tmp_path, "init", "-q", "-b", "main")
    git(tmp_path, "config", "user.email", "test@example.invalid")
    git(tmp_path, "config", "user.name", "test")
    git(tmp_path, "config", "commit.gpgsign", "false")
    commit(tmp_path, "acceptance: 21c", text())
    base = git(tmp_path, "rev-parse", "HEAD")
    git(tmp_path, "checkout", "-q", "-b", "ticket")
    commit(tmp_path, "acceptance: 21c ticket", text(first="    assert 'ticket'\n"))
    git(tmp_path, "checkout", "-q", "main")
    commit(tmp_path, "acceptance: 21c main", text(first="    assert 'main'\n"))
    git(tmp_path, "checkout", "-q", "ticket")
    done = subprocess.run(
        ["git", "-C", str(tmp_path), "merge", "-q", "--no-commit", "--no-ff", "main"],
        capture_output=True,
        check=False,
    )
    assert done.returncode != 0
    return tmp_path, base


def finish(root: Path, content: str | None) -> str:
    if content is not None:
        (root / TEST).write_text(content)
    git(root, "add", TEST)
    git(root, "commit", "-q", "--no-edit")
    return git(root, "rev-parse", "HEAD")[:12]


def flagged(root: Path, base: str, merge: str) -> bool:
    return any(p.startswith(merge) and TEST in p for p in problems(root, base))


def test_a_conflict_resolved_to_the_tickets_side_then_changed_in_an_acceptance_commit_passes(
    conflicted: tuple[Path, str],
) -> None:
    root, base = conflicted
    merge = finish(root, text(first="    assert 'ticket'\n"))
    commit(root, "acceptance: 21c re-apply main", text(first="    assert 'ticket'\n    assert 'main'\n"))
    assert not flagged(root, base, merge)
    assert problems(root, base) == []


def test_a_conflict_resolved_to_the_other_parents_side_passes(conflicted: tuple[Path, str]) -> None:
    root, base = conflicted
    merge = finish(root, text(first="    assert 'main'\n"))
    assert not flagged(root, base, merge)


def test_committed_conflict_markers_stay_flagged(conflicted: tuple[Path, str]) -> None:
    root, base = conflicted
    assert "<<<<<<<" in (root / TEST).read_text()
    merge = finish(root, None)
    assert flagged(root, base, merge)


def test_a_mix_of_both_sides_stays_flagged(conflicted: tuple[Path, str]) -> None:
    root, base = conflicted
    merge = finish(root, text(first="    assert 'ticket'\n    assert 'main'\n"))
    assert flagged(root, base, merge)


def test_a_cleanly_merged_file_hand_reverted_to_one_side_stays_flagged(tmp_path: Path) -> None:
    """Only a conflicted path may be taken whole from one side: here git merged both changes."""
    git(tmp_path, "init", "-q", "-b", "main")
    git(tmp_path, "config", "user.email", "test@example.invalid")
    git(tmp_path, "config", "user.name", "test")
    git(tmp_path, "config", "commit.gpgsign", "false")
    commit(tmp_path, "acceptance: 21c", text())
    base = git(tmp_path, "rev-parse", "HEAD")
    git(tmp_path, "checkout", "-q", "-b", "ticket")
    commit(tmp_path, "acceptance: 21c first", text(first="    assert 'ticket'\n"))
    git(tmp_path, "checkout", "-q", "main")
    commit(tmp_path, "acceptance: 21c last", text(last="    assert 'main'\n"))
    git(tmp_path, "checkout", "-q", "ticket")
    git(tmp_path, "merge", "-q", "--no-commit", "--no-ff", "main")
    merge = finish(tmp_path, text(first="    assert 'ticket'\n"))
    assert flagged(tmp_path, base, merge)


def test_a_merge_whose_tree_is_merge_trees_own_conflicted_output_is_flagged(
    conflicted: tuple[Path, str],
) -> None:
    """merge-tree labels its markers with the parents' shas; committing that tree as the merge must
    not pass because it equals git's own merge."""
    root, base = conflicted
    git(root, "merge", "--abort")
    ticket, main = git(root, "rev-parse", "ticket"), git(root, "rev-parse", "main")
    done = subprocess.run(
        ["git", "-C", str(root), "merge-tree", "--write-tree", ticket, main],
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 1
    tree = done.stdout.split("\n", 1)[0]
    merge = git(root, "commit-tree", tree, "-p", ticket, "-p", main, "-m", "merge main")
    assert "<<<<<<<" in git(root, "show", f"{merge}:{TEST}")
    git(root, "reset", "-q", "--hard", merge)
    assert flagged(root, base, merge[:12])
