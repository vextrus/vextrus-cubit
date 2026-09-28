"""The joining rule: glyphs in stream order become text items; each threshold tested either side."""

import itertools
import math

import pytest

from engine.read.pdf.text import (
    ACROSS,
    ANGLE_TOLERANCE,
    GAP_AFTER,
    GAP_BEFORE,
    SIZE_TOLERANCE,
    SPACE_GAP,
    UNKNOWN,
    Glyph,
    runs,
)

_shows = itertools.count(100)
"""A glyph is its own show operator unless a test says otherwise."""
EM = 10.0
WIDTH = 6.0  # each glyph advances 0.6 em


def glyph(
    text: str,
    x: float,
    y: float = 0.0,
    *,
    angle: float = 0.0,
    size: float = EM,
    mirrored: bool = False,
    hidden: bool = False,
    index: int | None = None,
    squeeze: float = 1.0,
) -> Glyph:
    """A glyph `size` high, advancing 0.6 em; `squeeze` narrows it as a width factor does."""
    cos, sin = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    axis = (-cos, -sin) if mirrored else (cos, sin)
    up = (-sin * size, cos * size)
    advance = (axis[0] * WIDTH * squeeze * size / EM, axis[1] * WIDTH * squeeze * size / EM)
    return Glyph(
        text=text,
        origin=(x, y),
        axis=axis,
        advance=advance,
        up=up,
        em=size * squeeze,
        box=(min(x, x + advance[0]), y, max(x, x + advance[0]), y + size),
        index=next(_shows) if index is None else index,
        hidden=hidden,
        font="F",
    )


def along(glyphs: str, *, gap: float = 0.0, **options: object) -> list[Glyph]:
    """The glyphs of `glyphs` one after another, each `gap` ems after the last one's advance."""
    return [glyph(c, i * (WIDTH + gap * EM), index=i, **options) for i, c in enumerate(glyphs)]  # type: ignore[arg-type]


def shown_together(glyphs: str, gaps: dict[int, float], squeeze: float = 1.0) -> list[Glyph]:
    """The glyphs of one show operator; `gaps[i]` ems (as the line is scaled) before glyph i."""
    found, x = [], 0.0
    for i, c in enumerate(glyphs):
        x += gaps.get(i, 0.0) * EM * squeeze
        found.append(glyph(c, x, index=7, squeeze=squeeze))
        x += WIDTH * squeeze
    return found


def texts(glyphs: list[Glyph]) -> list[str]:
    return [run.text for run in runs(glyphs)]


def test_glyphs_placed_one_after_another_are_one_item() -> None:
    [run] = runs(along("S-101"))

    assert (run.text, run.index, run.size, run.angle, run.mirrored) == ("S-101", 0, EM, 0.0, False)
    assert run.box == (0.0, 0.0, 30.0, 10.0)


def test_stream_order_is_kept_never_sorted_by_position() -> None:
    # A mirrored text advances right to left: in stream order it reads right way round.
    glyphs = [glyph(c, 100 - i * WIDTH, mirrored=True) for i, c in enumerate("NOTE")]

    [run] = runs(glyphs)

    assert (run.text, run.mirrored, run.angle) == ("NOTE", True, 180.0)


def test_a_turned_text_is_one_item_at_its_angle() -> None:
    step = WIDTH
    glyphs = [glyph(c, 0, -i * step, angle=270) for i, c in enumerate("BEAM")]

    [run] = runs(glyphs)

    assert (run.text, run.angle) == ("BEAM", 270.0)


@pytest.mark.parametrize(
    ("gap", "joined"),
    [
        (GAP_AFTER - 0.01, True),
        (GAP_AFTER + 0.01, False),
        (GAP_BEFORE + 0.01, True),
        (GAP_BEFORE - 0.01, False),
    ],
)
def test_the_next_glyph_starts_within_its_window_along_the_line(gap: float, joined: bool) -> None:
    assert len(texts(along("AB", gap=gap))) == (1 if joined else 2)


@pytest.mark.parametrize(("offset", "joined"), [(ACROSS - 0.01, True), (ACROSS + 0.01, False)])
def test_the_next_glyph_sits_on_the_line(offset: float, joined: bool) -> None:
    glyphs = [glyph("A", 0), glyph("B", WIDTH, offset * EM)]

    assert len(texts(glyphs)) == (1 if joined else 2)


@pytest.mark.parametrize(
    ("scale", "joined"), [(1 + SIZE_TOLERANCE - 0.001, True), (1 + SIZE_TOLERANCE + 0.001, False)]
)
def test_one_item_keeps_one_size(scale: float, joined: bool) -> None:
    glyphs = [glyph("A", 0), glyph("B", WIDTH, size=EM * scale)]

    assert len(texts(glyphs)) == (1 if joined else 2)


@pytest.mark.parametrize(
    ("turn", "joined"), [(ANGLE_TOLERANCE - 0.001, True), (ANGLE_TOLERANCE + 0.001, False)]
)
def test_one_item_keeps_one_direction(turn: float, joined: bool) -> None:
    glyphs = [glyph("A", 0), glyph("B", WIDTH, angle=math.degrees(turn))]

    assert len(texts(glyphs)) == (1 if joined else 2)


def test_a_mirrored_glyph_or_a_hidden_one_starts_a_new_item() -> None:
    assert texts([glyph("A", 0), glyph("B", WIDTH, mirrored=True)]) == ["A", "B"]
    assert texts([glyph("A", 0), glyph("B", WIDTH, hidden=True)]) == ["A", "B"]


@pytest.mark.parametrize(("gap", "text"), [(SPACE_GAP - 0.01, "AB"), (SPACE_GAP + 0.01, "A B")])
def test_a_gap_of_a_quarter_em_is_a_space(gap: float, text: str) -> None:
    assert texts(along("AB", gap=gap)) == [text]


def test_a_drawn_space_is_not_doubled() -> None:
    assert texts(along("A B", gap=SPACE_GAP + 0.1)) == ["A B"]


def test_an_item_of_spaces_or_unknown_letters_alone_is_dropped() -> None:
    assert texts(along("  ")) == []
    assert texts(along(UNKNOWN * 3)) == []
    assert texts(along("A" + UNKNOWN)) == ["A" + UNKNOWN]


def test_a_glyph_with_no_direction_stands_alone() -> None:
    broken = Glyph("B", (WIDTH, 0), (0.0, 0.0), (0.0, 0.0), (0.0, EM), EM, (0, 0, 0, 0), 1, False, "F")

    assert texts([glyph("A", 0), broken, glyph("C", 2 * WIDTH)]) == ["A", "B", "C"]


def test_one_show_operator_is_one_item_however_wide_its_gaps() -> None:
    # `[(LEVEL) -3000 (+3.00)] TJ`: a gap of three ems inside one string is one space.
    assert texts(shown_together("LEVEL+3.00", {5: 3.0})) == ["LEVEL +3.00"]


@pytest.mark.parametrize(("squeeze", "text"), [(1.0, "AB CD"), (0.5, "AB CD"), (0.8, "AB CD")])
def test_a_word_gap_reads_the_same_in_narrow_text(squeeze: float, text: str) -> None:
    # `80 Tz [(AB) -300 (CD)] TJ`: the gap is 0.3 em of the line as it is scaled.
    assert texts(shown_together("ABCD", {2: 0.3}, squeeze=squeeze)) == [text]


def test_a_gap_short_of_a_space_in_narrow_text_is_no_space() -> None:
    assert texts(shown_together("ABCD", {2: 0.2}, squeeze=0.5)) == ["ABCD"]
