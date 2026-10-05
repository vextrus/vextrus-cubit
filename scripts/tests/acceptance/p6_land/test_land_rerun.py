"""T-LAND 2: a failure made only of listed flaky tests gets one `gh run rerun <run> --failed` (the run id
from the failed job's `detailsUrl`), and the lander waits for the rerun's own result: right after a rerun
GitHub still serves the old red (same `completedAt`), which is not the rerun's verdict.

Seams (fixed by the ticket): `scripts.land.Gh(repo, *, sleep, polls)`, `land(..., repo=)`.
"""

from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.p6_land._fakegh import (
    FAILED_JOB,
    FAILED_RUN,
    FLAKY_ID,
    FLAKY_LINE,
    PR,
    FakeGh,
    PrRepo,
    failed_log,
    install,
    lander,
    record,
    rollup,
)

OLD = "2026-10-05T03:09:40Z"
NEW = "2026-10-05T03:31:07Z"


def run_land(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, flaky: set[str], **state: Any
) -> tuple[int, FakeGh]:
    repo = PrRepo(tmp_path, behind=False)
    record(tmp_path / "ledger", repo.reviewed)
    for key in ("views", "after_rerun"):
        for payload in state.get(key, []):
            payload["headRefOid"] = repo.reviewed
    fake = install(tmp_path, monkeypatch, head=repo.reviewed, **state)
    monkeypatch.chdir(repo.work)
    code: int = lander().land(
        PR,
        lander().Gh(repo.work, sleep=lambda _: None),
        ledger_dir=tmp_path / "ledger",
        flaky=flaky,
        ready=lambda _: 0,
        repo=repo.work,
    )
    return code, fake


def red(completed: str) -> dict[str, Any]:
    return rollup("red", "", completedAt=completed)


def green(completed: str) -> dict[str, Any]:
    return rollup("green", "", completedAt=completed)


def reruns(fake: FakeGh) -> list[list[str]]:
    return fake.called("run", "rerun")


def test_a_listed_flake_is_rerun_once_and_the_rerun_s_green_lands(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    code, fake = run_land(
        tmp_path,
        monkeypatch,
        {FLAKY_ID},
        views=[red(OLD)],
        after_rerun=[red(OLD), green(NEW)],
        logs={FAILED_JOB: failed_log(FLAKY_LINE)},
    )
    assert code == 0, "the old red served right after the rerun was taken for the rerun's result"
    assert reruns(fake) == [["run", "rerun", FAILED_RUN, "--failed"]]
    assert len(fake.called("pr", "merge")) == 1


def test_red_again_after_the_one_rerun_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    code, fake = run_land(
        tmp_path,
        monkeypatch,
        {FLAKY_ID},
        views=[red(OLD)],
        after_rerun=[red(OLD), red(NEW)],
        logs={FAILED_JOB: failed_log(FLAKY_LINE)},
    )
    out = capsys.readouterr()
    assert code == 3
    assert [line for line in out.out.splitlines() if line.startswith("land:")][-1].startswith(
        f"land: refused: PR {PR}"
    )
    assert "Traceback" not in out.err
    assert len(reruns(fake)) == 1
    assert not fake.called("pr", "merge")


@pytest.mark.parametrize(
    "log",
    [
        failed_log("FAILED vextrus/y/tests/test_b.py::test_real - assert 0"),
        failed_log(),
    ],
    ids=["not-listed", "no-test-line"],
)
def test_a_failure_not_made_of_listed_flakes_is_never_rerun(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, log: str
) -> None:
    code, fake = run_land(
        tmp_path,
        monkeypatch,
        {FLAKY_ID},
        views=[red(OLD)],
        after_rerun=[green(NEW)],
        logs={FAILED_JOB: log},
    )
    assert code == 3
    assert reruns(fake) == []
    assert not fake.called("pr", "merge")
