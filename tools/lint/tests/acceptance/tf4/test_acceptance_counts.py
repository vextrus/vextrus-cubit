"""Ticket f4, T5 (C3): an acceptance commit carries its counts (`contracts/trailers.md` 3;
docs/specs/factory.md 5, definition of done 1): `red-on-main: <n> failed` and `green-on-throwaway: <n>
passed`, each on its own line, unless the commit is listed by full sha in
`tools/lint/acceptance_legacy.txt` as that file is at the base (a PR cannot exempt itself).
A commit that only deletes acceptance files needs no counts.

Seam: `tools.lint.acceptance.problems(root, base, head)` and `main([base, head])` (exit 1 on a problem).
"""

import re
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
TEST = "vextrus/t/tests/acceptance/t1/test_a.py"
COUNTS = "red-on-main: 3 failed\ngreen-on-throwaway: 3 passed\n"
LEGACY = {
    "0a72a25d38bdfa648874a2d24b06ac586649267e",
    "0383e734b8aa91c9518d93abf22133e5a62c1f49",
    "449fd7956a59ff05a3d0ab9fc3c6f0e9318d3adf",
    "050b96e604013529fb3e51ce09d31992d391ed08",
}


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def commit(root: Path, message: str, files: dict[str, str]) -> str:
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        git(root, "add", name)
    (root.parent / "message.txt").write_text(message)
    git(root, "commit", "-q", "-F", str(root.parent / "message.txt"))
    return git(root, "rev-parse", "HEAD")


@pytest.fixture
def repo(tmp_path: Path) -> tuple[Path, str]:
    """A repository with main at one commit; the ticket's branch checked out from it."""
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    base = commit(root, "init", {"README.md": "x\n"})
    git(root, "checkout", "-q", "-b", "ticket")
    return root, base


def problems(root: Path, base: str, head: str = "HEAD") -> list[str]:
    from tools.lint.acceptance import problems as found

    return found(root, base, head)


def test_an_acceptance_commit_passes_with_its_counts_and_fails_without(repo: tuple[Path, str]) -> None:
    root, base = repo
    bare = commit(root, "acceptance: t1 pins the confirm\n", {TEST: "a\n"})
    counted = commit(root, f"acceptance: t1 pins the export\n\nWhat it pins.\n{COUNTS}", {TEST: "b\n"})
    found = problems(root, base, bare)
    assert found
    assert all(problem.startswith(bare[:12]) for problem in found)
    assert problems(root, bare, counted) == []


@pytest.mark.parametrize(
    ("message", "names"),
    [
        ("green-on-throwaway: 3 passed\n", ("red-on-main",)),
        ("red-on-main: 3 failed\n", ("green-on-throwaway",)),
        ("red-on-main: three failed\ngreen-on-throwaway: 3 passed\n", ("red-on-main",)),
        ("red-on-main: 3\ngreen-on-throwaway: 3 passed\n", ("red-on-main",)),
        ("red-on-main: 3 failed (test_a, test_b)\ngreen-on-throwaway: 3 passed\n", ("red-on-main",)),
        ("Red on main: 3 of 4 fail\ngreen-on-throwaway: 4 passed\n", ("red-on-main",)),
        ("red-on-main: 0 failed\ngreen-on-throwaway: 3 passed\n", ("red-on-main",)),
        ("red-on-main: 3 failed\ngreen-on-throwaway: 0 passed\n", ("green-on-throwaway",)),
        ("red-on-main: 3 failed\ngreen-on-throwaway: 2 passed\n", ("green-on-throwaway", "red-on-main")),
    ],
    ids=[
        "no-red",
        "no-green",
        "word-count",
        "no-failed",
        "trailing-names",
        "other-wording",
        "red-zero",
        "green-zero",
        "green-below-red",
    ],
)
def test_missing_or_misworded_counts_fail_naming_the_commit_and_the_line(
    repo: tuple[Path, str], message: str, names: tuple[str, ...], monkeypatch: pytest.MonkeyPatch
) -> None:
    from tools.lint.acceptance import main

    root, base = repo
    bad = commit(root, f"acceptance: t1 pins the confirm\n\n{message}", {TEST: "a\n"})
    found = problems(root, base)
    assert found
    assert any(
        problem.startswith(bad[:12]) and any(word in problem for word in names) for problem in found
    )
    monkeypatch.chdir(root)
    assert main([base, "HEAD"]) == 1


def test_a_commit_listed_in_the_bases_legacy_file_is_exempt_but_a_pr_cannot_list_itself(
    tmp_path: Path,
) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    init = commit(root, "init", {"README.md": "x\n"})
    git(root, "checkout", "-q", "-b", "carried")
    carried = commit(root, "acceptance: t9 pins the carried promise\n", {TEST: "a\n"})

    git(root, "checkout", "-q", "main")
    legacy = f"# carried branches' acceptance commits, before the counts rule\n\n{carried}\n"
    base = commit(root, "the legacy list", {"tools/lint/acceptance_legacy.txt": legacy})
    git(root, "checkout", "-q", "carried")
    git(root, "merge", "-q", "--no-edit", "main")
    assert problems(root, base) == []

    git(root, "checkout", "-q", "-b", "self-listed", carried)
    commit(root, "list my own commit", {"tools/lint/acceptance_legacy.txt": f"{carried}\n"})
    found = problems(root, init)
    assert any(problem.startswith(carried[:12]) for problem in found)


def test_an_acceptance_commit_that_only_deletes_needs_no_counts(repo: tuple[Path, str]) -> None:
    root, base = repo
    added = commit(
        root,
        f"acceptance: t1 pins tier 2\n\n{COUNTS}",
        {TEST: "a\n", "x/tests/acceptance/t1/test_b.py": "b\n"},
    )
    git(root, "rm", "-q", TEST, "x/tests/acceptance/t1/test_b.py")
    commit(root, "acceptance: t1 withdraws tier 2 (cut)\n", {})
    unlisted = commit(root, "acceptance: t1 pins it again\n", {TEST: "c\n"})
    found = problems(root, added)
    assert found
    assert all(problem.startswith(unlisted[:12]) for problem in found)
    assert problems(root, base, f"{unlisted}~1") == []


def test_the_real_legacy_list_names_at_least_the_carried_commits() -> None:
    path = REPO / "tools/lint/acceptance_legacy.txt"
    assert path.is_file()
    listed = [
        line.strip()
        for line in path.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert all(re.fullmatch(r"[0-9a-f]{40}", line) for line in listed)
    assert len(listed) == len(set(listed))
    # Every carried commit is listed; more may be added.
    # A PR cannot exempt itself: the lint reads the base's file.
    assert set(listed) >= LEGACY


def test_the_existing_rules_still_hold_beside_the_counts_rule(repo: tuple[Path, str]) -> None:
    root, base = repo
    mixed = commit(root, "acceptance: t1 pins and builds\n", {TEST: "a\n", "vextrus/t/api.py": "b\n"})
    weakened = commit(root, "t1: fix the flaky test\n", {TEST: "skip\n"})
    found = problems(root, base)
    assert any(problem.startswith(weakened[:12]) for problem in found)
    mixed_problems = [problem for problem in found if problem.startswith(mixed[:12])]
    assert any("vextrus/t/api.py" in problem for problem in mixed_problems)
    assert any("red-on-main" in problem or "green-on-throwaway" in problem for problem in mixed_problems)
