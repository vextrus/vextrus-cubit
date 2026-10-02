"""Which texts of a drawing each of its printed sheets holds (ticket 21c: the report's Bangla text
sheets and its Fonts table's "Sheets" column), from the kept ReadArtefact and each sheet's location.

A sheet on a layout holds every text its layout draws (through its inserts too). A sheet laid out in
model space holds every text model space draws whose insertion point lies inside its frame's box.
A text drawn by a block inserted on two sheets is on both. Positions come through
`engine.geometry.placement`, the one place a drawn thing's world position is resolved; its walk bounds
a crafted file.
"""

from collections.abc import Hashable, Iterable, Mapping
from typing import Any

from engine.geometry.placement import walk, world
from engine.read.artefact import ReadArtefact, Text
from engine.render.fonts import fonts_of

_MODEL = "Model"


def texts_on[K: Hashable](
    artefact: ReadArtefact, locations: Iterable[tuple[K, Mapping[str, Any]]]
) -> dict[K, set[str]]:
    """Each sheet's texts' handles, by the sheet's key; `locations` pairs a key with its stored
    location (`{"layout": name}` or `{"box": [x0, y0, x1, y1]}`)."""
    placed = list(locations)
    found: dict[K, set[str]] = {key: set() for key, _ in placed}
    layouts = {b.layout: h for h, b in artefact.blocks.items() if b.layout not in (None, _MODEL)}
    model = next((h for h, b in artefact.blocks.items() if b.layout == _MODEL), None)
    boxes: list[tuple[K, tuple[float, float, float, float]]] = []
    for key, location in placed:
        layout = location.get("layout")
        if isinstance(layout, str):
            block = layouts.get(layout)
            if block is not None:
                found[key] |= {e.handle for e, _ in walk(artefact, block) if isinstance(e, Text)}
            continue
        box = _box(location.get("box"))
        if box is not None:
            boxes.append((key, box))
    if boxes and model is not None:
        for entity, chain in walk(artefact, model):
            if not isinstance(entity, Text):
                continue
            x, y, _ = world(entity, chain).apply(entity.position)
            for key, (x0, y0, x1, y1) in boxes:
                if x0 <= x <= x1 and y0 <= y <= y1:
                    found[key].add(entity.handle)
    return found


def _box(value: object) -> tuple[float, float, float, float] | None:
    if not isinstance(value, list) or len(value) != 4:
        return None
    try:
        x0, y0, x1, y1 = (float(v) for v in value)
    except TypeError, ValueError:
        return None
    return (x0, y0, x1, y1)


def font_rows_of(artefact: ReadArtefact, handles: Iterable[str]) -> set[tuple[str, str]]:
    """The Font report's rows (`Substitute.row`: the name asked for, casefolded, and its kind) the
    given texts are drawn in."""
    rows: set[tuple[str, str]] = set()
    entities = artefact.entities
    for handle in handles:
        text = entities.get(handle)
        if isinstance(text, Text):
            rows |= {used.row for used, _ in fonts_of(text) if used.asked}
    return rows
