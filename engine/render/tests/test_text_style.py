"""#88: a text is drawn at its style's width factor and oblique angle (ticket 18 measured the cost:
on a real structural set, 18 % of the texts are MTEXT in a style of width 0.8, drawn at 1).

Synthetic drawings built in code (engine/render/fixtures/artefacts.py): a condensed style (0.7) and an
oblique one (15°), each compared with the same text in an upright style of width 1.
"""

import math

import numpy as np
import pytest

from engine.recognise.types import Box, SheetCandidate, SheetLocation
from engine.render import buffers
from engine.render._text import lay_out
from engine.render.fixtures.artefacts import Drawing

WORD = "COLUMN SCHEDULE"


def _glyph_box(built: buffers.SheetBuffers) -> tuple[float, float, float, float]:
    rects = built.atlas_glyphs[built.glyphs["glyph"]]
    g = built.glyphs
    xs = [g["ox"] + rects[a] * g["xx"] + rects[b] * g["yx"] for a in ("x0", "x1") for b in ("y0", "y1")]
    ys = [g["oy"] + rects[a] * g["xy"] + rects[b] * g["yy"] for a in ("x0", "x1") for b in ("y0", "y1")]
    x, y = np.concatenate(xs), np.concatenate(ys)
    return float(x.min()), float(y.min()), float(x.max()), float(y.max())


def _drawn(kind: str, **style: float | None) -> buffers.SheetBuffers:
    d = Drawing()
    handle = d.style("S", **style)  # type: ignore[arg-type]
    d.text(WORD, (100.0, 100.0, 0.0), kind=kind, height=10.0, style_handle=handle)
    sheet = SheetCandidate(SheetLocation(box=Box(0.0, 0.0, 420.0, 297.0)))
    return buffers.build(d.artefact(), sheet)


def _width(built: buffers.SheetBuffers) -> float:
    x0, _, x1, _ = _glyph_box(built)
    return x1 - x0


def test_an_mtext_is_drawn_at_its_styles_width_factor() -> None:
    upright, narrow = _drawn("MTEXT", width_factor=1.0), _drawn("MTEXT", width_factor=0.7)

    assert _width(narrow) == pytest.approx(0.7 * _width(upright), rel=0.03)


@pytest.mark.parametrize("kind", ["MTEXT", "TEXT"])
def test_a_text_leans_by_its_styles_oblique_angle(kind: str) -> None:
    upright = _drawn(kind, oblique_radians=0.0)
    leaning = _drawn(kind, oblique_radians=math.radians(15))

    assert np.allclose(upright.glyphs["yx"], 0.0, atol=1e-6)
    assert np.allclose(
        leaning.glyphs["yx"] / leaning.glyphs["yy"], math.tan(math.radians(15)), atol=1e-3
    )


@pytest.mark.parametrize("bad", [None, float("nan"), 0.0, -2.0])
def test_a_width_factor_that_is_no_usable_number_is_drawn_as_1(bad: float | None) -> None:
    assert _width(_drawn("MTEXT", width_factor=bad)) == pytest.approx(
        _width(_drawn("MTEXT", width_factor=1.0)), rel=1e-6
    )


def test_an_inline_width_and_oblique_win_over_the_styles() -> None:
    d = Drawing()
    narrow = d.style("S", width_factor=0.5, oblique_radians=math.radians(30))
    d.text("\\W1;\\Q0.0001;" + WORD, (0.0, 0.0, 0.0), kind="MTEXT", height=1.0, style_handle=narrow)
    (text,) = list(d.artefact().entities.values())

    laid = lay_out(text, 1.0, d.styles[narrow])  # type: ignore[arg-type]

    assert all(g.sx == pytest.approx(1.0) for g in laid.glyphs)
    assert all(abs(g.shear) < 1e-3 for g in laid.glyphs)


def test_an_inline_q0_draws_upright_in_an_oblique_style() -> None:
    """The review of 18, round 1: `\\Q0;` in a 30° style still leaned 30°, since 0 read as unstated."""
    d = Drawing()
    slanted = d.style("S", oblique_radians=math.radians(30))
    d.text("\\Q0;" + WORD, (0.0, 0.0, 0.0), kind="MTEXT", height=1.0, style_handle=slanted)
    (text,) = list(d.artefact().entities.values())

    laid = lay_out(text, 1.0, d.styles[slanted])  # type: ignore[arg-type]

    assert laid.glyphs
    assert all(g.shear == 0.0 for g in laid.glyphs)
