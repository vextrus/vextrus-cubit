"""S14-R1: the slot (factory-next.md 8 row 4; research/review.md 3 steps 1-2; issues #420, #452): two
concurrent runs claim different slots under a lock, and each lens runs in the runnable worktree
`.claude/worktrees/rv<N>` with `VEXTRUS_DB_NAME=vextrus_rv_slot<N>`, beside the read-only
`.private/work/factory/review/slot<N>` holding the same merged head, never in the slot itself.

The concurrency is made deterministic with two named pipes, not with time: the first run's lens is held
inside the fake `claude` until the second run has finished."""

import os
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14r1._world import HANG, SMALL, World, wait_for_fifo, why

OTHER = {"web/src/components/chip.tsx": "export const Chip = () => null\nexport const k = 3\n"}


def test_two_concurrent_runs_claim_different_slots(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, SMALL)
    world.pr(13, OTHER)
    started, release = world.root / "started.fifo", world.root / "release.fifo"
    os.mkfifo(started)
    os.mkfifo(release)
    (world.root / "hold-once").write_text("")
    reader = os.open(started, os.O_RDONLY | os.O_NONBLOCK)
    first = world.popen("12", "--round", "1")
    try:
        held = wait_for_fifo(reader, first)
        if not held:
            _, err = first.communicate(timeout=HANG)
            raise AssertionError(
                f"the first run ended before its lens started: exit {first.returncode}; {err[-1500:]!r}"
            )
        second = world.run("13", "--round", "1")
    finally:
        if first.poll() is None and (world.root / "hold-taken").exists():
            writer = os.open(release, os.O_WRONLY)
            os.write(writer, b"go\n")
            os.close(writer)
        os.close(reader)
    _, err = first.communicate(timeout=HANG)
    assert second.returncode == 0, why(second)
    assert first.returncode == 0, f"exit {first.returncode}; {err[-1500:]!r}"
    slots: dict[str, set[int]] = {}
    for call in world.lens_calls():
        assert call["slot"] is not None, f"a lens ran outside a runnable worktree rv<N>: {call['cwd']}"
        slots.setdefault(call["pr"], set()).add(call["slot"]["n"])
    assert set(slots) == {"12", "13"}, slots
    assert not slots["12"] & slots["13"], f"both runs used slot {slots['12'] & slots['13']}"


def test_each_lens_runs_in_its_runnable_worktree_beside_the_read_only_slot(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    calls = world.lens_calls()
    assert calls, "no lens was started"
    for call in calls:
        cwd = Path(call["cwd"])
        assert call["slot"] is not None, f"the lens ran outside .claude/worktrees/rv<N>: {cwd}"
        n = call["slot"]["n"]
        assert cwd.resolve() == (world.main / ".claude" / "worktrees" / f"rv{n}").resolve()
        assert ".private/work/factory/review" not in str(cwd), (
            "a lens ran in the read-only review folder"
        )
        assert call["db"] == f"vextrus_rv_slot{n}"
        assert call["slot"]["head"] is not None, f"slot{n} was not made beside rv{n}"
        assert call["slot"]["head"] == call["head"], (
            "the slot and the runnable worktree hold different heads"
        )
        assert call["head"] == head, "the lens did not review the PR's head (main had not moved)"
