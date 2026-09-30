"""Ticket 24g, R1 "Diagnostic": "(Development Sets only ...) Held-out: totals only, unchanged."

A Held-out Set answers exactly as on main: its header and two totals (sheets, views) in main's words,
no diagnostic line, no subject report, no per-sheet line; and which of its views is unjoined, and why,
changes nothing it answers. The kinds' spelling fix does change what joins, so the views total counts a
"title block" key view that joins a `title_block` export view.

Invented keys and exports only; nothing depends on the Python build.
"""

from pathlib import Path

import pytest

from tools.scorer.tests.acceptance.t24s.runs import (
    RUN_ID,
    SET,
    Place,
    export_sheet,
    export_view,
    key_sheet,
    key_view,
)

from .sets import shown, unsubjected_view
from .test_diagnostic import messy_set

A_BOX = [10.0, 10.0, 110.0, 110.0]
B_BOX = [200.0, 10.0, 300.0, 110.0]
C_BOX = [400.0, 10.0, 500.0, 110.0]


def answer(output: str, place: Place) -> list[str]:
    """The call's lines after its head line, with the test's folder hidden."""
    lines = output.replace(str(place.root), "<root>").splitlines()
    assert lines[0].startswith(f"vx-score {RUN_ID}: head "), output
    return lines[1:]


def main_held_out_answer(sheets: tuple[int, int], views: tuple[int, int]) -> list[str]:
    """Main's words for a Held-out Set (tools/scorer/score.py `_answer` on main)."""
    return [
        f"{SET}: a Held-out Set, in aggregate only",
        f"  {'sheets':14} {sheets[0]} / {sheets[1]}",
        f"  {'views':14} {views[0]} / {views[1]}",
    ]


def test_a_held_out_set_answers_its_totals_in_mains_words_and_nothing_else(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    messy_set(place, held_out=True)

    assert place.score() == 0
    output = shown(capfd)
    assert answer(output, place) == main_held_out_answer((0, 1), (3, 13)), output


def held_out_with_one_unjoined(place: Place, cause: str) -> None:
    """A held-out sheet of three views, two joined (one by the kinds' spelling fix); the third is
    unjoined for `cause`, its subject in or outside the vocabulary accordingly."""
    third_key = {
        "no view of its kind": key_view(C_BOX, "View C", kind="section", subject="slab"),
        "iou 0.6": key_view(C_BOX, "View C", kind="plan", subject="furniture arrangement"),
        "far away": key_view(C_BOX, "View C", kind="detail", subject="beam layout"),
    }[cause]
    third_found = {
        "no view of its kind": export_view([900.0, 900.0, 1000.0, 1000.0], "View C", kind="plan"),
        "iou 0.6": unsubjected_view([425.0, 10.0, 525.0, 110.0], "View C", kind="plan"),
        "far away": export_view([900.0, 900.0, 1000.0, 1000.0], "View C", kind="detail"),
    }[cause]
    place.write_keys(
        [
            key_sheet(
                "Sheet A",
                "QZ-901",
                "Invented plan",
                "first floor",
                [
                    key_view(A_BOX, "View A", kind="title block", subject="column layout"),
                    key_view(B_BOX, "View B", kind="plan", subject="pile cap"),
                    third_key,
                ],
            )
        ],
        held_out=True,
    )
    place.write_run(
        [
            export_sheet(
                "Sheet A",
                "QZ-901",
                "Invented plan",
                "first floor",
                [
                    export_view(A_BOX, "View A", kind="title_block", subject="column"),
                    unsubjected_view(B_BOX, "View B", kind="plan"),
                    third_found,
                ],
            )
        ]
    )


def test_why_a_held_out_view_is_unjoined_changes_nothing_the_set_answers(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    answers = []
    for cause in ("no view of its kind", "iou 0.6", "far away"):
        place = Place(tmp_path / cause.replace(" ", "-"))
        place.root.mkdir()
        held_out_with_one_unjoined(place, cause)
        assert place.score() == 0
        answers.append(answer(shown(capfd), place))

    assert answers[0] == main_held_out_answer((0, 1), (2, 3)), answers[0]
    assert answers[1] == answers[0]
    assert answers[2] == answers[0]
