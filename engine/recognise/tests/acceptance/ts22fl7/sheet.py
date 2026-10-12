"""Ticket S22-FL7's synthetic Structural sheets: one invented frame in model space (the hand-built
artefact of engine/recognise/tests/drawing.py, no toolchain), its views drawn as grids with their
titles under them, the sheet's title in its title block. Every title and number is invented."""

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import ViewCandidate, ViewKind

SCALE = 50.0
LEFT = (40.0, 300.0, 200.0, 560.0)
MIDDLE = (240.0, 300.0, 400.0, 560.0)
RIGHT = (440.0, 300.0, 600.0, 560.0)
LOWER = (40.0, 60.0, 340.0, 240.0)
WHOLE = (40.0, 60.0, 640.0, 560.0)

type Drawn = tuple[str | None, tuple[float, float, float, float]]


def _grid(d: Sheets, box: tuple[float, float, float, float]) -> None:
    x0, y0, x1, y1 = box
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((x, y0), (x, y1))
        d.line((x0, y), (x1, y))


def structural_views(title: str, drawn: list[Drawn], number: str = "S-41") -> list[ViewCandidate]:
    """The views (but the title block) 17 reads on a Structural sheet titled `title`."""
    d = Sheets()
    block = frame_block(d)
    ox, oy = 10_000.0, 0.0
    insert = d.insert(block, (ox, oy, 0.0), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in {0: title, 2: number}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * SCALE)
    for view_title, (x0, y0, x1, y1) in drawn:
        _grid(d, (ox + x0 * SCALE, oy + y0 * SCALE, ox + x1 * SCALE, oy + y1 * SCALE))
        if view_title is not None:
            d.text(view_title, (ox + x0 * SCALE, oy + (y0 - 12) * SCALE, 0.0), height=6.0 * SCALE)
    found = sheets.find(d.artefact(), "structural", DEFAULT)
    assert len(found) == 1, "one sheet"
    read = views.find(d.artefact(), found[0], views.default_conventions())
    return [v for v in read if v.kind is not ViewKind.TITLE_BLOCK]
