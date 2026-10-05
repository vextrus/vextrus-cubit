"""Ticket W316's synthetic sheets: hand-built ReadArtefacts (no toolchain), drawn by 13's test drawing
(`engine/recognise/tests/drawing.py`) as `engine/recognise/tests/test_views.py` draws them (`framed`,
`grid`, `model_sheet`, `drawn`, copied here with a Discipline). Every title is invented; they prove
mechanics only, never a reading (docs/sdlc.md).

A sheet is one A1 frame at 1:50 in model space, its title block's values under their labels, each view
a 4 x 4 grid of lines at its paper box (mm) with its title 12 mm under it (`None`: drawn with no
title), and loose texts where a test asks (a title's second line, a block of notes).
"""

from dataclasses import dataclass

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import SheetCandidate, ViewCandidate, ViewConventions, ViewKind

CONVENTIONS = views.default_conventions()
SCALE = 50.0
ORIGIN = (10_000.0, 0.0)
HEADINGS = frozenset({ViewKind.SCHEDULE, ViewKind.LEGEND, ViewKind.NOTES})
"""The kinds whose title heads its content, so it is drawn over it (17's `_HEADINGS`)."""

type Box = tuple[float, float, float, float]

# Six places on the invented A1 paper (mm), left of its title-block strip, two rows of three.
PLACES: tuple[Box, ...] = (
    (30.0, 330.0, 210.0, 560.0),
    (240.0, 330.0, 420.0, 560.0),
    (450.0, 330.0, 630.0, 560.0),
    (30.0, 60.0, 210.0, 290.0),
    (240.0, 60.0, 420.0, 290.0),
    (450.0, 60.0, 630.0, 290.0),
)


def framed(d: Sheets, block: str, at: tuple[float, float], scale: float, values: dict[int, str]) -> str:
    """A frame insert in model space, its values written loose under their labels (13's reading)."""
    insert = d.insert(block, (at[0], at[1], 0.0), scale=(scale, scale, scale))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in values.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * scale)
    return insert


def grid(d: Sheets, box: Box) -> None:
    """A view's drawing: a 4 x 4 grid of lines filling `box`."""
    x0, y0, x1, y1 = box
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((x, y0), (x, y1))
        d.line((x0, y), (x1, y))


@dataclass(frozen=True)
class Sheet:
    """One invented sheet: its number, its title, its views (each title, `None` for a drawing with
    no title, at its paper box) and its loose texts (each at its paper place and height, mm)."""

    number: str
    title: str
    views: tuple[tuple[str | None, Box], ...] = ()
    texts: tuple[tuple[str, tuple[float, float], float], ...] = ()


def model_file(drawn_sheets: list[Sheet], *, discipline: str) -> tuple[Sheets, list[SheetCandidate]]:
    """One file of `discipline`: each sheet a frame at 1:50 in model space, side by side, each view
    drawn at its paper box with its title 12 mm under it (a schedule's, legend's or notes' heading
    6 mm over it: their content stands under them). Its sheets as `sheets.find` reads them, in the
    order given."""
    d = Sheets()
    block = frame_block(d)
    s = SCALE
    for n, sheet in enumerate(drawn_sheets):
        ox, oy = ORIGIN[0] + n * 100_000.0, ORIGIN[1]
        framed(d, block, (ox, oy), s, {0: sheet.title, 2: sheet.number})
        for view_title, (x0, y0, x1, y1) in sheet.views:
            grid(d, (ox + x0 * s, oy + y0 * s, ox + x1 * s, oy + y1 * s))
            if view_title is not None:
                y = y1 + 6 if views.describe(view_title).kind in HEADINGS else y0 - 12
                d.text(view_title, (ox + x0 * s, oy + y * s, 0.0), height=6.0 * s)
        for text, (x, y), height in sheet.texts:
            d.text(text, (ox + x * s, oy + y * s, 0.0), height=height * s)
    found = {f.number.value: f for f in sheets.find(d.artefact(), discipline, DEFAULT) if f.number}
    assert sorted(found) == sorted(sheet.number for sheet in drawn_sheets)
    return d, [found[sheet.number] for sheet in drawn_sheets]


def model_sheet(
    titles: list[str | None],
    *,
    title: str,
    discipline: str,
    texts: tuple[tuple[str, tuple[float, float], float], ...] = (),
) -> tuple[Sheets, SheetCandidate]:
    """A file of one sheet of `discipline` titled `title`, its views' `titles` at `PLACES` in reading
    order (`model_file`)."""
    d, (sheet,) = model_file([Sheet("X-01", title, placed(titles), texts)], discipline=discipline)
    return d, sheet


def placed(titles: list[str | None]) -> tuple[tuple[str | None, Box], ...]:
    """Each title at the next of `PLACES`, in reading order."""
    assert len(titles) <= len(PLACES)
    return tuple(zip(titles, PLACES, strict=False))


def every(
    d: Sheets, sheet: SheetCandidate, conventions: ViewConventions = CONVENTIONS
) -> list[ViewCandidate]:
    """The sheet's views, its title block among them, as `views.find` proposes them."""
    return list(views.find(d.artefact(), sheet, conventions))


def drawn(
    d: Sheets, sheet: SheetCandidate, conventions: ViewConventions = CONVENTIONS
) -> list[ViewCandidate]:
    """The sheet's views but its title block (every framed sheet has one)."""
    return [v for v in every(d, sheet, conventions) if v.kind is not ViewKind.TITLE_BLOCK]


def proposed(view: ViewCandidate) -> tuple[tuple[str, ...], str | None, str | None]:
    """A view's proposal: its Steps, its Part and its exclusion's reason (none when proposed in)."""
    return view.steps, view.part, (str(view.exclusion.reason) if view.exclusion else None)
