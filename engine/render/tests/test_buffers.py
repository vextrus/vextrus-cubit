"""Per-sheet buffers: what they hold, the published format, and a hostile buffer refused."""

import contextlib
import math
import random
import struct

import numpy as np
import pytest

from engine.recognise.types import Box, SheetCandidate, SheetLocation
from engine.render.buffers import HEADER, SECTION, BufferError, Limits, PaperSource, SheetBuffers, build
from engine.render.fixtures.artefacts import PAPER, Drawing


def model_sheet(x0: float, y0: float, x1: float, y1: float) -> SheetCandidate:
    return SheetCandidate(SheetLocation(box=Box(x0, y0, x1, y1)))


def _segments(built: SheetBuffers) -> np.ndarray:
    lines = built.lines
    return np.column_stack([lines["x0"], lines["y0"], lines["x1"], lines["y1"]])


def _strings_of(built: SheetBuffers, index: int, field: str) -> str:
    return built.strings[int(built.primitives[index][field])]


# What a sheet holds -----------------------------------------------------------------------------


def test_coordinates_are_paper_mm_from_the_sheets_lower_left_corner() -> None:
    drawing = Drawing(insunits=4)
    drawing.line((100_010, 50_020), (100_110, 50_020))
    built = build(drawing.artefact(), model_sheet(100_000, 50_000, 100_297, 50_210))  # A4 at 1:1

    assert built.paper.source == PaperSource.STANDARD
    assert (built.paper.width_mm, built.paper.height_mm) == (297.0, 210.0)
    np.testing.assert_allclose(_segments(built), [[10, 20, 110, 20]], atol=1e-3)


def test_a_standard_sheet_at_a_standard_scale_gives_its_millimetres() -> None:
    drawing = Drawing(insunits=1)  # inches, an A1 at 1:96 (the research's plan sheet)
    width, height = 841 * 96 / 25.4, 594 * 96 / 25.4
    drawing.line((0, 0), (96 / 25.4 * 100, 0))  # 100 mm on paper
    built = build(drawing.artefact(), model_sheet(0, 0, width, height))

    assert built.paper.source == PaperSource.STANDARD
    assert built.paper.width_mm == pytest.approx(841.0)
    assert float(built.lines["x1"][0]) == pytest.approx(100.0, abs=1e-3)


def test_an_unrecognised_box_is_assumed_a1_wide_and_says_so() -> None:
    built = build(Drawing().artefact(), model_sheet(0, 0, 1000, 700))
    assert built.paper.source == PaperSource.ASSUMED
    assert built.paper.width_mm == pytest.approx(841.0)


def test_what_crosses_the_box_is_cut_to_it_and_what_is_outside_is_left_out() -> None:
    drawing = Drawing()
    drawing.line((-50, 100), (100, 100))
    drawing.line((500, 500), (600, 600))
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    np.testing.assert_allclose(_segments(built), [[0, 100, 100, 100]], atol=1e-3)


def test_every_primitive_carries_its_handles_and_insert_chain() -> None:
    drawing = Drawing()
    pile = drawing.block("PILE")
    line = drawing.line((1, 0), (2, 0), owner=pile, layer="PILES")
    cap = drawing.block("CAP")
    inner = drawing.insert(pile, (10, 0, 0), owner=cap)
    top = drawing.insert(cap, (100, 100, 0), extrusion=(0.0, 0.0, -1.0))
    built = build(drawing.artefact(), model_sheet(-297, 0, 0, 210))

    assert len(built.primitives) == 1
    assert _strings_of(built, 0, "source") == line
    assert _strings_of(built, 0, "type") == "LINE"
    assert _strings_of(built, 0, "layer") == "PILES"
    assert _strings_of(built, 0, "top") == top
    chain = built.chains[int(built.primitives[0]["chain"])]
    assert [built.strings[i] for i in chain] == [top, inner]
    # The mirrored cap puts the line at x = -(100 + 10 + 1) .. -(100 + 10 + 2), from the box's left.
    np.testing.assert_allclose(sorted(_segments(built)[0][[0, 2]]), [297 - 112, 297 - 111], atol=1e-3)


def test_thin_lines_carry_their_lineweight_and_wide_polylines_are_quads() -> None:
    drawing = Drawing()
    drawing.line((0, 10), (100, 10), lineweight=35)
    drawing.line((0, 20), (100, 20))  # its lineweight is its layer's, which the artefact lacks
    drawing.entity("LWPOLYLINE", {"points": [[0, 50, 4, 4, 0], [100, 50, 4, 4, 0]], "flags": 0})
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))

    assert sorted(built.lines["weight"].tolist()) == pytest.approx([0.25, 0.35])
    assert built.stats["lineweight_default"] == 2  # the plain line, and the wide polyline
    assert len(built.triangles) == 2
    ys = np.concatenate([built.triangles[k] for k in ("y0", "y1", "y2")])
    assert (ys.min(), ys.max()) == pytest.approx((48.0, 52.0))


def test_a_solid_hatch_fills_and_its_hole_stays_empty() -> None:
    outer = [[0, 0, 0], [100, 0, 0], [100, 100, 0], [0, 100, 0]]
    hole = [[40, 40, 0], [60, 40, 0], [60, 60, 0], [40, 60, 0]]
    drawing = Drawing()
    drawing.entity("HATCH", {"solid_fill": 1, "paths": [
        {"type": "polyline", "flags": 1, "closed": True, "vertices": outer},
        {"type": "polyline", "flags": 16, "closed": True, "vertices": hole},
    ]})  # fmt: skip
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))

    t = built.triangles
    xs = np.column_stack([t["x0"], t["x1"], t["x2"]]).astype(float)
    ys = np.column_stack([t["y0"], t["y1"], t["y2"]]).astype(float)
    area = 0.5 * np.abs(
        (xs[:, 1] - xs[:, 0]) * (ys[:, 2] - ys[:, 0]) - (xs[:, 2] - xs[:, 0]) * (ys[:, 1] - ys[:, 0])
    )
    assert area.sum() == pytest.approx(100 * 100 - 20 * 20)


def test_a_pattern_hatch_draws_lines_from_the_standard_table_and_an_unknown_one_is_counted() -> None:
    square = [[0, 0, 0], [50, 0, 0], [50, 50, 0], [0, 50, 0]]
    path = [{"type": "polyline", "flags": 1, "closed": True, "vertices": square}]
    drawing = Drawing()
    drawing.entity(
        "HATCH",
        {
            "solid_fill": 0,
            "pattern_name": "ANSI31",
            "pattern_scale": 1.0,
            "pattern_angle": 0.0,
            "paths": path,
        },
    )
    drawing.entity("HATCH", {"solid_fill": 0, "pattern_name": "NOT-A-PATTERN", "paths": path})
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))

    assert len(built.lines) > 10
    segments = _segments(built)
    angles = (
        np.degrees(np.arctan2(segments[:, 3] - segments[:, 1], segments[:, 2] - segments[:, 0])) % 180
    )
    assert np.allclose(angles, 45.0, atol=0.01)
    assert built.stats["hatch_pattern_unknown"] == 1


def test_a_dashed_linetype_is_baked_in_and_one_too_fine_is_drawn_continuous() -> None:
    drawing = Drawing(insunits=4)
    drawing.line((0, 10), (200, 10), linetype="DASHED")
    drawing.line((0, 20), (200, 20), linetype="DASHED", ltscale=0.001)
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))

    dashed = built.lines[built.lines["y0"] == 10]
    assert len(dashed) > 5
    assert len(built.lines[built.lines["y0"] == 20]) == 1
    assert built.stats["linetype_too_fine"] == 1


def test_true_type_text_is_glyphs_and_shx_text_is_lines() -> None:
    drawing = Drawing()
    drawing.text("AB", (10, 10, 0), height=5, font="arial.ttf")
    drawing.text("AB", (10, 50, 0), height=5, font="romans.shx")
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))

    assert len(built.glyphs) == 2
    assert len(built.atlas_glyphs) == 2
    assert len(built.lines) > 4
    assert {built.strings[int(f["asked"])] for f in built.fonts} == {"Arial", "Romans"}
    # A glyph's y axis is one text height tall: 5 mm.
    assert float(np.hypot(built.glyphs["yx"][0], built.glyphs["yy"][0])) == pytest.approx(5.0, rel=1e-5)


def test_the_atlas_holds_each_glyph_once() -> None:
    drawing = Drawing()
    drawing.text("AAAA", (10, 10, 0), font="arial.ttf")
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    assert len(built.glyphs) == 4
    assert len(built.atlas_glyphs) == 1


def test_a_dimension_draws_its_block_and_its_parts_carry_it() -> None:
    drawing = Drawing()
    geometry = drawing.block("*D1")
    part = drawing.line((0, 0), (50, 0), owner=geometry)
    dimension = drawing.entity("DIMENSION", {"geometry": "*D1"})
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))

    assert len(built.lines) == 1
    assert _strings_of(built, 0, "source") == part
    assert _strings_of(built, 0, "type") == "DIMENSION"
    assert _strings_of(built, 0, "top") == dimension


def test_a_layout_sheet_draws_model_space_through_its_viewports() -> None:
    drawing = Drawing(insunits=4)
    drawing.line((1000, 1000), (2000, 1000))  # model space, 1 m long
    drawing.entity(
        "LWPOLYLINE",
        {
            "points": [[0, 0, 0, 0, 0], [420, 0, 0, 0, 0], [420, 297, 0, 0, 0], [0, 297, 0, 0, 0]],
            "flags": 1,
        },
        owner=PAPER,
    )
    drawing.entity(
        "VIEWPORT",
        {
            "center": [210.0, 148.5, 0.0],
            "width": 420.0,
            "height": 297.0,
            "id": 1,
            "view_center_point": [0.0, 0.0, 0.0],
            "view_height": 297.0,
        },
        owner=PAPER,
    )
    drawing.entity(
        "VIEWPORT",
        {
            "center": [200.0, 150.0, 0.0],
            "width": 100.0,
            "height": 50.0,
            "id": 2,
            "view_center_point": [1500.0, 1000.0, 0.0],
            "view_height": 500.0,
        },
        owner=PAPER,
    )
    built = build(drawing.artefact(), SheetCandidate(SheetLocation(layout="Layout1")))

    assert built.paper.source == PaperSource.LAYOUT
    assert (built.paper.width_mm, built.paper.height_mm) == (420.0, 297.0)
    assert built.stats["viewports_drawn"] == 1
    model_line = built.lines[built.lines["y0"] == built.lines["y1"]]
    through = [s for s in _segments(built) if abs(s[1] - 150) < 1e-3]
    # 1:10 through the viewport, cut to its 100 mm wide rectangle: from x 150 to 250.
    np.testing.assert_allclose(through, [[150, 150, 250, 150]], atol=1e-3)
    assert len(model_line) >= 1


def test_types_not_drawn_are_counted_not_dropped_silently() -> None:
    drawing = Drawing()
    drawing.entity("MULTILEADER", {})
    drawing.entity("LINE", {"start": [0.0, 0.0, 0.0], "end": [float("nan"), 0.0, 0.0]})
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    assert built.stats["not_drawn_MULTILEADER"] == 1
    assert built.stats["not_drawn_LINE"] == 1


def test_mtext_without_a_height_is_drawn_at_its_blocks_height() -> None:
    drawing = Drawing()
    label = drawing.block("LABEL")
    drawing.text("X", (0, 0, 0), kind="MTEXT", height=None, owner=label)
    drawing.text("SIBLING", (0, -20, 0), height=7.0, owner=label)
    drawing.insert(label, (50, 100, 0))
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    heights = np.hypot(built.glyphs["yx"], built.glyphs["yy"])
    assert heights.tolist() == pytest.approx([7.0] * len(heights))
    assert "text_height_default" not in built.stats


# The format -------------------------------------------------------------------------------------


def _tiny() -> SheetBuffers:
    drawing = Drawing()
    drawing.line((0, 10), (100, 10))
    drawing.text("A", (10, 10, 0), font="arial.ttf")
    drawing.entity(
        "SOLID",
        {
            "vtx0": [0.0, 0.0, 0.0],
            "vtx1": [10.0, 0.0, 0.0],
            "vtx2": [0.0, 10.0, 0.0],
            "vtx3": [10.0, 10.0, 0.0],
        },
    )
    return build(drawing.artefact(), model_sheet(0, 0, 297, 210))


def test_the_buffer_round_trips() -> None:
    built = _tiny()
    back = SheetBuffers.from_bytes(built.to_bytes())
    assert back.paper == built.paper
    assert back.strings == built.strings
    assert back.chains == built.chains
    for name in ("primitives", "lines", "triangles", "glyphs", "atlas_glyphs", "atlas", "fonts"):
        assert np.array_equal(getattr(back, name), getattr(built, name)), name
    assert back.stats == built.stats


def test_the_header_is_where_the_docstring_says() -> None:
    data = _tiny().to_bytes()
    assert data[:4] == b"VXSB"
    assert struct.unpack_from("<HHII", data, 4) == (1, 0, 56, len(data))
    assert struct.unpack_from("<ff", data, 16) == (297.0, 210.0)
    assert struct.unpack_from("<I", data, 32)[0] == 10
    offsets = [SECTION.unpack_from(data, HEADER.size + i * SECTION.size) for i in range(10)]
    assert [o[0] for o in offsets] == [
        b"STRS",
        b"CHNS",
        b"PRIM",
        b"LINE",
        b"TRIS",
        b"GLYF",
        b"AGLY",
        b"ATLS",
        b"FONT",
        b"STAT",
    ]
    assert all(o[1] % 8 == 0 for o in offsets)


def _patched(data: bytes, offset: int, fmt: str, *values: object) -> bytes:
    out = bytearray(data)
    struct.pack_into(fmt, out, offset, *values)
    return bytes(out)


def _section(data: bytes, fourcc: bytes) -> int:
    for i in range(struct.unpack_from("<I", data, 32)[0]):
        if SECTION.unpack_from(data, HEADER.size + i * SECTION.size)[0] == fourcc:
            return HEADER.size + i * SECTION.size
    raise AssertionError(fourcc)


@pytest.mark.parametrize(
    ("damage", "message"),
    [
        (lambda d: _patched(d, 12, "<I", len(d) + 1000), "says it is"),
        (lambda d: d[:-8], "says it is"),
        (lambda d: d + b"\0" * 8, "says it is"),
        (lambda d: b"XXXX" + d[4:], "magic"),
        (lambda d: _patched(d, 4, "<H", 2), "version 2"),
        (lambda d: _patched(d, 32, "<I", 1_000_000), "section table"),
        (lambda d: _patched(d, _section(d, b"LINE") + 4, "<I", len(d)), "outside"),
        (lambda d: _patched(d, _section(d, b"LINE") + 12, "<I", 99), "records"),
        (
            lambda d: _patched(
                d,
                _section(d, b"TRIS") + 4,
                "<I",
                struct.unpack_from("<I", d, _section(d, b"LINE") + 4)[0],
            ),
            "overlap|outside|records",
        ),
        (lambda d: d[:10], "shorter"),
        (lambda d: _patched(d, 16, "<f", float("inf")), "finite"),
    ],
)
def test_a_damaged_buffer_is_refused(damage: object, message: str) -> None:
    data = damage(_tiny().to_bytes())  # type: ignore[operator]
    with pytest.raises(BufferError, match=message):
        SheetBuffers.from_bytes(data)


def test_an_index_past_its_table_is_refused() -> None:
    built = _tiny()
    built.lines["prim"][0] = 10_000
    with pytest.raises(BufferError, match="primitive past"):
        SheetBuffers.from_bytes(built.to_bytes())
    built = _tiny()
    built.glyphs["glyph"][0] = 99
    with pytest.raises(BufferError, match="atlas glyph past"):
        SheetBuffers.from_bytes(built.to_bytes())


def test_random_damage_is_refused_or_read_never_anything_else() -> None:
    data = _tiny().to_bytes()
    chooser = random.Random(16)
    for _ in range(2000):
        damaged = bytearray(data)
        for _ in range(chooser.randint(1, 4)):
            damaged[chooser.randrange(len(damaged))] = chooser.randrange(256)
        with contextlib.suppress(BufferError):
            SheetBuffers.from_bytes(bytes(damaged))


# The trust boundary: bounded, never followed -------------------------------------------------------


def test_a_block_with_a_great_many_entities_is_cut_at_the_budget() -> None:
    drawing = Drawing()
    many = drawing.block("MANY")
    for i in range(2000):
        drawing.line((i % 200, 0), (i % 200, 1), owner=many)
    for i in range(50):
        drawing.insert(many, (0, i * 2, 0))
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210), limits=Limits(lines=5000))

    assert built.truncated
    assert len(built.lines) == 5000
    assert built.stats["budget_lines"] > 0
    data = built.to_bytes()
    assert struct.unpack_from("<H", data, 6)[0] & 1


def test_a_sheet_that_takes_too_long_is_cut_at_its_time_budget() -> None:
    drawing = Drawing()
    many = drawing.block("MANY")
    for i in range(3000):
        drawing.line((i % 200, 0), (i % 200, 1), owner=many)
    values = {"row_count": 100, "column_count": 100, "row_spacing": 1.0, "column_spacing": 1.0}
    drawing.insert(many, values=values, kind="MINSERT")  # 30 million entities to visit
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210), limits=Limits(seconds=0.5))

    assert built.truncated
    assert built.stats["budget_seconds"] == 1


def test_an_insert_loop_is_drawn_once_and_counted() -> None:
    drawing = Drawing()
    a = drawing.block("A")
    drawing.line((0, 0), (10, 0), owner=a)
    drawing.insert(a, (1, 1, 0), owner=a)
    drawing.insert(a, (10, 10, 0))
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    assert len(built.lines) == 1
    assert built.stats["refused_loop"] == 1


def test_a_hatch_pattern_too_fine_for_its_area_is_refused() -> None:
    huge = [[0, 0, 0], [1e6, 0, 0], [1e6, 1e6, 0], [0, 1e6, 0]]
    drawing = Drawing()
    path = {"type": "polyline", "flags": 1, "closed": True, "vertices": huge}
    values = {"solid_fill": 0, "pattern_name": "ANSI31", "pattern_scale": 1e-6, "paths": [path]}
    drawing.entity("HATCH", values)
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    assert built.stats["hatch_too_complex"] == 1
    assert len(built.lines) == 0


def test_a_hatch_boundary_with_too_many_edges_is_refused() -> None:
    n = 150_000
    ring = [
        [math.cos(2 * math.pi * k / n) * 50 + 100, math.sin(2 * math.pi * k / n) * 50 + 100, 0]
        for k in range(n)
    ]
    drawing = Drawing()
    drawing.entity(
        "HATCH",
        {"solid_fill": 1, "paths": [{"type": "polyline", "flags": 1, "closed": True, "vertices": ring}]},
    )
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    assert built.stats["hatch_too_complex"] == 1


@pytest.mark.parametrize(
    "junk",
    [
        {"paths": "nope"},
        {"paths": [{"type": "edges", "edges": [{"type": "arc"}]}]},
        {"paths": [{"type": "polyline", "vertices": [[1, "x"]]}]},
    ],
)
def test_a_hatch_with_junk_values_is_not_drawn_and_counted(junk: dict[str, object]) -> None:
    drawing = Drawing()
    drawing.entity("HATCH", {"solid_fill": 1, **junk})
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    assert built.stats["not_drawn_HATCH"] == 1


def test_overlong_mtext_codes_and_huge_text_are_bounded() -> None:
    drawing = Drawing()
    drawing.text(
        "\\f" + "A" * 100_000 + ";" + "X" * 50_000 + "{" * 50_000,
        (10, 10, 0),
        kind="MTEXT",
        font="arial.ttf",
    )
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    assert built.stats["text_characters_cut"] > 0


def test_the_sheets_layout_must_exist() -> None:
    with pytest.raises(ValueError, match="not in the drawing"):
        build(Drawing().artefact(), SheetCandidate(SheetLocation(layout="Nope")))
