"""Ticket 23's acceptance tests: the node table in git.

ADR 0011, item 3: "Every Jev node ships with a spot check of about 30 real items, a measured queue size
and a pinned model version, in one table (counts in git, labelled items in `.private/`), re-measured
when the model changes." The plan (docs/plans/M0.md, 23): "right / checked and the queue size, recorded
in the node table". The table's file is the orchestrator's ruling (session 06, 23):
`docs/knowledge/jev-nodes.md`.

What these tests read: the file's first Markdown table whose header names the node, the model, right,
checked and the queue (each header cell matched case-insensitively by that word; "right" and
"checked" may share one cell written "right / checked"), and its rows for `sheet_type`. The last such
row is the current measurement.
"""

import re
from decimal import Decimal
from pathlib import Path

from django.conf import settings

from vextrus.platform.services import jev

TABLE = Path(__file__).resolve().parents[5] / "docs" / "knowledge" / "jev-nodes.md"
COLUMNS = ("node", "model", "right", "checked", "queue")
ABOUT_30 = 25
"""The fewest sheets "about 30" allows."""


def _cells(line: str) -> list[str]:
    return [cell.strip().strip("`*").strip() for cell in line.strip().strip("|").split("|")]


def _table() -> tuple[list[str], list[list[str]]]:
    lines = TABLE.read_text(encoding="utf-8").splitlines()
    for at, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            continue
        header = [cell.lower() for cell in _cells(line)]
        if all(any(word in cell for cell in header) for word in COLUMNS):
            rows = []
            for row in lines[at + 2 :]:
                if not row.lstrip().startswith("|"):
                    break
                rows.append(_cells(row))
            return header, rows
    raise AssertionError(f"no table in {TABLE.name} names the columns {', '.join(COLUMNS)}")


def _column(header: list[str], word: str) -> int:
    return next(at for at, cell in enumerate(header) if word in cell)


def _sheet_type_rows() -> tuple[list[str], list[list[str]]]:
    header, rows = _table()
    node = _column(header, "node")
    found = [row for row in rows if row[node] == jev.SHEET_TYPE.key]
    assert found, f"the node table has no row for {jev.SHEET_TYPE.key}"
    return header, found


def _count(text: str) -> int:
    assert re.fullmatch(r"\d+", text), f"{text!r} is not a count"
    return int(text)


def _right_and_checked(header: list[str], row: list[str]) -> tuple[int, int]:
    right, checked = _column(header, "right"), _column(header, "checked")
    if right == checked:
        parts = re.fullmatch(r"(\d+)\s*/\s*(\d+)", row[right])
        assert parts, f"{row[right]!r} is not right / checked"
        return int(parts[1]), int(parts[2])
    return _count(row[right]), _count(row[checked])


def test_the_node_table_is_in_git_at_docs_knowledge_jev_nodes() -> None:
    assert TABLE.is_file()


def test_the_table_names_node_model_right_checked_and_queue() -> None:
    header, _rows = _table()
    assert all(any(word in cell for cell in header) for word in COLUMNS)


def test_the_sheet_type_node_has_a_row() -> None:
    _sheet_type_rows()


def test_each_sheet_type_row_checked_about_30_real_sheets() -> None:
    header, rows = _sheet_type_rows()
    for row in rows:
        right, checked = _right_and_checked(header, row)
        assert checked >= ABOUT_30
        assert 0 <= right <= checked


def test_each_sheet_type_row_has_a_measured_queue_size() -> None:
    header, rows = _sheet_type_rows()
    queue = _column(header, "queue")
    for row in rows:
        _right, checked = _right_and_checked(header, row)
        assert 0 <= _count(row[queue]) <= checked


def test_the_current_row_names_the_node_s_pinned_model() -> None:
    header, rows = _sheet_type_rows()
    assert jev.SHEET_TYPE.model in rows[-1][_column(header, "model")]


def test_the_current_row_names_the_threshold_its_queue_was_measured_at() -> None:
    header, rows = _sheet_type_rows()
    threshold: Decimal = getattr(settings, jev.SHEET_TYPE.propose_at)
    cell = rows[-1][_column(header, "threshold")] if any("threshold" in c for c in header) else ""
    assert re.fullmatch(r"\d*\.\d+|\d+", cell), f"no threshold in the current row: {cell!r}"
    assert Decimal(cell) == threshold
