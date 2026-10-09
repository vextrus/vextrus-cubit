"""verify's record carries `started_at` (S17-F4): the measures need a run's whole length."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.tf4._schema import contract, errors
from scripts.tests.acceptance.tf4.test_verify import Runner, clone, record_of, stage, verify

__all__ = ["clone"]  # the fixture, re-exported for pytest


def test_the_record_holds_started_at_no_later_than_written_at(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    code, _, _ = verify(clone, Runner(), capsys, monkeypatch)
    assert code == 0
    record = record_of(clone, tree)
    assert errors(record, contract("verify-record.schema.json")) == []
    assert record["started_at"] <= record["written_at"]
