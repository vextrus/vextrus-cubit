"""Where a drawn thing is in the world: the object-to-world transform through its whole insert chain.

The M0 plan's contract ("Placement"; the Edison check's generic bugs, docs/research/
edison-check-session-02.md): the ReadArtefact (04) carries each insert's point, scale, rotation and
extrusion unresolved; **this module resolves them, and nothing else does**. The renderer (11) and the
recognisers (13, 17) take positions through `world`, never computing a transform themselves.

- `world(entity, chain)`: the transform from the entity's own coordinates to the world's (model space,
  or the layout's paper space), through `chain`, the inserts it is reached through, outermost first.
  For an entity drawn in its own object coordinate system (OCS: a 2D polyline, circle, arc, TEXT,
  hatch, solid; everything but the types in `WCS_TYPES`), its extrusion's OCS is applied first, so a
  circle with extrusion -Z lands mirrored, as AutoCAD draws it. An `Insert` is an OCS entity like
  the rest (its insertion point is in its OCS); what its block draws is placed by the chain that ends
  with it: `chain_transform((*chain, link(artefact, insert)))`.
- An insert's transform, as AutoCAD applies it: its block's base point to the origin, scaled (a
  negative factor mirrors), rotated, moved to its insertion point, then taken out of its OCS (the
  arbitrary-axis algorithm, the DXF reference's): a mirrored insert (extrusion (0, 0, -1)) flips x, as
  25 of 47 Edison piles need. A MINSERT's cell (row, column) is offset by the spacings along its rotated,
  unscaled axes.
- `chain(artefact, handles)` builds a chain from insert handles (a `DwgAnchor`'s `inserts`), checking
  that each insert lies in the block of the one before; `walk(artefact, block)` visits every entity a
  block draws, depth first in drawing order, each with its chain (an ATTRIB after its INSERT, placed
  in the INSERT's space, where the file stores it).

**A crafted file is refused or bounded, never followed:** an insert of a block already on its own
chain or the block walked from (a loop), a chain deeper than `MAX_DEPTH`, a block the artefact does
not hold, an insert placed by a value that is not finite (its point, scale, rotation, extrusion or a
MINSERT's spacing: `rotation_z(inf)` raised out of the renderer's walk, 13's review round 1), a
MINSERT of more than `MAX_CELLS` cells, and a walk past its visit budget (entities and
MINSERT cells alike, so nested MINSERTs of empty blocks are bounded too) or its caller's `stop` are
each skipped and counted in the walk's `refused` (`Refusal`), never raised and never recursed into;
`chain` raises `PlacementError`.

Transforms are 3D affine (a 3x4 matrix), since an extrusion can tilt a plane; the sheet is its XY
projection (`xy`). Floats throughout: geometry stays float (docs/data-model.md §2).
"""

import math
from collections import Counter
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

from engine.read.artefact import AnyEntity, Insert, Point, ReadArtefact, Text

MAX_DEPTH = 32
"""The deepest insert chain followed (real sets nest a handful deep; the limit only stops a crafted
file's recursion)."""
MAX_CELLS = 10_000
"""The most cells a MINSERT is drawn with."""
MAX_VISITS = 10_000_000
"""The most entities and MINSERT cells one walk visits before it stops."""
CHECK_EVERY = 1024

WCS_TYPES = frozenset(
    {"LINE", "POINT", "3DFACE", "SPLINE", "ELLIPSE", "MTEXT", "LEADER", "MULTILEADER", "MLEADER",
     "MLINE", "RAY", "XLINE", "VIEWPORT", "3DSOLID", "REGION", "BODY", "MESH", "IMAGE", "WIPEOUT",
     "TOLERANCE", "ACAD_TABLE", "HELIX"}
)  # fmt: skip
"""Types whose coordinates are already in the world of their block; every other type is in its OCS."""

_ARBITRARY_AXIS = 1.0 / 64.0


class PlacementError(ValueError):
    """A chain that cannot be followed (a loop, too deep, or broken)."""


class Refusal(StrEnum):
    """Why a walk did not follow an insert."""

    LOOP = "loop"
    TOO_DEEP = "too_deep"
    BLOCK_MISSING = "block_missing"
    TOO_MANY_CELLS = "too_many_cells"
    VISIT_LIMIT = "visit_limit"
    STOPPED = "stopped"
    """The caller's `stop` said so (the renderer's time budget)."""
    NOT_FINITE = "not_finite"
    """An insert placed by a value that is not finite: it cannot be placed, so it is not followed."""


@dataclass(frozen=True)
class Transform:
    """A 3D affine transform: `m` is a 3x4 matrix, row major (x' = m0·x + m1·y + m2·z + m3, …)."""

    m: tuple[float, float, float, float, float, float, float, float, float, float, float, float] = (
        1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0,
    )  # fmt: skip

    def __matmul__(self, other: Transform) -> Transform:
        """`self @ other`: `other` first, then `self`."""
        a, b = self.m, other.m
        out = []
        for row in range(3):
            r = a[row * 4 : row * 4 + 4]
            for col in range(4):
                value = r[0] * b[col] + r[1] * b[4 + col] + r[2] * b[8 + col]
                out.append(value + r[3] if col == 3 else value)
        return Transform(tuple(out))  # type: ignore[arg-type]

    def apply(self, point: Sequence[float]) -> Point:
        x, y = float(point[0]), float(point[1])
        z = float(point[2]) if len(point) > 2 else 0.0
        m = self.m
        return (
            m[0] * x + m[1] * y + m[2] * z + m[3],
            m[4] * x + m[5] * y + m[6] * z + m[7],
            m[8] * x + m[9] * y + m[10] * z + m[11],
        )

    def vector(self, vector: Sequence[float]) -> Point:
        """A direction (no translation)."""
        x, y = float(vector[0]), float(vector[1])
        z = float(vector[2]) if len(vector) > 2 else 0.0
        m = self.m
        return (
            m[0] * x + m[1] * y + m[2] * z,
            m[4] * x + m[5] * y + m[6] * z,
            m[8] * x + m[9] * y + m[10] * z,
        )

    def xy(self, points: NDArray[np.float64], z: float = 0.0) -> NDArray[np.float64]:
        """Points (Nx2, at height `z` in their own coordinates) projected onto the world's XY plane."""
        m = self.m
        x, y = points[:, 0], points[:, 1]
        out = np.empty((len(points), 2), dtype=np.float64)
        out[:, 0] = m[0] * x + m[1] * y + (m[2] * z + m[3])
        out[:, 1] = m[4] * x + m[5] * y + (m[6] * z + m[7])
        return out

    @property
    def mirrored(self) -> bool:
        """Whether it mirrors the XY plane as seen from above (its XY part turns clockwise)."""
        m = self.m
        return m[0] * m[5] - m[1] * m[4] < 0

    @property
    def xy_scale(self) -> float:
        """How much it scales lengths in the XY plane (the geometric mean of its two axes)."""
        m = self.m
        return math.sqrt(abs(m[0] * m[5] - m[1] * m[4]))

    @property
    def is_finite(self) -> bool:
        return all(math.isfinite(v) for v in self.m)

    def inverse(self) -> Transform:
        """The transform that undoes this one: a world point back to the block's own coordinates
        (13 reads a frame's text in the frame's coordinates). A transform that is not finite, is
        singular (a scale of 0 flattens it) or whose inverse is not finite (a scale near 0 or past
        any drawing's) has none: `PlacementError`, never a division by zero."""
        m = self.m
        if not self.is_finite:
            raise PlacementError("a transform that is not finite has no inverse")
        a, b, c, d, e, f, g, h, i = m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]
        cofactors = (e * i - f * h, c * h - b * i, b * f - c * e,
                     f * g - d * i, a * i - c * g, c * d - a * f,
                     d * h - e * g, b * g - a * h, a * e - b * d)  # fmt: skip
        determinant = a * cofactors[0] + b * cofactors[3] + c * cofactors[6]
        if determinant == 0 or not math.isfinite(determinant):
            raise PlacementError("a singular transform (a scale of 0) has no inverse")
        r = tuple(v / determinant for v in cofactors)
        tx, ty, tz = m[3], m[7], m[11]
        inverse = (
            r[0], r[1], r[2], -(r[0] * tx + r[1] * ty + r[2] * tz),
            r[3], r[4], r[5], -(r[3] * tx + r[4] * ty + r[5] * tz),
            r[6], r[7], r[8], -(r[6] * tx + r[7] * ty + r[8] * tz),
        )  # fmt: skip
        if not all(math.isfinite(v) for v in inverse):
            raise PlacementError("the transform's inverse is not finite")
        return Transform(inverse)


IDENTITY = Transform()


def translation(x: float, y: float, z: float = 0.0) -> Transform:
    return Transform((1.0, 0.0, 0.0, x, 0.0, 1.0, 0.0, y, 0.0, 0.0, 1.0, z))


def rotation_z(radians: float) -> Transform:
    c, s = math.cos(radians), math.sin(radians)
    return Transform((c, -s, 0.0, 0.0, s, c, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0))


def scaling(x: float, y: float, z: float = 1.0) -> Transform:
    return Transform((x, 0.0, 0.0, 0.0, 0.0, y, 0.0, 0.0, 0.0, 0.0, z, 0.0))


def ocs(extrusion: Sequence[float]) -> Transform:
    """From an object coordinate system to its world, by AutoCAD's arbitrary-axis algorithm; the
    identity for the world's own Z, and for an extrusion that is no direction at all."""
    ex, ey, ez = (float(v) for v in extrusion[:3])
    length = math.sqrt(ex * ex + ey * ey + ez * ez)
    if not math.isfinite(length) or length == 0.0:
        return IDENTITY
    az = (ex / length, ey / length, ez / length)
    if az == (0.0, 0.0, 1.0):
        return IDENTITY
    if abs(az[0]) < _ARBITRARY_AXIS and abs(az[1]) < _ARBITRARY_AXIS:
        ax = _cross((0.0, 1.0, 0.0), az)
    else:
        ax = _cross((0.0, 0.0, 1.0), az)
    ax = _unit(ax)
    ay = _unit(_cross(az, ax))
    return Transform((ax[0], ay[0], az[0], 0.0, ax[1], ay[1], az[1], 0.0, ax[2], ay[2], az[2], 0.0))


def _cross(a: Sequence[float], b: Sequence[float]) -> Point:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _unit(v: Sequence[float]) -> Point:
    length = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return (v[0] / length, v[1] / length, v[2] / length)


@dataclass(frozen=True)
class Link:
    """One insert on a chain: the insert, its block's base point, and for a MINSERT its cell."""

    insert: Insert
    base_point: Point
    row: int = 0
    column: int = 0

    def transform(self) -> Transform:
        """The insert's own transform: its block's contents to the space it lies in."""
        i = self.insert
        sx, sy, sz = i.scale
        bx, by, bz = self.base_point
        local = rotation_z(i.rotation_radians)
        if self.row or self.column:
            dx = self.column * _grid(i, "column_spacing")
            dy = self.row * _grid(i, "row_spacing")
            local = local @ translation(dx, dy)
        placed = translation(*i.point) @ local @ scaling(sx, sy, sz) @ translation(-bx, -by, -bz)
        return ocs(i.extrusion) @ placed


type Chain = tuple[Link, ...]
"""The inserts an entity is reached through, outermost first (an anchor's `inserts`, resolved)."""


def _grid(insert: Insert, key: str) -> float:
    value = insert.values.get(key, 0.0)
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else 0.0


def _cells(insert: Insert) -> tuple[int, int]:
    """A MINSERT's rows and columns (1 and 1 for an INSERT, or for counts that are not counts)."""
    counts = []
    for key in ("row_count", "column_count"):
        value = insert.values.get(key, 1)
        ok = isinstance(value, int) and not isinstance(value, bool) and value >= 1
        counts.append(value if ok else 1)
    return counts[0], counts[1]  # type: ignore[return-value]


def _placeable(insert: Insert, rows: int, columns: int) -> bool:
    """Whether every value that places the insert is finite (a MINSERT's spacings among them)."""
    values = [*insert.point, *insert.scale, insert.rotation_radians, *insert.extrusion]
    if rows > 1:
        values.append(_grid(insert, "row_spacing"))
    if columns > 1:
        values.append(_grid(insert, "column_spacing"))
    return all(math.isfinite(v) for v in values)


def chain_transform(chain: Chain) -> Transform:
    """The transform of a chain's innermost block's contents to the world."""
    result = IDENTITY
    for link in chain:
        result = result @ link.transform()
    return result


def world(entity: AnyEntity, chain: Chain = ()) -> Transform:
    """The object-to-world transform of `entity` reached through `chain` (the module's docstring)."""
    return chain_transform(chain) @ own_ocs(entity)


def own_ocs(entity: AnyEntity) -> Transform:
    """The entity's own OCS: identity for a world-coordinate type."""
    if entity.type in WCS_TYPES:
        return IDENTITY
    if isinstance(entity, Text | Insert):
        return ocs(entity.extrusion)
    extrusion = entity.values.get("extrusion")
    if (
        isinstance(extrusion, list)
        and len(extrusion) == 3
        and all(isinstance(v, int | float) and not isinstance(v, bool) for v in extrusion)
    ):
        return ocs([float(v) for v in extrusion])
    return IDENTITY


def link(artefact: ReadArtefact, insert: Insert, row: int = 0, column: int = 0) -> Link:
    block = artefact.blocks.get(insert.block)
    if block is None:
        raise PlacementError(f"insert {insert.handle} names block {insert.block}, which is not held")
    return Link(insert, block.base_point, row, column)


def chain(artefact: ReadArtefact, handles: Sequence[str]) -> Chain:
    """The chain of inserts named by `handles` (outermost first): each an insert whose owner is the
    block of the one before, with no block twice, at most `MAX_DEPTH` long."""
    if len(handles) > MAX_DEPTH:
        raise PlacementError(f"a chain of {len(handles)} inserts is deeper than {MAX_DEPTH}")
    links: list[Link] = []
    seen: set[str] = set()
    for handle in handles:
        insert = artefact.entities.get(handle)
        if not isinstance(insert, Insert):
            raise PlacementError(f"{handle} is not an insert the artefact holds")
        if links and insert.owner != links[-1].insert.block:
            raise PlacementError(f"insert {handle} is not in the block of the insert before it")
        if insert.block in seen:
            raise PlacementError(f"insert {handle} inserts block {insert.block} inside itself")
        seen.add(insert.block)
        links.append(link(artefact, insert))
    return tuple(links)


@dataclass
class Walk:
    """A depth-first walk of what a block draws; `refused` counts what it would not follow."""

    artefact: ReadArtefact
    max_depth: int = MAX_DEPTH
    max_visits: int = MAX_VISITS
    enter: Callable[[Link, Chain], bool] | None = None
    """Asked before a block is walked into through an insert (the new link, and the chain it ends):
    false skips it (the renderer skips a block that falls outside its sheet)."""
    stop: Callable[[], bool] | None = None
    """Asked every `CHECK_EVERY` visits: true ends the walk (a caller's time budget)."""
    visits: int = 0
    """Entities yielded and MINSERT cells entered: the work done, which `max_visits` bounds."""
    refused: Counter[Refusal] = field(default_factory=Counter)
    ended: bool = False

    def _visit(self) -> bool:
        """Count one unit of work; false once the walk must end."""
        if self.ended:
            return False
        if self.visits >= self.max_visits:
            self.refused[Refusal.VISIT_LIMIT] += 1
            self.ended = True
            return False
        self.visits += 1
        if self.stop is not None and self.visits % CHECK_EVERY == 0 and self.stop():
            self.refused[Refusal.STOPPED] += 1
            self.ended = True
            return False
        return True

    def entities(self, block: str, chain: Chain = ()) -> Iterator[tuple[AnyEntity, Chain]]:
        """Every entity `block` draws, each with its chain: an insert, then (unless it is refused)
        what its block draws, then its attributes."""
        record = self.artefact.blocks.get(block)
        if record is None:
            self.refused[Refusal.BLOCK_MISSING] += 1
            return
        on_chain = {link.insert.block for link in chain} | {block}
        entities = self.artefact.entities
        for handle in record.entities:
            entity = entities.get(handle)
            if entity is None or entity.type == "ATTRIB":
                continue  # ATTRIBs come with their insert, placed in its space
            if not self._visit():
                return
            yield entity, chain
            if isinstance(entity, Insert):
                yield from self._insert(entity, chain, on_chain)
                for attrib in entity.attribs:
                    if isinstance(found := entities.get(attrib), Text):
                        yield found, chain

    def _insert(
        self, insert: Insert, chain: Chain, on_chain: set[str]
    ) -> Iterator[tuple[AnyEntity, Chain]]:
        if insert.block in on_chain:
            self.refused[Refusal.LOOP] += 1
            return
        if len(chain) >= self.max_depth:
            self.refused[Refusal.TOO_DEEP] += 1
            return
        if insert.block not in self.artefact.blocks:
            self.refused[Refusal.BLOCK_MISSING] += 1
            return
        rows, columns = _cells(insert)
        if not _placeable(insert, rows, columns):
            self.refused[Refusal.NOT_FINITE] += 1
            return
        if rows * columns > MAX_CELLS:
            self.refused[Refusal.TOO_MANY_CELLS] += 1
            rows = columns = 1
        for row in range(rows):
            for column in range(columns):
                if not self._visit():  # a cell is work even when its block draws nothing
                    return
                new = link(self.artefact, insert, row, column)
                inner = (*chain, new)
                if self.enter is None or self.enter(new, inner):
                    yield from self.entities(insert.block, inner)


def walk(artefact: ReadArtefact, block: str) -> Iterator[tuple[AnyEntity, Chain]]:
    """`Walk(artefact).entities(block)`: every entity `block` draws, with its chain."""
    return Walk(artefact).entities(block)


def refusals(walked: Walk) -> Mapping[str, int]:
    """What a walk refused, by `Refusal`, for a report's counts."""
    return {str(reason): count for reason, count in sorted(walked.refused.items())}
