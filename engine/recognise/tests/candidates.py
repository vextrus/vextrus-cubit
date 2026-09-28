"""Hand-made candidates for 19b's tests: sheets and views as 13 and 17 would propose them."""

import itertools
from collections.abc import Sequence

from engine.recognise.types import (
    Box,
    Exclusion,
    Layer,
    SheetCandidate,
    SheetLocation,
    Sourced,
    StoreysMeaning,
    ValueSource,
    ViewCandidate,
    ViewKind,
)

_layouts = itertools.count()


def sheet(
    number: str | None = None,
    title: str | None = None,
    *,
    discipline: str | None = "structural",
    group: str | None = "set",
    revision: str | None = None,
    storeys: str | None = None,
    exclusion: Exclusion | None = None,
) -> SheetCandidate:
    return SheetCandidate(
        location=SheetLocation(layout=f"Layout{next(_layouts)}"),
        number=None if number is None else Sourced(number, ValueSource.TITLE_BLOCK_TEXT),
        title=None if title is None else Sourced(title, ValueSource.TITLE_BLOCK_TEXT),
        discipline=None if discipline is None else Sourced(discipline, ValueSource.FILE),
        revision_mark=None if revision is None else Sourced(revision, ValueSource.FILE_NAME),
        storeys_as_stated=None if storeys is None else Sourced(storeys, ValueSource.TITLE_BLOCK_TEXT),
        exclusion=exclusion,
        group=group,
    )


def plan(
    storeys: Sequence[str],
    subject: str | None = "slab",
    layer: Layer | None = None,
    kind: ViewKind = ViewKind.PLAN,
    *,
    title: str | None = None,
    steps: Sequence[str] = (),
    part: str | None = None,
    exclusion: Exclusion | None = None,
) -> ViewCandidate:
    return ViewCandidate(
        box=Box(0, 0, 10, 10),
        kind=kind,
        title=title,
        storeys=tuple(storeys),
        storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL if storeys else None,
        subject=subject,
        layer=layer,
        steps=tuple(steps),
        part=part,
        exclusion=exclusion,
    )


def view(
    kind: ViewKind = ViewKind.DETAIL,
    *,
    title: str | None = None,
    steps: Sequence[str] = (),
    part: str | None = None,
    exclusion: Exclusion | None = None,
) -> ViewCandidate:
    return ViewCandidate(
        box=Box(0, 0, 10, 10), kind=kind, title=title, steps=tuple(steps), part=part, exclusion=exclusion
    )


def same(found: Sequence[object], expected: Sequence[object]) -> bool:
    """The very objects, in order (frozen candidates compare by value, so `==` would not tell)."""
    return len(found) == len(expected) and all(a is b for a, b in zip(found, expected, strict=True))
