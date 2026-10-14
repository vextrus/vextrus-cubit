"""Ticket S29-F2a (docs/plans/factory-s29.md item 2, F2; #823's owed check): "the verify record keeps
each check's start and end". Each element of the record's `checks` carries `started_at` and `ended_at`,
UTC to the second in the record's own style (`written_at`, `started_at`), so a slow cloud verify names
its slow step.

Seams (fixed by f4, kept): `scripts.verify.main(argv, *, run, leak)`, the record at
`<git-common-dir>/vextrus/verify-<tree>.json`, its contract `contracts/verify-record.schema.json`.

    uv run pytest -rf scripts/tests/acceptance/ts29f2a
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.tf4._schema import contract, errors
from scripts.tests.acceptance.tf4.test_verify import Runner, clone, record_of, stage

__all__ = ["clone"]  # the fixture, re-exported for pytest

UTC_SECOND = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
MISSING = "the record keeps no start and end"


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class Clocked(Runner):
    """A fake `run` that notes the UTC second each check ran at."""

    def __init__(self) -> None:
        super().__init__()
        self.at: list[tuple[str, str]] = []

    def __call__(self, check: Any) -> tuple[int, str]:
        self.at.append((check.name, _now()))
        return super().__call__(check)


def _no_leak(root: Path, tree: str) -> tuple[bool, list[str]]:
    return False, []


def _verify(root: Path, run: Runner, monkeypatch: pytest.MonkeyPatch) -> int:
    from scripts.verify import main

    monkeypatch.chdir(root)
    return main([], run=run, leak=_no_leak)


def _times(check: dict[str, Any]) -> tuple[str, str]:
    assert "started_at" in check, f"{MISSING} for check {check['name']}"
    assert "ended_at" in check, f"{MISSING} for check {check['name']}"
    return check["started_at"], check["ended_at"]


def test_each_check_keeps_its_start_and_end_in_utc_to_the_second(
    clone: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    assert _verify(clone, Clocked(), monkeypatch) == 0
    record = record_of(clone, tree)
    assert len(record["checks"]) >= 2
    for check in record["checks"]:
        started, ended = _times(check)
        assert UTC_SECOND.fullmatch(started), (check["name"], started)
        assert UTC_SECOND.fullmatch(ended), (check["name"], ended)


def test_a_checks_start_comes_before_it_ran_and_its_end_after(
    clone: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Start and end bracket the run itself, and every check sits inside the record's own span."""
    tree = stage(clone, "scripts/thing.py")
    run = Clocked()
    assert _verify(clone, run, monkeypatch) == 0
    record = record_of(clone, tree)
    for check in record["checks"]:
        started, ended = _times(check)
        assert record["started_at"] <= started <= ended <= record["written_at"], check
        ran = [at for name, at in run.at if name == check["name"]]
        assert ran, f"{check['name']} is recorded but never ran"
        assert started <= ran[0], (check["name"], started, ran)
        assert ran[-1] <= ended, (check["name"], ran, ended)


def test_a_failing_check_keeps_its_start_and_end_too(
    clone: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    run = Clocked()
    run.scripted = {"pytest": [(1, "FAILED scripts/tests/test_thing.py::test_x\n")]}
    assert _verify(clone, run, monkeypatch) == 1
    record = record_of(clone, tree)
    [failed] = [check for check in record["checks"] if check["name"] == "pytest"]
    assert failed["exit_code"] == 1
    started, ended = _times(failed)
    assert started <= ended


def test_the_records_contract_names_each_checks_start_and_end(
    clone: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The contract (additionalProperties false) lists both, in `written_at`'s pattern, and a record
    written with them still meets it."""
    schema = contract("verify-record.schema.json")
    fields = schema["properties"]["checks"]["items"]["properties"]
    assert {"started_at", "ended_at"} <= set(fields), f"{MISSING} in its contract"
    for name in ("started_at", "ended_at"):
        assert fields[name]["pattern"] == schema["properties"]["written_at"]["pattern"], name
    tree = stage(clone, "scripts/thing.py")
    assert _verify(clone, Clocked(), monkeypatch) == 0
    assert errors(record_of(clone, tree), schema) == []
