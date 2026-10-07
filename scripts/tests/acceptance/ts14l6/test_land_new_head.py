"""S14-L6 (issue #398): after update-branch makes a new head, landing waits for the `ci` check of that
new head to exist and succeed before `merge_ready` and the merge; a rollup with the other checks done
but no `ci` check yet is pending, never green; a new head whose `ci` check never comes is refused within
the poll bound, never merged on the old head's green.

Seams (existing): `scripts.land.land(pr, gh, *, ledger_dir, flaky, ready, repo)` and
`scripts.land.Gh(repo, *, sleep, polls)`. GitHub is the fake gh 2.45 of `_fake.py` on PATH.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from scripts import land
from scripts.tests.acceptance.ts14l6._fake import (
    CI_JOB,
    Fake,
    World,
    install,
    passed,
    with_ci,
    without_ci,
)

PR = 12
NO_TEST_LOG = "ci\tdecide\t2026-10-05T03:09:45.1234567Z ##[error]Process completed with exit code 1.\n"


@dataclass
class Landing:
    code: int
    out: str
    err: str
    fake: Fake
    old: str
    new: str
    readied: list[int]


def landing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
    *,
    new_rollups: list[list[dict[str, Any]]],
    polls: int = 8,
) -> Landing:
    """Land PR 12, reviewed (a ledger PASS for its head) and one merge behind main, so the lander's
    update makes a new head; the old head's own CI was all green, `ci` included."""
    world = World(tmp_path)
    old = world.pr(PR, ["scripts/feature.py"])
    world.main_moves_on()
    new = world.merged(PR)
    passed(world.ledger(), PR, old)
    fake = install(
        tmp_path,
        monkeypatch,
        {
            PR: {
                "head": old,
                "files": ["scripts/feature.py"],
                "update": {"head": new, "update_ref": [str(world.origin), f"refs/pull/{PR}/head"]},
                "rollups": {old: [with_ci()], new: new_rollups},
                "logs": {CI_JOB: NO_TEST_LOG},
            }
        },
    )
    monkeypatch.chdir(world.work)
    readied: list[int] = []

    def ready(pr: int) -> int:
        readied.append(fake.served(PR, new))
        return 0

    capfd.readouterr()
    code = land.land(
        PR,
        land.Gh(world.work, sleep=lambda _: None, polls=polls),
        ledger_dir=world.ledger(),
        flaky=set(),
        ready=ready,
        repo=world.work,
    )
    out, err = capfd.readouterr()
    return Landing(code, out, err, fake, old, new, readied)


Fixtures = tuple[Path, pytest.MonkeyPatch, pytest.CaptureFixture[str]]


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]) -> Fixtures:
    return tmp_path, monkeypatch, capfd


def test_a_new_head_with_its_other_checks_green_but_no_ci_check_yet_is_not_merged(
    env: Fixtures,
) -> None:
    """The 5 Oct refusals of #391 and #393: the new head's rollup had no `ci` yet; then `ci` fails."""
    done = landing(*env, new_rollups=[without_ci(), with_ci(conclusion="FAILURE")])
    assert done.code == 3, done.out + done.err
    assert "Traceback" not in done.err
    assert done.fake.merged() == []
    assert done.readied == [], "merge_ready ran before the new head's ci check existed"


def test_landing_merges_the_new_head_only_after_its_ci_check_succeeded(env: Fixtures) -> None:
    rollups = [[], without_ci(), with_ci(status="IN_PROGRESS", conclusion=""), with_ci()]
    done = landing(*env, new_rollups=rollups)
    assert done.code == 0, done.out + done.err
    assert [merge["sha"] for merge in done.fake.merged()] == [done.new]
    assert done.fake.merged()[0]["served"] >= 4, "merged before the new head's ci check succeeded"
    assert done.readied, "merge_ready did not run"
    assert done.readied[0] >= 4, "merge_ready ran before the new head's ci check succeeded"


def test_a_new_head_whose_ci_check_never_comes_is_refused_not_merged_on_the_old_head_s_green(
    env: Fixtures,
) -> None:
    done = landing(*env, new_rollups=[without_ci()], polls=5)
    assert done.code == 3, done.out + done.err
    assert "Traceback" not in done.err
    assert done.fake.merged() == []
    assert done.readied == []
    lines = [line for line in done.out.splitlines() if line.startswith("land:")]
    assert len(lines) == 1, done.out
    assert lines[0].startswith(f"land: refused: PR {PR}"), done.out
