"""Ticket S29-F2a (docs/plans/factory-s29.md item 2, F2; the owner's Q3: "a fast verify before READY;
CI is the full gate"): `python -m scripts.verify --fast` runs, and what it wrote says it was fast.

- The record gains `mode`: `"fast"` from `--fast`, `"full"` otherwise (named in its contract).
- The trailer the guard and the watcher read stays exactly `Factory-Verify: <tree> ok` (trailers.md 1:
  any other `Factory-*` key makes a head malformed), and a fast run prints `Verify-Mode: fast` just
  before it: a plain trailer the builder copies beside it, so the commit says the verify was fast.
- A fast run still runs the cross-PR check (narrowed; what it narrows is the builder's).

Seams: `scripts.verify.main(argv, *, run, leak)` (f4), the record at
`<git-common-dir>/vextrus/verify-<tree>.json`.

    uv run pytest -rf scripts/tests/acceptance/ts29f2a
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.tf4._schema import contract, errors
from scripts.tests.acceptance.tf4.test_verify import Runner, clone, record_of, stage

__all__ = ["clone"]  # the fixture, re-exported for pytest

NO_MODE = "the record says no mode"


def _no_leak(root: Path, tree: str) -> tuple[bool, list[str]]:
    return False, []


def run_verify(
    root: Path,
    args: list[str],
    run: Runner,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[int, str, str]:
    from scripts.verify import main

    monkeypatch.chdir(root)
    code = main(args, run=run, leak=_no_leak)
    out = capsys.readouterr()
    return code, out.out, out.err


def test_a_fast_verify_passes_and_its_record_says_fast(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    code, _, err = run_verify(clone, ["--fast"], Runner(), capsys, monkeypatch)
    assert code == 0, err
    record = record_of(clone, tree)
    assert record.get("mode") == "fast", f"{NO_MODE} fast: {sorted(record)}"
    assert errors(record, contract("verify-record.schema.json")) == []


def test_a_fast_verify_prints_verify_mode_fast_before_the_unchanged_trailer(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    code, out, err = run_verify(clone, ["--fast"], Runner(), capsys, monkeypatch)
    assert code == 0, err
    lines = out.strip().splitlines()
    assert lines[-1] == f"Factory-Verify: {tree} ok"
    assert lines[-2] == "Verify-Mode: fast", lines[-3:]


def test_a_fast_verify_still_runs_the_cross_pr_check(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    run = Runner()
    code, _, err = run_verify(clone, ["--fast"], run, capsys, monkeypatch)
    assert code == 0, err
    assert "crosspr" in run.calls
    assert "crosspr" in [check["name"] for check in record_of(clone, tree)["checks"]]


def test_a_failing_fast_verify_prints_no_trailer_and_records_fast(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    run = Runner({"pytest": [(1, "FAILED scripts/tests/test_thing.py::test_x\n")]})
    code, out, err = run_verify(clone, ["--fast"], run, capsys, monkeypatch)
    assert code == 1, err
    assert "Factory-Verify:" not in out
    record = record_of(clone, tree)
    assert record["ok"] is False
    assert record.get("mode") == "fast", f"{NO_MODE} fast: {sorted(record)}"


def test_a_full_verify_record_says_full_and_prints_no_fast_mode(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    code, out, err = run_verify(clone, [], Runner(), capsys, monkeypatch)
    assert code == 0, err
    assert "Verify-Mode: fast" not in out
    assert out.strip().splitlines()[-1] == f"Factory-Verify: {tree} ok"
    record = record_of(clone, tree)
    assert record.get("mode") == "full", f"{NO_MODE} full: {sorted(record)}"


def test_the_records_contract_names_the_mode() -> None:
    schema = contract("verify-record.schema.json")
    mode = schema["properties"].get("mode")
    assert mode is not None, f"{NO_MODE} in its contract"
    assert set(mode["enum"]) == {"fast", "full"}, mode
