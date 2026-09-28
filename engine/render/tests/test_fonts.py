"""The substitution table, the shipped fonts' glyphs, nonzero winding and the font report."""

import builtins
from pathlib import Path

import numpy as np
import pytest

from engine.recognise.types import Box, SheetCandidate, SheetLocation
from engine.render import fonts
from engine.render.buffers import build
from engine.render.fixtures.artefacts import Drawing
from engine.render.fonts import Face, HowClose, report, substitute
from engine.render.fonts.glyphs import (
    FILES,
    SDF_PX_PER_UNIT,
    FontKey,
    Outline,
    outline,
    sdf,
    strokes,
    winding,
)


@pytest.mark.parametrize(
    ("name", "asked", "kind", "key", "how_close"),
    [
        ("romans.shx", "Romans", "shx", FontKey.STROKE, HowClose.SINGLE_STROKE),
        ("SIMPLEX.SHX", "Simplex", "shx", FontKey.STROKE, HowClose.SINGLE_STROKE),
        ("txt", "Txt", "shx", FontKey.STROKE, HowClose.SINGLE_STROKE),
        ("arial.ttf", "Arial", "other", FontKey.SANS, HowClose.SAME_WIDTHS),
        ("Arial", "Arial", "other", FontKey.SANS, HowClose.SAME_WIDTHS),
        ("arialbd.ttf", "Arial Bold", "other", FontKey.SANS_BOLD, HowClose.SAME_WIDTHS),
        ("Times New Roman", "Times New Roman", "other", FontKey.SERIF, HowClose.SAME_WIDTHS),
        ("swiss.ttf", "Swiss 721", "other", FontKey.SANS, HowClose.WIDER),
        ("arialn.ttf", "Arial Narrow", "other", FontKey.SANS, HowClose.WIDER),
        ("Century Gothic", "Century Gothic", "other", FontKey.SANS, HowClose.NOT_FOUND),
        ("SutonnyMJ.ttf", "SutonnyMJ", "other", FontKey.SANS, HowClose.BANGLA_ANSI),
        ("SutonnyOMJ", "SutonnyOMJ", "other", FontKey.SANS, HowClose.NOT_FOUND),
    ],
)
def test_the_table(name: str, asked: str, kind: str, key: FontKey, how_close: HowClose) -> None:
    found = substitute(name)
    assert (found.asked, found.kind, found.key, found.how_close) == (asked, kind, key, how_close)


def test_inline_bold_draws_the_bold_face() -> None:
    assert substitute("Arial", True).key is FontKey.SANS_BOLD
    assert substitute("Unknown Face", True).key is FontKey.SANS_BOLD


@pytest.mark.parametrize(
    ("name", "asked"),
    [
        ("../../etc/passwd", "Passwd"),
        ("/etc/shadow", "Shadow"),
        ("C:\\Windows\\Fonts\\arial.ttf", "Arial"),
        ("http://example.invalid/evil.ttf?x=1", "Evil"),
        ("file:///etc/passwd#frag", "Passwd"),
        ("\x00\x1b[31mred", "[31mred"),
        ("A" * 5000 + ".ttf", "A" + "a" * 63),
    ],
)
def test_a_font_name_that_is_a_path_or_url_is_only_a_name(
    name: str, asked: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    real_open = builtins.open

    def guarded(file: object, *args: object, **kwargs: object) -> object:
        path = Path(str(file)).resolve()
        assert path.is_relative_to(FILES.resolve()), f"opened {path}"
        return real_open(file, *args, **kwargs)  # type: ignore[call-overload]

    monkeypatch.setattr(builtins, "open", guarded)
    found = substitute(name)
    assert found.asked == asked
    assert "/" not in found.asked
    assert "\\" not in found.asked
    drawing = Drawing()
    drawing.text("TEXT", font=name)
    drawing.text("{\\f" + name.replace(";", "") + ";INLINE}", kind="MTEXT")
    assert report(drawing.artefact()).counts["fonts_named"] >= 1


def test_every_shipped_font_has_its_licence_beside_it() -> None:
    files = {p.name for p in FILES.iterdir()}
    assert {"OFL-Liberation.txt", "HERSHEY-NOTICE.txt"} <= files
    liberation = (FILES / "OFL-Liberation.txt").read_text()
    assert "SIL OPEN FONT LICENSE Version 1.1" in liberation
    assert "Reserved Font Name Liberation" in liberation
    hershey = (FILES / "HERSHEY-NOTICE.txt").read_text()
    assert "Dr.\n\t\t\t\tA. V. Hershey" in hershey
    assert "James Hurt" in hershey
    fonts_shipped = {p.name for p in FILES.iterdir() if p.suffix in (".ttf", ".jhf")}
    assert fonts_shipped == {
        "LiberationSans-Regular.ttf",
        "LiberationSans-Bold.ttf",
        "LiberationSerif-Regular.ttf",
        "rowmans.jhf",
    }


def test_capitals_are_one_text_unit_tall() -> None:
    for key in (FontKey.SANS, FontKey.SERIF):
        glyph = outline(key, "H")
        assert glyph is not None
        assert glyph.box is not None
        assert glyph.box[3] == pytest.approx(1.0, abs=0.01)
        assert glyph.box[1] == pytest.approx(0.0, abs=0.01)
    stroke = strokes("H")
    assert stroke is not None
    ys = np.concatenate(stroke.strokes)[:, 1]
    assert (ys.min(), ys.max()) == pytest.approx((0.0, 1.0))


def test_the_single_stroke_font_has_ascii_the_degree_sign_and_composed_symbols() -> None:
    for code in range(33, 127):
        assert strokes(chr(code)) is not None
    for char in "\u00b0\u2300\u00d8\u00b1":
        found = strokes(char)
        assert found is not None
        assert found.strokes
    assert strokes("\u0995") is None


def test_arial_widths_are_liberation_sans_widths() -> None:
    # Liberation Sans is metric-compatible with Arial: "H" is 1479 / 2048 em wide in both.
    glyph = outline(FontKey.SANS, "H")
    assert glyph is not None
    assert glyph.advance * 1409 / 2048 == pytest.approx(1479 / 2048, abs=1e-6)


def _square(x0: float, y0: float, size: float, clockwise: bool = False) -> np.ndarray:
    points = np.array([[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size]], dtype=float)
    return points[::-1] if clockwise else points


def test_overlapping_contours_fill_once_by_nonzero_winding() -> None:
    # Two overlapping squares wound the same way, as a diameter sign's O and slash overlap: the
    # overlap is inside (winding 2), never a hole as even-odd would make it.
    contours = (_square(0, 0, 2), _square(1, 1, 2))
    points = np.array([[0.5, 0.5], [1.5, 1.5], [2.5, 2.5], [3.5, 3.5]])
    assert winding(points, contours).tolist() == [1, 2, 1, 0]
    field = sdf(Outline(contours, 3.0, (0.0, 0.0, 3.0, 3.0)))
    assert field is not None
    row = field.pixels.shape[0] - 1 - int((1.5 - field.box[1]) * SDF_PX_PER_UNIT)
    column = int((1.5 - field.box[0]) * SDF_PX_PER_UNIT)
    assert field.pixels[row, column] >= 128


def test_a_hole_wound_the_other_way_stays_a_hole() -> None:
    contours = (_square(0, 0, 3), _square(1, 1, 1, clockwise=True))
    assert winding(np.array([[1.5, 1.5], [0.5, 0.5]]), contours).tolist() == [0, 1]


def test_liberations_o_has_its_counter_open() -> None:
    glyph = outline(FontKey.SANS, "O")
    assert glyph is not None
    assert glyph.box is not None
    field = sdf(glyph)
    assert field is not None
    centre = ((glyph.box[0] + glyph.box[2]) / 2, (glyph.box[1] + glyph.box[3]) / 2)
    row = field.pixels.shape[0] - 1 - int((centre[1] - field.box[1]) * SDF_PX_PER_UNIT)
    column = int((centre[0] - field.box[0]) * SDF_PX_PER_UNIT)
    assert field.pixels[row, column] < 128


def test_the_report_counts_fonts_by_style_and_inline() -> None:
    drawing = Drawing()
    drawing.text("A", font="romans.shx")
    drawing.text("B", font="romans.shx")
    drawing.text("{\\fArial|b1;BOLD} plain", kind="MTEXT", font="swiss.ttf")
    drawing.text("\u0995", font="Nikosh.ttf")  # Bangla in Unicode: no shipped font has it
    drawing.text("X", kind="MTEXT", height=None, font="arial.ttf", owner=drawing.block("EMPTY"))
    found = report(drawing.artefact())

    rows = {u.substitute.asked: (u.texts, u.substitute.drawn_with) for u in found.fonts}
    assert rows == {
        "Romans": (2, "Hershey Simplex"),
        "Arial": (2, "Liberation Sans"),  # one inline in bold, one by its style
        "Swiss 721": (1, "Liberation Sans"),
        "Nikosh": (1, "Liberation Sans"),
    }
    assert found.counts["fonts_named"] == 4
    assert found.counts["single_stroke"] == 1
    assert found.counts["texts"] == 5
    assert found.counts["texts_height_defaulted"] == 1
    assert found.counts["texts_glyphs_missing"] == 1
    assert [m["code"] for m in found.messages()] == [
        "engine.font_report.summary",
        "engine.font_report.height_defaulted",
        "engine.font_report.glyphs_missing",
    ]


def test_the_harness_reads_the_reports_counts() -> None:
    from engine.export import to_json
    from engine.harness import _counts

    drawing = Drawing()
    drawing.text("A", font="romans.shx")
    counts = _counts(to_json(fonts.report(drawing.artefact())))
    assert counts is not None
    assert counts["fonts_named"] == 1


def test_a_font_named_by_a_style_and_inline_in_bold_is_one_font_with_its_faces() -> None:
    """The design gate's item: Arial named by a style and by `{\\fArial|b1;…}` showed twice and the
    summary said "2 fonts named". A row is the name the drawing asks for; the face is its detail."""
    drawing = Drawing()
    drawing.text("PLAIN", font="arial.ttf")
    drawing.text("{\\fArial|b1;BOLD} {\\fARIAL|i1;SLANTED}", kind="MTEXT", font="arial.ttf")
    found = report(drawing.artefact())

    assert [(u.substitute.asked, u.texts, u.faces) for u in found.fonts] == [
        ("Arial", 2, (Face.REGULAR, Face.BOLD, Face.ITALIC))
    ]
    assert found.counts["fonts_named"] == 1
    assert found.messages()[0] == {"code": "engine.font_report.summary", "params": {"fonts": 1}}
    assert found.fonts[0].to_json()["faces"] == ["regular", "bold", "italic"]


def test_a_sheets_font_rows_are_grouped_as_the_reports_are() -> None:
    drawing = Drawing()
    drawing.text("PLAIN", (10.0, 10.0, 0.0), font="arial.ttf")
    drawing.text("{\\fArial|b1;BOLD}", (10.0, 30.0, 0.0), kind="MTEXT", font="arial.ttf")
    built = build(drawing.artefact(), SheetCandidate(SheetLocation(box=Box(0, 0, 297, 210))))
    rows = [
        (built.strings[r["asked"]], built.strings[r["drawn_with"]], int(r["texts"])) for r in built.fonts
    ]
    assert rows == [("Arial", "Liberation Sans", 2)]


@pytest.mark.parametrize(
    ("name", "shown"),
    [
        ("sutonnymj.ttf", "SutonnyMJ"),
        ("SUTONNYMJ.TTF", "SutonnyMJ"),
        ("SutonnyMJ.ttf", "SutonnyMJ"),
        ("nikosh.ttf", "Nikosh"),
        ("kalpurush ansi.ttf", "Kalpurush Ansi"),
        ("MyCompanyFont.ttf", "MyCompanyFont"),  # mixed case is the drawing's own
        ("ROMANS.SHX", "Romans"),
    ],
)
def test_a_name_typed_in_one_case_is_capitalised_as_its_family_is_written(name: str, shown: str) -> None:
    assert substitute(name).asked == shown
