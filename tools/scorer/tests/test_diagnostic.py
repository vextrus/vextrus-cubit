"""The diagnostic's rules the acceptance tests leave open (ticket 24g, session 07's ruling R1): the
other-kind cause checked first, a same-kind view taken by another, the export side's wording, the
frames' corners aligned, a key kind that is not a plain word, and the subject mapping's edge cases.
Invented keys and exports only."""

from pathlib import Path

import pytest

from tools.scorer import score
from tools.scorer.tests.acceptance.t24s.runs import (
    Place,
    export_sheet,
    export_view,
    key_sheet,
    key_view,
)

A_BOX = [10.0, 10.0, 110.0, 110.0]


def shown(capfd: pytest.CaptureFixture[str]) -> str:
    output = capfd.readouterr()
    return output.out + output.err


def scored(place: Place, key_views: list[dict[str, object]], views: list[dict[str, object]]) -> None:
    place.write_keys([key_sheet("Sheet A", "QZ-1", "Invented plan", "first floor", key_views)])
    place.write_run([export_sheet("Sheet A", "QZ-1", "Invented plan", "first floor", views)])
    assert place.score() == 0


def test_a_view_of_another_kind_in_its_place_is_the_cause_before_any_other(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    # The key's section has an export plan in its place and an export section far away: other kind.
    scored(
        Place(tmp_path),
        [key_view(A_BOX, "View A", kind="section")],
        [
            export_view(A_BOX, "View A", kind="plan"),
            export_view([900.0, 900.0, 1000.0, 1000.0], "View B", kind="section"),
        ],
    )
    out = shown(capfd)
    assert "    other kind at IoU >= 0.8: 1\n" in out, out
    assert "    same kind, best IoU < 0.2: 0\n" in out, out
    assert "    plan: other kind at IoU >= 0.8: 1\n" in out, out
    assert "    section: same kind, best IoU < 0.2: 1\n" in out, out


def test_a_same_kind_view_taken_by_another_is_its_own_cause(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    # Two key plans on one place, one export plan: one joins, the other's best IoU is 1 but taken.
    scored(
        Place(tmp_path),
        [key_view(A_BOX, "View A"), key_view(A_BOX, "View B")],
        [export_view(A_BOX, "View A")],
    )
    out = shown(capfd)
    assert "    same kind, best IoU >= 0.8 (taken by another view): 1\n" in out, out
    assert "    1 missing view of kind plan\n" in out, out


def test_an_export_view_with_no_key_view_of_its_kind_says_key(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    scored(
        Place(tmp_path),
        [key_view(A_BOX, "View A")],
        [export_view(A_BOX, "View A"), export_view([500.0, 10.0, 600.0, 110.0], "L", kind="legend")],
    )
    out = shown(capfd)
    assert "    legend: no key view of that kind: 1\n" in out, out
    assert "    no export view of that kind: 0\n" in out, out


def test_a_key_kind_that_is_not_a_plain_word_is_never_named(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    secret = "Marlowe's (east) wing, level 7"
    scored(Place(tmp_path), [key_view(A_BOX, "View A", kind=secret)], [])
    out = shown(capfd)
    assert "    1 missing view of kind another kind\n" in out, out
    assert "marlowe" not in out.casefold()


def framed(place: Place, export_box: list[float], export_views: list[dict[str, object]]) -> None:
    frame = [0.0, 0.0, 420.0, 297.0]
    place.write_keys(
        [
            key_sheet(
                "Model",
                "QZ-1",
                "Invented plan",
                "first floor",
                [key_view([20.0, 20.0, 120.0, 120.0], "View A")],
                frame=frame,
            )
        ]
    )
    place.write_run(
        [export_sheet(None, "QZ-1", "Invented plan", "first floor", export_views, box=export_box)]  # type: ignore[arg-type]
    )
    assert place.score() == 0


def test_a_view_moved_with_its_frame_would_join_if_the_corners_were_aligned(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    # The export's frame and view are both 30 mm right of the key's: the sheet joins (IoU 0.87),
    # the view does not (0.54); moved by the corners' 30 mm, it would.
    framed(Place(tmp_path), [30.0, 0.0, 450.0, 297.0], [export_view([50.0, 20.0, 150.0, 120.0], "V")])
    out = shown(capfd)
    assert "views          0 / 1" in out, out  # the join rule is unchanged: no shift
    assert "if frame corners were aligned (lower-left, translation only): 1\n" in out, out


def test_a_view_off_its_frame_would_not_join_if_the_corners_were_aligned(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    framed(Place(tmp_path), [30.0, 0.0, 450.0, 297.0], [export_view([80.0, 20.0, 180.0, 120.0], "V")])
    out = shown(capfd)
    assert "if frame corners were aligned (lower-left, translation only): 0\n" in out, out


def test_no_framed_sheet_says_so(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    scored(Place(tmp_path), [key_view(A_BOX, "View A")], [export_view(A_BOX, "View A")])
    assert "aligned: no joined sheet has a frame\n" in shown(capfd)


@pytest.mark.parametrize(
    ("phrase", "word"),
    [
        ("pile cap", "pile cap"),
        ("Pile-cap and pile layout", "pile cap"),
        ("beam and column layout", "beam"),  # the first word in the phrase
        ("columns", None),  # whole words only
        ("RETAINING_WALL section", "retaining wall"),
        ("shear  wall", "shear wall"),
        ("", None),
    ],
)
def test_a_key_phrase_maps_to_the_first_whole_subject_word_in_it(phrase: str, word: str) -> None:
    assert score._subject_word(score._underscored(phrase)) == word


@pytest.mark.parametrize(
    ("kind", "folded"),
    [
        ("3D / Perspective", "perspective"),
        ("3d", "perspective"),
        ("Title_Block", "title block"),
        ("  key   plan ", "key plan"),
        (None, ""),
    ],
)
def test_a_kind_is_folded_before_it_is_compared(kind: object, folded: str) -> None:
    assert score._kind(kind) == folded
