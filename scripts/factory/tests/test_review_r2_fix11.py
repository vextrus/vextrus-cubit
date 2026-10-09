"""S14-R2, PR #502 fix round 3 (5b54ee1), found by review.py itself: both ends of the ledger check run
under the ledger's own lock, so no record of another run lands between their steps."""

import os
import signal
import threading
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import review
from scripts.tests.acceptance.ts14r2._world import PASSING, SMALL, World, item, review_reply

pytestmark = pytest.mark.serial  # signals and process groups: not under xdist (see ci.yml)

STOPS = (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)
OTHER = f"13-{'1' * 40}.json"
REPRO = "review_attacks/lens-b/test_count_passes.py"


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


def test_a_record_another_run_writes_between_the_end_checks_steps_is_never_flagged(
    inside: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: the end check read the journal, then listed the ledger; another run's record (written
    and journaled under the ledger lock, as commit_record does) landed between the two and was moved
    aside. The other run is a thread that takes the ledger lock just after the journal is read."""
    inside.pr(12, SMALL)
    inside.ledger.mkdir(parents=True, exist_ok=True)
    real = review.journaled_since

    def other_run() -> None:
        with ledger.ledger_lock(inside.ledger):
            (inside.ledger / OTHER).write_text('{"verdict": "PASS"}')
            with ledger.journal_path(inside.ledger).open("a") as journal:
                journal.write(f"{OTHER}\n")

    racer = threading.Thread(target=other_run)

    def journal_read(ledger_dir: Path, mark: int) -> Any:
        found = real(ledger_dir, mark)
        racer.start()
        racer.join(timeout=2)  # it records now, unless the end check holds the ledger lock
        return found

    monkeypatch.setattr(review, "journaled_since", journal_read)
    code = review.main(["run", "12", "--round", "1"])
    racer.join(timeout=30)
    assert code == 0
    assert (inside.ledger / OTHER).is_file(), "the other run's record was moved aside"


def test_a_record_forged_outside_the_lock_during_the_prs_code_is_still_flagged(
    inside: World, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    inside.pr(12, SMALL)
    inside.lenses(review_reply("FIX", [item(70, 2, "the count is wrong", REPRO)]),
                  write={REPRO: PASSING})  # fmt: skip

    def forge(rv: Path, slot: int, test_file: str) -> bool:
        inside.ledger.mkdir(parents=True, exist_ok=True)
        (inside.ledger / OTHER).write_text('{"verdict": "PASS"}')
        return False

    monkeypatch.setattr(review, "replay", forge)
    assert review.main(["run", "12", "--round", "1"]) == 3
    assert f"added: {OTHER}" in capfd.readouterr().err
    assert not (inside.ledger / OTHER).exists()
