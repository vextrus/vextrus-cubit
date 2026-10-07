"""S14-L6 (issue #398): after update-branch makes a new head, landing waits for the `ci` check of that
new head to exist and succeed before `merge_ready` and the merge; a rollup with the other checks done
but no `ci` check yet is pending, never green; a new head whose `ci` check never comes is refused within
the poll bound, never merged on the old head's green.

S17-F7 (the owner's ruling, 7 Oct 2026): the lander no longer updates a branch; `land update <PR>` is
the one path that moves the head. So each world here runs `land update 12` (which waits for the new
head's `ci` check to exist), then lands; the new head's checks are served in order across both.

Seams (existing): `scripts.land.land(pr, gh, *, ledger_dir, flaky, ready, repo)`,
`scripts.land.Gh(repo, *, sleep, polls)` and `scripts.land.main(["update", "<PR>"])`. GitHub is the
fake gh 2.45 of `_fake.py` on PATH.
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
    updated: int
    update_out: str


def landing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
    *,
    new_rollups: list[list[dict[str, Any]]],
    polls: int = 8,
) -> Landing:
    """`land update 12`, then land PR 12, reviewed (a ledger PASS for its head) and one merge behind
    main, so the update makes a new head; the old head's own CI was all green, `ci` included."""
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

    class Fast(land.Gh):
        def __init__(self, *args: Any, **options: Any) -> None:
            options["sleep"] = lambda _: None
            options["polls"] = polls
            super().__init__(*args, **options)

    capfd.readouterr()
    with monkeypatch.context() as patch:
        patch.setattr(land, "Gh", Fast)
        updated = land.main(["update", str(PR)])
    update_out = capfd.readouterr().out
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
    return Landing(code, out, err, fake, old, new, readied, updated, update_out)


Fixtures = tuple[Path, pytest.MonkeyPatch, pytest.CaptureFixture[str]]


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]) -> Fixtures:
    return tmp_path, monkeypatch, capfd


def test_a_new_head_with_its_other_checks_green_but_no_ci_check_yet_is_not_merged(
    env: Fixtures,
) -> None:
    """The 5 Oct refusals of #391 and #393: the new head's rollup had no `ci` yet; then `ci` fails."""
    done = landing(*env, new_rollups=[without_ci(), with_ci(conclusion="FAILURE")])
    assert done.updated == 0, done.update_out
    assert done.fake.pr(PR)["head"] == done.new, "`land update` did not move the head"
    assert done.code == 3, done.out + done.err
    assert "Traceback" not in done.err
    assert done.fake.merged() == []
    assert done.readied == [], "merge_ready ran before the new head's ci check existed"


def test_landing_merges_the_new_head_only_after_its_ci_check_succeeded(env: Fixtures) -> None:
    rollups = [[], without_ci(), with_ci(status="IN_PROGRESS", conclusion=""), with_ci()]
    done = landing(*env, new_rollups=rollups)
    assert done.updated == 0, done.update_out
    assert done.code == 0, done.out + done.err
    assert len(done.fake.updates()) == 1, "landing asked GitHub to bring main in again"
    assert [merge["sha"] for merge in done.fake.merged()] == [done.new]
    assert done.fake.merged()[0]["served"] >= 4, "merged before the new head's ci check succeeded"
    assert done.readied, "merge_ready did not run"
    assert done.readied[0] >= 4, "merge_ready ran before the new head's ci check succeeded"


def test_a_new_head_whose_ci_check_never_comes_is_refused_not_merged_on_the_old_head_s_green(
    env: Fixtures,
) -> None:
    done = landing(*env, new_rollups=[without_ci()], polls=5)
    assert done.updated == 3, "`land update` reported a head with no `ci` check: " + done.update_out
    assert done.code == 3, done.out + done.err
    assert "Traceback" not in done.err
    assert done.fake.merged() == []
    assert done.readied == []
    lines = [line for line in done.out.splitlines() if line.startswith("land:")]
    assert len(lines) == 1, done.out
    assert lines[0].startswith(f"land: refused: PR {PR}"), done.out
