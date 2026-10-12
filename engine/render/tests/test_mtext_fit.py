"""S24-A4: an MTEXT wraps where AutoCAD wrapped it, stays inside its box, and spaces its lines by its own
line spacing style and factor; every other text is laid out as before.

The G1 walk found notes printed over each other: the substitute fonts measure wider than the faces
they stand for, the reference rectangles hug AutoCAD's lines, so a line AutoCAD kept whole wrapped
and its extra line landed on the text below. Synthetic texts built in code (the repo is public); each
"AutoCAD measure" is set from the substitute's own width, as a narrower face would give it.
"""

import itertools
import math

import pytest

from engine.read.artefact import Text
from engine.render._text import LINE_SPACING, MAX_FIT_CHARACTERS, MIN_SQUEEZE, Laid, lay_out
from engine.render.fixtures.artefacts import Drawing
from engine.render.fonts.glyphs import outline

NOTE = "PROVIDE TOP BARS AT EVERY SUPPORT"
CONDENSED = 0.78
"""A condensed face's width against its substitute's (both real sets: 0.73 to 0.80)."""


def _mtext(text: str = NOTE, **options: object) -> Text:
    d = Drawing()
    handle = d.text(text, kind="MTEXT", height=1.0, **options)  # type: ignore[arg-type]
    found = d.entities[handle]
    assert isinstance(found, Text)
    return found


def _lines(laid: Laid) -> list[float]:
    """The baselines drawn, top first."""
    found = {round(g.v, 6) for g in laid.glyphs}
    found |= {round(float(s[:, 1].min()), 6) for s in laid.strokes} if not laid.glyphs else set()
    return sorted(found, reverse=True)


def _right(laid: Laid) -> float:
    """The right edge of the widest line, in text units, from each glyph's drawn advance."""
    edges = [0.0]
    for g in laid.glyphs:
        glyph = outline(g.key, g.char) if g.char is not None else None
        edges.append(g.u + g.sx * (glyph.advance if glyph is not None else 0.6))
    for s in laid.strokes:
        edges.append(float(s[:, 0].max()))
    return max(edges)


def _natural(text: str = NOTE, font: str = "arialn.ttf") -> float:
    """The text's width laid out on one line with no fit: the substitute's own width."""
    return _right(lay_out(_mtext(text, font=font), 1.0))


def test_with_no_measure_an_mtext_wraps_at_its_reference_width() -> None:
    width = _natural()

    laid = lay_out(_mtext(font="arialn.ttf", width=width * 0.6), 1.0)

    assert len(_lines(laid)) == 2
    assert _right(laid) <= width * 0.6


def test_a_line_autocad_kept_whole_is_drawn_whole_inside_its_box() -> None:
    """The walk's case: AutoCAD drew the note on one line 0.78 of the substitute's width, and its
    reference width is 1 % wider than that line, so the substitute's widths would wrap it."""
    measured = _natural() * CONDENSED
    mtext = _mtext(font="arialn.ttf", width=measured * 1.01, extents_width=measured, extents_height=1.03)

    laid = lay_out(mtext, 1.0)

    assert len(_lines(laid)) == 1
    assert _right(laid) <= measured * 1.01
    assert _right(laid) == pytest.approx(measured, rel=0.02)


def test_lines_autocad_wrapped_stay_wrapped_where_it_wrapped_them() -> None:
    first, second = "MINIMUM COVER", "TO MAIN BARS"  # no gentler squeeze meets AutoCAD's width
    measured = _natural(first) * CONDENSED
    mtext = _mtext(
        f"{first} {second}",
        font="arialn.ttf",
        width=measured * 1.01,
        extents_width=measured,
        extents_height=1.03 + LINE_SPACING,
    )

    laid = lay_out(mtext, 1.0)

    lines = _lines(laid)
    assert len(lines) == 2
    assert lines[0] - lines[1] == pytest.approx(LINE_SPACING)
    assert _right(laid) == pytest.approx(measured, rel=0.02)
    on_first = [g.char for g in laid.glyphs if round(g.v, 6) == lines[0]]
    assert "".join(c for c in on_first if c is not None) == first.replace(" ", "")


def test_of_two_wraps_meeting_autocads_measures_the_gentler_squeeze_wins() -> None:
    """A word moved between lines can meet AutoCAD's width and height at two squeezes: nothing in the
    file tells them apart, and the gentler one is the Plot's (three headings of a real set)."""
    first = "PROVIDE TOP BARS AT"  # then "EVERY SUPPORT"; at a gentler squeeze "PROVIDE TOP BARS"
    measured = _natural(first) * CONDENSED
    mtext = _mtext(
        font="arialn.ttf",
        width=measured * 1.01,
        extents_width=measured,
        extents_height=1.03 + LINE_SPACING,
    )

    laid = lay_out(mtext, 1.0)

    lines = _lines(laid)
    assert len(lines) == 2
    on_first = [g.char for g in laid.glyphs if round(g.v, 6) == lines[0]]
    assert "".join(c for c in on_first if c is not None) == "PROVIDETOPBARS"
    assert _right(laid) == pytest.approx(measured, rel=0.02)


def test_with_no_stored_height_the_squeeze_nearest_autocads_width_wins() -> None:
    """Two words AutoCAD kept on one line: wrapped, each line is half its width; at its squeeze the
    one line is its width."""
    text = "SUPPORT BARS"
    measured = _natural(text) * CONDENSED

    laid = lay_out(_mtext(text, font="arialn.ttf", width=measured * 1.01, extents_width=measured), 1.0)

    assert len(_lines(laid)) == 1
    assert _right(laid) == pytest.approx(measured, rel=0.02)


def test_with_no_stored_height_a_tie_goes_to_the_layout_without_a_fit() -> None:
    """Without AutoCAD's height, a wrap whose widest line is within the tolerance of AutoCAD's width
    cannot be told from AutoCAD's own: the text is laid out as without a fit."""
    natural = _natural(font="arial.ttf")
    plain = lay_out(_mtext(font="arial.ttf", width=natural * 0.6), 1.0)
    widest = _right(plain)

    laid = lay_out(_mtext(font="arial.ttf", width=natural * 0.6, extents_width=widest * 0.98), 1.0)

    assert laid.glyphs == plain.glyphs


def test_an_mtext_with_no_reference_width_is_drawn_at_autocads_width() -> None:
    measured = _natural() * CONDENSED

    laid = lay_out(_mtext(font="arialn.ttf", extents_width=measured, extents_height=1.03), 1.0)

    assert len(_lines(laid)) == 1
    assert _right(laid) == pytest.approx(measured, rel=0.02)


@pytest.mark.parametrize("text", ["A", "NOTE", NOTE, f"{NOTE} {NOTE} {NOTE}", "1/2 SEE DETAIL 3"])
@pytest.mark.parametrize("ratio", [0.62, 0.7, 0.78, 0.85, 0.97])
@pytest.mark.parametrize("box", [0.5, 1.0, 1.01, 1.3])
def test_text_stays_inside_its_box_for_any_measure(text: str, ratio: float, box: float) -> None:
    """Whatever AutoCAD measured within the squeeze allowed (down to 0.6), every line ends inside the
    box AutoCAD measured, within the fit's 5 %; a reference width narrower than it (a word longer
    than the width overflows it in AutoCAD too) changes only where lines break."""
    measured = _natural(text) * ratio
    assert ratio >= MIN_SQUEEZE

    laid = lay_out(_mtext(text, font="arialn.ttf", width=measured * box, extents_width=measured), 1.0)

    assert _right(laid) <= measured * 1.05 + 1e-9


def test_text_within_the_tolerance_of_autocads_measure_is_laid_out_unchanged() -> None:
    """Arial's substitute measures 4.4 % over AutoCAD's own width (both real sets): drawn as it was."""
    natural = _natural(font="arial.ttf")
    plain = lay_out(_mtext(font="arial.ttf", width=natural * 1.01), 1.0)

    fitted = lay_out(
        _mtext(
            font="arial.ttf",
            width=natural * 1.01,
            extents_width=natural / 1.044,
            extents_height=1.03,
        ),
        1.0,
    )

    assert fitted.glyphs == plain.glyphs


def test_a_measure_needing_more_than_the_least_squeeze_is_not_taken() -> None:
    natural = _natural()
    plain = lay_out(_mtext(font="arialn.ttf"), 1.0)

    laid = lay_out(_mtext(font="arialn.ttf", extents_width=natural * 0.3, extents_height=1.03), 1.0)

    assert laid.glyphs == plain.glyphs


def test_single_stroke_text_is_never_squeezed_to_autocads_measure_alone() -> None:
    """AutoCAD's measure of SHX text runs 12 % under its Plot, which the Hershey substitute matches
    (docs/knowledge/lessons.md): with no reference width, it is drawn as it was."""
    plain = lay_out(_mtext(font="romans.shx"), 1.0)
    natural = _right(plain)

    laid = lay_out(_mtext(font="romans.shx", extents_width=natural * 0.88, extents_height=1.2), 1.0)

    assert [s.tolist() for s in laid.strokes] == [s.tolist() for s in plain.strokes]


def test_single_stroke_text_autocad_kept_whole_fits_its_reference_width() -> None:
    natural = _right(lay_out(_mtext(font="romans.shx"), 1.0))
    mtext = _mtext(
        font="romans.shx", width=natural * 0.9, extents_width=natural * 0.88, extents_height=1.2
    )

    laid = lay_out(mtext, 1.0)

    lowest = min(float(s[:, 1].min()) for s in laid.strokes)
    assert lowest > -1.0 - 0.5  # one line: nothing drawn a line pitch below the first baseline
    assert _right(laid) <= natural * 0.9 * 1.05


def test_an_mtext_longer_than_the_fit_bound_is_laid_out_without_a_fit() -> None:
    """Each squeeze wraps the text again: a hostile file's long MTEXT costs one layout, as before."""
    text = " ".join(["BAR"] * (MAX_FIT_CHARACTERS // 4 + 1))
    width = _natural("BAR BAR BAR")
    plain = lay_out(_mtext(text, font="arialn.ttf", width=width), 1.0)

    laid = lay_out(_mtext(text, font="arialn.ttf", width=width, extents_width=width * CONDENSED), 1.0)

    assert laid.glyphs == plain.glyphs


def test_line_breaks_count_toward_the_fit_bound() -> None:
    """Review of S24-A4: an MTEXT of line breaks alone has no characters but costs a wrap per line."""
    text = "\\P" * MAX_FIT_CHARACTERS
    plain = lay_out(_mtext(text + "BAR", font="arialn.ttf", width=1.0), 1.0)

    laid = lay_out(_mtext(text + "BAR", font="arialn.ttf", width=1.0, extents_width=0.5), 1.0)

    assert laid.glyphs == plain.glyphs


def test_a_line_pitch_past_any_float_keeps_every_baseline_finite() -> None:
    """Review of S24-A4: a huge inline height at the largest factor overflowed the next baseline."""
    mtext = _mtext("\\H300000000000;A\\PB", line_spacing_style=1, line_spacing_factor=4.0)

    laid = lay_out(mtext, 1e-296)

    assert all(math.isfinite(g.v) and math.isfinite(g.u) for g in laid.glyphs)


def test_a_text_is_laid_out_without_a_fit() -> None:
    d = Drawing()
    handle = d.text(NOTE, kind="TEXT", height=1.0, font="arialn.ttf", extents_width=5.0)
    text = d.entities[handle]
    assert isinstance(text, Text)
    plain = Drawing()
    plain_text = plain.entities[plain.text(NOTE, kind="TEXT", height=1.0, font="arialn.ttf")]
    assert isinstance(plain_text, Text)

    assert lay_out(text, 1.0).glyphs == lay_out(plain_text, 1.0).glyphs


# Line spacing --------------------------------------------------------------------------------------

THREE = "ONE\\PTWO\\P{\\H2x;THREE}"


def _gaps(**options: object) -> list[float]:
    lines = _lines(lay_out(_mtext(THREE, **options), 1.0))
    return [a - b for a, b in itertools.pairwise(lines)]


def test_single_spacing_is_five_thirds_of_each_lines_tallest_run() -> None:
    assert _gaps() == pytest.approx([LINE_SPACING, 2 * LINE_SPACING])


@pytest.mark.parametrize("factor", [0.25, 0.5, 1.5, 4.0])
def test_at_least_spacing_is_the_factor_times_each_lines_single_spacing(factor: float) -> None:
    gaps = _gaps(line_spacing_style=1, line_spacing_factor=factor)

    assert gaps == pytest.approx([factor * LINE_SPACING, factor * 2 * LINE_SPACING])


@pytest.mark.parametrize("factor", [0.5, 1.0, 2.5])
def test_exactly_spacing_is_the_factor_times_the_mtexts_single_spacing_whatever_its_runs(
    factor: float,
) -> None:
    gaps = _gaps(line_spacing_style=2, line_spacing_factor=factor)

    assert gaps == pytest.approx([factor * LINE_SPACING, factor * LINE_SPACING])


@pytest.mark.parametrize("style", [None, 0, 3])
def test_a_style_autocad_does_not_have_reads_as_at_least(style: int | None) -> None:
    gaps = _gaps(line_spacing_style=style, line_spacing_factor=2.0)

    assert gaps == pytest.approx([2.0 * LINE_SPACING, 4.0 * LINE_SPACING])


@pytest.mark.parametrize("factor", [None, 0.1, 4.5, -1.0, math.nan, math.inf])
@pytest.mark.parametrize("style", [1, 2])
def test_a_factor_autocad_does_not_allow_reads_as_1(style: int, factor: float | None) -> None:
    gaps = _gaps(line_spacing_style=style, line_spacing_factor=factor)

    expected = [LINE_SPACING, LINE_SPACING] if style == 2 else [LINE_SPACING, 2 * LINE_SPACING]
    assert gaps == pytest.approx(expected)
