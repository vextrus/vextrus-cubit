"""T-W318's sheets: one invented frame in model space at 1:50, drawn by the repo's hand-built
`Sheets` (no toolchain), each view a grid of lines at its paper box with its title (if any) 12 mm
under it, as `engine/recognise/tests/test_views.py`'s `model_sheet` draws them. Every title and storey
word is invented; they prove mechanics only.

The Sheet's title and its stated storey words are set on the candidate the sheet finder returns
(`dataclasses.replace`), so the test, not the title block's reading, says what the Sheet states.
"""

from dataclasses import replace

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import SheetCandidate, Sourced, ValueSource, ViewCandidate, ViewKind

SCALE = 50.0
ORIGIN = (10_000.0, 0.0)
PLACES = (
    (40.0, 300.0, 340.0, 560.0),
    (400.0, 300.0, 640.0, 560.0),
    (40.0, 40.0, 340.0, 240.0),
    (400.0, 40.0, 640.0, 240.0),
)
"""Where the views go on the paper (mm), in reading order: top row, then bottom row."""


def _grid(d: Sheets, box: tuple[float, float, float, float]) -> None:
    x0, y0, x1, y1 = box
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((x, y0), (x, y1))
        d.line((x0, y), (x1, y))


def sheet_views(
    titles: list[str | None],
    *,
    title: str = "GENERAL ARRANGEMENT",
    stated: str | None,
) -> tuple[SheetCandidate, list[ViewCandidate]]:
    """A Sheet titled `title` stating the storey words `stated` (None: it states none), with one view
    per entry of `titles` (None: a view drawn with no title), and the views `views.find` reads on it,
    its title block left out."""
    d = Sheets()
    block = frame_block(d)
    ox, oy = ORIGIN
    insert = d.insert(block, (ox, oy, 0.0), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in {0: title, 2: "S-31"}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * SCALE)
    for view_title, (x0, y0, x1, y1) in zip(titles, PLACES, strict=False):
        _grid(d, (ox + x0 * SCALE, oy + y0 * SCALE, ox + x1 * SCALE, oy + y1 * SCALE))
        if view_title is not None:
            d.text(view_title, (ox + x0 * SCALE, oy + (y0 - 12) * SCALE, 0.0), height=6.0 * SCALE)
    found = sheets.find(d.artefact(), "structural", DEFAULT)
    assert len(found) == 1, "the invented frame is one sheet"
    sheet = replace(
        found[0],
        title=Sourced(title, ValueSource.TITLE_BLOCK_TEXT),
        storeys_as_stated=None if stated is None else Sourced(stated, ValueSource.TITLE_BLOCK_TEXT),
    )
    read = views.find(d.artefact(), sheet, views.default_conventions())
    drawn = [v for v in read if v.kind is not ViewKind.TITLE_BLOCK]
    assert len(drawn) == len(titles), f"each drawn view is read once: {[v.title for v in drawn]}"
    return sheet, drawn
