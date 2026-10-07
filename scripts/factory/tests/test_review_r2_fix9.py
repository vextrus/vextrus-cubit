"""S14-R2, PR #502 fix round 1 (27b0275): the whole ledger folder is checked and changes are moved
aside; one run per PR head; a capped lens's spend reaches the cost line; every piece of advice runs
as printed."""

import json
import os
import re
import shlex
import signal
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import review
from scripts.factory.tests.test_review_r2_fix1 import PR, Cloud
from scripts.factory.tests.test_review_r2_fix5 import Launcher
from scripts.tests.acceptance.ts14r2._world import PASSING, SMALL, World, git, item, review_reply

pytestmark = pytest.mark.serial  # signals and process groups: not under xdist (see ci.yml)

STOPS = (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)
REPRO = "review_attacks/lens-b/test_count_passes.py"
COMMAND = re.compile(r"`(uv run python -m scripts\.factory\.review [^`]+)`")
R3 = ["--round", "3", "--exception", "fix-regression", "--reason", "the advice's round-3 flags"]


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


# ---------------------------------------------------------------- 1. the whole ledger folder


def test_any_ledger_file_added_or_changed_while_the_prs_code_ran_is_named_and_moved_aside(
    inside: World, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    """Refuted: the check looked only at ledger/<pr>-<head>.json; a PASS forged for another PR, or a
    changed record, stood."""
    inside.pr(12, SMALL)
    inside.seed_record(99, "9" * 40, 1)
    inside.lenses(review_reply("FIX", [item(70, 2, "the count is wrong", REPRO)]),
                  write={REPRO: PASSING})  # fmt: skip
    other = f"13-{'1' * 40}.json"

    def attack(rv: Path, slot: int, test_file: str) -> bool:
        (inside.ledger / other).write_text('{"verdict": "PASS"}')
        (inside.ledger / f"99-{'9' * 40}.json").write_text('{"verdict": "PASS"}')
        return False

    monkeypatch.setattr(review, "replay", attack)
    assert review.main(["run", "12", "--round", "1"]) == 3
    printed = capfd.readouterr().err
    assert f"added: {other}" in printed, printed[-1500:]
    assert f"changed: 99-{'9' * 40}.json" in printed
    assert not (inside.ledger / other).exists()
    assert not (inside.ledger / f"99-{'9' * 40}.json").exists()
    moved = sorted(path.name.split(".json")[0] for path in (inside.ledger / "quarantine").iterdir())
    assert moved == [f"13-{'1' * 40}", f"99-{'9' * 40}"]


# ---------------------------------------------------------------- 2. one run per PR head


def test_round_2_of_a_head_is_refused_while_round_1_of_it_runs(tmp_path: Path) -> None:
    first = review.Run(pr=PR, round_=1, head="a" * 40)
    second = review.Run(pr=PR, round_=2, head="a" * 40)
    with (
        review.round_lock(tmp_path, first),
        pytest.raises(review.Refused, match="another run"),
        review.round_lock(tmp_path, second),
    ):
        pass
    with review.round_lock(tmp_path, second):  # free again once round 1 ends
        pass


# ---------------------------------------------------------------- 3. a capped lens's spend is kept


CAPPED = {"type": "result", "subtype": "error_max_turns", "is_error": True, "total_cost_usd": 1.25,
          "num_turns": 200, "duration_ms": 61000, "usage": {"output_tokens": 9000}}  # fmt: skip


@pytest.fixture
def capped(monkeypatch: pytest.MonkeyPatch) -> None:
    def run_group(argv: Any, **_: Any) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(list(argv), 1, json.dumps(CAPPED), "")

    monkeypatch.setattr(review, "run_group", run_group)
    monkeypatch.setattr(review, "write_facts", lambda *_: (Path("d"), Path("l")))
    monkeypatch.setattr(review, "lens_command", lambda *_: ["claude"])


def test_a_lens_capped_in_turns_keeps_its_spend_and_is_named(tmp_path: Path, capped: None) -> None:
    run = review.Run(pr=PR, round_=1, head="a" * 40, merged="a" * 40, slot=1)
    with pytest.raises(review.Refused, match="lens-b failed \\(exit 1, error_max_turns\\)"):
        review.lenses_in(run, [review.LENS_B], tmp_path, tmp_path, tmp_path)
    (spent,) = run.lenses
    assert (spent["total_cost_usd"], spent["num_turns"], spent["subtype"]) == (
        1.25,
        200,
        "error_max_turns",
    )
    assert spent["usage"] == {"output_tokens": 9000}
    assert run.cost() == 1.25


def test_a_capped_refuter_keeps_its_spend(
    tmp_path: Path, capped: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(review, "refuter_tree", lambda run, rv: None)
    run = review.Run(pr=PR, round_=1, head="a" * 40, merged="a" * 40, slot=1)
    run.findings = [review.Finding("l1-f1", 60, "a.py", 1, "s", None, "UNPROVEN")]
    review.refute(run, tmp_path, tmp_path, tmp_path)
    (spent,) = run.lenses
    assert (spent["total_cost_usd"], spent["subtype"]) == (1.25, "error_max_turns")
    assert "error_max_turns" in spent["refused"]


# ---------------------------------------------------------------- 4. advice that runs as printed


def advised(text: str) -> Any:
    """The command `text` advises, parsed exactly as printed (its prefix is review.py's own)."""
    (command,) = COMMAND.findall(text)
    argv = shlex.split(command)
    assert argv[:5] == list(review.REVIEW_COMMAND), argv
    return review.parse(argv[5:])


def test_from_verdicts_advice_runs_as_printed(tmp_path: Path) -> None:
    with pytest.raises(review.Refused) as refused:
        review.from_verdict(PR, tmp_path)
    args = advised(str(refused.value))
    assert (args.command, args.pr, args.round) == ("run", PR, 1)
    ledger.check_round(tmp_path / "ledger", args.pr, args.round, args.exception)


def test_collects_no_hand_off_advice_runs_as_printed_in_round_3(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(review, "resolve", lambda pr: "a" * 40)
    with pytest.raises(review.Refused) as refused:
        review.collect(review.Run(pr=PR, round_=3), review.parse(["collect", str(PR), *R3]), tmp_path)
    args = advised(str(refused.value))
    assert (args.command, args.pr, args.round, args.where) == ("run", PR, 3, "cloud")
    ledger.check_round(tmp_path / "ledger", args.pr, args.round, args.exception)
    assert args.reason == R3[-1]


def test_fetch_verdicts_collect_advice_runs_as_printed_in_round_3(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    cloud = Cloud(tmp_path)
    launcher = Launcher(monkeypatch, cloud.head)
    run = review.Run(pr=PR, round_=3, head=cloud.head, tier="normal")
    run.exception, run.reason = "fix-regression", R3[-1]
    review.hand_off(run, [review.LENS_A, review.LENS_B], cloud.main, cloud.records)
    _, nonce = launcher.launched[0]
    record = tmp_path / "launch.json"
    branch = f"review/{PR}-{nonce[:8]}"
    record.write_text(json.dumps({"role": "reviewer", "review": {"pr": PR, "head_sha": cloud.head,
                                  "nonce": nonce, "branch": branch}}))  # fmt: skip
    with pytest.raises(ledger.Refused) as refused:
        ledger.fetch_verdict(PR, record, 3, scan=lambda text: 0, post=lambda pr, body: 1,
                             ledger_dir=cloud.ledger_dir, head_of=lambda pr: cloud.head)  # fmt: skip
    args = advised(str(refused.value))
    assert (args.command, args.pr, args.round) == ("collect", PR, 3)
    ledger.check_round(cloud.ledger_dir, args.pr, args.round, args.exception)
    assert args.reason == R3[-1]
    assert git(cloud.main, "rev-parse", "HEAD") == cloud.head


def test_a_record_the_ledger_journaled_meanwhile_is_not_flagged(tmp_path: Path) -> None:
    """Another PR's run records beside this one (R1's concurrent slots): the ledger's journal names
    it, so it is neither flagged nor moved; an unjournaled file is."""
    ledger_dir = tmp_path / "ledger"
    ledger_dir.mkdir()
    before, mark = review.ledger_snapshot(ledger_dir), review.journal_mark(ledger_dir)
    (ledger_dir / f"13-{'1' * 40}.json").write_text("{}")
    ledger.journal_path(ledger_dir).write_text(f"13-{'1' * 40}.json\n")
    run = review.Run(pr=PR, round_=1, head="a" * 40)
    review.check_ledger(ledger_dir, before, run, review.journaled_since(ledger_dir, mark))
    assert (ledger_dir / f"13-{'1' * 40}.json").exists()
    (ledger_dir / f"14-{'2' * 40}.json").write_text("{}")
    with pytest.raises(review.Refused, match=f"added: 14-{'2' * 40}.json"):
        review.check_ledger(ledger_dir, before, run, review.journaled_since(ledger_dir, mark))
