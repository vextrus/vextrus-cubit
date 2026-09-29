"""The acceptance check (ADR 0041): a builder cannot quietly change the acceptance tests written before
it started; only an `acceptance:` commit that changes nothing else may."""

import subprocess
from pathlib import Path

import pytest

from tools.lint.acceptance import is_acceptance, main, problems


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
    git(root, "commit", "-q", "-m", message)
    return git(root, "rev-parse", "HEAD")


@pytest.fixture
def repo(tmp_path: Path) -> tuple[Path, str]:
    """A repository with main at one commit; the ticket's branch checked out from it."""
    git(tmp_path, "init", "-q", "-b", "main")
    git(tmp_path, "config", "user.email", "test@example.invalid")
    git(tmp_path, "config", "user.name", "test")
    git(tmp_path, "config", "commit.gpgsign", "false")
    base = commit(tmp_path, "init", {"README.md": "x\n"})
    git(tmp_path, "checkout", "-q", "-b", "ticket")
    return tmp_path, base


def test_acceptance_paths() -> None:
    assert is_acceptance("vextrus/takeoff/tests/acceptance/t21c/test_confirm.py")
    assert is_acceptance("engine/read/tests/acceptance/t13/test_sheets.py")
    assert is_acceptance("web/src/acceptance/t21c/confirm.test.tsx")
    assert is_acceptance("web/e2e/acceptance/t21c/walk.spec.ts")
    assert not is_acceptance("vextrus/takeoff/tests/test_confirm.py")
    assert not is_acceptance("web/src/features/acceptance.ts")
    assert not is_acceptance("docs/acceptance/notes.md")


def test_the_writers_commit_then_the_builders_pass(repo: tuple[Path, str]) -> None:
    root, base = repo
    commit(
        root, "acceptance: 21c pins the confirm", {"vextrus/t/tests/acceptance/t21c/test_a.py": "a\n"}
    )
    commit(root, "21c: the confirm", {"vextrus/t/api.py": "b\n", "vextrus/t/tests/test_api.py": "c\n"})
    assert problems(root, base) == []


def test_a_builder_weakening_an_acceptance_test_fails(repo: tuple[Path, str]) -> None:
    root, base = repo
    commit(root, "acceptance: 21c", {"web/src/acceptance/t21c/a.test.tsx": "expect(1)\n"})
    bad = commit(root, "21c: fix the flaky test", {"web/src/acceptance/t21c/a.test.tsx": "skip\n"})
    [problem] = problems(root, base)
    assert problem.startswith(bad[:12])
    assert "web/src/acceptance/t21c/a.test.tsx" in problem


def test_an_acceptance_commit_that_changes_code_too_fails(repo: tuple[Path, str]) -> None:
    root, base = repo
    bad = commit(
        root,
        "acceptance: 21c",
        {"web/e2e/acceptance/t21c/walk.spec.ts": "x\n", "web/src/app.tsx": "y\n"},
    )
    [problem] = problems(root, base)
    assert problem.startswith(bad[:12])
    assert "web/src/app.tsx" in problem


def test_a_merge_from_main_bringing_other_acceptance_tests_passes(repo: tuple[Path, str]) -> None:
    root, base = repo
    commit(root, "21c: the confirm", {"vextrus/t/api.py": "b\n"})
    git(root, "checkout", "-q", "main")
    commit(root, "acceptance: 22", {"vextrus/u/tests/acceptance/t22/test_b.py": "b\n"})
    commit(root, "22: other ticket", {"vextrus/u/api.py": "u\n"})
    main_head = git(root, "rev-parse", "HEAD")
    git(root, "checkout", "-q", "ticket")
    git(root, "merge", "-q", "--no-edit", "main")
    assert problems(root, base) == []
    assert problems(root, main_head) == []


def test_main_exits_one_on_a_problem(repo: tuple[Path, str], monkeypatch: pytest.MonkeyPatch) -> None:
    root, base = repo
    monkeypatch.chdir(root)
    commit(root, "acceptance: 21c", {"vextrus/t/tests/acceptance/t21c/test_a.py": "a\n"})
    assert main([base]) == 0
    commit(root, "21c: loosen", {"vextrus/t/tests/acceptance/t21c/test_a.py": "b\n"})
    assert main([base, "HEAD"]) == 1
    assert main([]) == 2
