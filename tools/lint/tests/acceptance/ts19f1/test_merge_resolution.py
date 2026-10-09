"""S19-F1 (1): the acceptance check flags a merge only where the merge itself, not git, wrote an
acceptance file.

The defect, measured in session 19: `merges()` listed a merge's files with `git diff-tree --cc`, which
names every file that differs from all parents, so a file both sides changed in different places, merged
cleanly by git with no hand edit, was reported as "a merge whose own resolution changes" it (70bb2ecba,
5b136b614: `git show --cc` shows no hunk for either). The pin: a merge is flagged only where an
acceptance file's merged content differs from git's own merge of its parents; a conflicted acceptance
file, a hand edit (conflict-free or not), an acceptance file the merge adds or deletes on its own, and
an octopus merge's acceptance file that differs from every parent (git's two-parent merge cannot vouch
for it: the safe reading) are still flagged.

Every repository here is a throwaway made in `tmp_path`, as `tools/lint/tests/test_acceptance.py` does.
"""

import subprocess
from pathlib import Path

import pytest

from tools.lint.acceptance import problems

COUNTS = "\n\nred-on-main: 1 failed\ngreen-on-throwaway: 1 passed"
TEST = "vextrus/t/tests/acceptance/t21c/test_a.py"
# Seven lines: a change to the first and one to the last are far enough apart for git to merge cleanly.
LINES = [f"def test_{n}():\n    assert {n}\n" for n in range(1, 8)]


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def commit(root: Path, message: str, files: dict[str, str]) -> str:
    """Commit the files; an `acceptance:` message gets its counts (the counts rule has its own tests)."""
    if message.startswith("acceptance:"):
        message += COUNTS
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        git(root, "add", name)
    git(root, "commit", "-q", "-m", message)
    return git(root, "rev-parse", "HEAD")


def text(first: str = "", last: str = "") -> str:
    """The acceptance file: its first and last tests may each carry an added line."""
    lines = list(LINES)
    lines[0] += first
    lines[-1] += last
    return "".join(lines)


@pytest.fixture
def repo(tmp_path: Path) -> tuple[Path, str]:
    """main holds the acceptance file; the ticket's branch is checked out from it (the base)."""
    git(tmp_path, "init", "-q", "-b", "main")
    git(tmp_path, "config", "user.email", "test@example.invalid")
    git(tmp_path, "config", "user.name", "test")
    git(tmp_path, "config", "commit.gpgsign", "false")
    commit(tmp_path, "init", {"README.md": "x\n", "vextrus/t/api.py": "a\n"})
    base = commit(tmp_path, "acceptance: 21c", {TEST: text()})
    git(tmp_path, "checkout", "-q", "-b", "ticket")
    return tmp_path, base


def both_sides_change_the_test(root: Path) -> None:
    """The ticket's acceptance commit adds to the first test; main's adds to the last."""
    commit(root, "acceptance: 21c first", {TEST: text(first="    assert 'ticket'\n")})
    git(root, "checkout", "-q", "main")
    commit(root, "acceptance: 21c last", {TEST: text(last="    assert 'main'\n")})
    git(root, "checkout", "-q", "ticket")


def merge_main(root: Path) -> subprocess.CompletedProcess[str]:
    """Start a merge of main without committing it (it may stop on a conflict)."""
    return subprocess.run(
        ["git", "-C", str(root), "merge", "-q", "--no-commit", "--no-ff", "main"],
        capture_output=True,
        text=True,
        check=False,
    )


def finish(root: Path, *names: str) -> str:
    for name in names:
        git(root, "add", name)
    git(root, "commit", "-q", "--no-edit")
    return git(root, "rev-parse", "HEAD")


def flagged(found: list[str], merge: str) -> list[str]:
    return [problem for problem in found if problem.startswith(merge[:12]) and TEST in problem]


def test_a_clean_merge_of_an_acceptance_file_both_sides_changed_is_not_flagged(
    repo: tuple[Path, str],
) -> None:
    root, base = repo
    both_sides_change_the_test(root)
    git(root, "merge", "-q", "--no-edit", "main")
    merged = (root / TEST).read_text()
    assert "'ticket'" in merged  # git merged both sides itself
    assert "'main'" in merged
    found = problems(root, base)
    assert found == [], f"a clean merge flagged: {found}"


def test_a_clean_merge_of_an_acceptance_file_beside_a_conflict_elsewhere_is_not_flagged(
    repo: tuple[Path, str],
) -> None:
    """A train's merge: a product file conflicts and is resolved by hand; the acceptance file both
    sides changed merges cleanly and is left as git wrote it."""
    root, base = repo
    both_sides_change_the_test(root)
    commit(root, "21c: the confirm", {"vextrus/t/api.py": "ticket\n"})
    git(root, "checkout", "-q", "main")
    commit(root, "22: other ticket", {"vextrus/t/api.py": "main\n"})
    git(root, "checkout", "-q", "ticket")
    assert merge_main(root).returncode != 0  # api.py conflicts
    (root / "vextrus/t/api.py").write_text("ticket\nmain\n")
    finish(root, "vextrus/t/api.py")
    found = problems(root, base)
    assert found == [], f"a clean merge flagged: {found}"


def test_a_merge_that_hand_edits_a_cleanly_merged_acceptance_file_is_flagged(
    repo: tuple[Path, str],
) -> None:
    root, base = repo
    both_sides_change_the_test(root)
    assert merge_main(root).returncode == 0
    merged = (root / TEST).read_text()
    (root / TEST).write_text(merged.replace("    assert 4\n", "    pass\n"))
    merge = finish(root, TEST)
    assert flagged(problems(root, base), merge), "a hand edit in a merge was not flagged"


def test_a_conflicted_acceptance_file_resolved_by_hand_is_flagged(repo: tuple[Path, str]) -> None:
    root, base = repo
    commit(root, "acceptance: 21c ticket", {TEST: text(first="    assert 'ticket'\n")})
    git(root, "checkout", "-q", "main")
    commit(root, "acceptance: 21c main", {TEST: text(first="    assert 'main'\n")})
    git(root, "checkout", "-q", "ticket")
    assert merge_main(root).returncode != 0  # the acceptance file conflicts
    (root / TEST).write_text(text(first="    pass\n"))
    merge = finish(root, TEST)
    assert flagged(problems(root, base), merge), "a hand-resolved conflict was not flagged"


def test_a_merge_that_adds_an_acceptance_file_neither_parent_has_is_flagged(
    repo: tuple[Path, str],
) -> None:
    root, base = repo
    commit(root, "21c: the confirm", {"vextrus/t/api.py": "ticket\n"})
    git(root, "checkout", "-q", "main")
    commit(root, "22: other ticket", {"README.md": "y\n"})
    git(root, "checkout", "-q", "ticket")
    assert merge_main(root).returncode == 0
    added = "vextrus/t/tests/acceptance/t21c/test_b.py"
    (root / added).write_text("def test_b():\n    pass\n")
    merge = finish(root, added)
    found = [problem for problem in problems(root, base) if problem.startswith(merge[:12])]
    assert any(added in problem for problem in found), "a file added by a merge was not flagged"


def test_a_merge_that_deletes_an_acceptance_file_both_parents_keep_is_flagged(
    repo: tuple[Path, str],
) -> None:
    root, base = repo
    commit(root, "21c: the confirm", {"vextrus/t/api.py": "ticket\n"})
    git(root, "checkout", "-q", "main")
    commit(root, "22: other ticket", {"README.md": "y\n"})
    git(root, "checkout", "-q", "ticket")
    assert merge_main(root).returncode == 0
    git(root, "rm", "-q", TEST)
    git(root, "commit", "-q", "--no-edit")
    merge = git(root, "rev-parse", "HEAD")
    assert flagged(problems(root, base), merge), "a file deleted by a merge was not flagged"


def test_an_octopus_merge_of_an_acceptance_file_changed_on_two_sides_is_flagged(
    repo: tuple[Path, str],
) -> None:
    """The safe reading: git's two-parent merge cannot vouch for a three-parent merge's file, so an
    acceptance file that differs from every parent of an octopus merge stays flagged."""
    root, base = repo
    commit(root, "21c: the confirm", {"vextrus/t/api.py": "ticket\n"})
    git(root, "checkout", "-q", "-b", "one", base)
    commit(root, "acceptance: 21c first", {TEST: text(first="    assert 'one'\n")})
    git(root, "checkout", "-q", "-b", "two", base)
    commit(root, "acceptance: 21c last", {TEST: text(last="    assert 'two'\n")})
    git(root, "checkout", "-q", "ticket")
    git(root, "merge", "-q", "--no-edit", "one", "two")
    merge = git(root, "rev-parse", "HEAD")
    assert len(git(root, "rev-list", "--parents", "-1", merge).split()) == 4  # three parents
    assert flagged(problems(root, base), merge), "an octopus merge's acceptance file was not flagged"
