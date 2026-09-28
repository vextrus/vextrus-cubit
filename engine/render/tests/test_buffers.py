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

    assert built.paper.source == PaperSource.STANDARD  # A3 in millimetres
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


# The format refuter's attacks (28 Sep 2026), each now refused with BufferError and nothing else.


def _replace_section(data: bytes, fourcc: bytes, payload: bytes, count: int | None = None) -> bytes:
    """The buffer with one section's bytes replaced (placed at the end, the table and total fixed)."""
    entry = _section(data, fourcc)
    _, _, _, records = SECTION.unpack_from(data, entry)
    offset = (len(data) + 7) // 8 * 8
    out = bytearray(data + b"\0" * (offset - len(data)) + payload)
    struct.pack_into(
        "<4sIII", out, entry, fourcc, offset, len(payload), records if count is None else count
    )
    struct.pack_into("<I", out, 12, len(out))
    return bytes(out)


@pytest.mark.parametrize(
    ("fourcc", "payload", "count", "message"),
    [
        # Deep nesting: a RecursionError on one Python, a parsed list on another; refused either way.
        (b"STAT", b"[" * 100_000 + b"]" * 100_000, 1, "not JSON|not names to integers"),
        (b"STAT", b"{" * 50_000, 1, "not JSON|not names to integers"),
        (b"STAT", b'{"a": 1}', 999, "record count"),
        (b"STAT", b"{}" + b" " * (2 << 20), 0, "megabyte"),
        (b"ATLS", struct.pack("<II", 0, 0), 7, "record count is not 1"),
        (b"ATLS", struct.pack("<II", 2**31, 2**31), 1, "size is not its pixels"),
    ],
)
def test_a_hostile_section_is_refused(fourcc: bytes, payload: bytes, count: int, message: str) -> None:
    data = _replace_section(_tiny().to_bytes(), fourcc, payload, count)
    with pytest.raises(BufferError, match=message):
        SheetBuffers.from_bytes(data)


@pytest.mark.parametrize(
    ("field", "value"), [("u0", 65535), ("v0", 65535), ("u1", 0), ("x1", -10.0), ("y0", float("nan"))]
)
def test_an_atlas_glyph_outside_the_atlas_or_empty_is_refused(field: str, value: float) -> None:
    built = _tiny()
    built.atlas_glyphs[field][0] = value
    with pytest.raises(BufferError, match=r"atlas glyph|not finite"):
        SheetBuffers.from_bytes(built.to_bytes())


@pytest.mark.parametrize(
    ("table", "field", "value"),
    [
        ("lines", "x0", float("inf")),
        ("lines", "weight", float("nan")),
        ("lines", "weight", 50.0),
        ("lines", "weight", -1.0),
        ("triangles", "y2", float("-inf")),
        ("glyphs", "xx", float("inf")),
    ],
)
def test_a_value_off_its_range_is_refused(table: str, field: str, value: float) -> None:
    built = _tiny()
    getattr(built, table)[field][0] = value
    with pytest.raises(BufferError, match=r"not finite|off its range"):
        SheetBuffers.from_bytes(built.to_bytes())


def test_a_layout_as_large_as_the_float_range_is_an_assumed_sheet_or_refused() -> None:
    """A vast layout is no standard sheet, so its paper is assumed (A1's long side); one wider than a
    float holds has no paper at all and is refused."""
    drawing = Drawing()
    drawing.line((0, 0), (1, 1), owner=PAPER)
    drawing.line((1e300, 1e300), (1e300, 1e300), owner=PAPER)
    built = build(drawing.artefact(), SheetCandidate(SheetLocation(layout="Layout1")))
    assert built.paper.source == PaperSource.ASSUMED
    assert built.paper.width_mm == pytest.approx(841.0)
    drawing.line((-1e308, -1e308), (-1e308, -1e308), owner=PAPER)
    drawing.line((1e308, 1e308), (1e308, 1e308), owner=PAPER)
    with pytest.raises(ValueError, match="larger than any sheet"):
        build(drawing.artefact(), SheetCandidate(SheetLocation(layout="Layout1")))


# The orchestrator's review of d4689726 (28 Sep 2026): each finding reproduced, then fixed.


def _nested_minserts(levels: int = 5, grid: int = 100) -> Drawing:
    """Nested grid x grid MINSERTs (`levels` deep, 0.0001 apart) over one line; inserted once."""
    drawing = Drawing()
    inner = drawing.block("LEAF")
    drawing.line((1, 1), (2, 1), owner=inner)
    cells = {"row_count": grid, "column_count": grid, "row_spacing": 0.0001, "column_spacing": 0.0001}
    for level in range(levels):
        outer = drawing.block(f"L{level}")
        drawing.insert(inner, owner=outer, values=cells, kind="MINSERT")
        inner = outer
    drawing.insert(inner)
    return drawing


def test_a_tiny_crafted_file_cannot_take_memory_in_proportion_to_its_cells() -> None:
    """Review item 1: every chain walked kept its transform for the whole walk (5.8 GB at 303 s)."""
    import tracemalloc

    artefact = _nested_minserts().artefact()
    sheet = model_sheet(0, 0, 297, 210)
    tracemalloc.start()
    try:
        built = build(artefact, sheet, limits=Limits(visits=150_000, seconds=1e9))
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()

    assert built.truncated
    assert peak < 40_000_000, f"{peak / 1e6:.0f} MB for 150,000 visits"


@pytest.mark.parametrize("bulge", [1e-12, 1e-14, 1e-15, 1e-16, -1e-15])
def test_a_tiny_bulge_is_a_straight_piece_not_a_crash(bulge: float) -> None:
    """Review item 2: a bulge whose arc is flatter than the tolerance divided by zero in arc_steps."""
    drawing = Drawing()
    drawing.entity("LWPOLYLINE", {"points": [[10, 10, 0, 0, bulge], [200, 10, 0, 0, 0]], "flags": 0})
    ring = [[20, 20, bulge], [60, 20, 0], [60, 60, 0], [20, 60, 0]]
    path = {"type": "polyline", "flags": 1, "closed": True, "vertices": ring}
    drawing.entity("HATCH", {"solid_fill": 1, "paths": [path]})
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))

    np.testing.assert_allclose(_segments(built), [[10, 10, 200, 10]], atol=1e-6)
    assert len(built.triangles) >= 2


def test_a_huge_radius_does_not_lose_the_sheet() -> None:
    drawing = Drawing()
    drawing.entity("CIRCLE", {"center": [0.0, 0.0, 0.0], "radius": 1e300})
    drawing.entity(
        "ARC", {"center": [0.0, 0.0, 0.0], "radius": 1e300, "start_angle": 0.0, "end_angle": 90.0}
    )
    drawing.entity("ELLIPSE", {"center": [0.0, 0.0, 0.0], "major_axis": [1e300, 0.0, 0.0], "ratio": 0.5})
    drawing.line((10, 10), (20, 10))
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    assert any(np.allclose(s, [10, 10, 20, 10]) for s in _segments(built))
    SheetBuffers.from_bytes(built.to_bytes())


def test_an_unexpected_arithmetic_error_loses_one_entity_not_the_sheet(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from engine.render import _shapes

    real = _shapes.shape

    def shape(entity: object, tolerance: float) -> object:
        if getattr(entity, "type", "") == "CIRCLE":
            raise ZeroDivisionError("float division by zero")
        return real(entity, tolerance)  # type: ignore[arg-type]

    monkeypatch.setattr(_shapes, "shape", shape)
    drawing = Drawing()
    drawing.entity("CIRCLE", {"center": [50.0, 50.0, 0.0], "radius": 5.0})
    drawing.line((10, 10), (20, 10))
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))

    assert built.stats["failed_CIRCLE"] == 1
    np.testing.assert_allclose(_segments(built), [[10, 10, 20, 10]], atol=1e-6)


def _timed_build(drawing: Drawing, seconds: float) -> tuple[SheetBuffers, float]:
    import time

    start = time.monotonic()
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210), limits=Limits(seconds=seconds))
    return built, time.monotonic() - start


def test_one_long_dashed_polyline_costs_in_proportion_to_its_length() -> None:
    """Review item 3: dashing scanned every vertex for every dash (28 s against a 5 s budget)."""
    xs = np.linspace(0, 290, 200_000)
    points = [[float(x), 100.0 + (i % 2) * 0.01, 0, 0, 0] for i, x in enumerate(xs)]
    drawing = Drawing(insunits=4)
    drawing.entity("LWPOLYLINE", {"points": points, "flags": 0, "linetype": "DASHED", "ltscale": 0.04})
    built, took = _timed_build(drawing, seconds=2.0)

    assert took < 2.0 + 4.0, f"{took:.1f} s"  # the budget, and one bounded entity's worth over it
    assert len(built.lines) > 100


def test_a_pattern_hatch_too_costly_is_refused_before_the_work() -> None:
    """Review item 3: a 99k-edge GRAVEL hatch ran 96.8 s, and only then was refused."""
    n = 99_000
    ring = [
        [math.cos(2 * math.pi * k / n) * 100 + 150, math.sin(2 * math.pi * k / n) * 100 + 105, 0]
        for k in range(n)
    ]
    path = {"type": "polyline", "flags": 1, "closed": True, "vertices": ring}
    drawing = Drawing(insunits=4)
    values = {"solid_fill": 0, "pattern_name": "GRAVEL", "pattern_scale": 1.0, "paths": [path]}
    drawing.entity("HATCH", values)
    built, took = _timed_build(drawing, seconds=2.0)

    assert took < 2.0 + 4.0, f"{took:.1f} s"
    assert built.stats["hatch_too_complex"] == 1


def test_viewports_share_one_visit_budget() -> None:
    """Review item 3: each viewport's walk restarted its visit count at zero."""
    drawing = Drawing(insunits=4)
    for i in range(3000):
        drawing.line((i * 0.1, 0), (i * 0.1, 1))
    for number, cx in ((2, 100.0), (3, 300.0)):
        viewport = {"center": [cx, 100.0, 0.0], "width": 150.0, "height": 150.0, "id": number,
                    "view_center_point": [150.0, 0.5, 0.0], "view_height": 400.0}  # fmt: skip
        drawing.entity("VIEWPORT", viewport, owner=PAPER)
    frame = [[0, 0, 0, 0, 0], [420, 0, 0, 0, 0], [420, 297, 0, 0, 0], [0, 297, 0, 0, 0]]
    drawing.entity("LWPOLYLINE", {"points": frame, "flags": 1}, owner=PAPER)
    sheet = SheetCandidate(SheetLocation(layout="Layout1"))

    built = build(drawing.artefact(), sheet, limits=Limits(visits=2000))

    # 2,000 visits across both viewports and the layout: about 2,000 lines, not 2,000 a viewport.
    assert len(built.lines) < 2100
    assert built.truncated


@pytest.mark.parametrize(
    ("width", "height", "per_unit", "message"),
    [(-1.0, 3e8, 1.0, "paper"), (0.0, 100.0, 1.0, "paper"), (1e6, 100.0, 1.0, "paper"),
     (297.0, 210.0, 0.0, "paper"), (297.0, 210.0, -2.0, "paper")],
)  # fmt: skip
def test_a_paper_no_sheet_could_have_is_refused(
    width: float, height: float, per_unit: float, message: str
) -> None:
    """Review item 4: a negative side passed the signed-product check and took 1.2 GB in rasterise."""
    data = bytearray(_tiny().to_bytes())
    struct.pack_into("<ffd", data, 16, width, height, per_unit)
    with pytest.raises(BufferError, match=message):
        SheetBuffers.from_bytes(bytes(data))


def test_a_line_across_the_whole_float_range_is_cut_to_the_sheet() -> None:
    """Review item 5: dx overflowed to inf, the cut point became NaN, and the decoder refused the
    engine's own buffer."""
    drawing = Drawing()
    drawing.line((-1e308, 5), (1e308, 5))
    built = build(drawing.artefact(), model_sheet(0, 0, 297, 210))
    back = SheetBuffers.from_bytes(built.to_bytes())
    np.testing.assert_allclose(_segments(back), [[0, 5, 297, 5]], atol=1e-3)


def _layout_a1(scale: float, insunits: int) -> SheetBuffers:
    """An A1 frame (841 x 594 mm) drawn in a layout in mm (scale 1) or in inches (1 / 25.4)."""
    drawing = Drawing(insunits=insunits)
    w, h = 841 * scale, 594 * scale
    frame = [[0, 0, 0, 0, 0], [w, 0, 0, 0, 0], [w, h, 0, 0, 0], [0, h, 0, 0, 0]]
    drawing.entity("LWPOLYLINE", {"points": frame, "flags": 1}, owner=PAPER)
    return build(drawing.artefact(), SheetCandidate(SheetLocation(layout="Layout1")))


@pytest.mark.parametrize("insunits", [0, 1, 4, 5, 6])
@pytest.mark.parametrize("scale", [1.0, 1 / 25.4])
def test_a_layouts_paper_is_the_standard_sheet_its_extents_are_whatever_insunits_says(
    scale: float, insunits: int
) -> None:
    """Review item 6: INSUNITS does not govern paper space; at 1 an A1 in mm became 21,361 mm wide."""
    built = _layout_a1(scale, insunits)
    assert built.paper.source == PaperSource.STANDARD
    assert (built.paper.width_mm, built.paper.height_mm) == pytest.approx((841.0, 594.0))


def test_a_layout_matching_no_sheet_is_assumed_and_says_so() -> None:
    drawing = Drawing(insunits=1)
    frame = [[0, 0, 0, 0, 0], [500, 0, 0, 0, 0], [500, 123, 0, 0, 0], [0, 123, 0, 0, 0]]
    drawing.entity("LWPOLYLINE", {"points": frame, "flags": 1}, owner=PAPER)
    built = build(drawing.artefact(), SheetCandidate(SheetLocation(layout="Layout1")))
    assert built.paper.source == PaperSource.ASSUMED
    assert built.paper.width_mm == pytest.approx(841.0)
