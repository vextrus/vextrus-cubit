"""S14-R2, PR #502 fix round 2 (0b4cdbb), found by review.py itself: two false-alarm races between
concurrent runs in the ledger check."""

import os
import signal
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import review
from scripts.tests.acceptance.ts14r2._world import SMALL, World

STOPS = (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)
OTHER = f"13-{'1' * 40}.json"


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


def test_a_record_another_run_writes_between_the_mark_and_the_snapshot_is_not_flagged(
    inside: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: the snapshot was taken before the journal's mark, so a record another run wrote (and
    journaled) between the two was in neither, and was flagged and moved aside."""
    inside.pr(12, SMALL)
    inside.ledger.mkdir(parents=True, exist_ok=True)
    steps: list[str] = []
    real_mark, real_snapshot = review.journal_mark, review.ledger_snapshot

    def between(result: Any, step: str) -> Any:
        steps.append(step)
        if len(steps) == 1:  # right after the first of the two steps: another run records
            (inside.ledger / OTHER).write_text('{"verdict": "PASS"}')
            with ledger.journal_path(inside.ledger).open("a") as journal:
                journal.write(f"{OTHER}\n")
        return result

    monkeypatch.setattr(review, "journal_mark", lambda d: between(real_mark(d), "mark"))
    monkeypatch.setattr(review, "ledger_snapshot", lambda d: between(real_snapshot(d), "snapshot"))
    assert review.main(["run", "12", "--round", "1"]) == 0
    assert (inside.ledger / OTHER).is_file(), "the other run's record was moved aside"


def test_the_ledgers_temporary_file_at_the_end_check_is_neither_flagged_nor_moved(
    tmp_path: Path,
) -> None:
    ledger_dir = tmp_path / "ledger"
    ledger_dir.mkdir()
    before = review.ledger_snapshot(ledger_dir)
    temporary = ledger_dir / ".record-k2x9a1.tmp"  # write_once's name before its link
    temporary.write_text("{}")
    review.check_ledger(ledger_dir, before, review.Run(pr=12, round_=1, head="a" * 40))
    assert temporary.is_file()


def test_a_file_removed_mid_snapshot_raises_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    ledger_dir = tmp_path / "ledger"
    ledger_dir.mkdir()
    (ledger_dir / OTHER).write_text("{}")
    (ledger_dir / f"14-{'2' * 40}.json").write_text("{}")
    real = Path.read_bytes

    def vanished(path: Path) -> bytes:
        if path.name == OTHER:  # listed, then removed before it was read
            path.unlink()
            raise FileNotFoundError(path)
        return real(path)

    monkeypatch.setattr(Path, "read_bytes", vanished)
    assert list(review.ledger_snapshot(ledger_dir)) == [f"14-{'2' * 40}.json"]
