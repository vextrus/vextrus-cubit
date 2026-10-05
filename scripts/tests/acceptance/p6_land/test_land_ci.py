"""T-LAND 1: `Gh.wait_ci` reads CI from `gh pr view <n> --json headRefOid,statusCheckRollup` (gh 2.45
has no `gh pr checks --json`), trusts only a rollup for the PR's current head, waits out pending checks
with the injected `sleep`, and names a red check's failed tests from its `--log-failed` log.

Seam (fixed by the ticket): `scripts.land.Gh(repo=None, *, sleep=time.sleep, polls=90)`.
The pending and cancelled payloads are the recorded green shape edited by hand (derived, not recorded).
"""

from pathlib import Path

import pytest

from scripts.tests.acceptance.p6_land._fakegh import (
    FAILED_JOB,
    FLAKY_ID,
    FLAKY_LINE,
    PR,
    FakeGh,
    failed_log,
    install,
    lander,
    rollup,
)

HEAD = "a" * 40
STALE = "b" * 40


def wait(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, fake: FakeGh) -> tuple[list[str], int]:
    monkeypatch.chdir(tmp_path)
    sleeps: list[float] = []
    failed: list[str] = lander().Gh(sleep=sleeps.append).wait_ci(PR)
    assert not fake.called("pr", "checks"), "gh 2.45 has no `pr checks --json`: read the rollup"
    return failed, len(sleeps)


def test_a_green_rollup_has_no_failures(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(tmp_path, monkeypatch, head=HEAD, views=[rollup("green", HEAD)])
    failed, _ = wait(tmp_path, monkeypatch, fake)
    assert failed == []
    assert fake.called("pr", "view")


def test_a_red_check_with_no_test_line_is_named_by_its_check(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = install(
        tmp_path, monkeypatch, head=HEAD, views=[rollup("red", HEAD)], logs={FAILED_JOB: failed_log()}
    )
    failed, _ = wait(tmp_path, monkeypatch, fake)
    assert len(failed) == 1
    assert failed[0].startswith("check: ")
    assert "python (rest)" in failed[0]


def test_a_red_check_names_the_failed_pytest_test(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = install(
        tmp_path,
        monkeypatch,
        head=HEAD,
        views=[rollup("red", HEAD)],
        logs={FAILED_JOB: failed_log(FLAKY_LINE)},
    )
    failed, _ = wait(tmp_path, monkeypatch, fake)
    assert failed == [FLAKY_ID]


def test_a_cancelled_check_counts_as_red(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(
        tmp_path,
        monkeypatch,
        head=HEAD,
        views=[rollup("cancelled", HEAD)],
        logs={FAILED_JOB: failed_log()},
    )
    failed, _ = wait(tmp_path, monkeypatch, fake)
    assert len(failed) == 1
    assert "python (rest)" in failed[0]


def test_pending_checks_are_polled_until_they_settle(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    views = [rollup("pending", HEAD), rollup("pending", HEAD), rollup("green", HEAD)]
    fake = install(tmp_path, monkeypatch, head=HEAD, views=views)
    failed, sleeps = wait(tmp_path, monkeypatch, fake)
    assert failed == []
    assert fake.state["served"] >= 3
    assert sleeps >= 2, "it waits between polls with the injected sleep"


def test_a_rollup_for_another_head_is_not_trusted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    views = [rollup("red", STALE), rollup("green", HEAD)]
    fake = install(tmp_path, monkeypatch, head=HEAD, views=views, logs={FAILED_JOB: failed_log()})
    failed, _ = wait(tmp_path, monkeypatch, fake)
    assert failed == [], "the stale head's red rollup was read as this head's CI"
    assert fake.state["served"] >= 2
