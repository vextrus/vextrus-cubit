"""S26-FX0 review round 1: the design-gate's test-only rule never counts a route, and e2e's `changes`
job lists files as scripts/walk/ready.py does (renames under both names, non-ASCII names uncoated)."""

from __future__ import annotations

import os
import subprocess
from collections.abc import Callable
from pathlib import Path

import pytest

from tools.lint.tests.acceptance.ts14c14._workflows import condition, jobs, load
from tools.lint.tests.acceptance.ts26fx0._runs import E2E, posted, real_drawings_na


def _git(root: Path, *args: str) -> str:
    env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1", "LC_ALL": "C"}
    done = subprocess.run(
        ["git", "-C", str(root), "-c", "user.name=b", "-c", "user.email=b@example.com", *args],
        capture_output=True,
        text=True,
        env=env,
        check=True,
    )
    return done.stdout.strip()


@pytest.mark.parametrize(
    "route",
    [
        "web/src/routes/_app/report.test.ts",
        "web/src/routes/_app/report.test.tsx",
        "web/src/routes/x.test.tsx",
    ],
)
def test_a_test_named_file_under_routes_still_needs_the_design_gate(route: str, tmp_path: Path) -> None:
    states = [s.get("state") for s in posted(real_drawings_na([route], tmp_path), "design-gate")]
    assert states == [], f"design-gate posted n/a for the route {route}"


def _product(tmp_path: Path, setup: dict[str, str], act: Callable[[Path], None]) -> str:
    """Run e2e.yml's `paths` step in a repo: `setup` files on main, then `act(root)` on a branch."""
    root = tmp_path / "repo"
    root.mkdir()
    _git(root, "init", "-q", "-b", "main")
    for name, text in setup.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(text)
    _git(root, "add", "-A")
    _git(root, "commit", "-q", "-m", "base")
    base = _git(root, "rev-parse", "HEAD")
    _git(root, "checkout", "-q", "-b", "pr")
    act(root)
    _git(root, "add", "-A")
    _git(root, "commit", "-q", "-m", "pr")
    step = next(s for s in load(E2E)["jobs"]["changes"]["steps"] if s.get("id") == "paths")
    out = tmp_path / "out"
    out.touch()
    done = subprocess.run(
        ["bash", "-eo", "pipefail", "-c", step["run"]],
        cwd=root,
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "EVENT": "pull_request",
            "BASE": base,
            "GITHUB_OUTPUT": str(out),
            "RUNNER_TEMP": str(tmp_path),
            "LC_ALL": "C",
        },
    )
    assert done.returncode == 0, done.stderr
    return out.read_text().strip()


BODY = "x = 1\n" * 40


def test_a_rename_out_of_a_product_path_is_a_product_change(tmp_path: Path) -> None:
    def move(root: Path) -> None:
        (root / "docs").mkdir()
        (root / "vextrus/a.py").rename(root / "docs/a.md")

    assert _product(tmp_path, {"vextrus/a.py": BODY}, move) == "product=true"


def test_a_non_ascii_product_file_name_is_a_product_change(tmp_path: Path) -> None:
    def edit(root: Path) -> None:
        (root / "web/src/café.tsx").write_text("changed\n")

    assert _product(tmp_path, {"web/src/café.tsx": "a\n"}, edit) == "product=true"


def test_a_docs_only_change_is_not_a_product_change(tmp_path: Path) -> None:
    def edit(root: Path) -> None:
        (root / "docs/a.md").write_text("b\n")

    assert _product(tmp_path, {"docs/a.md": "a\n"}, edit) == "product=false"


def test_a_failed_changes_job_fails_smoke_instead_of_skipping_it() -> None:
    smoke = jobs(load(E2E))["smoke"]
    failed = {"needs": {"changes": {"result": "failure", "outputs": {}}}, "__status__": "failure"}
    assert condition(smoke, failed), "smoke is skipped when `changes` failed"
    first = smoke["steps"][0]
    assert "needs.changes.result" in str(first.get("if"))
    assert "exit 1" in first["run"]
