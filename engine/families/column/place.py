"""Where a view lies in model space (M0 gives a view's box on PAPER, in mm, from its sheet's lower-left
corner; engine/recognise/views.py's docstring).

On a model-space sheet a view's model box is `frame's lower-left + paper box x scale`, the sheet and
its scale being M0's own (`sheets.find`, `views._paper_scale`). The sheet is the one whose frame holds
the view's title (its anchor), else the file's only model-space sheet. A view on a layout, or one no
sheet holds, cannot be placed: `None`, and the reader asks.
"""

from engine.geometry.placement import PlacementError, chain, world
from engine.read.anchor import DwgAnchor
from engine.read.artefact import ReadArtefact, Text
from engine.recognise import sheets
from engine.recognise.types import Box, SheetCandidate, ViewCandidate
from engine.recognise.views import _paper_scale

type Bounds = tuple[float, float, float, float]


def _title_point(artefact: ReadArtefact, view: ViewCandidate) -> tuple[float, float] | None:
    for anchor in view.anchors:
        if not isinstance(anchor, DwgAnchor):
            continue
        entity = artefact.entities.get(anchor.handle)
        if not isinstance(entity, Text):
            continue
        try:
            x, y, _ = world(entity, chain(artefact, anchor.inserts)).apply(entity.position)
        except PlacementError, ValueError, KeyError:
            continue
        return (x, y)
    return None


def _holds(box: Box, point: tuple[float, float]) -> bool:
    return box.x0 <= point[0] <= box.x1 and box.y0 <= point[1] <= box.y1


def model_box(artefact: ReadArtefact, view: ViewCandidate) -> Bounds | None:
    """The view's box in model space, or None when it cannot be placed."""
    found = sheets.find(artefact, None, sheets.default_conventions())
    model: list[SheetCandidate] = [s for s in found if s.location.box is not None]
    point = _title_point(artefact, view)
    held = [s for s in model if point is not None and s.location.box and _holds(s.location.box, point)]
    if len(held) != 1:
        held = model if len(model) == 1 else []
    if not held:
        return None
    sheet = held[0]
    frame = sheet.location.box
    assert frame is not None
    anchor = next((a for a in sheet.anchors if isinstance(a, DwgAnchor)), None)
    scale = _paper_scale(artefact, anchor, frame)
    box = view.box
    return (
        frame.x0 + box.x0 * scale,
        frame.y0 + box.y0 * scale,
        frame.x0 + box.x1 * scale,
        frame.y0 + box.y1 * scale,
    )
