"""Ticket 212: the run-to-run diff compares a sheet's `paper` (the extent in mm its view boxes are on,
`engine/export.py`), so a run that loses a sheet's paper shows it. #212: "`paper` among diff.py's sheet
values (so a run shows a lost paper)". Invented exports (`tests/exports.py`), never a real set's."""

from typing import Any

from scripts.real_drawings.diff import compare
from scripts.real_drawings.tests.exports import SHA_A, dwg, export, sheet

A1 = [841.0, 594.0]
A3 = [420.0, 297.0]
FRAME = [0.0, 0.0, 42_050.0, 29_700.0]


def run(*sheets: dict[str, Any]) -> dict[str, Any]:
    return export(dwg(SHA_A, *sheets))


def sheet_changes(old: dict[str, Any], new: dict[str, Any]) -> list[Any]:
    return [item for item in compare(old, new).items if item.measure == "sheets"]


def test_a_layout_sheet_whose_paper_changed_is_shown_changed_with_its_paper() -> None:
    old = run(sheet("S-101", paper=A1))
    new = run(sheet("S-101", paper=A3))

    [change] = sheet_changes(old, new)

    assert change.change == "changed"
    assert change.fields["paper"] == [A1, A3]


def test_a_model_space_sheet_whose_paper_changed_is_shown_changed_with_its_paper() -> None:
    old = run(sheet(None, FRAME, paper=A1))
    new = run(sheet(None, FRAME, paper=A3))

    [change] = sheet_changes(old, new)

    assert change.change == "changed"
    assert change.fields["paper"] == [A1, A3]


def test_a_sheet_whose_paper_went_to_null_is_never_shown_unchanged() -> None:
    old = run(sheet("S-101", paper=A1), sheet(None, FRAME, paper=A3))
    new = run(sheet("S-101", paper=None), sheet(None, FRAME, paper=None))

    found = sheet_changes(old, new)
    counts = compare(old, new).counts()["sheets"]

    assert counts["lost"] + counts["changed"] == 2
    assert all(item.change in ("lost", "changed") for item in found)
    changed = [item.fields["paper"] for item in found if item.change == "changed"]
    assert all(paper[1] is None and paper[0] in (A1, A3) for paper in changed)


def test_two_runs_with_the_same_papers_show_no_sheet_changed() -> None:
    old = run(sheet("S-101", paper=A1), sheet(None, FRAME, paper=A3))
    new = run(sheet("S-101", paper=list(A1)), sheet(None, FRAME, paper=list(A3)))

    assert sheet_changes(old, new) == []
