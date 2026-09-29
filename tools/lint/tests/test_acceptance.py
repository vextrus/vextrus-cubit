"""The acceptance check (ADR 0041): a builder cannot quietly change the acceptance tests written before
it started; only an `acceptance:` commit that changes nothing else may."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from tools.lint.acceptance import is_acceptance, main, problems

REPO = Path(__file__).resolve().parents[3]


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


def test_a_merge_whose_resolution_weakens_an_acceptance_test_fails(repo: tuple[Path, str]) -> None:
    root, base = repo
    commit(root, "acceptance: 21c", {"vextrus/t/tests/acceptance/t21c/test_a.py": "assert 1\n"})
    git(root, "checkout", "-q", "main")
    commit(root, "22: other ticket", {"vextrus/u/api.py": "u\n"})
    git(root, "checkout", "-q", "ticket")
    git(root, "merge", "-q", "--no-commit", "--no-ff", "main")
    (root / "vextrus/t/tests/acceptance/t21c/test_a.py").write_text("pass\n")
    git(root, "add", "vextrus/t/tests/acceptance/t21c/test_a.py")
    git(root, "commit", "-q", "-m", "Merge main")
    merge = git(root, "rev-parse", "HEAD")
    [problem] = problems(root, base)
    assert problem.startswith(merge[:12])
    assert "a merge whose own resolution" in problem


def test_a_config_line_naming_the_acceptance_tests_fails(repo: tuple[Path, str]) -> None:
    root, base = repo
    commit(root, "21c: deps", {"pyproject.toml": "[project]\nname = 'x'\n"})
    assert problems(root, base) == []
    bad = commit(
        root,
        "21c: tidy the suite",
        {"vextrus/t/conftest.py": "collect_ignore_glob = ['tests/acceptance/*']\n"},
    )
    [problem] = problems(root, base)
    assert problem.startswith(bad[:12])
    assert "vextrus/t/conftest.py" in problem


def test_a_web_config_excluding_the_acceptance_folder_fails(repo: tuple[Path, str]) -> None:
    root, base = repo
    commit(root, "21c: web", {"web/vite.config.ts": "exclude: ['src/**/*.tz.test.tsx']\n"})
    assert problems(root, base) == []
    commit(root, "21c: web", {"web/vite.config.ts": "exclude: ['src/acceptance/**']\n"})
    [problem] = problems(root, base)
    assert "web/vite.config.ts" in problem


SKIPPED = """\
import pytest


@pytest.mark.skip(reason="flaky")
def test_skipped():
    assert False


@pytest.mark.xfail
def test_xfailed():
    assert False


def test_kept():
    assert True


@pytest.mark.needs_toolchain
def test_opt_in():
    assert True


def test_deselected_by_k():
    assert True
"""


def run_plugin(root: Path, folder: str) -> subprocess.CompletedProcess[str]:
    tests = root / folder
    tests.mkdir(parents=True)
    (tests / "test_a.py").write_text(SKIPPED)
    (root / "pytest.ini").write_text(
        "[pytest]\nmarkers =\n  needs_toolchain: x\naddopts = -m 'not needs_toolchain'\n"
    )
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "tools.lint.acceptance_pytest",
            "-p",
            "no:django",
            "-p",
            "no:cacheprovider",
            "-k",
            "not deselected_by_k",
            str(tests),
        ],
        cwd=root,
        env={**os.environ, "PYTHONPATH": str(REPO)},
        capture_output=True,
        text=True,
        check=False,
    )


def test_a_skipped_xfailed_or_deselected_acceptance_test_fails_the_run(tmp_path: Path) -> None:
    done = run_plugin(tmp_path, "vextrus/t/tests/acceptance/t21c")
    assert done.returncode == 1, done.stdout
    assert "test_a.py::test_skipped: skipped" in done.stdout
    assert "test_a.py::test_xfailed: xfailed or xpassed" in done.stdout
    assert "test_a.py::test_deselected_by_k: deselected" in done.stdout
    assert "test_opt_in" not in done.stdout.split("did not run")[-1]


def test_the_same_tests_outside_the_acceptance_paths_pass(tmp_path: Path) -> None:
    done = run_plugin(tmp_path, "vextrus/t/tests")
    assert done.returncode == 0, done.stdout
