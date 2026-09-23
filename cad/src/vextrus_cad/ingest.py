"""DXF → EntityGraph v3, in one shot (L-CAD-01 … L-CAD-05).

The extractor reads original entities only. INSERTs explode to world coordinates for rendering,
under a depth cap and a derived-entity budget whose trips are counted; that paint is kept apart in
`derived`, each piece naming the instance that painted it. Block attributes collect separately.
Nothing here reads meaning: no schedule, no view law, no notation — those are TypeScript stages
over the artifact this writes.

v3 (I-415) restates what v2 left behind of how a drawing is WRITTEN, as facts the entity itself
states and nothing derived from them: every text's world rotation and alignment, every block
reference's identity and placement, the layer table's visibility, and a dimension's override text.
It mints no key: L-CAD-02 scopes a key to ezdxf's version and the parameter-set hash, neither of
which the bump touches, so the same drawing keeps the same key multiset. It moves one v2 fact, on
purpose: a single-line text's anchor is taken from the text's own coordinate frame into the world,
so a text a mirrored block paints stands where the world sees it rather than across the y axis.

A fact v3 only restates never refuses a drawing v2 took. Where a text states its alignment or its
direction unreadably — a code outside its closed range, a non-finite angle or point, an extrusion
that is no direction — it is read as DXF's default and the reading is named in the report (L-CAD-04);
a block definition whose content cannot be read carries no digest, and says why. A block
reference's placement is not only restated: the explode applies it to paint, so one placed nowhere
is refused under a name that says so.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

import ezdxf
import ezdxf.recover
from ezdxf.lldxf.const import VSF_NON_RECTANGULAR_CLIPPING
from ezdxf.math import NULLVEC, OCS, Z_AXIS, Vec3

from . import colours, geometry, report, units
from .parameters import DERIVED_ENTITY_BUDGET, EXPLODE_DEPTH_CAP, parameter_set_hash
from .resync import resync_tag_stream

#: The version this extractor writes, and the only one the ingest door takes from it (L-CAD-05).
ENTITYGRAPH_VERSION: Final = 3

#: The oldest version both mirrors still admit on READ: an artifact stored before v3 keeps reading,
#: carrying none of v3's facts (L-CAD-05, "v2 as the floor").
ENTITYGRAPH_FLOOR: Final = 2

#: The source-key scheme ezdxf mints, and the tool identity that scopes those keys (L-CAD-02).
SCHEME: Final = "DXF_HANDLE"
TOOL: Final = "ezdxf"

#: ezdxf's name for the model layout; the artifact's marker for it is the lowercase word.
_MODEL_LAYOUT: Final = "Model"
MODEL_SPACE: Final = "model"

#: Structural records that are not drawing content: attributes collect separately (L-CAD-03),
#: vertices and sequence ends belong to their owner, and a viewport frames paint rather than being
#: paint. None of them is an atom a source key names.
_NOT_CONTENT: Final = frozenset({"ATTRIB", "ATTDEF", "SEQEND", "VERTEX", "VIEWPORT"})

#: Originals that carry paint of their own (L-CAD-03): a block reference paints its block, and a
#: dimension paints its rendered geometry — its measurement text among it. Both stay originals and
#: the paint they carry becomes derived entities naming them.
_PAINTS_DERIVED: Final = frozenset({"INSERT", "DIMENSION"})

#: How close a viewport's view must stand to its own frame, in drawing units, to be the paper's own
#: viewport (the paper seen at 1:1) where its LAYOUT names none. A real window onto model space
#: looks at model coordinates, not at its own place on the page.
_OWN_VIEWPORT_TOLERANCE: Final = 1e-6

#: The DXF names for "where this entity sits", in the order they are asked for. A type answers to
#: at most one of them, and asking for the other raises rather than returning nothing.
_ANCHOR_ATTRIBUTES: Final = ("insert", "location")

#: How near a full turn an elliptical parameter range must come to count as closed.
_FULL_TURN_EPSILON: Final = 1e-9

#: The single-line text types: their `insert` and `align_point` stand in the entity's own OCS, their
#: alignment is the (halign, valign) pair of groups 72/73, and their angle is group 50 in that OCS.
#: MTEXT is the other text type: its `insert` is a world point and its alignment one attachment point.
_SINGLE_LINE_TEXT: Final = frozenset({"TEXT", "ATTRIB", "ATTDEF"})

#: The halign values (group 72) that stretch a text between its two points, so the baseline runs from
#: `insert` to `align_point` whatever group 50 says: ALIGNED and FIT, as ezdxf's renderer reads them.
_STRETCHED_HALIGN: Final = frozenset({3, 5})

#: The closed ranges of the alignment codes a text states — a single-line text's horizontal (group
#: 72) and vertical alignment (group 73 on a TEXT, 74 on an attribute), and an MTEXT's attachment
#: point (group 71) — as DXF defines them and ezdxf's attribute validators hold them. One home in
#: Python: the mirror (`model.py`) reads these, and the Zod mirror states the same ranges.
HALIGN_CODES: Final = range(0, 6)
VALIGN_CODES: Final = range(0, 4)
ATTACHMENT_CODES: Final = range(1, 10)

#: What a text that states no alignment, or one outside its range, is read as: left on the baseline,
#: and an MTEXT attached top left — the defaults ezdxf's validators restore.
_DEFAULT_HALIGN: Final = 0
_DEFAULT_VALIGN: Final = 0
_DEFAULT_ATTACHMENT: Final = 1

#: How short a direction's shadow on the drawing plane may fall, against the direction's own length,
#: before it names no direction there: a baseline standing edge-on to the plane casts a shadow of
#: rounding noise, and the angle of noise is no angle.
_EDGE_ON: Final = 1e-9

#: What reading a drawing's statement can raise where the statement is malformed: ezdxf's own
#: refusals, the extractor's (a non-finite coordinate is a ValueError), and arithmetic on a
#: degenerate shape. The ingest refuses a drawing on the first two where its paint depends on them.
_UNREADABLE: Final = (ezdxf.DXFError, ValueError, ArithmeticError)

#: Told each statement a text makes that is read as DXF's default rather than as stated: the note
#: code it is reported under, and what was read how (L-CAD-04).
_Read = Callable[[str, str], None]


def _finite(vector: Any) -> bool:
    return all(math.isfinite(float(component)) for component in (vector.x, vector.y, vector.z))


def _turn(degrees: float) -> float:
    """An angle as the artifact spells it: counter-clockwise degrees in [0, 360), quantised."""
    turned = geometry.quantise(float(degrees) % 360.0)
    # A hair below a whole turn quantises onto 360, which is the same direction as 0.
    return 0.0 if turned >= 360.0 else turned


def _heading(vector: Any) -> float | None:
    """The world angle of a direction vector's projection onto the drawing plane, in [0, 360) — or
    None where the vector names no direction there: not finite, of no length, or standing edge-on to
    the plane, so that its shadow on it is rounding noise and its angle the angle of noise."""
    if not _finite(vector):
        return None
    shadow = math.hypot(float(vector.x), float(vector.y))
    if shadow == 0 or shadow <= _EDGE_ON * float(vector.magnitude):
        return None
    return _turn(math.degrees(math.atan2(float(vector.y), float(vector.x))))


def _pair(point: Any) -> list[float]:
    return [geometry.quantise(float(point.x)), geometry.quantise(float(point.y))]


def _frame(entity: Any) -> tuple[Any, bool]:
    """The entity's own coordinate frame (its OCS), and whether its extrusion could be read at all.

    An extrusion that is not a finite, non-zero direction frames nothing — ezdxf would build its axes
    out of NaN — so the entity is read in the world's frame instead: DXF's default extrusion, and the
    frame v2 read every text in.
    """
    extrusion = Vec3(entity.dxf.get("extrusion", Z_AXIS))
    if _finite(extrusion) and not extrusion.is_null:
        return entity.ocs(), True
    return OCS(), False


def _angled(degrees: Any, frame: Any) -> Any | None:
    """The world direction a stated angle names in a frame, or None where the angle is not finite."""
    angle = float(degrees)
    return frame.to_wcs(Vec3.from_deg_angle(angle)) if math.isfinite(angle) else None


def _rotation(direction: Any | None, what: str, read: _Read) -> float:
    """A text's world rotation from the direction its statement names, or 0 where it names none."""
    heading = None if direction is None else _heading(direction)
    if heading is None:
        read(report.TEXT_ROTATION_UNREADABLE, f"{what} names no direction on the drawing plane, read as 0")
        return 0.0
    return heading


def _code(stated: Any, codes: range, default: int, what: str, read: _Read) -> int:
    """An alignment code as the drawing states it, or DXF's default where it states one outside its
    closed range — the value ezdxf's own attribute validator restores."""
    code = int(stated)
    if code in codes:
        return code
    read(
        report.TEXT_ALIGNMENT_UNREADABLE,
        f"{what} outside {codes.start}-{codes.stop - 1}, read as {default}",
    )
    return default


def _group(entity: Any, attribute: str) -> str:
    """A statement as the file spells it — the type and the DXF group code ezdxf reads it from — so a
    note names the tag an operator would find in the file (valign is group 73 on a TEXT and 74 on an
    attribute)."""
    return f"{entity.dxftype()} group {entity.DXFATTRIBS.get(attribute).code}"


def _text_facts(entity: Any, dxftype: str, read: _Read) -> dict[str, Any]:
    """How a text is written: its world rotation and its alignment, as the entity states them.

    The rotation is the WORLD angle of the text's baseline, counter-clockwise and normalised
    (I-415). A single-line text states its angle in its own OCS (group 50), so the baseline's
    direction is taken through that OCS into the world: a text inside a mirrored block reference comes
    out of the explode with its extrusion flipped, and its group 50 alone would read the mirror image.
    An ALIGNED or FIT text runs from its insert to its alignment point whatever group 50 says, and is
    read that way. MTEXT reads as `get_rotation()` does, which honours `text_direction` — a world
    vector that outranks group 50 wherever a writer states both — and a group-50-only MTEXT goes
    through its OCS like a TEXT does.

    Alignment is restated raw: `halign`/`valign` (groups 72 and 73, 74 on an attribute) for a
    single-line text, and the `attachment` point (group 71, 1-9) for MTEXT. A single-line text
    aligned anywhere but left on the baseline is placed by its alignment point, not its insert (the
    insert is a derived point a writer may or may not have recomputed), so that point travels too as
    `align_point`, in world coordinates. The record's own anchor (`points`) stays the insert it
    always was.

    None of this is applied, so none of it may refuse the drawing (I-415): a statement that
    cannot be read — an alignment code outside its closed range, a non-finite angle, direction or
    alignment point, a direction edge-on to the drawing plane, an extrusion that is no direction — is
    read as DXF's default and handed to `read`, which names it in the report.
    """
    frame, framed = _frame(entity)
    if not framed:
        read(report.TEXT_EXTRUSION_UNREADABLE, f"{dxftype} extrusion is no direction, read as +Z")
    if dxftype == "MTEXT":
        attachment = _code(
            entity.dxf.get("attachment_point", _DEFAULT_ATTACHMENT),
            ATTACHMENT_CODES,
            _DEFAULT_ATTACHMENT,
            _group(entity, "attachment_point"),
            read,
        )
        if entity.dxf.hasattr("text_direction"):
            # What get_rotation() reads: a world vector, so no frame stands between it and the world.
            rotation = _rotation(Vec3(entity.dxf.text_direction), "MTEXT text_direction", read)
        else:
            direction = _angled(entity.dxf.get("rotation", 0.0), frame)
            rotation = _rotation(direction, "MTEXT group 50", read)
        return {"rotation": rotation, "attachment": attachment}

    stated_halign = entity.dxf.get("halign", _DEFAULT_HALIGN)
    stated_valign = entity.dxf.get("valign", _DEFAULT_VALIGN)
    halign = _code(stated_halign, HALIGN_CODES, _DEFAULT_HALIGN, _group(entity, "halign"), read)
    valign = _code(stated_valign, VALIGN_CODES, _DEFAULT_VALIGN, _group(entity, "valign"), read)
    aligned = (halign, valign) != (_DEFAULT_HALIGN, _DEFAULT_VALIGN)
    insert = Vec3(entity.dxf.insert)
    # ezdxf's own reading: an alignment point the entity does not state is its insert.
    align_point = Vec3(entity.dxf.get("align_point", insert))
    if aligned and not _finite(align_point):
        read(report.TEXT_ALIGNMENT_UNREADABLE, f"{dxftype} alignment point not finite, read as its insert")
        align_point = insert
    if halign in _STRETCHED_HALIGN and not insert.isclose(align_point):
        baseline = frame.to_wcs(align_point - insert)
        rotation = _rotation(baseline, f"{dxftype} baseline (insert to alignment point)", read)
    else:
        rotation = _rotation(_angled(entity.dxf.get("rotation", 0.0), frame), f"{dxftype} group 50", read)
    facts: dict[str, Any] = {"rotation": rotation, "halign": halign, "valign": valign}
    if aligned:
        facts["align_point"] = _pair(frame.to_wcs(align_point))
    return facts


def _placed(insert: Any, which: str) -> None:
    """Refuse a block reference that places its block nowhere, naming what it states (L-CAD-04).

    Unlike a text's facts, a placement is not only restated: the explode applies it to the block's
    paint. A reference that states no finite insert point, rotation, scale or extrusion places its
    block nowhere — v2 could not finish exploding one (its walk ran unbounded) — so it is refused
    under a name that says what it states, rather than as a coordinate it never had. `which` is how
    the refusal names the reference: its handle, or the original a nested one was painted by.
    """
    stated = {
        "insert point": _finite(Vec3(insert.dxf.get("insert", NULLVEC))),
        "rotation": math.isfinite(float(insert.dxf.get("rotation", 0.0))),
        "x scale": math.isfinite(float(insert.dxf.get("xscale", 1.0))),
        "y scale": math.isfinite(float(insert.dxf.get("yscale", 1.0))),
        "extrusion": _frame(insert)[1],
    }
    unplaced = [name for name, readable in stated.items() if not readable]
    if unplaced:
        raise ValueError(
            f"block reference {which} (block {insert.dxf.name}) states no finite "
            f"{' and no finite '.join(unplaced)}, so where it places its block cannot be read"
        )


def _placement(insert: Any) -> dict[str, Any]:
    """Where a block reference puts its block, in one canonical spelling (I-416).

    The world transform a reference applies, decomposed as the world sees it: the point the block's
    base lands on (`at`), the world angle the block's own x axis turns to (`rotation`, CCW, [0, 360)),
    the length each block axis is scaled to (`scale`, both positive), and whether the reference
    mirrors the block (`mirrored`: the world image of the block's y axis is on the right of its x
    axis). A DXF can spell one placement several ways — x scale -1 is y scale -1 turned half a turn,
    and a flipped extrusion is a mirror too — and this is the one spelling of all of them, so two
    references that place a block alike carry the same record. An x axis the reference scales to
    nothing, or stands edge-on to the drawing plane, turns no way on it, and is spelled 0. A
    reference placed nowhere is refused (`_placed`).
    """
    _placed(insert, str(insert.dxf.get("handle", "?")))
    matrix = insert.matrix44()
    x_axis = matrix.transform_direction(Vec3(1, 0, 0))
    y_axis = matrix.transform_direction(Vec3(0, 1, 0))
    rotation = _heading(x_axis)
    return {
        "at": _pair(insert.ocs().to_wcs(Vec3(insert.dxf.insert))),
        "rotation": 0.0 if rotation is None else rotation,
        "scale": [
            geometry.quantise(math.hypot(x_axis.x, x_axis.y)),
            geometry.quantise(math.hypot(y_axis.x, y_axis.y)),
        ],
        "mirrored": (x_axis.x * y_axis.y - x_axis.y * y_axis.x) < 0,
    }


def _layer_records(doc: Any) -> list[dict[str, Any]]:
    """The layer table's visibility, in the drawing's own table order (I-417).

    Restated, never applied: whether a layer is switched on, frozen, and plotted is a fact of the
    drawing a reader may need — a frozen layer of stale paint is not the sheet — but deciding what an
    off or frozen layer means for extents, the partition or a measurement is a stage over the
    artifact, not this extractor's business (L-CAD-01).
    """
    return [
        {
            "name": str(layer.dxf.name),
            "on": bool(layer.is_on()),
            "frozen": bool(layer.is_frozen()),
            "plot": bool(int(layer.dxf.get("plot", 1))),
        }
        for layer in doc.layers
    ]


def _dimension_override(entity: Any) -> str | None:
    """A dimension's own text (group 1) where it states one, raw (L-CAD-01).

    Empty and a bare `<>` both mean "the measurement", which the dimension's derived paint already
    carries; anything else is text the designer wrote, and until now it existed only as that paint.
    """
    stated = str(entity.dxf.get("text", "") or "")
    return None if stated in {"", "<>"} else stated


class IngestError(Exception):
    """A drawing this extractor refuses: loud failure, nothing written (L-CAD-04).

    Every refusal carries a code from the closed table in `report.py` and says it first, because the
    operator two processes away reads a string: `DXF_UNREADABLE` tells them their export is the
    problem, `SOURCE_NOT_READABLE` tells them it is ours, and a bare traceback tells them neither.
    """

    def __init__(self, code: str, message: str) -> None:
        if code not in report.REFUSAL_CODES:
            raise ValueError(f"{code} is not a refusal this extractor knows")
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


@dataclass
class _Readings:
    """The statements this run read as DXF's default rather than as the drawing states them, counted
    per note code and per statement, and said once each when the run ends (L-CAD-04: a default read
    in silence is a silent loss). A reading counts once per record it lands in — a block's own text is
    read for its definition's digest and again for each reference that paints it.
    """

    counts: dict[tuple[str, str], int] = field(default_factory=dict)

    def default(self, code: str, what: str) -> None:
        self.counts[(code, what)] = self.counts.get((code, what), 0) + 1

    def write(self, notes: report.Report) -> None:
        """One note per code: how many readings in all, and each statement with its own count."""
        said: dict[str, list[str]] = {}
        totals: dict[str, int] = {}
        for (code, what), count in sorted(self.counts.items()):
            said.setdefault(code, []).append(f"{what}: {count}")
            totals[code] = totals.get(code, 0) + count
        for code, statements in said.items():
            notes.add(code, "; ".join(statements), totals[code])


@dataclass
class _Counters:
    """One space's fidelity counters (R-TO-001)."""

    explode_truncated: bool = False
    explode_losses: dict[str, int] = field(default_factory=dict)
    flatten_capped: dict[str, int] = field(default_factory=dict)

    def lose(self, dxftype: str) -> None:
        self.explode_truncated = True
        self.explode_losses[dxftype] = self.explode_losses.get(dxftype, 0) + 1

    def cap(self, dxftype: str) -> None:
        self.flatten_capped[dxftype] = self.flatten_capped.get(dxftype, 0) + 1

    def record(self, space: str, conversion_losses: dict[str, int] | None = None) -> dict[str, Any]:
        """This space's counters, with what the conversion lost on it where a conversion lost any.

        `conversion_losses` is the DWG lane's reconciliation carried into the artifact: how many of
        each class the conversion did not carry across on this space (`dwg/reconcile.py`). It is
        written only where there is one, so a DXF ingest — which crosses no converter — spells the
        same bytes it always did, and both mirrors read the key as optional (L-CAD-05).
        """
        record: dict[str, Any] = {
            "space": space,
            "explode_truncated": self.explode_truncated,
            "explode_losses": dict(sorted(self.explode_losses.items())),
            "flatten_capped": dict(sorted(self.flatten_capped.items())),
        }
        if conversion_losses:
            record["conversion_losses"] = dict(sorted(conversion_losses.items()))
        return record


@dataclass
class _Space:
    """Everything one layout contributes to the artifact."""

    name: str
    kind: str
    entities: list[dict[str, Any]] = field(default_factory=list)
    derived: list[dict[str, Any]] = field(default_factory=list)
    attributes: list[dict[str, Any]] = field(default_factory=list)
    boxes: list[tuple[float, float, float, float]] = field(default_factory=list)
    counters: _Counters = field(default_factory=_Counters)
    #: The windows a paper layout opens onto model space, as the drawing states them; a model space
    #: has none. Inventory rather than paint: a viewport frames what is drawn and draws nothing.
    viewports: list[dict[str, Any]] = field(default_factory=list)

    def is_content_less(self) -> bool:
        return not self.entities and not self.derived


def source_key(handle: str) -> str:
    """`scheme:key` for a DXF entity — the file's own handle, uppercased (L-CAD-02)."""
    return f"{SCHEME}:{handle.upper()}"


def _viewport_records(layout: Any) -> list[dict[str, Any]]:
    """Every window a paper layout opens onto model space, in the drawing's own order (L-CAD-05).

    A VIEWPORT is not content — it frames paint rather than being paint, so no source key is minted
    for it and no space's extents include it — but what it frames is a fact of the drawing a reader
    of the sheet needs: without it a paper layout is a title block around an empty page. Each record
    restates only what the entity carries: where its window stands on the paper (`centre`, `size`),
    which piece of model space it looks at (`view_centre`, `view_height`), whether it is switched
    on, its twist and whether a non-rectangular boundary clips it. A consumer derives the scale
    (`size[1] / view_height`) and does the projecting; nothing here does either.

    The layout's own viewport — the paper seen at 1:1, the one its LAYOUT object names as
    `viewport_handle` — is not a window onto model space and is left out. Where the LAYOUT names
    one, that handle is the reading. Where it names none (a converter that dropped the reference,
    a writer that deleted the viewport and left the pointer dangling), the paper's own viewport is
    known by its shape instead: it looks at its own centre at its own height. The `id` is never
    consulted — LibreDWG's conversion flattens every viewport's id to 1, so an id tells a converted
    drawing's windows apart from nothing. A window of no height frames nothing and is left out.
    """
    dxf_layout = getattr(layout, "dxf_layout", None)
    own = None if dxf_layout is None else dxf_layout.dxf.get("viewport_handle", None)
    own = None if own is None else str(own).upper()
    records: list[dict[str, Any]] = []
    for entity in layout:
        if entity.dxftype() != "VIEWPORT":
            continue
        handle = entity.dxf.get("handle", None)
        if handle is None:
            continue
        handle = str(handle).upper()
        view_height = float(entity.dxf.get("view_height", 0.0))
        if not (math.isfinite(view_height) and view_height > 0):
            continue
        centre = entity.dxf.center
        target = entity.dxf.view_center_point
        if own is not None:
            is_own = handle == own
        else:
            is_own = (
                math.isclose(target.x, centre.x, abs_tol=_OWN_VIEWPORT_TOLERANCE)
                and math.isclose(target.y, centre.y, abs_tol=_OWN_VIEWPORT_TOLERANCE)
                and math.isclose(view_height, float(entity.dxf.height), abs_tol=_OWN_VIEWPORT_TOLERANCE)
            )
        if is_own:
            continue
        records.append(
            {
                "centre": [geometry.quantise(centre.x), geometry.quantise(centre.y)],
                "clipped": bool(int(entity.dxf.get("flags", 0)) & VSF_NON_RECTANGULAR_CLIPPING),
                "handle": handle,
                "on": int(entity.dxf.get("status", 0)) > 0,
                "size": [
                    geometry.quantise(float(entity.dxf.width)),
                    geometry.quantise(float(entity.dxf.height)),
                ],
                "twist": geometry.quantise(float(entity.dxf.get("view_twist_angle", 0.0))),
                "view_centre": [geometry.quantise(target.x), geometry.quantise(target.y)],
                "view_height": geometry.quantise(view_height),
            }
        )
    return records


def _closed_flag(entity: Any, dxftype: str) -> bool | None:
    """Whether this entity's geometry closes, or None when its type has no such notion."""
    if dxftype == "LWPOLYLINE":
        return bool(entity.closed)
    if dxftype == "POLYLINE":
        return bool(entity.is_closed)
    if dxftype == "SPLINE":
        return bool(entity.closed)
    if dxftype == "CIRCLE":
        return True
    if dxftype == "ELLIPSE":
        # An ellipse carries no closed flag of its own: it closes when its parameter range spans a
        # whole turn, and an elliptical arc does not.
        span = abs(float(entity.dxf.end_param) - float(entity.dxf.start_param))
        return span >= math.tau - _FULL_TURN_EPSILON
    return None


def _text_of(entity: Any, dxftype: str) -> tuple[str, float] | None:
    """An entity's raw text and its world height, or None when it carries no text.

    Text crosses the seam raw (L-CAD-01): the AutoCAD escapes are the app's parsers' business.
    """
    if dxftype == "MTEXT":
        return (str(entity.text), geometry.quantise(float(entity.dxf.char_height)))
    if dxftype in {"TEXT", "ATTRIB", "ATTDEF"}:
        return (str(entity.dxf.text), geometry.quantise(float(entity.dxf.height)))
    return None


def _anchor(entity: Any) -> tuple[float, float] | None:
    """An entity's own location in the world, for spaces whose extents nothing else would place it in.

    A single-line text's insert stands in its own OCS, so it is taken into the world first
    (I-415): the text of a mirrored block reference comes out of the explode with its extrusion
    flipped, and its raw insert would place it on the far side of the drawing's y axis. For the usual
    extrusion the OCS is the world and the point is the one it always was. An MTEXT's insert and a
    POINT's location are world points already. A text whose extrusion is no direction is read in
    the world's frame, where v2 read it.
    """
    for name in _ANCHOR_ATTRIBUTES:
        try:
            anchor = entity.dxf.get(name, None)
        except ezdxf.DXFAttributeError:
            # The name is not part of this type's namespace at all, which is not the same as unset.
            continue
        if anchor is not None:
            if entity.dxftype() in _SINGLE_LINE_TEXT:
                # The frame `_text_facts` read the same text in, which named an unreadable one.
                anchor = _frame(entity)[0].to_wcs(Vec3(anchor))
            return (geometry.quantise(anchor.x), geometry.quantise(anchor.y))
    return None


class _Extractor:
    """One invocation's state: stateless between runs, budgeted within one (L-CAD-03, L-CAD-04)."""

    def __init__(self, doc: Any, notes: report.Report | None = None) -> None:
        notes = report.Report() if notes is None else notes
        self._doc = doc
        self._notes = notes
        #: The statements read as DXF's default rather than as stated, said once each at the end.
        self._readings = _Readings()
        #: The definitions left with no digest because a record in them, or in a definition they
        #: nest, cannot be read (BLOCK_DEFINITION_UNREADABLE).
        self._unreadable: set[str] = set()
        self._layers = colours.LayerColours.of(doc)
        #: How finely a curve of THIS drawing is described, in this drawing's units — derived from
        #: `$INSUNITS` so the accuracy is the same length on every file (L-MEA-01).
        self._tolerance = report.flatten_tolerance(int(doc.header.get("$INSUNITS", 0)), notes)
        #: How much of the pinned derived-entity budget this invocation has spent walking (L-CAD-03).
        self._expanded = 0
        #: Each block definition read so far: its digest (None where it has none) and its nesting
        #: height, read once per invocation however many references name it.
        self._definitions: dict[str, tuple[str | None, float]] = {}

    def definition(self, name: str) -> tuple[str | None, float]:
        """A block definition's content digest and its nesting height.

        The digest is the block's identity as learn-and-count needs it (I-416): the same symbol
        keeps the same digest under any name, at any placement, in any drawing. So it is a sha256 over
        the definition's CONTENT — each record's type, its geometry flattened in block coordinates and
        measured from the block's base point, its text, height, rotation and alignment, and a nested
        reference's own digest and placement — and over nothing a writer varies without changing the
        symbol: no handle, no block name, no colour, no layer and no linetype, the exclusions L-CAD-02
        already makes of a content digest. The records are hashed as a sorted multiset, so the order
        a writer happened to emit them in is not part of the symbol either. An attribute definition
        is no record of it: it is a slot each reference fills (its values travel as the reference's
        `block_attributes`), and the explode leaves it out of the paint for the same reason.

        A definition has no digest (None) where the drawing does not hold it, where it reaches a block
        cycle (its height is then unbounded), or where it nests deeper than the explode depth cap —
        the same line past which its paint is not drawn either (L-CAD-03). Nor where it holds a record
        the digest cannot read, or nests a definition that does: a symbol part of which cannot be read
        has no identity to state, and the report names which record and why
        (BLOCK_DEFINITION_UNREADABLE). That is never a refusal here — the walk reads definitions the
        explode may never reach, past the depth cap, which v2 never read at all — while a record the
        explode does reach refuses the drawing there, exactly as it did before v3.

        The walk is iterative and post-order, and every definition it meets is read exactly once and
        kept: a block tree that branches at every level is as many reads as it has definitions, never
        as many as it has paths (the breaker in tests/cad/ingest-bounds-breaker.test.ts), however deep
        it nests and whichever reference asks first. A reference reached again while its own
        definition is still on the walk closes a cycle, and every definition that reaches one has no
        digest — which is a fact of the drawing, so it is kept like any other answer.
        """
        if name in self._definitions:
            return self._definitions[name]

        #: The walk: each open definition and the names it references that are still to be read.
        walk: list[tuple[str, Any, list[str]]] = []
        open_names: set[str] = set()

        def enter(block_name: str) -> None:
            block = self._doc.blocks.get(block_name)
            if block is None:
                self._definitions[block_name] = (None, 0)
                return
            nested = [str(entity.dxf.name) for entity in block if entity.dxftype() == "INSERT"]
            walk.append((block_name, block, nested))
            open_names.add(block_name)

        enter(name)
        while walk:
            current, block, pending = walk[-1]
            while pending and (pending[-1] in self._definitions or pending[-1] in open_names):
                pending.pop()
            if pending:
                enter(pending.pop())
                continue
            walk.pop()
            open_names.discard(current)
            self._definitions[current] = self._read_definition(current, block, open_names)
        return self._definitions.get(name, (None, 0))

    def _read_definition(self, name: str, block: Any, open_names: set[str]) -> tuple[str | None, float]:
        """One definition's digest and height, every definition it references already read — or
        still open on the walk, which is a cycle.

        A record the digest cannot read leaves the definition without one, named once here; a nested
        definition left without one for that reason passes it on silently, the first note having said
        so. The height is counted either way, so the depth cap reads the definition as it would have.
        """
        base = Vec3(block.block.dxf.base_point)
        items: list[str] = []
        height: float = 1
        unreadable: str | None = None
        nests_unreadable = False
        for entity in block:
            height = max(height, 1 + self._nested_height(entity, open_names))
            if entity.dxftype() == "INSERT" and str(entity.dxf.name) in self._unreadable:
                nests_unreadable = True
            try:
                item = self._definition_item(entity, base, open_names)
            except _UNREADABLE as error:
                if unreadable is None:
                    unreadable = f"{entity.dxftype()} {entity.dxf.get('handle', '?')}: {error}"
                continue
            if item is not None:
                items.append(json.dumps(item, sort_keys=True, separators=(",", ":"), ensure_ascii=False))
        if height > EXPLODE_DEPTH_CAP:
            return None, height
        if unreadable is not None:
            self._notes.add(
                report.BLOCK_DEFINITION_UNREADABLE,
                f"block {name}: {unreadable}; it and every block that nests it carry no digest",
            )
        if unreadable is not None or nests_unreadable:
            self._unreadable.add(name)
            return None, height
        return hashlib.sha256("\n".join(sorted(items)).encode("utf-8")).hexdigest(), height

    def _nested_height(self, entity: Any, open_names: set[str]) -> float:
        """The nesting height a record adds to its definition: none for drawn content, and for a
        nested reference the height of the definition it names — unbounded where that definition is
        still open on the walk, because the reference closes a cycle."""
        if entity.dxftype() != "INSERT":
            return 0
        nested_name = str(entity.dxf.name)
        if nested_name in open_names or nested_name not in self._definitions:
            return math.inf
        return self._definitions[nested_name][1]

    def _definition_item(self, entity: Any, base: Vec3, open_names: set[str]) -> dict[str, Any] | None:
        """One record of a block definition as its digest reads it, measured from the base point."""
        dxftype = entity.dxftype()
        if dxftype in _NOT_CONTENT:
            return None

        def local(x: float, y: float) -> list[float]:
            return [geometry.quantise(x - base.x), geometry.quantise(y - base.y)]

        if dxftype == "INSERT":
            nested_name = str(entity.dxf.name)
            # A reference into a definition still open on the walk closes a cycle, and names none.
            closes_cycle = nested_name in open_names or nested_name not in self._definitions
            nested = None if closes_cycle else self._definitions[nested_name][0]
            placement = _placement(entity)
            placement["at"] = local(*placement["at"])
            return {"type": dxftype, "definition": nested, **placement}

        item: dict[str, Any] = {"type": dxftype}
        flattened = geometry.flatten(entity, self._tolerance)
        if flattened is not None:
            item["points"] = [local(x, y) for x, y in flattened[0]]
        closed = _closed_flag(entity, dxftype)
        if closed is not None:
            item["closed"] = closed
        text = _text_of(entity, dxftype)
        if text is not None:
            item["text"], item["height"] = text
            item.update(_text_facts(entity, dxftype, self._read_for_digest))
            if "align_point" in item:
                item["align_point"] = local(*item["align_point"])
        if "points" not in item:
            anchor = _anchor(entity)
            if anchor is not None:
                item["anchor"] = local(*anchor)
        return item

    def _read_for_digest(self, code: str, what: str) -> None:
        """A block's own text read as a default for its definition's digest — counted apart from
        the records its references paint, which read the same text again, once each."""
        self._readings.default(code, f"{what}, in a block definition")

    def finish(self) -> None:
        """Say what the run read as a default, once the whole drawing has been read."""
        self._readings.write(self._notes)

    def block_record(self, insert: Any) -> dict[str, Any]:
        """A block reference's identity: the block it names, that block's content digest, and where
        and how it places it (I-416). Restated from the reference; the paint stays in `derived`.
        """
        name = str(insert.dxf.name)
        digest, _height = self.definition(name)
        return {"name": name, "definition_sha256": digest, **_placement(insert)}

    def entity_record(
        self,
        entity: Any,
        space: _Space,
        inherited: colours.Channels | None,
    ) -> dict[str, Any] | None:
        dxftype = entity.dxftype()
        if dxftype in _NOT_CONTENT:
            return None

        record: dict[str, Any] = {
            "type": dxftype,
            "space": space.name,
            "layer": str(entity.dxf.layer),
            "colour": colours.resolve(entity, self._layers, inherited),
        }

        closed = _closed_flag(entity, dxftype)
        flattened = geometry.flatten(entity, self._tolerance)
        points: list[geometry.Point] | None = None
        if flattened is not None:
            points, capped = flattened
            if capped:
                space.counters.cap(dxftype)
            if closed:
                # A coarsened flattening still comes back round to its start, so the closing vertex
                # is dropped there too — the artifact spells each vertex once whichever it is.
                points = geometry.drop_closing_vertex(points)
            record["points"] = [[x, y] for x, y in points]
        elif dxftype == "POINT":
            anchor = _anchor(entity)
            if anchor is not None:
                points = [anchor]
                record["points"] = [[anchor[0], anchor[1]]]

        if closed is not None:
            record["closed"] = closed
            if closed and points is not None and len(points) >= 3:
                record["area"] = geometry.shoelace_area(points)

        text = _text_of(entity, dxftype)
        if text is not None:
            record["text"], record["height"] = text
            record.update(_text_facts(entity, dxftype, self._readings.default))
            if points is None:
                # A text has no path for ezdxf to build, so nothing above places it — and a text
                # nothing places is a text no stage over the artifact can read as standing anywhere.
                # L-CAD-06 partitions model space by the captions drawn in it, which means a caption
                # has to say where it stands; so a text-bearing original carries its own insertion
                # point, the same anchor the space's extents are already taken from below.
                anchor = _anchor(entity)
                if anchor is not None:
                    points = [anchor]
                    record["points"] = [[anchor[0], anchor[1]]]

        if dxftype == "DIMENSION":
            override = _dimension_override(entity)
            if override is not None:
                record["override"] = override

        box = geometry.bounds(points) if points else None
        if box is None:
            anchor = _anchor(entity) if dxftype not in _PAINTS_DERIVED else None
            if anchor is not None:
                box = (anchor[0], anchor[1], anchor[0], anchor[1])
        if box is not None:
            space.boxes.append(box)
        return record

    def collect_attributes(self, insert: Any, key: str, space: _Space) -> None:
        for attrib in getattr(insert, "attribs", ()):
            dxftype = attrib.dxftype()
            text = _text_of(attrib, dxftype)
            if text is None:
                continue
            facts = _text_facts(attrib, dxftype, self._readings.default)
            space.attributes.append(
                {
                    "src": key,
                    "tag": str(attrib.dxf.tag),
                    "text": text[0],
                    "height": text[1],
                    # An attribute carries no anchor of its own in the artifact, so its alignment
                    # point would be a point with nothing to be read against: how it is turned and
                    # aligned travels, where it stands does not (I-415).
                    "rotation": facts["rotation"],
                    "halign": facts["halign"],
                    "valign": facts["valign"],
                }
            )

    def explode(
        self,
        instance: Any,
        key: str,
        space: _Space,
        inherited: colours.Channels,
        depth: int,
    ) -> None:
        """Explode one painting original to world coordinates, for rendering only (L-CAD-03).

        The budget bounds the walk, not merely the mint. A block tree that branches even modestly is
        an exponential number of instances below the depth cap, and an instance whose paint is
        refused still costs the expansion that discovered it, so charging only minted entities would
        leave a few kilobytes of lawful drawing able to spend a quarter of an hour of one shot
        (L-CAD-04's generous timeouts are not an unbounded one). Every virtual entity this extractor
        looks at is charged against `DERIVED_ENTITY_BUDGET`; once it is spent nothing further is
        entered, and what is skipped is counted as lost paint.
        """
        for virtual in instance.virtual_entities():
            dxftype = virtual.dxftype()
            if self._expanded >= DERIVED_ENTITY_BUDGET:
                # Structural records are not paint (L-CAD-03), so they are not lost paint either:
                # a SEQEND or a VERTEX would never have become a derived entity to begin with.
                if dxftype not in _NOT_CONTENT:
                    space.counters.lose(dxftype)
                continue
            self._expanded += 1

            if dxftype == "INSERT":
                if depth + 1 > EXPLODE_DEPTH_CAP:
                    # The instance is not entered, so its attributes are no more collected than its
                    # geometry is: the counters and `block_attributes` say the same thing about it.
                    space.counters.lose(dxftype)
                    continue
                # Refused before its walk, which would otherwise run unbounded (as v2's did).
                _placed(virtual, f"nested in {key}")
                self.collect_attributes(virtual, key, space)
                self.explode(virtual, key, space, inherited, depth + 1)
                continue

            record = self.entity_record(virtual, space, inherited)
            if record is None:
                continue
            record["src"] = key
            space.derived.append(record)

    def read_space(self, layout: Any, name: str, kind: str) -> _Space:
        space = _Space(name=name, kind=kind)
        if kind == "paper":
            space.viewports = _viewport_records(layout)
        for entity in layout:
            handle = entity.dxf.get("handle", None)
            if handle is None:
                # Nothing to mint a source key from, so this is no atom of the extraction surface
                # (L-CAD-02) — and it must not reach the extents of a space it does not appear in.
                continue
            record = self.entity_record(entity, space, None)
            if record is None:
                continue
            key = source_key(str(handle))
            record["key"] = key
            if entity.dxftype() == "INSERT":
                record["block"] = self.block_record(entity)
            space.entities.append(record)

            if entity.dxftype() in _PAINTS_DERIVED:
                if entity.dxftype() == "INSERT":
                    self.collect_attributes(entity, key, space)
                rgb = record["colour"]["rgb"]
                painted: colours.Channels = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
                self.explode(entity, key, space, painted, 1)
        return space


def _bbox_record(box: tuple[float, float, float, float] | None) -> dict[str, list[float]] | None:
    if box is None:
        return None
    return {"max": [box[2], box[3]], "min": [box[0], box[1]]}


def _stated_losses(conversion_losses: dict[str, dict[str, int]] | None) -> dict[str, dict[str, int]]:
    """The caller's per-space, per-class conversion losses, kept only where something was lost."""
    if not conversion_losses:
        return {}
    kept: dict[str, dict[str, int]] = {}
    for space, types in conversion_losses.items():
        lost = {dxftype: count for dxftype, count in types.items() if count > 0}
        if lost:
            kept[space] = lost
    return kept


def ingest_document(
    doc: Any,
    notes: report.Report | None = None,
    conversion_losses: dict[str, dict[str, int]] | None = None,
) -> dict[str, Any]:
    """The whole artifact for an already-opened drawing, with what it carries but does not draw
    written into `notes` (L-CAD-04: never a silent loss).

    `conversion_losses` is what a conversion in front of this ingest lost, per space and per class
    (the DWG lane's `reconcile`). It is a fact about the drawing this document came from rather than
    about the document, so it can only arrive from the caller — and it is carried onto the counters,
    where R-TO-001 already keeps what the extraction lost and where.
    """
    notes = report.Report() if notes is None else notes
    report.survey(doc, notes)
    extractor = _Extractor(doc, notes)

    spaces: list[_Space] = []
    dropped: list[str] = []
    for layout_name in doc.layouts.names_in_taborder():
        is_model = layout_name == _MODEL_LAYOUT
        space = extractor.read_space(
            doc.layouts.get(layout_name),
            MODEL_SPACE if is_model else layout_name,
            "model" if is_model else "paper",
        )
        # A paper layout with nothing on it is inventory, not a sheet: dropped and counted.
        if not is_model and space.is_content_less():
            dropped.append(layout_name)
            continue
        spaces.append(space)
    extractor.finish()

    layouts: list[dict[str, Any]] = []
    for space in spaces:
        box, strays = geometry.robust_extents(space.boxes)
        layouts.append(
            {
                "name": space.name,
                "kind": space.kind,
                "bbox": _bbox_record(box),
                "strays_rejected": strays,
                "viewports": space.viewports,
            }
        )

    # A class the conversion lost on a space this artifact never carried — a paper layout the
    # conversion emptied, so nothing was left to keep it — has no counters row to stand on, and it
    # is exactly the loss that must not go unsaid: the sheet is gone. It gets a row of its own,
    # named, with nothing else on it.
    losses = _stated_losses(conversion_losses)
    counters = [space.counters.record(space.name, losses.get(space.name)) for space in spaces]
    counters += [
        _Counters().record(name, losses[name])
        for name in sorted(set(losses) - {space.name for space in spaces})
    ]

    return {
        "block_attributes": [record for space in spaces for record in space.attributes],
        "counters": counters,
        "derived": [record for space in spaces for record in space.derived],
        "dropped_layouts": dropped,
        "entities": [record for space in spaces for record in space.entities],
        "entitygraph_version": ENTITYGRAPH_VERSION,
        "ingest": {
            "parameter_set_hash": parameter_set_hash(),
            "scheme": SCHEME,
            "tool": TOOL,
            "tool_version": ezdxf.__version__,
        },
        "insunits": units.report(int(doc.header.get("$INSUNITS", 0))),
        "layers": _layer_records(doc),
        "layouts": layouts,
    }


def _open_recovered(stream: io.BytesIO, notes: report.Report) -> Any:
    """One recover-mode open, with what the audit repaired on the way in recorded as a note.

    `ezdxf.recover` is the open this extractor uses rather than `readfile`, because the drawings this
    product is given are converter output: a file AutoCAD wrote, a file LibreDWG wrote from a file
    AutoCAD wrote, a file a consultant's 2009 seat wrote. `readfile` refuses all of them over one
    flaw; recover mode repairs what it can and hands back an auditor saying what it did — and a
    repair nobody is told about is a silent edit of somebody's drawing, so the count travels
    (L-CAD-09).

    What the reader SAYS on the way in is held for the duration of the open rather than written to
    the caller's streams (L-CAD-01: this process's answer is the artifact it writes, and its streams
    belong to whoever spawned it). `ezdxf` logs one warning per non-unique handle it finds, and
    seventeen of those across a converted sheet set is the reader talking over this command's own
    contract. Held is not dropped: the count and the words become a note, like everything else.
    """
    # Imported here rather than at the top of the module: `vextrus_cad.dwg` reads this module for
    # the name it spells model space under, so naming it up there would close the circle.
    from .dwg.quiet import held_library_words, said

    with held_library_words() as words:
        doc, auditor = ezdxf.recover.read(stream)
    if auditor.fixes or auditor.errors:
        notes.add(
            report.AUDIT_REPAIRED,
            f"{len(auditor.fixes)} repaired, {len(auditor.errors)} left unrepaired",
            len(auditor.fixes) + len(auditor.errors),
        )
    if words:
        notes.add(
            report.READER_WARNED,
            f"{len(words)} line(s) the reader said opening this drawing, "
            f"held off this process's streams{said(words)}",
            len(words),
        )
    return doc


def read_document(source: Path, notes: report.Report) -> Any:
    """Open a drawing, repairing its tag stream at most once, or refuse it by name (L-CAD-04).

    The order is: recover mode, and if the tag stream itself is mis-paired, ONE resync and recover
    mode again. Once, not until it works — a resync that has to run twice is not repairing a stray
    line, it is guessing at a file, and a guessed drawing is worse than a refused one because
    everything downstream reads the artifact and nothing else (L-CAD-01).

    A drawing that still will not open leaves as `DXF_UNREADABLE` carrying the line that broke the
    rhythm, never as a bare exception: a traceback names this file where the operator needs the line
    of their own export to take back to whoever produced it.
    """
    try:
        data = source.read_bytes()
    except OSError as error:
        raise IngestError(report.SOURCE_NOT_READABLE, str(error)) from error

    repeated = report.duplicate_handles(data)
    if repeated:
        raise IngestError(
            report.HANDLES_NOT_UNIQUE,
            f"{len(repeated)} handle(s) are stated more than once, first {repeated[0]}",
        )

    try:
        return _open_recovered(io.BytesIO(data), notes)
    except ezdxf.DXFStructureError as structure_error:
        first = structure_error
    except ezdxf.DXFError as error:
        # Recover mode failed for a reason no re-pairing of lines can address.
        raise IngestError(report.DXF_UNREADABLE, str(error)) from error

    repair = resync_tag_stream(data)
    where = f'line {repair.line}: "{repair.text}"' if repair.line else "no mis-paired line was found"
    if repair.repaired is None or repair.dropped == 0:
        raise IngestError(report.DXF_UNREADABLE, f"{first} ({where})") from first

    try:
        doc = _open_recovered(io.BytesIO(repair.repaired), notes)
    except ezdxf.DXFError as error:
        raise IngestError(
            report.DXF_UNREADABLE,
            f"{error} after a tag-stream resync dropped {repair.dropped} lines ({where})",
        ) from error

    notes.add(
        report.RESYNCED_TAG_STREAM,
        f"{repair.dropped} lines dropped, first at {where}",
        repair.dropped,
    )
    return doc


def ingest_dxf(
    source: Path,
    notes: report.Report | None = None,
    conversion_losses: dict[str, dict[str, int]] | None = None,
) -> dict[str, Any]:
    """Read a DXF file and return its EntityGraph v3 artifact, or refuse the drawing by name.

    `notes` is the caller's report: what the open repaired and what the drawing carries that no
    geometry in the artifact stands for is written into it. A caller that passes none is asking only
    for the artifact, and the notes are collected and dropped — never suppressed, because the
    refusals travel as exceptions whatever the caller asked for.

    `conversion_losses` is what a conversion in front of this ingest lost, per space and per class;
    only the caller that ran the conversion knows it, and it travels onto the counters.
    """
    notes = report.Report() if notes is None else notes
    doc = read_document(source, notes)
    try:
        return ingest_document(doc, notes, conversion_losses)
    except (ezdxf.DXFError, ValueError) as error:
        # A drawing ezdxf opens but cannot be read through refuses the sheet by name rather than
        # writing half an artifact (L-CAD-04). ValueError is the extractor's own half of that: a
        # coordinate that is not finite, an area that overflowed the double it is computed in, a
        # header field spelling $INSUNITS as something other than a number. Each is a drawing this
        # extractor cannot read through, and none of them may leave as a traceback, because a
        # traceback names geometry.py where the contract requires the drawing's own name.
        raise IngestError(report.DXF_UNEXTRACTABLE, f"unextractable DXF: {error}") from error
