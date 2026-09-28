"""Text placement: an MTEXT's height, never none, and its angle, read from its direction vector.

The M0 plan's contract ("Placement"; the Edison check's generic bugs: MTEXT inside blocks with no
height crashed Step 1, and MTEXT angles stored as a direction vector read as 0° left 98 of 139 beam
labels unbound; docs/research/edison-check-session-02.md). The renderer (11) and the recognisers (13,
17) take a text's height and angle from here, never computing either themselves.

**`height(entity, chain, *, artefact)`** is the text's height in the world (drawing units), never none:
its local height, resolved in this order, times what the chain scales it by along its own up
direction (a text inside an insert scaled 50 is 50 times taller):
1. `own`: the height the file stores for it;
2. `inline`: for an MTEXT stored without one, the absolute height its text sets before its first
   character (`{\\H2.5;…}`), which is its own too;
3. `style`: its text style's fixed height, given as `style_heights` (style name to height). **The
   ReadArtefact carries no style table** (04's shape, version 1), so the harness passes none and this
   step finds nothing until the artefact carries the styles' heights;
4. `block`: the height most of the other texts in its block (or layout) are stored with, the smaller
   one on a tie; the "block's" height of the contract. The artefact the entity came from is its
   source, so `artefact` is required (keyword-only): a call cannot leave this step out unnoticed;
5. `default`: AutoCAD's default text size for the drawing's units (0.2 for inches and feet, 2.5
   otherwise), and the caller reports it: `resolve` says which step gave the height, and the font
   report counts the texts that fell to the default (`engine.font_report.height_defaulted`).

**`angle(entity)`** is the direction of the text's baseline in its block's coordinates, in radians: an
MTEXT's from its direction vector (as stored, in the world of its block), a TEXT's from its rotation in
its object coordinate system (so a TEXT with extrusion -Z reads mirrored, as AutoCAD draws it).
`world_angle(entity, chain)` is the same through the chain.

`frame(entity, chain, height)` gives the renderer the text's origin and its two axes in the world: the
image of one unit along the baseline and one unit up, each times the height, so a glyph at (u, v) in
ems lands at origin + u·x + v·y (a mirrored or unevenly scaled insert mirrors or skews it, as AutoCAD
draws text inside blocks).
"""

import math
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from engine.geometry.placement import Chain, chain_transform, ocs, own_ocs
from engine.read.artefact import ReadArtefact, Text
from engine.text.decode import runs

IMPERIAL_DEFAULT = 0.2
METRIC_DEFAULT = 2.5
_IMPERIAL_UNITS = frozenset(
    {1, 2, 3, 8, 9, 10, 21}
)  # inches, feet, miles, microinches, mils, yards, US feet


class HeightSource(StrEnum):
    OWN = "own"
    INLINE = "inline"
    STYLE = "style"
    BLOCK = "block"
    DEFAULT = "default"


@dataclass(frozen=True)
class Height:
    """A text's height: in the world (`value`), in its own block (`local`), and which step gave it."""

    value: float
    local: float
    source: HeightSource


class Heights:
    """Resolves text heights over one artefact, remembering each block's usual height."""

    def __init__(self, artefact: ReadArtefact, style_heights: Mapping[str, float] | None = None) -> None:
        self.artefact = artefact
        self.style_heights = {k: v for k, v in (style_heights or {}).items() if _positive(v)}
        self._blocks: dict[str, float | None] = {}
        units = artefact.summary.insunits
        self.default = IMPERIAL_DEFAULT if units in _IMPERIAL_UNITS else METRIC_DEFAULT

    def local(self, entity: Text) -> tuple[float, HeightSource]:
        if _positive(entity.height):
            return float(entity.height), HeightSource.OWN  # type: ignore[arg-type]
        if entity.type == "MTEXT":
            first = next((run for run in runs(entity.text) if run.text.strip()), None)
            if first is not None and first.style.height is not None and _positive(first.style.height):
                return first.style.height, HeightSource.INLINE
        if entity.style is not None and entity.style in self.style_heights:
            return self.style_heights[entity.style], HeightSource.STYLE
        usual = self._usual(entity.owner)
        if usual is not None:
            return usual, HeightSource.BLOCK
        return self.default, HeightSource.DEFAULT

    def resolve(self, entity: Text, chain: Chain = ()) -> Height:
        local, source = self.local(entity)
        up = _up(entity)
        x, y, _ = (chain_transform(chain) @ own_ocs(entity)).vector(up)
        scale = math.hypot(x, y)
        value = local * scale if _positive(scale) else local
        return Height(value, local, source)

    def _usual(self, block: str) -> float | None:
        if block in self._blocks:
            return self._blocks[block]
        usual = None
        record = self.artefact.blocks.get(block)
        if record is not None:
            heights: Counter[float] = Counter()
            for handle in record.entities:
                other = self.artefact.entities.get(handle)
                if isinstance(other, Text) and _positive(other.height):
                    heights[float(other.height)] += 1  # type: ignore[arg-type]
            if heights:
                usual = min(heights, key=lambda h: (-heights[h], h))
        self._blocks[block] = usual
        return usual


def height(
    entity: Text,
    chain: Chain = (),
    *,
    artefact: ReadArtefact,
    style_heights: Mapping[str, float] | None = None,
) -> float:
    """The text's height in the world, never none (the module's docstring gives the order)."""
    return Heights(artefact, style_heights).resolve(entity, chain).value


def resolve(
    entity: Text,
    chain: Chain = (),
    *,
    artefact: ReadArtefact,
    style_heights: Mapping[str, float] | None = None,
) -> Height:
    """`height`, with the text's local height and the step that gave it."""
    return Heights(artefact, style_heights).resolve(entity, chain)


def _positive(value: object) -> bool:
    return (
        isinstance(value, int | float)
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value > 0
    )


def _unit3(v: tuple[float, float, float] | None) -> tuple[float, float, float] | None:
    if v is None or not all(math.isfinite(c) for c in v):
        return None
    length = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return None if length <= 1e-12 else (v[0] / length, v[1] / length, v[2] / length)


def _normal(entity: Text) -> tuple[float, float, float]:
    return _unit3(entity.extrusion) or (0.0, 0.0, 1.0)


def _direction(entity: Text) -> tuple[float, float, float]:
    """The unit baseline direction in the entity's own coordinates: an MTEXT's direction vector as
    stored, in its block's world (with none, its plane's own x axis); a TEXT's rotation in its OCS."""
    if entity.type == "MTEXT":
        found = _unit3(entity.direction)
        if found is not None:
            return found
        x, y, z = ocs(_normal(entity)).vector((1.0, 0.0, 0.0))
        return (x, y, z)
    r = entity.rotation_radians if math.isfinite(entity.rotation_radians) else 0.0
    return (math.cos(r), math.sin(r), 0.0)


def _up(entity: Text) -> tuple[float, float, float]:
    """The unit up direction, a quarter turn from the baseline in the text's plane: for an MTEXT its
    plane's normal (its extrusion) x its direction, so a plane facing -Z turns up the other way."""
    dx, dy, dz = _direction(entity)
    if entity.type != "MTEXT":
        return (-dy, dx, 0.0)
    nx, ny, nz = _normal(entity)
    up = _unit3((ny * dz - nz * dy, nz * dx - nx * dz, nx * dy - ny * dx))
    return up or (-dy, dx, 0.0)


def angle(entity: Text) -> float:
    """The baseline's direction in the text's block, in radians (the module's docstring)."""
    x, y, _ = own_ocs(entity).vector(_direction(entity))
    return math.atan2(y, x)


def world_angle(entity: Text, chain: Chain = ()) -> float:
    x, y, _ = (chain_transform(chain) @ own_ocs(entity)).vector(_direction(entity))
    return math.atan2(y, x)


@dataclass(frozen=True)
class TextFrame:
    """Where a text is drawn in the world: its origin and its baseline and up axes, each one height
    long (world XY), so a glyph point (u, v) in ems lands at origin + u·x_axis + v·y_axis."""

    origin: tuple[float, float]
    x_axis: tuple[float, float]
    y_axis: tuple[float, float]


def frame(entity: Text, chain: Chain, local_height: float) -> TextFrame:
    placed = chain_transform(chain) @ own_ocs(entity)
    ox, oy, _ = placed.apply(entity.position)
    dx, dy, _ = placed.vector(_direction(entity))
    ux, uy, _ = placed.vector(_up(entity))
    return TextFrame(
        (ox, oy), (dx * local_height, dy * local_height), (ux * local_height, uy * local_height)
    )


__all__ = [
    "Height", "HeightSource", "Heights", "TextFrame", "angle", "frame", "height", "ocs", "resolve",
    "world_angle",
]  # fmt: skip
