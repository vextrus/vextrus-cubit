"""Where a view is in model space: its box, from the paper it was found on to the drawing's units.

M0's view finder (`engine.recognise.views`) gives every view's box **on paper, in mm, from its sheet's
lower-left corner**, and names its sheet in its anchors' key (`DwgAnchor.sheet`): a layout's name, or
`model/` and the frame's insert handles for a sheet framed in model space (13's `MODEL_SHEET`). The grid
is read in model space, so the box is taken back there the way M0 laid it on paper:

- a model-space sheet: the frame's box in model space (the largest rectangle its insert draws, as 13
  found it), its lower-left corner,
  and M0's own paper scale (`views._paper_scale`: the frame insert's, else a standard paper's);
- a layout sheet: through each plan viewport's model-to-paper transform (the renderer's), inverted; the
  box is the union of what the viewports overlapping it show.

A view with no sheet anchor (a synthetic view) has its box in drawing units already, and is taken as it
is; a `ViewArtefact` with no view at all is the whole of model space (none). A box that cannot be
placed raises `Unplaced`: the caller reads nothing for it and raises its Question.
"""

import math
from collections.abc import Iterable

from engine.geometry.placement import PlacementError, Transform, chain, chain_transform, link
from engine.read.anchor import DwgAnchor
from engine.read.artefact import Entity, Insert, ReadArtefact
from engine.recognise import sheets as sheet_finder
from engine.recognise.sheets import MODEL_SHEET, _rectangle, _Segmenter
from engine.recognise.types import Box
from engine.recognise.views import _paper_scale, _shapes_rect
from engine.render.buffers import is_main_viewport, viewport_transform

type Bounds = tuple[float, float, float, float]


class Unplaced(ValueError):
    """A view whose box cannot be taken to model space."""


def _sheet_key(view: object) -> str | None:
    for anchor in getattr(view, "anchors", ()) or ():
        if isinstance(anchor, DwgAnchor):
            return anchor.sheet
    return None


def _union(boxes: Iterable[Bounds]) -> Bounds | None:
    held = list(boxes)
    if not held:
        return None
    return (
        min(b[0] for b in held),
        min(b[1] for b in held),
        max(b[2] for b in held),
        max(b[3] for b in held),
    )


def _through(box: Bounds, transform: Transform) -> Bounds:
    x0, y0, x1, y1 = box
    corners = [transform.apply((x, y, 0.0))[:2] for x in (x0, x1) for y in (y0, y1)]
    return (
        min(c[0] for c in corners),
        min(c[1] for c in corners),
        max(c[0] for c in corners),
        max(c[1] for c in corners),
    )


def _frame_box(artefact: ReadArtefact, handles: list[str]) -> tuple[Bounds, DwgAnchor] | None:
    """The model-space box of the frame the key names, as M0's sheet finder took it: the largest
    rectangle its insert's block draws, or the rectangle itself; and an anchor naming the frame."""
    if not handles:
        return None
    frame = artefact.entities.get(handles[-1])
    try:
        outer = chain(artefact, handles[:-1])
        if isinstance(frame, Insert):
            segmenter = _Segmenter(artefact, None, sheet_finder.default_conventions())
            corners = segmenter._block_rectangle(frame.block)
            placed = chain_transform((*outer, link(artefact, frame)))
        elif frame is not None:
            corners = _rectangle(frame)
            placed = chain_transform(outer)
        else:
            return None
    except PlacementError:
        return None
    if corners is None:
        return None
    points = [placed.apply((x, y, 0.0))[:2] for x, y in corners]
    box = (
        min(p[0] for p in points),
        min(p[1] for p in points),
        max(p[0] for p in points),
        max(p[1] for p in points),
    )
    if not all(math.isfinite(v) for v in box):
        return None
    summary = artefact.summary
    try:
        anchor = DwgAnchor(
            summary.source_sha256,
            summary.reader,
            summary.reader_version,
            MODEL_SHEET + "/".join(handles),
            tuple(handles[:-1]),
            handles[-1],
        )
    except ValueError:
        return None
    return box, anchor


def _from_model_sheet(artefact: ReadArtefact, key: str, box: Bounds) -> Bounds | None:
    found = _frame_box(artefact, key[len(MODEL_SHEET) :].split("/"))
    if found is None:
        return None
    (fx0, fy0, fx1, fy1), anchor = found
    scale = _paper_scale(artefact, anchor, Box(fx0, fy0, fx1, fy1))
    if not (scale > 0 and math.isfinite(scale)):
        return None
    x0, y0, x1, y1 = box
    return (fx0 + x0 * scale, fy0 + y0 * scale, fx0 + x1 * scale, fy0 + y1 * scale)


def _from_layout(artefact: ReadArtefact, layout: str, box: Bounds) -> Bounds | None:
    handle = next((h for h, b in artefact.blocks.items() if b.layout == layout), None)
    record = artefact.blocks.get(handle) if handle is not None else None
    if record is None:
        return None
    shown: list[Bounds] = []
    first = True
    for entity_handle in record.entities:
        entity = artefact.entities.get(entity_handle)
        if not isinstance(entity, Entity) or entity.type != "VIEWPORT":
            continue
        values = dict(entity.values)
        main = is_main_viewport(values, first)
        first = False
        if main:
            continue
        to_paper = viewport_transform(values)
        rect = _shapes_rect(values)
        if to_paper is None or rect is None:
            continue
        x0, y0 = max(box[0], rect[0]), max(box[1], rect[1])
        overlap = (x0, y0, min(box[2], rect[2]), min(box[3], rect[3]))
        if overlap[0] >= overlap[2] or overlap[1] >= overlap[3]:
            continue
        try:
            shown.append(_through(overlap, to_paper.inverse()))
        except PlacementError:
            continue
    return _union(shown)


def model_box(artefact: ReadArtefact, view: object) -> Bounds | None:
    """The view's box in model space, none for the whole space (the module's docstring)."""
    candidate = getattr(view, "view", None)
    if candidate is None:
        return None
    box = getattr(candidate, "box", None)
    if box is None:
        raise Unplaced("the view has no box")
    bounds = (float(box.x0), float(box.y0), float(box.x1), float(box.y1))
    key = _sheet_key(candidate)
    if key is None:
        return bounds
    if key.startswith(MODEL_SHEET):
        placed = _from_model_sheet(artefact, key, bounds)
    else:
        placed = _from_layout(artefact, key, bounds)
    if placed is None:
        raise Unplaced("the view's sheet cannot be placed in model space")
    return placed
