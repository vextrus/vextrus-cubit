"""The diagnostic's rules the acceptance tests leave open (ticket 24g, session 07's ruling R1): the
other-kind cause checked first, a same-kind view taken by another, the export side's wording, the
frames' corners aligned, a key kind that is not a plain word, and the subject mapping's edge cases.
Invented keys and exports only."""

import re
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


@pytest.mark.parametrize(
    "secret",
    [
        "Marlowe's (east) wing, level 7",
        "column c3",
        "level 12",
        "ground floor plan",
        "sheet s101",
        "q" * 5000,
        "\uff50\uff4c\uff41\uff4e \uff58",  # "plan x" in full-width letters
    ],
    ids=["punctuated", "column c3", "level 12", "three words", "sheet s101", "long", "full-width"],
)
def test_a_key_kind_off_the_closed_list_is_never_named(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], secret: str
) -> None:
    # 24g's review (60): a pattern of plain words let "column c3" and the like through verbatim.
    scored(Place(tmp_path), [key_view(A_BOX, "View A", kind=secret)], [])
    out = shown(capfd)
    assert "    1 missing view of kind another kind\n" in out, out
    for word in ("marlowe", "column", "level", "ground", "s101", "q" * 50, "plan x"):
        assert word not in out.casefold(), word


# Every sentence the diagnostic prints, but for its counts, its kinds (score.KINDS) and its causes
# (score.CAUSES): the closed list its words must come from.
FIXED = (
    "missing view views of kind another kind",
    "unjoined key views of joined sheets, by cause",
    "unjoined export views of joined sheets, by kind and cause",
    "none",
    "key views that would join if frame corners were aligned: no joined sheet has a frame",
    "key views that would join if frame corners were aligned (lower-left, translation only)",
    "joined views with no export subject",
    "subjects outside the vocabulary",
)


def test_every_word_the_diagnostic_prints_comes_from_a_closed_list(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    # The class of 24g's review finding (60): the diagnostic names nothing a key (or an export) can
    # choose. Adversarial kinds, titles and subjects on both sides, joined and not.
    hostile = ["column c3", "level 12", "ground floor plan", "sheet s101", "z" * 5000, "Marlowe"]
    hostile += ["\uff50\uff4c\uff41\uff4e \uff58", "plan\nsecret", "title_block extra", "3d/secret"]
    keyed, found = [], []
    for i, kind in enumerate(hostile):
        where = [10.0 + 150.0 * i, 10.0, 110.0 + 150.0 * i, 110.0]
        keyed.append(key_view(where, f"Secret title {i}", kind=kind, subject=f"secret {kind}"))
        keyed.append(key_view(where, f"Hidden title {i}", kind="plan", subject="hidden phrase"))
        found.append(export_view(where, "Found", kind=kind + " exported", subject="exported"))
    place = Place(tmp_path)
    place.write_keys(
        [key_sheet("Model", "QZ-1", "Invented", "first", keyed, frame=[0.0, 0.0, 2000.0, 300.0])]
    )
    sheet = export_sheet(None, "QZ-1", "Invented", "first", found, box=[5.0, 0.0, 2005.0, 300.0])  # type: ignore[arg-type]
    place.write_run([sheet])
    assert place.score() == 0
    lines = shown(capfd).splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("  extra sheets"))
    end = next(i for i, line in enumerate(lines) if re.search(r" \d+ / \d+$", line))
    printed = [line for line in lines if " missing view" in line] + lines[start + 1 : end]
    assert any("another kind" in line for line in printed), printed
    closed = [*FIXED, *score.KINDS, *(c.format(side=s) for c in score.CAUSES for s in ("key", "export"))]
    allowed = {word for sentence in closed for word in re.findall(r"[^\W\d_]+", sentence.casefold())}
    for line in printed:
        assert set(re.findall(r"[^\W\d_]+", line.casefold())) <= allowed, line


def two_frames(
    place: Place,
    layout: str | None,
    frames: tuple[list[float], list[float]],
    views: tuple[list[float], list[float]],
    paper: list[float] | None = None,
) -> None:
    """One framed sheet: the key's frame and view, and the export's; `paper` on both sides."""
    extra = {} if paper is None else {"paper": paper}
    key_layout = "Model" if layout is None else layout
    place.write_keys(
        [
            key_sheet(
                key_layout, "QZ-1", "Invented plan", "first floor", [key_view(views[0], "V")],
                frame=frames[0], **extra,
            )
        ]
    )  # fmt: skip
    sheet = export_sheet(
        layout,  # type: ignore[arg-type]
        "QZ-1",
        "Invented plan",
        "first floor",
        [export_view(views[1], "V")],
        box=frames[1],
    )
    place.write_run([sheet | extra])
    assert place.score() == 0


ALIGNED = "if frame corners were aligned (lower-left, translation only): {}\n"


@pytest.mark.parametrize("paper", ["both", "export only"])
def test_a_model_space_view_would_join_if_its_frame_corner_were_the_keys(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], paper: str
) -> None:
    # 24g's review (75): views are on paper in mm from their own sheet's lower-left corner; a
    # model-space frame is in model units. At 1:100, an export frame 400 model mm right of the key's
    # puts the same view 4 mm left on its paper: 6 mm of 10 overlap (IoU 0.43), and moving it 4 mm
    # joins it.
    place = Place(tmp_path)
    frames = ([0.0, 0.0, 42000.0, 29700.0], [400.0, 0.0, 42400.0, 29700.0])
    views = ([20.0, 20.0, 30.0, 30.0], [16.0, 20.0, 26.0, 30.0])
    if paper == "both":
        two_frames(place, None, frames, views, paper=[420.0, 297.0])
    else:
        place.write_keys(
            [
                key_sheet(
                    "Model", "QZ-1", "Invented plan", "first floor", [key_view(views[0], "V")],
                    frame=frames[0],
                )
            ]
        )  # fmt: skip
        sheet = export_sheet(
            None,  # type: ignore[arg-type]
            "QZ-1",
            "Invented plan",
            "first floor",
            [export_view(views[1], "V")],
            box=frames[1],
        )
        place.write_run([sheet | {"paper": [420.0, 297.0]}])
        assert place.score() == 0
    out = shown(capfd)
    assert "views          0 / 1" in out, out  # the join rule is unchanged: no shift
    assert ALIGNED.format(1) in out, out


def test_a_model_space_sheet_with_no_paper_counts_none(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    frames = ([0.0, 0.0, 42000.0, 29700.0], [400.0, 0.0, 42400.0, 29700.0])
    views = ([20.0, 20.0, 30.0, 30.0], [16.0, 20.0, 26.0, 30.0])
    two_frames(Place(tmp_path), None, frames, views)
    assert ALIGNED.format(0) in shown(capfd)


def test_a_layout_view_would_join_if_its_frame_corner_were_the_keys(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    # A layout frame 30 mm right of the key's: the same view, from its own frame's corner, is 30 mm
    # left (IoU 0.25); moved by 30 mm it joins.
    frames = ([0.0, 0.0, 420.0, 297.0], [30.0, 0.0, 450.0, 297.0])
    views = ([20.0, 20.0, 70.0, 70.0], [-10.0, 20.0, 40.0, 70.0])
    two_frames(Place(tmp_path), "Sheet A", frames, views)
    out = shown(capfd)
    assert "views          0 / 1" in out, out
    assert ALIGNED.format(1) in out, out


def test_a_layout_view_already_in_the_keys_place_gains_nothing_from_aligning(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    frames = ([0.0, 0.0, 420.0, 297.0], [30.0, 0.0, 450.0, 297.0])
    views = ([20.0, 20.0, 70.0, 70.0], [20.0, 20.0, 70.0, 70.0])
    two_frames(Place(tmp_path), "Sheet A", frames, views)
    out = shown(capfd)
    assert "views          1 / 1" in out, out
    assert ALIGNED.format(0) in out, out


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


def test_every_key_phrase_is_mapped_whether_or_not_its_view_joins(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 24g's refuter: a phrase mapped only for a joined view made a huge one fail the call only when
    # its view joined, which tells a Held-out Set's joins by the exit code. A mapping that fails must
    # fail the call whatever joins.
    def refuse(phrase: str) -> str | None:
        if phrase == "column layout":
            raise MemoryError
        return None

    monkeypatch.setattr(score, "_subject_word", refuse)
    place = Place(tmp_path)
    place.write_keys(
        [
            key_sheet(
                "Sheet A",
                "QZ-1",
                "Invented plan",
                "first floor",
                [key_view(A_BOX, "View A", subject="column layout")],
            )
        ],
        held_out=True,
    )
    place.write_run([export_sheet("Sheet A", "QZ-1", "Invented plan", "first floor", [])])
    assert place.score() == score.BROKEN


def test_a_framed_sheet_with_no_key_views_still_counts_as_framed(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [key_sheet("Model", "QZ-1", "Invented plan", "first floor", [], frame=[0.0, 0.0, 420.0, 297.0])]
    )
    place.write_run(
        [export_sheet(None, "QZ-1", "Invented plan", "first floor", [], box=[0.0, 0.0, 420.0, 297.0])]  # type: ignore[arg-type]
    )
    assert place.score() == 0
    assert "(lower-left, translation only): 0\n" in shown(capfd)
