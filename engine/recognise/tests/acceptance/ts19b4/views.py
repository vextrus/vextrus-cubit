"""Ticket S19-B4's view stand-ins: hand-made `ViewCandidate`s as 17 would read them, beside T-W334's
sheet and `compare` helpers (engine/recognise/tests/acceptance/w334). Every title, number, mark and
size is invented."""

from engine.recognise.types import Box, Layer, StoreysMeaning, ViewCandidate, ViewKind

BOX = Box(40.0, 60.0, 660.0, 560.0)


def plan(
    title: str | None, subject: str | None, *storeys: str, layer: Layer | None = None
) -> ViewCandidate:
    """Stands in for a plan of one subject at the given floor levels (`not_stated` is symbolic)."""
    return ViewCandidate(
        box=BOX,
        kind=ViewKind.PLAN,
        title=title,
        storeys=storeys,
        storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL if storeys else None,
        subject=subject,
        layer=layer,
    )


def section(title: str | None, *storeys: str) -> ViewCandidate:
    """Stands in for a sectional view; the storeys given are those it states."""
    return ViewCandidate(
        box=BOX,
        kind=ViewKind.SECTION,
        title=title,
        storeys=storeys,
        storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL if storeys else None,
    )


def schedule(title: str | None = None) -> ViewCandidate:
    return ViewCandidate(box=BOX, kind=ViewKind.SCHEDULE, title=title)
