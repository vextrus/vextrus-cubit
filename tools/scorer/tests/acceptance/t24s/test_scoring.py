"""Ticket 24s: what the blind scorer answers (docs/plans/M0.md, "24s The blind scorer and the Development
Set keys"; session 06's ruling "24s <-> 17"; the key-matching contract, docs/specs/M1.md "Ticket 01's
matching contract").

- Development Sets: per sheet, pass or fail, and what is wrong in general terms ("number wrong",
  "a view missing", "storeys wrong"), never the key's value; and the totals (sheets n / N, views n / N,
  per field).
- Held-out Sets: in aggregate only (a test on a synthetic held-out set proves it answers nothing per
  sheet).
- A view joins at IoU >= 0.8 with the same kind; a sheet joins on its layout, and when several export
  sheets share one layout (model space), on the key's frame box at IoU >= 0.8.
- Every call logged with the run and its head.

Invented keys and exports only.
"""

import os
import re
from pathlib import Path

import pytest

from .runs import HEAD, RUN_ID, Place, export_sheet, export_view, key_sheet, key_view

A_BOX = [10.0, 10.0, 110.0, 110.0]
B_BOX = [200.0, 10.0, 300.0, 110.0]


def total(output: str, name: str, n: int, of: int) -> bool:
    """True when a line names `name` and gives `n / N` (the plan's own way of writing a total)."""
    return (
        re.search(rf"(?im)^.*\b{re.escape(name)}\b.*(?<![\d/])\b{n} / {of}\b(?![\d/])", output)
        is not None
    )


def two_sheets(place: Place, *, number_b: str = "QZ-902", storeys_b: str = "second floor") -> None:
    """Two sheets, each with one view; the export's second sheet takes the given number and storeys."""
    place.write_keys(
        [
            key_sheet(
                "Sheet A", "QZ-901", "Invented first plan", "first floor", [key_view(A_BOX, "Plan A")]
            ),
            key_sheet(
                "Sheet B", "QZ-902", "Invented second plan", "second floor", [key_view(B_BOX, "Plan B")]
            ),
        ]
    )
    place.write_run(
        [
            export_sheet(
                "Sheet A", "QZ-901", "Invented first plan", "first floor", [export_view(A_BOX, "Plan A")]
            ),
            export_sheet(
                "Sheet B", number_b, "Invented second plan", storeys_b, [export_view(B_BOX, "Plan B")]
            ),
        ]
    )


def test_a_development_set_that_matches_its_key_passes_every_sheet(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    two_sheets(place)

    assert place.score() == 0
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "sheets", 2, 2), shown
    assert total(shown, "views", 2, 2), shown
    assert "wrong" not in shown
    assert "missing" not in shown


def test_a_wrong_number_fails_that_sheet_as_number_wrong(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    two_sheets(place, number_b="AB-100")

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err
    assert shown.count("number wrong") == 1, shown
    assert total(shown, "sheets", 1, 2), shown
    assert total(shown, "number", 1, 2), shown
    assert "QZ-902" not in shown


def test_wrong_storeys_fail_that_sheet_as_storeys_wrong(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    two_sheets(place, storeys_b="ninth floor")

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err
    assert shown.count("storeys wrong") == 1, shown
    assert total(shown, "sheets", 1, 2), shown
    assert total(shown, "storeys", 1, 2), shown
    assert "second floor" not in shown


def test_a_key_view_no_export_view_joins_is_a_view_missing(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    second = [210.0, 150.0, 290.0, 250.0]
    place.write_keys(
        [
            key_sheet(
                "Sheet A",
                "QZ-901",
                "Invented first plan",
                "first floor",
                [key_view(A_BOX, "Plan A"), key_view(second, "Plan A2")],
            ),
            key_sheet(
                "Sheet B", "QZ-902", "Invented second plan", "second floor", [key_view(B_BOX, "Plan B")]
            ),
        ]
    )
    place.write_run(
        [
            export_sheet(
                "Sheet A", "QZ-901", "Invented first plan", "first floor", [export_view(A_BOX, "Plan A")]
            ),
            export_sheet(
                "Sheet B",
                "QZ-902",
                "Invented second plan",
                "second floor",
                [export_view(B_BOX, "Plan B")],
            ),
        ]
    )

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err
    assert shown.count("a view missing") == 1, shown
    assert total(shown, "sheets", 1, 2), shown
    assert total(shown, "views", 2, 3), shown


def one_view(
    place: Place, key_box: list[float], export_box: list[float], export_kind: str = "plan"
) -> None:
    place.write_keys(
        [key_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", [key_view(key_box, "Plan A")])]
    )
    place.write_run(
        [
            export_sheet(
                "Sheet A",
                "QZ-901",
                "Invented plan",
                "first floor",
                [export_view(export_box, "Plan A", export_kind)],
            )
        ]
    )


def test_a_view_joins_at_an_iou_of_exactly_0_8(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_view(place, [0.0, 0.0, 100.0, 100.0], [0.0, 0.0, 100.0, 80.0])  # IoU 8000 / 10000

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "views", 1, 1), shown
    assert "a view missing" not in shown


def test_a_view_below_an_iou_of_0_8_does_not_join(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_view(place, [0.0, 0.0, 100.0, 100.0], [0.0, 0.0, 100.0, 75.0])  # IoU 0.75

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "views", 0, 1), shown
    assert "a view missing" in shown


def test_a_view_of_another_kind_does_not_join(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    one_view(place, [0.0, 0.0, 100.0, 100.0], [0.0, 0.0, 100.0, 100.0], export_kind="section")

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "views", 0, 1), shown
    assert "a view missing" in shown


FRAME_1 = [0.0, 0.0, 1000.0, 700.0]
FRAME_2 = [2000.0, 0.0, 3000.0, 700.0]


def test_model_space_sheets_sharing_a_layout_join_on_the_keys_frame(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [
            key_sheet("Model", "QZ-901", "Invented first plan", "first floor", [], frame=FRAME_1),
            key_sheet("Model", "QZ-902", "Invented second plan", "second floor", [], frame=FRAME_2),
        ]
    )
    # The export lists them the other way round: only the frame can pair them.
    place.write_run(
        [
            export_sheet("Model", "QZ-902", "Invented second plan", "second floor", [], box=FRAME_2),
            export_sheet("Model", "QZ-901", "Invented first plan", "first floor", [], box=FRAME_1),
        ]
    )

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "sheets", 2, 2), shown
    assert "wrong" not in shown


def test_a_model_space_sheet_whose_frame_is_below_an_iou_of_0_8_does_not_join(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [
            key_sheet("Model", "QZ-901", "Invented first plan", "first floor", [], frame=FRAME_1),
            key_sheet("Model", "QZ-902", "Invented second plan", "second floor", [], frame=FRAME_2),
        ]
    )
    place.write_run(
        [
            export_sheet("Model", "QZ-901", "Invented first plan", "first floor", [], box=FRAME_1),
            # IoU with FRAME_2: 1000 x 490 over 1000 x 700 = 0.7
            export_sheet(
                "Model",
                "QZ-902",
                "Invented second plan",
                "second floor",
                [],
                box=[2000.0, 0.0, 3000.0, 490.0],
            ),
        ]
    )

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "sheets", 1, 2), shown


# Every value below is the key's and differs from the export's, so a scorer that shows a key value shows
# one of these.
SECRET_NUMBER = "QZ-7741"
SECRET_TITLE = "Zanzibar roof plan"
SECRET_STOREYS = "seventeenth floor"
SECRET_VIEW_TITLE = "Quixotic beam layout"
SECRET_SUBJECT = "pile_cap"
SECRET_DISCIPLINE = "architectural"
SECRET_REVISION = "Rev-Q"
SECRET_DATE = "2031-12-24"
SECRETS = [
    SECRET_NUMBER,
    SECRET_TITLE,
    SECRET_STOREYS,
    SECRET_VIEW_TITLE,
    SECRET_SUBJECT,
    SECRET_DISCIPLINE,
    SECRET_REVISION,
    SECRET_DATE,
]


def test_the_scorer_shows_no_key_value_in_its_output_or_its_log(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [
            key_sheet(
                "Sheet A",
                SECRET_NUMBER,
                SECRET_TITLE,
                SECRET_STOREYS,
                [
                    key_view(A_BOX, SECRET_VIEW_TITLE, subject=SECRET_SUBJECT),
                    key_view(B_BOX, SECRET_VIEW_TITLE),
                ],
                discipline=SECRET_DISCIPLINE,
                revision=SECRET_REVISION,
                date=SECRET_DATE,
            )
        ]
    )
    place.write_run(
        [
            export_sheet(
                "Sheet A", "AB-100", "Invented plan", "ground floor", [export_view(A_BOX, "Plan A")]
            )
        ]
    )

    place.score()
    output = capfd.readouterr()
    shown = output.out + output.err + place.logged()
    assert "number wrong" in shown  # it did score the sheet
    for secret in SECRETS:
        assert secret.casefold() not in shown.casefold(), secret


def held_out_run(place: Place, *, failing: str) -> None:
    """Scores a held-out set of two sheets in which the sheet named `failing` has a wrong number."""
    numbers = {"Sheet A": "QZ-901", "Sheet B": "QZ-902"}
    place.write_keys(
        [
            key_sheet(
                "Sheet A", "QZ-901", "Invented first plan", "first floor", [key_view(A_BOX, "Plan A")]
            ),
            key_sheet(
                "Sheet B", "QZ-902", "Invented second plan", "second floor", [key_view(B_BOX, "Plan B")]
            ),
        ],
        held_out=True,
    )
    numbers[failing] = "AB-100"
    place.write_run(
        [
            export_sheet(
                "Sheet A",
                numbers["Sheet A"],
                "Invented first plan",
                "first floor",
                [export_view(A_BOX, "Plan A")],
            ),
            export_sheet(
                "Sheet B",
                numbers["Sheet B"],
                "Invented second plan",
                "second floor",
                [export_view(B_BOX, "Plan B")],
            ),
        ]
    )
    place.score()


def test_a_held_out_set_answers_only_in_aggregate(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    first, second = Place(tmp_path / "first"), Place(tmp_path / "second")
    first.root.mkdir()
    second.root.mkdir()

    held_out_run(first, failing="Sheet A")
    out_first = capfd.readouterr()
    held_out_run(second, failing="Sheet B")
    out_second = capfd.readouterr()

    shown_first = (out_first.out + out_first.err).replace(str(first.root), "<root>")
    shown_second = (out_second.out + out_second.err).replace(str(second.root), "<root>")
    assert total(shown_first, "sheets", 1, 2), shown_first
    for reason in ("number wrong", "a view missing", "storeys wrong"):
        assert reason not in shown_first
    # Which sheet failed changes nothing the held-out set answers.
    assert shown_first == shown_second


def test_every_call_is_logged_with_the_run_and_its_head(tmp_path: Path) -> None:
    place = Place(tmp_path)
    two_sheets(place)

    place.score()
    place.score()
    logged = place.logged()
    assert logged.count(RUN_ID) >= 2, logged
    # The run id embeds the head's first 12 characters; the head must be logged beside it as well.
    assert logged.replace(RUN_ID, "").count(HEAD[:12]) >= 2, logged


def test_a_refused_call_is_logged_too(tmp_path: Path) -> None:
    place = Place(tmp_path)
    two_sheets(place)

    assert place.score(writer=os.getuid() + 1) != 0
    assert RUN_ID in place.logged()
