"""What a view draws that a grid could be made of: its straight lines, its circles and its short texts,
each placed in the world (model space) through its whole insert chain (`engine.geometry.placement`).

`drawn(artefact, box, layers)` walks model space once per artefact (cached for one recognise call by
the caller's `Space`) and keeps what lies in `box` (the whole space when `box` is None). `layers`, when
given, is the Drafting Profile's grid layers: only lines and circles on them are kept. No layer is
named here (ADR 0039).

A crafted file is bounded by the walk's own limits (placement's `MAX_VISITS`) and by `MAX_TEXTS`,
`MAX_CIRCLES` and `MAX_SEGMENTS`, past which nothing more is kept; an entity that cannot be placed, or
whose numbers are not finite, is skipped.
"""

import math
from collections.abc import Collection
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from engine.geometry.placement import Chain, PlacementError, Walk, world
from engine.read.artefact import Entity, Insert, ReadArtefact, Text
from engine.recognise import sheets as sheet_finder
from engine.recognise.sheets import _finite_insert, _Segmenter
from engine.recognise.views import _segments

LINE_TYPES = frozenset({"LINE", "LWPOLYLINE", "POLYLINE"})
"""The types a grid line is drawn as."""
CIRCLE_TYPES = frozenset({"CIRCLE"})
"""The types a bubble is drawn as."""
MAX_LABEL = 8
"""The longest text kept: a grid label is short."""
MAX_TEXTS = 200_000
MAX_CIRCLES = 100_000
MAX_SEGMENTS = 2_000_000
"""The most short texts, circles and line segments one space gives (the real sets' model spaces hold
tens of thousands): a crafted file's surplus is left unread, never held."""

type Box = tuple[float, float, float, float]


@dataclass(frozen=True)
class Circle:
    x: float
    y: float
    radius: float
    layer: str
    handle: str
    inserts: tuple[str, ...]
    block_names: tuple[str, ...]


@dataclass(frozen=True)
class Label:
    shown: str
    x: float
    y: float
    height: float
    handle: str
    inserts: tuple[str, ...]


@dataclass
class Drawn:
    """One space's lines (segments x0, y0, x1, y1, with the entity each came from), circles and texts."""

    segments: NDArray[np.float64]
    segment_entity: NDArray[np.int64]
    entities: list[tuple[str, tuple[str, ...], str]]  # (handle, inserts, layer)
    circles: list[Circle] = field(default_factory=list)
    labels: list[Label] = field(default_factory=list)

    def within(self, box: Box | None) -> Drawn:
        if box is None:
            return self
        x0, y0, x1, y1 = box
        s = self.segments
        if len(s):
            inside = ~(
                (np.maximum(s[:, 0], s[:, 2]) < x0)
                | (np.minimum(s[:, 0], s[:, 2]) > x1)
                | (np.maximum(s[:, 1], s[:, 3]) < y0)
                | (np.minimum(s[:, 1], s[:, 3]) > y1)
            )
            segments, owners = s[inside], self.segment_entity[inside]
        else:
            segments, owners = s, self.segment_entity
        return Drawn(
            segments,
            owners,
            self.entities,
            [c for c in self.circles if x0 <= c.x <= x1 and y0 <= c.y <= y1],
            [t for t in self.labels if x0 <= t.x <= x1 and y0 <= t.y <= y1],
        )


def _names(artefact: ReadArtefact, chain: Chain) -> tuple[str, ...]:
    return tuple(link.insert.name for link in chain)


def _circle(entity: Entity, chain: Chain, artefact: ReadArtefact) -> Circle | None:
    centre = entity.values.get("center")
    radius = entity.values.get("radius")
    if not isinstance(centre, list | tuple) or len(centre) < 2:
        return None
    if not isinstance(radius, int | float) or isinstance(radius, bool):
        return None
    try:
        placed = world(entity, chain)
        x, y, _ = placed.apply([float(v) for v in centre[:3]])
        r = float(radius) * placed.xy_scale
    except PlacementError, ValueError, TypeError, OverflowError:
        return None
    if not all(math.isfinite(v) for v in (x, y, r)) or r <= 0:
        return None
    inserts = tuple(link.insert.handle for link in chain)
    return Circle(x, y, r, entity.layer, entity.handle, inserts, _names(artefact, chain))


def read_space(artefact: ReadArtefact, layers: Collection[str] = ()) -> Drawn:
    """Model space's lines, circles and short texts, placed in the world."""
    model = next((h for h, b in artefact.blocks.items() if b.layout == "Model"), None)
    empty = Drawn(np.empty((0, 4)), np.empty(0, dtype=np.int64), [])
    if model is None:
        return empty
    segmenter = _Segmenter(artefact, None, sheet_finder.default_conventions())
    walk = Walk(artefact, enter=lambda new, inner: _finite_insert(inner[-1].insert))
    pieces: list[NDArray[np.float64]] = []
    owners: list[int] = []
    entities: list[tuple[str, tuple[str, ...], str]] = []
    circles: list[Circle] = []
    labels: list[Label] = []
    wanted = set(layers)
    count = 0
    for entity, chain in walk.entities(model):
        if isinstance(entity, Text):
            if entity.type == "ATTDEF" or len(entity.text) > 64 or len(labels) >= MAX_TEXTS:
                continue
            placed = segmenter._place(entity, chain)
            if placed is None or len(placed.shown) > MAX_LABEL:
                continue
            x, y = placed.centre()
            inserts = tuple(link.insert.handle for link in chain)
            labels.append(Label(placed.shown, x, y, placed.height, entity.handle, inserts))
            continue
        if isinstance(entity, Insert) or (wanted and entity.layer not in wanted):
            continue
        if entity.type in CIRCLE_TYPES:
            if len(circles) >= MAX_CIRCLES:
                continue
            found = _circle(entity, chain, artefact)
            if found is not None:
                circles.append(found)
            continue
        if entity.type not in LINE_TYPES or count >= MAX_SEGMENTS:
            continue
        segments = _segments(entity, chain)
        if segments is None or not len(segments):
            continue
        segments = segments[: MAX_SEGMENTS - count]
        count += len(segments)
        entities.append((entity.handle, tuple(link.insert.handle for link in chain), entity.layer))
        pieces.append(segments)
        owners.append(len(entities) - 1)
    if not pieces:
        return Drawn(np.empty((0, 4)), np.empty(0, dtype=np.int64), entities, circles, labels)
    lengths = [len(p) for p in pieces]
    return Drawn(
        np.concatenate(pieces),
        np.repeat(np.array(owners, dtype=np.int64), lengths),
        entities,
        circles,
        labels,
    )
