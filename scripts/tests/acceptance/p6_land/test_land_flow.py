"""T-LAND 4: `land()` through the real `Gh` class and a fake gh 2.45 on PATH, end to end: each refusal is
exit 3 with one plain `land: ...` line (no traceback), the merge is pinned to the head CI was green on,
an `update-branch` conflict is the builder's to fix, and the lander never moves a branch itself.

Seams (fixed by the ticket): `scripts.land.Gh(repo, *, sleep, polls)`, `land(..., repo=)`.
"""

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.p6_land._fakegh import (
    FAILED_JOB,
    PR,
    FakeGh,
    PrRepo,
    failed_log,
    install,
    lander,
    record,
    rollup,
)

FORBIDDEN = {"checkout", "switch", "reset", "push", "branch", "worktree", "merge", "rebase"}
MOVED = "d" * 40


@dataclass
class Landing:
    code: int
    fake: FakeGh
    repo: PrRepo
    out: str
    err: str
    started: list[list[str]]

    def lines(self) -> list[str]:
        return [line for line in self.out.splitlines() if line.startswith("land:")]

    def refused_plainly(self) -> str:
        assert self.code == 3
        assert "Traceback" not in self.err
        assert len(self.lines()) == 1, self.out
        assert self.lines()[0].startswith(f"land: refused: PR {PR}"), self.lines()
        return self.lines()[0]


def landing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
    *,
    behind: bool,
    passed: bool = True,
    views: list[str] | None = None,
    ready: int = 0,
    **state: Any,
) -> Landing:
    """Land PR 12 from a fresh clone; `views` names fixture payloads for the head CI runs on (the
    merged head when `behind` and the update succeeds, else the reviewed head)."""
    repo = PrRepo(tmp_path, behind=behind)
    if passed:
        record(tmp_path / "ledger", repo.reviewed)
    tested = repo.merged if behind and repo.merged else repo.reviewed
    payloads = [rollup(name, tested) for name in views or ["green"]]
    if behind and "update" not in state:
        state["update"] = {"head": repo.merged, "update_ref": [str(repo.origin), "refs/pull/12/head"]}
    fake = install(
        tmp_path,
        monkeypatch,
        head=repo.reviewed,
        views=payloads,
        logs={FAILED_JOB: failed_log("FAILED vextrus/y/tests/test_b.py::test_real - assert 0")},
        **state,
    )
    monkeypatch.chdir(repo.work)
    started: list[list[str]] = []
    real = subprocess.Popen

    def recording(args: Any, *rest: Any, **options: Any) -> Any:
        started.append([str(part) for part in args] if isinstance(args, list | tuple) else [str(args)])
        return real(args, *rest, **options)

    def system(command: str) -> int:
        raise AssertionError("land runs no shell command")

    capfd.readouterr()
    with monkeypatch.context() as patch:
        patch.setattr(subprocess, "Popen", recording)
        patch.setattr(os, "system", system)
        code: int = lander().land(
            PR,
            lander().Gh(repo.work, sleep=lambda _: None),
            ledger_dir=tmp_path / "ledger",
            flaky=set(),
            ready=lambda _: ready,
            repo=repo.work,
        )
    out, err = capfd.readouterr()
    return Landing(code, fake, repo, out, err, started)


def git_subcommand(argv: list[str]) -> str | None:
    """The git subcommand an argv runs (`git -C <dir> -c <k=v> fetch ...` runs `fetch`)."""
    if not argv or Path(argv[0]).name != "git":
        return None
    rest = argv[1:]
    while rest and rest[0].startswith("-"):
        rest = rest[2:] if rest[0] in ("-C", "-c", "--git-dir", "--work-tree") else rest[1:]
    return rest[0] if rest else None


Fixtures = tuple[Path, pytest.MonkeyPatch, pytest.CaptureFixture[str]]


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]) -> Fixtures:
    return tmp_path, monkeypatch, capfd


def test_a_no_ledger_pass_refuses_before_marking_ready(env: Fixtures) -> None:
    done = landing(*env, behind=False, passed=False)
    done.refused_plainly()
    assert not done.fake.called("pr", "ready")
    assert not done.fake.called("pr", "merge")


def test_b_red_ci_not_listed_as_flaky_refuses(env: Fixtures) -> None:
    done = landing(*env, behind=False, views=["red"])
    done.refused_plainly()
    assert not done.fake.called("run", "rerun")
    assert not done.fake.called("pr", "merge")


def test_c_merge_ready_refusing_lands_nothing(env: Fixtures) -> None:
    done = landing(*env, behind=False, ready=1)
    done.refused_plainly()
    assert not done.fake.called("pr", "merge")


def test_d_an_update_branch_conflict_is_the_builder_s_to_fix(env: Fixtures) -> None:
    done = landing(*env, behind=True, update="conflict")
    line = done.refused_plainly()
    assert "conflicts with main" in line
    assert "builder" in line
    assert done.fake.called("pr", "update-branch")
    assert "served" not in done.fake.state, "CI was waited on for a branch that cannot take main"
    assert not done.fake.called("pr", "merge")


def test_e_a_head_moved_by_update_branch_lands_on_the_new_head(env: Fixtures) -> None:
    done = landing(*env, behind=True)
    assert done.code == 0, done.out + done.err
    assert done.repo.merged is not None
    assert len(done.fake.called("pr", "update-branch")) == 1
    assert done.fake.called("pr", "merge") == [
        ["pr", "merge", str(PR), "--merge", "--match-head-commit", done.repo.merged]
    ]
    merge_at = next(i for i, argv in enumerate(done.started) if argv[:3] == ["gh", "pr", "merge"])
    pulls = [
        i
        for i, argv in enumerate(done.started)
        if git_subcommand(argv) == "pull" and argv[-3:] == ["--ff-only", "origin", "main"]
    ]
    assert pulls, "main is pulled, fast-forward only"
    assert pulls[0] > merge_at, "main is pulled after the merge"
    assert "Traceback" not in done.err


def test_f_a_head_pushed_after_ci_went_green_is_not_merged(env: Fixtures) -> None:
    tmp_path, monkeypatch, capfd = env
    repo = PrRepo(tmp_path, behind=False)
    record(tmp_path / "ledger", repo.reviewed)
    green = rollup("green", repo.reviewed) | {"_then_head": MOVED}
    fake = install(tmp_path, monkeypatch, head=repo.reviewed, views=[green])
    monkeypatch.chdir(repo.work)
    code: int = lander().land(
        PR,
        lander().Gh(repo.work, sleep=lambda _: None),
        ledger_dir=tmp_path / "ledger",
        flaky=set(),
        ready=lambda _: 0,
        repo=repo.work,
    )
    out, err = capfd.readouterr()
    assert code == 3
    assert "Traceback" not in err
    first = next(line for line in out.splitlines() if line.startswith("land:"))
    assert first.startswith(f"land: refused: PR {PR}")
    assert not fake.called("pr", "merge")


def test_g_a_head_that_already_holds_main_is_not_updated(env: Fixtures) -> None:
    done = landing(*env, behind=False)
    assert done.code == 0, done.out + done.err
    assert not done.fake.called("pr", "update-branch")
    assert done.fake.called("pr", "merge") == [
        ["pr", "merge", str(PR), "--merge", "--match-head-commit", done.repo.reviewed]
    ]


def test_h_the_lander_never_moves_a_branch_or_a_worktree(env: Fixtures) -> None:
    done = landing(*env, behind=True)
    assert done.code == 0, done.out + done.err
    ran = {sub for argv in done.started if (sub := git_subcommand(argv)) is not None}
    assert ran, "the flow reads git (fetch, merge-base) through subprocess"
    assert not ran & FORBIDDEN, sorted(ran & FORBIDDEN)


def test_i_gh_failing_on_pr_view_is_a_plain_refusal(env: Fixtures) -> None:
    done = landing(*env, behind=False, fail_view=True)
    done.refused_plainly()
    assert not done.fake.called("pr", "merge")
