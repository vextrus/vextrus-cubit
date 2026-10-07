"""T-LAND 4: `land()` through the real `Gh` class and a fake gh 2.45 on PATH, end to end: each refusal is
exit 3 with one plain `land: ...` line (no traceback), the merge is pinned to the head CI was green on,
a conflict with main is the builder's to fix, and the lander never moves a branch itself.

S17-F7 (the owner's ruling, 7 Oct 2026: main's ruleset no longer requires a branch to be up to date):
the lander lands a PR's head as it stands, CI green on that head; a PR GitHub reports CONFLICTING /
DIRTY is refused naming `land update`; only `land update <PR>` moves the head, bringing main in
through GitHub's REST route (`gh api --method PUT .../pulls/<n>/update-branch -f
expected_head_sha=<head>`): gh 2.45 has no `gh pr update-branch` (amendment 1).

Seams (fixed by the ticket): `scripts.land.Gh(repo, *, sleep, polls)`, `land(..., repo=)`,
`scripts.land.main(["update", "<PR>"])`.
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
    update_request,
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
    updated: int | None = None

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
    update_first: bool = False,
    **state: Any,
) -> Landing:
    """Land PR 12 from a fresh clone; `views` names fixture payloads for the head CI runs on: the
    reviewed head as it stands, or, with `update_first` (`land update 12` run before landing, its exit
    code kept in `updated`), the merged head the update makes. When `behind`, GitHub would accept a
    request to bring main in, moving the head to the merge, unless `update` scripts another answer."""
    repo = PrRepo(tmp_path, behind=behind)
    if passed:
        record(tmp_path / "ledger", repo.reviewed)
    tested = repo.merged if update_first and repo.merged else repo.reviewed
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
    updated: int | None = None
    if update_first:
        land = lander()

        class Fast(land.Gh):  # type: ignore[misc, name-defined]
            def __init__(self, *args: Any, **options: Any) -> None:
                options["sleep"] = lambda _: None
                super().__init__(*args, **options)

        with monkeypatch.context() as patch:
            patch.setattr(land, "Gh", Fast)
            updated = land.main(["update", str(PR)])
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
    return Landing(code, fake, repo, out, err, started, updated)


def git_subcommand(argv: list[str]) -> str | None:
    """The git subcommand an argv runs (`git -C <dir> -c <k=v> fetch ...` runs `fetch`)."""
    if not argv or Path(argv[0]).name != "git":
        return None
    rest = argv[1:]
    while rest and rest[0].startswith("-"):
        rest = rest[2:] if rest[0] in ("-C", "-c", "--git-dir", "--work-tree") else rest[1:]
    return rest[0] if rest else None


def fast_forward(argv: list[str]) -> bool:
    """Main fast-forwarded to origin's main after the merge (T-LAND-PULL): the one merge allowed."""
    ref = argv[-1:] in (["refs/remotes/origin/main"], ["origin/main"])
    return git_subcommand(argv) == "merge" and argv[-3:-1] == ["-q", "--ff-only"] and ref


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


def test_d_a_conflict_with_main_is_the_builder_s_to_fix_and_names_land_update(
    env: Fixtures,
) -> None:
    """S17-F7: GitHub reports the PR CONFLICTING / DIRTY; an update cannot resolve a conflict, so the
    lander never asks for one."""
    done = landing(
        *env,
        behind=True,
        update="conflict",
        mergeable="CONFLICTING",
        merge_state_status="DIRTY",
    )
    line = done.refused_plainly()
    assert "land update" in line, "the refusal does not name `land update`: " + line
    assert "conflicts with main" in line
    assert "builder" in line
    assert done.fake.updates() == [], "the lander asked GitHub to bring main in"
    assert "served" not in done.fake.state, "CI was waited on for a branch that cannot take main"
    assert not done.fake.called("pr", "merge")


def test_e_a_head_moved_by_land_update_lands_on_the_new_head(env: Fixtures) -> None:
    """S17-F7: `land update 12` is the one path that moves the head (one request, carrying the
    reviewed head); landing then merges the new head CI was green on, adding no request of its own."""
    done = landing(*env, behind=True, update_first=True)
    assert done.updated == 0, done.out + done.err
    assert done.code == 0, done.out + done.err
    assert done.repo.merged is not None
    assert [update_request(argv, done.repo.reviewed) for argv in done.fake.updates()] == [True]
    assert done.fake.called("pr", "merge") == [
        ["pr", "merge", str(PR), "--merge", "--match-head-commit", done.repo.merged]
    ]
    merge_at = next(i for i, argv in enumerate(done.started) if argv[:3] == ["gh", "pr", "merge"])
    # T-LAND-PULL: main is fetched, then fast-forwarded to origin/main; `git pull` reads FETCH_HEAD.
    fetches = [
        i
        for i, argv in enumerate(done.started)
        if git_subcommand(argv) == "fetch" and argv[-3:] == ["-q", "origin", "main"]
    ]
    pulls = [i for i, argv in enumerate(done.started) if fast_forward(argv)]
    assert pulls, "main is pulled, fast-forward only"
    assert pulls[0] > merge_at, "main is pulled after the merge"
    assert [i for i in fetches if merge_at < i < pulls[0]], "main is fetched before it is pulled"
    assert "Traceback" not in done.err


def test_j_a_reviewed_green_pr_one_commit_behind_main_lands(env: Fixtures) -> None:
    """Amendment 1: `gh pr update-branch` is an unknown command on gh 2.45, so a lander that calls it
    refuses every PR behind main with a false "conflicts with main". S17-F7: it lands as it stands,
    main not brought in."""
    done = landing(*env, behind=True)
    assert "conflicts with main" not in done.out
    assert not done.fake.called("pr", "update-branch"), "gh 2.45 has no `gh pr update-branch`"
    assert done.fake.updates() == [], "the lander asked GitHub to bring main in"
    assert done.code == 0, done.out + done.err
    assert done.fake.state["head"] == done.repo.reviewed, "the PR's head moved"
    assert done.fake.called("pr", "merge") == [
        ["pr", "merge", str(PR), "--merge", "--match-head-commit", done.repo.reviewed]
    ]
    assert done.lines() == [f"land: PR {PR} merged"]


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
    assert not done.fake.updates()
    assert done.fake.called("pr", "merge") == [
        ["pr", "merge", str(PR), "--merge", "--match-head-commit", done.repo.reviewed]
    ]


def test_h_the_lander_never_moves_a_branch_or_a_worktree(env: Fixtures) -> None:
    done = landing(*env, behind=True)
    assert done.code == 0, done.out + done.err
    ran = {
        sub
        for argv in done.started
        if (sub := git_subcommand(argv)) is not None and not fast_forward(argv)
    }
    assert ran, "the flow reads git (fetch, merge-base) through subprocess"
    assert not ran & FORBIDDEN, sorted(ran & FORBIDDEN)


def test_i_gh_failing_on_pr_view_is_a_plain_refusal(env: Fixtures) -> None:
    done = landing(*env, behind=False, fail_view=True)
    done.refused_plainly()
    assert not done.fake.called("pr", "merge")
