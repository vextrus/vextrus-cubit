"""run.py's early checks of a repeat walk's answers file (the flow: scripts/tests/acceptance/ts30w1)."""

import json
from pathlib import Path

import pytest

from scripts.walk import run
from scripts.walk.jev_answers import Refused, read_rows


def _row(**over: object) -> dict[str, object]:
    row: dict[str, object] = {
        "cache_key": "0" * 64,
        "node": "sheet_type",
        "model_version": run.pinned_model(),
        "options": ["other"],
        "choice": "other",
        "confidence": "0.5000",
        "probabilities": {"other": "1"},
    }
    return row | over


def test_the_pinned_model_is_read_from_the_product_source() -> None:
    assert run.pinned_model().startswith("jev-")


def test_check_counts_the_rows_of_a_good_file(tmp_path: Path) -> None:
    path = tmp_path / "a.json"
    path.write_text(json.dumps([_row(), _row()]), encoding="utf-8")
    assert run.check_jev_answers(path) == 2


@pytest.mark.parametrize("text", ["{}", '"x"', "[1]", "[", json.dumps([_row(model_version="jev-0")])])
def test_check_refuses_a_bad_file(tmp_path: Path, text: str) -> None:
    path = tmp_path / "a.json"
    path.write_text(text, encoding="utf-8")
    with pytest.raises(run.WalkError):
        run.check_jev_answers(path)


@pytest.mark.parametrize(
    "rows",
    [[_row(confidence=0.5)], [_row(extra=1)], [_row(options="x")], [_row(confidence="nan")], ["x"], {}],
)
def test_the_seam_refuses_a_malformed_row(rows: object) -> None:
    with pytest.raises(Refused):
        read_rows(json.dumps(rows))
