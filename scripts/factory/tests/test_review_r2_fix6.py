"""S14-R2, PR #501 fix round 1 (2723c0f): a kept lens answer the PR's code rewrites during a replay is
never reused, even when the PR's code also makes the run exit early; and one run of a PR, head and
round at a time, local or cloud."""

import json
import os
import signal
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import review, review_cloud
from scripts.factory.tests.test_review_r2_fix1 import PR, Cloud
from scripts.tests.acceptance.ts14r2._world import (
    HANG,
    PASSING,
    SMALL,
    World,
    git,
    item,
    review_reply,
    wait_for_fifo,
    why,
)

STOPS = (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)
REPRO = "review_attacks/lens-b/test_count_passes.py"
FINDING = item(70, 2, "the badge count leaves out a deleted Element", REPRO)


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[World]:
    """The acceptance world, entered in this process: review.main runs here, so a replay can be
    replaced by the PR's attack."""
    (tmp_path / "world").mkdir()
    made = World(tmp_path / "world")
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
        made.kill_hung()


def sonnet_calls(world: World) -> int:
    return len([call for call in world.lens_calls() if call["kind"] == "sonnet"])


# ---------------------------------------------------------------- 1. a rewritten answer is never reused


def test_a_kept_answer_rewritten_during_a_replay_is_never_reused_after_an_early_exit(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: during a replay the PR's code rewrote lens B's kept answer (FIX 70) to a PASS and left
    an index.lock, so refuter_tree refused before check_kept ran, and the rerun reused the PASS."""
    head = world.pr(12, SMALL)
    world.lenses(review_reply("FIX", [FINDING]), write={REPRO: PASSING})
    base = git(world.main, "rev-parse", "origin/main")
    out = world.main / ".private" / "work" / "factory" / "review" / "out"
    forged = out / f"12-{head}-r1-lens-b.done.json"

    def attack(rv: Path, slot: int, test_file: str) -> bool:
        clean = {"verdict": "PASS", "head": head, "findings": [], "report": "fine"}
        forged.write_text(json.dumps({"head": head, "base": base, "agent": "pr-reviewer",
                                      "model": review.LENS_B.model, "review": clean,
                                      "attacks": {}}))  # fmt: skip
        gitdir = git(rv, "rev-parse", "--path-format=absolute", "--git-dir")
        Path(gitdir, "index.lock").write_text("")
        return False

    real_replay = review.replay
    monkeypatch.setattr(review, "replay", attack)
    assert review.main(["run", "12", "--round", "1"]) == 3
    assert world.record(12, head) is None
    assert not forged.exists(), "the rewritten answer was left for a rerun"
    monkeypatch.setattr(review, "replay", real_replay)  # the next run's replay is the real one
    assert review.main(["run", "12", "--round", "1"]) == 0
    assert sonnet_calls(world) == 2, "lens B's rewritten answer was reused"
    record = world.record(12, head)
    assert record is not None
    assert record["verdict"] != "PASS"


# ---------------------------------------------------------------- 2. one run of a round at a time


def test_a_second_local_run_of_the_round_is_refused_and_the_first_records(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    started, release = world.root / "started.fifo", world.root / "release.fifo"
    os.mkfifo(started)
    os.mkfifo(release)
    (world.root / "hold-once").write_text("")
    reader = os.open(started, os.O_RDONLY | os.O_NONBLOCK)
    first = world.popen("12", "--round", "1")
    try:
        assert wait_for_fifo(reader, first), "the first run ended before its lens started"
        second = world.run("12", "--round", "1")
    finally:
        if first.poll() is None and (world.root / "hold-taken").exists():
            writer = os.open(release, os.O_WRONLY)
            os.write(writer, b"go\n")
            os.close(writer)
        os.close(reader)
    _, err = first.communicate(timeout=HANG)
    assert second.returncode == 3, why(second)
    assert "another run of this round is going" in second.stdout + second.stderr, why(second)
    assert first.returncode == 0, err[-1500:]
    assert len(world.lens_calls()) == 1, "the second run started a lens"
    record = world.record(12, head)
    assert record is not None
    assert record["round"] == 1


def test_a_second_cloud_run_of_the_round_is_refused_and_the_first_hand_off_is_intact(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    cloud = Cloud(tmp_path)
    monkeypatch.setattr(review, "resolve", lambda pr: cloud.head)
    monkeypatch.setattr(review, "merged_head", lambda main, pr, head: (head, head))
    monkeypatch.setattr(review, "changes", lambda *_: ([("vextrus/rates/table.py", 400, 0)], []))
    monkeypatch.setattr(review, "merge_bases", lambda *_: 1)
    monkeypatch.setattr(review, "tier", lambda *_, **__: "normal")
    args = review.parse(["run", str(PR), "--round", "1", "--where", "cloud"])
    second: list[str] = []
    launched: list[str] = []

    def launch_one(argv: list[str], *, push: Any, launch: Any, records_dir: Path) -> int:
        if not second:  # while the first run launches lens A, a second run of the round starts
            with pytest.raises(review.Refused) as refused:
                review.review(review.Run(pr=PR, round_=1), args, cloud.main)
            second.append(str(refused.value))
        nonce = f"{len(launched) + 1}" * 32
        review_file = records_dir / f"review-{PR}-{nonce[:8]}.json"
        review_file.write_text(json.dumps({"pr": PR, "head_sha": cloud.head, "nonce": nonce}))
        launched.append(nonce)
        branch = f"review/{PR}-{nonce[:8]}"
        return int(launch(["true", "--branch", branch, "--review-file", str(review_file)], ""))

    monkeypatch.setattr(review_cloud, "run", launch_one)
    review.review(review.Run(pr=PR, round_=1), args, cloud.main)
    assert second, "no second run was started"
    assert "another run of this round is going" in second[0]
    assert len(launched) == 2, "the second run launched a duplicate session"
    manifest = json.loads(review.handoff_path(cloud.records, PR, cloud.head, 1).read_text())
    assert [(e["label"], e["state"], len(e["launches"])) for e in manifest["lenses"]] == [
        ("lens-a", "launched", 1),
        ("lens-b", "launched", 1),
    ]
