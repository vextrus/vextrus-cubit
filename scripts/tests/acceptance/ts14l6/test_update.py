"""S14-L6 (issue #456): `python -m scripts.land update <PR>` brings main into the PR's branch in one
REST call carrying the expected head, prints the new 40-hex head, waits for the new head's `ci` check,
and refuses a stale head, naming the sha it expected.

Seams (assumed): `scripts.land.main(["update", "<PR>"]) -> int` is the command; `main` builds its client
as `scripts.land.Gh(...)`, whose `sleep=` keyword the tests inject (no wall-clock waits). GitHub is the
fake gh 2.45 of `_fake.py` on PATH; git is a real throwaway clone with an `origin`.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from scripts import land
from scripts.tests.acceptance.ts14l6._fake import (
    Fake,
    World,
    install,
    update_request,
    with_ci,
    without_ci,
)

PR = 12
RACED = "c" * 40


@dataclass
class Run:
    code: int
    out: str
    err: str
    fake: Fake
    old: str
    new: str
    sleeps: list[float]


def update(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
    *,
    rollups: list[list[dict[str, Any]]] | None = None,
    **pr: Any,
) -> Run:
    """`python -m scripts.land update 12` from a clone on main, PR 12 one merge behind main."""
    world = World(tmp_path)
    old = world.pr(PR, ["scripts/feature.py"])
    world.main_moves_on()
    new = world.merged(PR)
    fake = install(
        tmp_path,
        monkeypatch,
        {
            PR: {
                "head": old,
                "files": ["scripts/feature.py"],
                "update": {"head": new, "update_ref": [str(world.origin), f"refs/pull/{PR}/head"]},
                "rollups": {new: rollups or [with_ci()]},
            }
            | pr
        },
    )
    monkeypatch.chdir(world.work)
    sleeps: list[float] = []

    class Fast(land.Gh):
        def __init__(self, *args: Any, **options: Any) -> None:
            options["sleep"] = sleeps.append
            super().__init__(*args, **options)

    monkeypatch.setattr(land, "Gh", Fast)
    capfd.readouterr()
    code: int = land.main(["update", str(PR)])
    out, err = capfd.readouterr()
    return Run(code, out, err, fake, old, new, sleeps)


Fixtures = tuple[Path, pytest.MonkeyPatch, pytest.CaptureFixture[str]]


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]) -> Fixtures:
    return tmp_path, monkeypatch, capfd


def test_update_brings_main_in_with_one_request_carrying_the_expected_head(env: Fixtures) -> None:
    done = update(*env)
    assert done.code == 0, done.out + done.err
    assert [update_request(argv, PR, done.old) for argv in done.fake.updates()] == [True], (
        done.fake.updates()
    )
    assert done.fake.pr(PR)["head"] == done.new, "main was brought into the PR's branch"


def test_update_prints_the_new_40_hex_head(env: Fixtures) -> None:
    done = update(*env)
    assert done.code == 0, done.out + done.err
    assert done.new in done.out


def test_update_merges_nothing(env: Fixtures) -> None:
    done = update(*env)
    assert done.code == 0, done.out + done.err
    assert done.fake.merged() == []
    assert not done.fake.called("pr", "merge")
    assert not done.fake.called("run", "rerun")


def test_update_waits_for_the_new_head_s_ci_check(env: Fixtures) -> None:
    """#398: right after update-branch the new head has no checks, then checks without `ci`; a head
    with no `ci` check yet is pending, never done."""
    done = update(*env, rollups=[[], without_ci(), with_ci()])
    assert done.code == 0, done.out + done.err
    assert done.new in done.out
    assert done.fake.served(PR, done.new) >= 3, "it returned before the new head's ci check existed"


def test_a_stale_head_is_refused_naming_the_expected_sha(env: Fixtures) -> None:
    """A push lands on the PR's branch as the update is asked for: GitHub refuses the expected head."""
    done = update(*env, race_head=RACED)
    assert done.code != 0
    assert "Traceback" not in done.err
    assert done.old[:12] in done.out + done.err, "the refusal names the head it expected"
    assert [update_request(argv, PR, done.old) for argv in done.fake.updates()] == [True], (
        "one request, never retried on a head nobody expected"
    )
    assert done.fake.pr(PR)["head"] == RACED
    assert done.fake.merged() == []
