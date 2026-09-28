"""MTEXT placement: a height that is never none, and the angle its direction vector gives."""

import math

import pytest

from engine.geometry.placement import chain
from engine.read.artefact import ReadArtefact, Text
from engine.render.fixtures.artefacts import MODEL, Drawing
from engine.text import mtext
from engine.text.mtext import HeightSource


def _text(drawing: Drawing, handle: str) -> tuple[Text, ReadArtefact]:
    artefact = drawing.artefact()
    found = artefact.entities[handle]
    assert isinstance(found, Text)
    return found, artefact


def test_own_height_wins() -> None:
    drawing = Drawing()
    handle = drawing.text("A", kind="MTEXT", height=3.0)
    entity, artefact = _text(drawing, handle)
    assert mtext.resolve(entity, artefact=artefact) == mtext.Height(3.0, 3.0, HeightSource.OWN)


def test_an_mtext_without_height_takes_the_height_its_text_sets_first() -> None:
    drawing = Drawing()
    handle = drawing.text("{\\H4.5;BEAM} B1", kind="MTEXT", height=None)
    entity, artefact = _text(drawing, handle)
    assert mtext.resolve(entity, artefact=artefact).source is HeightSource.INLINE
    assert mtext.height(entity, artefact=artefact) == 4.5


def test_a_text_with_no_height_takes_its_styles_fixed_height_from_the_artefact() -> None:
    drawing = Drawing()
    notes = drawing.style("NOTES", fixed_height=1.8)
    drawing.text("SIBLING", height=7.0)  # the block's usual height, which the style comes before
    handle = drawing.text("A", kind="MTEXT", height=None, style_handle=notes)
    entity, artefact = _text(drawing, handle)
    found = mtext.resolve(entity, artefact=artefact)
    assert (found.local, found.source) == (1.8, HeightSource.STYLE)


def test_the_order_is_own_inline_style_block() -> None:
    drawing = Drawing()
    fixed = drawing.style("FIXED", fixed_height=3.7)
    loose = drawing.style("LOOSE")
    drawing.text("SIBLING", height=1.0)
    handles = {
        "own": drawing.text("OWN", kind="MTEXT", height=2.0, style_handle=fixed),
        "inline": drawing.text("{\\H4.5;SET}", kind="MTEXT", height=None, style_handle=fixed),
        "style": drawing.text("TEXT", height=None, style_handle=fixed),
        "block": drawing.text("LOOSE", kind="MTEXT", height=None, style_handle=loose),
    }
    artefact = drawing.artefact()

    found = {}
    for step, handle in handles.items():
        entity = artefact.entities[handle]
        assert isinstance(entity, Text)
        height = mtext.resolve(entity, artefact=artefact)
        found[step] = (height.local, height.source)

    assert found == {
        "own": (2.0, HeightSource.OWN),
        "inline": (4.5, HeightSource.INLINE),
        "style": (3.7, HeightSource.STYLE),
        "block": (1.0, HeightSource.BLOCK),
    }


@pytest.mark.parametrize("junk", [float("nan"), float("inf"), 0.0, -3.7])
def test_a_style_height_that_is_no_finite_positive_number_is_passed_over(junk: float) -> None:
    """The same rule as an own height: a style built in code (not read, which keeps none) that holds
    one is passed over for the block's."""
    drawing = Drawing()
    odd = drawing.style("ODD", fixed_height=junk)
    drawing.text("SIBLING", height=1.0)
    handle = drawing.text("X", kind="MTEXT", height=None, style_handle=odd)
    entity, artefact = _text(drawing, handle)
    assert mtext.resolve(entity, artefact=artefact) == mtext.Height(1.0, 1.0, HeightSource.BLOCK)


def test_two_styles_with_one_name_give_each_text_its_own_styles_height() -> None:
    drawing = Drawing()
    small = drawing.style("NOTES", fixed_height=1.8)
    large = drawing.style("NOTES", fixed_height=5.0)
    first = drawing.text("SMALL", height=None, style_handle=small)
    second = drawing.text("LARGE", height=None, style_handle=large)
    artefact = drawing.artefact()
    heights = mtext.Heights(artefact)
    found = [heights.resolve(e) for h in (first, second) if isinstance(e := artefact.entities[h], Text)]
    assert [(h.local, h.source) for h in found] == [(1.8, HeightSource.STYLE), (5.0, HeightSource.STYLE)]


def test_style_heights_are_the_artefacts_only() -> None:
    """One source: the caller-supplied `style_heights` (name to height) is gone (#82)."""
    drawing = Drawing()
    handle = drawing.text("A", kind="MTEXT", height=None, style="NOTES")
    entity, artefact = _text(drawing, handle)
    with pytest.raises(TypeError):
        mtext.resolve(entity, artefact=artefact, style_heights={"NOTES": 1.8})  # type: ignore[call-arg]
    with pytest.raises(TypeError):
        mtext.Heights(artefact, {"NOTES": 1.8})  # type: ignore[call-arg]
    assert mtext.resolve(entity, artefact=artefact).source is HeightSource.DEFAULT


def _in_a_block(step: HeightSource, local: float) -> tuple[Drawing, str, str]:
    """A drawing with block `B` holding a text that `step` gives the local height `local` (the
    default's is its own); returns the drawing, the block and the text."""
    drawing = Drawing()
    block = drawing.block("B")
    if step is HeightSource.OWN:
        handle = drawing.text("X", height=local, owner=block)
    elif step is HeightSource.INLINE:
        handle = drawing.text(f"{{\\H{local!r};X}}", kind="MTEXT", height=None, owner=block)
    elif step is HeightSource.STYLE:
        fixed = drawing.style("S", fixed_height=local)
        handle = drawing.text("X", height=None, style_handle=fixed, owner=block)
    else:
        if step is HeightSource.BLOCK:
            drawing.text("SIBLING", height=local, owner=block)
        handle = drawing.text("X", height=None, owner=block)
    return drawing, block, handle


_OUT_OF_THE_FLOATS = [
    # a world height that overflows to infinity, for every step
    (HeightSource.OWN, 1e308, 1e10),
    (HeightSource.INLINE, 1e11, 1e300),  # an inline height is read only below 1e12
    (HeightSource.STYLE, 1e308, 1e10),
    (HeightSource.BLOCK, 1e308, 1e10),
    (HeightSource.DEFAULT, 2.5, 1e308),
    # and one that underflows to 0 through a scale above 0 (a scale of 0 was passed over before)
    (HeightSource.OWN, 1e-10, 1e-315),
    (HeightSource.INLINE, 1e-10, 1e-315),
    (HeightSource.STYLE, 1e-10, 1e-315),
    (HeightSource.BLOCK, 1e-10, 1e-315),
]


@pytest.mark.parametrize(("step", "local", "scale"), _OUT_OF_THE_FLOATS)
def test_the_world_height_is_finite_and_above_zero_whatever_the_insert_scales_it_by(
    step: HeightSource, local: float, scale: float
) -> None:
    """On `main` an MTEXT of height 1e308 in an insert scaled 1e10 gave `value=inf` (measured 29 Sep
    2026): a scale the floats cannot carry the height through is passed over, for every step."""
    drawing, block, handle = _in_a_block(step, local)
    top = drawing.insert(block, scale=(scale, scale, 1.0))
    artefact = drawing.artefact()
    entity = artefact.entities[handle]
    assert isinstance(entity, Text)

    found = mtext.resolve(entity, chain(artefact, [top]), artefact=artefact)

    assert found == mtext.Height(local, local, step)
    assert math.isfinite(found.value)
    assert found.value > 0


def test_an_mtext_without_height_in_a_block_takes_its_blocks_usual_height_times_the_insert() -> None:
    drawing = Drawing()
    label = drawing.block("LABEL")
    handle = drawing.text("NO HEIGHT", kind="MTEXT", height=None, owner=label)
    for size in (3.0, 3.0, 5.0):
        drawing.text("SIBLING", height=size, owner=label)
    top = drawing.insert(label, scale=(50.0, 50.0, 1.0))
    artefact = drawing.artefact()
    entity = artefact.entities[handle]
    assert isinstance(entity, Text)

    found = mtext.resolve(entity, chain(artefact, [top]), artefact=artefact)

    assert (found.local, found.value, found.source) == (3.0, 150.0, HeightSource.BLOCK)


@pytest.mark.parametrize(("insunits", "expected"), [(1, 0.2), (4, 2.5), (0, 2.5)])
def test_with_nothing_else_the_default_for_the_units_and_the_source_says_so(
    insunits: int, expected: float
) -> None:
    drawing = Drawing(insunits=insunits)
    alone = drawing.block("ALONE")
    handle = drawing.text("X", kind="MTEXT", height=None, owner=alone)
    artefact = drawing.artefact()
    entity = artefact.entities[handle]
    assert isinstance(entity, Text)
    found = mtext.resolve(entity, (), artefact=artefact)
    assert found == mtext.Height(expected, expected, HeightSource.DEFAULT)


def test_the_height_is_never_none_or_zero_even_for_junk() -> None:
    drawing = Drawing()
    handle = drawing.text("{\\H-3;\\Hnan;X}", kind="MTEXT", height=float("nan"))
    entity, artefact = _text(drawing, handle)
    assert mtext.height(entity, artefact=artefact) > 0


def test_an_mtext_at_30_degrees_by_its_direction_vector() -> None:
    drawing = Drawing()
    thirty = (math.cos(math.radians(30)), math.sin(math.radians(30)), 0.0)
    handle = drawing.text("B1 (250 x 500)", kind="MTEXT", direction=thirty)
    assert math.degrees(mtext.angle(_text(drawing, handle)[0])) == pytest.approx(30.0)


def test_an_mtext_direction_need_not_be_a_unit_vector() -> None:
    drawing = Drawing()
    handle = drawing.text("UP", kind="MTEXT", direction=(0.0, 7.0, 0.0))
    assert math.degrees(mtext.angle(_text(drawing, handle)[0])) == pytest.approx(90.0)


def test_a_text_angle_is_its_rotation_mirrored_by_its_ocs() -> None:
    drawing = Drawing()
    plain = drawing.text("A", rotation_radians=math.radians(20))
    flipped = drawing.text("B", rotation_radians=math.radians(20), extrusion=(0.0, 0.0, -1.0))
    assert math.degrees(mtext.angle(_text(drawing, plain)[0])) == pytest.approx(20.0)
    assert math.degrees(mtext.angle(_text(drawing, flipped)[0])) == pytest.approx(160.0)


def test_the_world_angle_turns_with_the_insert() -> None:
    drawing = Drawing()
    label = drawing.block("LABEL")
    thirty = (math.cos(math.radians(30)), math.sin(math.radians(30)), 0.0)
    handle = drawing.text("B1", kind="MTEXT", direction=thirty, owner=label)
    top = drawing.insert(label, rotation_radians=math.radians(45))
    artefact = drawing.artefact()
    entity = artefact.entities[handle]
    assert isinstance(entity, Text)
    assert math.degrees(mtext.world_angle(entity, chain(artefact, [top]))) == pytest.approx(75.0)


def test_a_frame_places_glyph_space_in_the_world() -> None:
    drawing = Drawing()
    label = drawing.block("LABEL")
    handle = drawing.text("A", (1.0, 0.0, 0.0), owner=label, height=2.0)
    top = drawing.insert(label, (100.0, 0.0, 0.0), extrusion=(0.0, 0.0, -1.0))
    artefact = drawing.artefact()
    entity = artefact.entities[handle]
    assert isinstance(entity, Text)

    placed = mtext.frame(entity, chain(artefact, [top]), 2.0)

    assert placed.origin == pytest.approx((-101.0, 0.0))
    assert placed.x_axis == pytest.approx((-2.0, 0.0))  # the mirrored insert mirrors the text
    assert placed.y_axis == pytest.approx((0.0, 2.0))


def test_the_model_space_block_is_a_block_too() -> None:
    drawing = Drawing()
    drawing.text("SIBLING", height=7.0)
    handle = drawing.text("X", kind="MTEXT", height=None)
    artefact = drawing.artefact()
    entity = artefact.entities[handle]
    assert isinstance(entity, Text)
    assert entity.owner == MODEL
    assert mtext.height(entity, (), artefact=artefact) == 7.0


def test_the_height_cannot_be_asked_without_the_artefact_its_block_is_read_from() -> None:
    """Review item 7: `height(entity, chain)` silently skipped the block step; now it cannot be called
    so, and a positional artefact is refused too, so every caller names where the block comes from."""
    drawing = Drawing()
    drawing.text("SIBLING", height=7.0)
    handle = drawing.text("X", kind="MTEXT", height=None)
    entity, artefact = _text(drawing, handle)
    with pytest.raises(TypeError):
        mtext.height(entity, ())  # type: ignore[call-arg]
    with pytest.raises(TypeError):
        mtext.resolve(entity, (), artefact)  # type: ignore[call-arg]
    assert mtext.resolve(entity, (), artefact=artefact).source is HeightSource.BLOCK


def test_an_mtext_in_a_tilted_plane_keeps_its_axes_in_that_plane() -> None:
    """The placement refuter's case: extrusion (0.6, 0, 0.8), direction (0, 1, 0); up is
    extrusion x direction = (-0.8, 0, 0.6), which the sheet sees as (-0.8, 0)."""
    drawing = Drawing()
    handle = drawing.text("T", kind="MTEXT", direction=(0.0, 1.0, 0.0), extrusion=(0.6, 0.0, 0.8))
    placed = mtext.frame(_text(drawing, handle)[0], (), 1.0)
    assert placed.x_axis == pytest.approx((0.0, 1.0))
    assert placed.y_axis == pytest.approx((-0.8, 0.0))
    handle = drawing.text("T", kind="MTEXT", direction=(0.8, 0.0, -0.6), extrusion=(0.6, 0.0, 0.8))
    assert mtext.frame(_text(drawing, handle)[0], (), 1.0).x_axis == pytest.approx((0.8, 0.0))
