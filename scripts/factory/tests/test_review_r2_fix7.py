"""S14-R2, PR #501 fix round 2 (97e498d): the owner's ruling (6 Oct 2026, 06:30Z), "narrow: drop answer
reuse". Every run starts every lens fresh; a lens answer left on disk (by an earlier run, or by another
PR's code) is never read, and a run that stops before its lenses start raises no tamper alarm and
deletes nothing."""

import json
import os
import signal
from collections.abc import Iterator
from pathlib import Path

import pytest

from scripts.factory import review
from scripts.tests.acceptance.ts14r2._world import SMALL, World, git, item, review_reply, why

STOPS = (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)
FIX = item(30, 2, "the badge could carry a tooltip", None)
OTHER = {"web/src/components/other.tsx": "export const Other = () => null\n"}


def out_dir(world: World) -> Path:
    path = world.main / ".private" / "work" / "factory" / "review" / "out"
    path.mkdir(parents=True, exist_ok=True)
    return path


def planted_pass(world: World, head: str) -> str:
    """A PASS answer for lens B in the shape the head before the ruling kept one."""
    clean = review_reply("PASS", [], head=head)
    return json.dumps({"head": head, "base": git(world.main, "rev-parse", "main"),
                       "agent": "pr-reviewer", "model": review.LENS_B.model, "review": clean,
                       "attacks": {}})  # fmt: skip


def sonnet_calls(world: World, pr: str) -> int:
    return len([c for c in world.lens_calls() if c["kind"] == "sonnet" and c["pr"] == pr])


def test_a_pass_answer_left_for_this_pr_head_and_round_is_ignored_and_the_lens_starts(
    tmp_path: Path,
) -> None:
    world = World(tmp_path)
    head = world.pr(12, SMALL)
    planted = out_dir(world) / f"12-{head}-r1-lens-b.done.json"
    planted.write_text(planted_pass(world, head))
    world.lenses(review_reply("FIX", [FIX]))
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert sonnet_calls(world, "12") == 1, "the planted answer stood in for lens B"
    record = world.record(12, head)
    assert record is not None
    assert record["verdict"] == "FIX"


def test_an_answer_for_pr_13_written_during_pr_12_s_run_is_never_read_by_pr_13_s_run(
    tmp_path: Path,
) -> None:
    """PR 12's code (here, its lens's attack files) writes a PASS for PR 13 where an answer was
    kept; PR 13's run starts its own lens and records its own FIX."""
    world = World(tmp_path)
    world.pr(12, SMALL)
    head13 = world.pr(13, OTHER)
    out_dir(world)
    forged = f"../../../.private/work/factory/review/out/13-{head13}-r1-lens-b.done.json"
    world.lenses(review_reply("PASS", []), write={forged: planted_pass(world, head13)})
    assert world.run("12", "--round", "1").returncode == 0
    assert (out_dir(world) / f"13-{head13}-r1-lens-b.done.json").is_file(), "the forgery is not set up"
    world.lenses(review_reply("FIX", [FIX]))
    done = world.run("13", "--round", "1")
    assert done.returncode == 0, why(done)
    assert sonnet_calls(world, "13") == 1, "PR 12's forged answer stood in for PR 13's lens B"
    record = world.record(13, head13)
    assert record is not None
    assert record["verdict"] == "FIX"


@pytest.fixture
def inside(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[World]:
    """The acceptance world, entered in this process (review.main runs here)."""
    made = World(tmp_path)
    for key in [key for key in os.environ if key.startswith("GIT_")]:
        monkeypatch.delenv(key)
    for key in ("CLAUDE_CODE_REMOTE", "CLAUDE_PROJECT_DIR", "VEXTRUS_DB_NAME", "PYTEST_ADDOPTS"):
        monkeypatch.delenv(key, raising=False)
    for key, value in made.env().items():
        monkeypatch.setenv(key, value)
    monkeypatch.chdir(made.main)
    saved = {signum: signal.getsignal(signum) for signum in STOPS}
    try:
        yield made
    finally:
        for signum, handler in saved.items():
            signal.signal(signum, handler)


@pytest.mark.parametrize("ending", [review.Stopped(15), RuntimeError("the disk is full")],
                         ids=["a-stop", "an-error"])  # fmt: skip
def test_a_run_that_ends_before_its_lenses_start_raises_no_alarm_and_deletes_nothing(
    inside: World,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
    ending: BaseException,
) -> None:
    """Refuted: the tamper check ran on a stop or an error before the lenses started, called the
    files already there a forgery, and deleted them."""
    head = inside.pr(12, SMALL)
    there = out_dir(inside) / f"12-{head}-r1-lens-b.done.json"
    there.write_text(planted_pass(inside, head))

    def ends(*_: object) -> None:
        raise ending

    monkeypatch.setattr(review, "write_facts", ends)
    assert review.main(["run", "12", "--round", "1"]) != 0
    printed = capfd.readouterr()
    assert "changed while the PR's code ran" not in printed.out + printed.err
    assert there.read_text() == planted_pass(inside, head), "a file was deleted or changed"
    assert inside.lens_calls() == []
