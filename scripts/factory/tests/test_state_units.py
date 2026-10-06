"""Units of scripts/factory/state.py: the ledger reader fails closed, the lock line is honest."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.factory import state

HEAD = "a" * 40


def write(folder: Path, name: str, text: str) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    (folder / name).write_text(text)


def record(pr: int, head: str, **over: object) -> str:
    return json.dumps({"pr": pr, "head": head, "round": 1, "verdict": "PASS", **over})


def test_a_good_record_is_read(tmp_path: Path) -> None:
    write(tmp_path, f"7-{HEAD}.json", record(7, HEAD))
    book = state.read_ledger(tmp_path)
    assert book.records[7][0].verdict == "PASS"
    assert not book.unreadable


@pytest.mark.parametrize(
    "text",
    [
        '{"pr": 7, "head": "',  # truncated
        record(8, HEAD),  # names another PR than its file
        record(7, "b" * 40),  # names another head than its file
        record(7, HEAD, verdict="MAYBE"),
        record(7, HEAD, round=9),
    ],
)
def test_a_record_that_disagrees_with_its_name_marks_the_pr_unreadable(
    tmp_path: Path, text: str
) -> None:
    write(tmp_path, f"7-{HEAD}.json", text)
    book = state.read_ledger(tmp_path)
    assert book.unreadable == {7}
    assert 7 not in book.records


def test_a_missing_ledger_is_empty_not_unreadable(tmp_path: Path) -> None:
    book = state.read_ledger(tmp_path / "none")
    assert not book.records
    assert not book.unreadable


def test_the_lock_line_is_free_without_a_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(tmp_path))
    assert state.real_drawing_lock() == "real-drawing lock: free"
