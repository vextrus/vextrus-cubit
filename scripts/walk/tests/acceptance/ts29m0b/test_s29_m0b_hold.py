"""Ticket S29-M0b, part 3: G1's script layer holds the served stack until the agent layer's verdict.

G1 walk #1 of 9101c005: `scripts/walk/run.py` wrote walk.json at +46 minutes and then held the stack for
its `--hold-minutes 90`; `/real-set-walk`'s agent layer ran 96 minutes, so the stack stopped under it.

Promises pinned:

1. **`--hold-minutes` defaults to 150**: the cap stays, as a safety, above an agent layer's 96 minutes.
2. **The hold ends when the walked head's verdict.json is written** in the walk's folder
   (`.private/work/walks/<sha40>/`, where `scripts/walk/verdict.py` writes it last), not before, and
   without one at the cap (guards: green on main, kept green).

No test sleeps: the hold runs on a fake clock put in place of `run`'s `time` module, whose `sleep`
moves the clock on.

    uv run pytest -rf scripts/walk/tests/acceptance/ts29m0b
"""

import subprocess
import time as real_time
from pathlib import Path
from typing import Any

import pytest

from scripts.walk import run

SHA = "0123456789abcdef0123456789abcdef01234567"
MINUTE = 60.0
GIVE_UP = 1000 * MINUTE
"""The fake clock refuses to run past this: a hold that never ends fails, never hangs."""


class FakeClock:
    """`run`'s `time`: monotonic and wall time move only when the hold sleeps; at `verdict_at` seconds
    the agent layer writes verdict.json into `out_dir`."""

    def __init__(self, out_dir: Path, verdict_at: float | None) -> None:
        self.now = 0.0
        self.base = real_time.time()
        self.out_dir = out_dir
        self.verdict_at = verdict_at

    def monotonic(self) -> float:
        return self.now

    def time(self) -> float:
        return self.base + self.now

    def sleep(self, seconds: float) -> None:
        assert seconds >= 0
        self.now += seconds
        if self.now > GIVE_UP:
            raise AssertionError("the hold never ended")
        if self.verdict_at is not None and self.now >= self.verdict_at:
            (self.out_dir / "verdict.json").write_text("{}")

    def __getattr__(self, name: str) -> Any:
        return getattr(real_time, name)


def _repo(root: Path) -> str:
    """A git repository of one empty commit at `root` (the walk takes a commit of its root); its sha."""

    def git(*args: str) -> str:
        return subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "-c",
                "user.name=walk",
                "-c",
                "user.email=walk@example.invalid",
                *args,
            ],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()

    root.mkdir(parents=True, exist_ok=True)
    git("init", "-q")
    git("commit", "-q", "--allow-empty", "-m", "synthetic")
    return git("rev-parse", "HEAD")


def _plan(out_dir: Path) -> run.Plan:
    return run.Plan(
        sha=SHA,
        sha8=SHA[:8],
        db_name=f"vextrus_walk_{SHA[:8]}",
        out_dir=out_dir,
        worktree=out_dir.parent / "_src",
        web_port=5511,
        api_port=8811,
    )


def _hold(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, minutes: float, verdict_at: float | None
) -> FakeClock:
    out_dir = tmp_path / "walks" / SHA
    out_dir.mkdir(parents=True)
    clock = FakeClock(out_dir, verdict_at)
    monkeypatch.setattr(run, "time", clock)
    since = real_time.time() - 10
    run.hold(_plan(out_dir), run.Stack(), minutes, [], since)
    return clock


def test_the_hold_minutes_default_to_150(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    root = tmp_path / "repo"
    head = _repo(root)
    given: dict[str, Any] = {}

    def fake_run(root: Path, walk: run.Plan, **kwargs: Any) -> int:
        given.update(kwargs)
        return 0

    monkeypatch.setattr(run, "run", fake_run)
    monkeypatch.setattr(run, "set_files", lambda root, slugs: {slug: [] for slug in slugs})
    code = run.main([head, "--root", str(root), "--web-port", "5511", "--api-port", "8811"])

    assert code == 0
    assert given.get("hold_minutes") == 150, (
        f"the hold's cap defaults to {given.get('hold_minutes')} minutes"
    )


def test_the_hold_lasts_until_the_verdict_is_written_after_96_minutes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = _hold(tmp_path, monkeypatch, 150, verdict_at=96 * MINUTE)

    assert clock.now >= 96 * MINUTE, "the hold ended before the verdict was written"
    assert clock.now < 150 * MINUTE, "the hold did not end when the verdict was written"


def test_with_no_verdict_the_hold_ends_at_its_cap(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = _hold(tmp_path, monkeypatch, 150, verdict_at=None)

    assert clock.now >= 150 * MINUTE, "the hold ended before its cap with no verdict"
    assert clock.now < 151 * MINUTE, "the hold ran on past its cap"


def test_the_hold_waits_for_the_folder_the_verdict_is_written_to(tmp_path: Path) -> None:
    """verdict.py writes `<walks-dir>/<sha40>/verdict.json` (its default `.private/work/walks`); the
    walk's own folder is that one, so the hold sees the verdict the agent layer writes."""
    root = tmp_path / "repo"
    head = _repo(root)
    walk = run.plan(head, root=root, web_port=5511, api_port=8811)

    assert walk.out_dir == root / ".private" / "work" / "walks" / head
