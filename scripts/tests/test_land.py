"""land's ledger reading, beside the acceptance tests."""

import json
from pathlib import Path

from scripts.land import has_pass, order

HEAD = "0123456789abcdef0123456789abcdef01234567"


def write(store: Path, **fields: object) -> None:
    record = {"pr": 12, "head": HEAD, "round": 1, "verdict": "PASS", "exception": None} | fields
    (store / f"12-{HEAD}.json").write_text(json.dumps(record))


def test_a_round_three_pass_needs_its_exception(tmp_path: Path) -> None:
    write(tmp_path, round=3)
    assert not has_pass(tmp_path, 12, HEAD)
    write(tmp_path, round=3, exception={"kind": "crash", "reason": "x"})
    assert has_pass(tmp_path, 12, HEAD)


def test_a_record_for_another_pr_or_an_unreadable_one_is_no_pass(tmp_path: Path) -> None:
    write(tmp_path, pr=13)
    assert not has_pass(tmp_path, 12, HEAD)
    (tmp_path / f"12-{HEAD}.json").write_text("{")
    assert not has_pass(tmp_path, 12, HEAD)


def test_order_with_nothing_passing_is_empty() -> None:
    assert order([{"number": 1, "engine": True, "pass": False}]) == []
