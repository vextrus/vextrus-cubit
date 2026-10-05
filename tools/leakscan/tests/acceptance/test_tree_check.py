"""Ticket f2, B5: no drawing and nothing under `.private/` is tracked (spec 5; the f2 build notes:
"`tools/leakscan/tests/test_tracked_tree.py` runs `tree.check(repo root)` on the real checkout: no
tracked file starts with DWG or DXF magic, no tracked path under `.private/`"), and agent memory is
ignored (spec 3.3).

`tree.check(root)` returns the violations, each naming its path; none for a clean tree. Every
repository here is a temporary one with invented bytes. Today the module and the ignore line do not
exist.
"""

import subprocess
from pathlib import Path

import pytest

from ._leak import REPO, git, temp_repo


def _check(root: Path) -> list[str]:
    from tools.leakscan import tree  # the seam the builder's test_tracked_tree.py calls

    return [str(violation) for violation in tree.check(root)]


def _track(repo: Path, path: str, data: bytes, *, force: bool = False) -> None:
    (repo / path).parent.mkdir(parents=True, exist_ok=True)
    (repo / path).write_bytes(data)
    git(repo, "add", *(["-f"] if force else []), "--", path)
    git(repo, "commit", "-q", "-m", f"test: track {Path(path).name}")


def test_a_normal_tracked_tree_has_no_violation(tmp_path: Path) -> None:
    repo, _ = temp_repo(tmp_path)
    _track(repo, "vextrus/app.py", b"print('hello')\n")
    assert _check(repo) == []


@pytest.mark.parametrize(
    ("path", "data"),
    [
        ("plans/sheet.bin", b"AC1032\x00\x00\x00invented"),
        ("plans/sheet.dat", b"AC1018 invented"),
        ("plans/ascii.txt", b"  0\nSECTION\n  2\nHEADER\n"),
        ("plans/binary.txt", b"AutoCAD Binary DXF\r\n\x1a\x00invented"),
    ],
)
def test_a_tracked_file_with_drawing_magic_is_a_violation_naming_its_path(
    tmp_path: Path, path: str, data: bytes
) -> None:
    repo, _ = temp_repo(tmp_path)
    _track(repo, path, data)
    found = _check(repo)
    assert found
    assert any(path in violation for violation in found)


def test_a_tracked_path_under_private_is_a_violation(tmp_path: Path) -> None:
    repo, _ = temp_repo(tmp_path)
    (repo / ".gitignore").write_text("/.private/\n")
    _track(repo, ".private/work/notes.md", b"invented notes\n", force=True)
    assert any(".private/work/notes.md" in violation for violation in _check(repo))


def test_an_untracked_drawing_is_not_a_violation(tmp_path: Path) -> None:
    repo, _ = temp_repo(tmp_path)
    (repo / "loose.dwg").write_bytes(b"AC1032 invented, never staged")
    assert _check(repo) == []


@pytest.mark.parametrize("path", [".claude/agent-memory/x.md", ".claude/agent-memory-y/z"])
def test_agent_memory_is_ignored_by_the_repos_own_gitignore(path: str) -> None:
    done = subprocess.run(["git", "check-ignore", "-q", "--no-index", path], cwd=REPO, check=False)
    assert done.returncode == 0
