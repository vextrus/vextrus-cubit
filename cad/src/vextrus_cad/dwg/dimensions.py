"""The dimensions a converted DXF carries with no picture behind them, drawn from their definitions
(L-CAD-03, L-CAD-04, L-CAD-09).

A DIMENSION is two things in a DXF. Its DEFINITION is what the draughtsman stated: the points they
picked, the dimension style and its overrides, and the text — `<>` for "the measurement itself", or
the words they typed over it. Its PICTURE is an anonymous block the entity names by reference: the
lines, the arrowheads, the measurement text and the definition points, which `cad/` explodes into
the dimension's derived paint (L-CAD-03) and which L-MEA-05's rank 3 reads its evidence off.

LibreDWG 0.13's own DWG writer (`dxf2dwg`, which mints F-RCC6's and F-RCC6-BNBC's DWGs) writes every
dimension's definition and leaves the reference to its picture empty, so the DXF `dwg2dxf` makes of
such a drawing names no picture for any dimension. The extractor opens every drawing in recover
mode, and ezdxf's audit removes a DIMENSION whose picture the document does not hold
(`AuditError.UNDEFINED_BLOCK`). Every dimension of such a drawing therefore left the artifact with
nothing said but a count of repairs — 125 of F-RCC6-BNBC's, which was all of its rank-3 scale
evidence, and a fresh upload of its DWG proposed no scale on any view (session 8's walk-0; the DXF
of the same drawing proposed on ten).

So the lane draws the picture from the definition before any reader sees the file, the way a CAD
program regenerates a picture it finds missing, with the renderer this extractor's pinned identity
already carries (ezdxf 1.4.4, L-CAD-02): the dimension's own points, its own style with its own
overrides, its own text. Nothing is invented — a definition that states a measurement renders that
measurement, and a text the draughtsman typed renders as typed. What was drawn is counted, so a
regenerated picture is a named repair rather than a quiet one; a dimension the renderer cannot draw
is left exactly as it came, and the geometry pass then does not count it as carried, so the
reconciliation names it as a shortfall instead of the audit deleting it in silence.

A drawing whose dimensions all carry their pictures — every drawing AutoCAD writes — has nothing
drawn and is not rewritten.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final

#: The one entity type this pass reads.
DIMENSION: Final = "DIMENSION"

#: The name a DIMENSION's picture reference falls back to when it states none — the same default the
#: audit reads it at, and one no block can carry.
_NO_PICTURE: Final = "*"


@dataclass(frozen=True)
class DrawnDimensions:
    """What one pass over a document drew."""

    #: Dimensions whose picture was missing and was drawn from their own definitions.
    drawn: int = 0
    #: Dimensions whose picture was missing and could not be drawn; they stay as they came.
    undrawn: int = 0


def carries_picture(dimension: Any, document: Any) -> bool:
    """Whether a DIMENSION's picture stands in the document — exactly the test ezdxf's audit applies
    before it removes one, so what this says is carried is what the recover-mode open keeps.

    A dimensional constraint is a parametric relation, not a picture-bearing dimension, and the audit
    keeps it whatever it names; so does this.
    """
    if dimension.is_dimensional_constraint:
        return True
    return dimension.dxf.get("geometry", _NO_PICTURE) in document.blocks


def draw_missing_pictures(document: Any) -> DrawnDimensions:
    """Draw the picture of every DIMENSION the document holds without one, in place, and count.

    Every block is read — the two spaces are blocks too, and a dimension inside a block definition is
    removed by the same audit — and the dimensions to draw are gathered before any is drawn, because
    drawing one adds a block to the collection being read. The order is the document's own, so one
    drawing draws the same pictures under the same names every time (L-CAD-02).
    """
    missing = [
        entity
        for block in document.blocks
        for entity in block
        if entity.dxftype() == DIMENSION and not carries_picture(entity, document)
    ]
    drawn = 0
    for dimension in missing:
        if _drawn(dimension, document):
            drawn += 1
    return DrawnDimensions(drawn=drawn, undrawn=len(missing) - drawn)


def _drawn(dimension: Any, document: Any) -> bool:
    """One dimension's picture drawn from its definition, or the dimension left exactly as it came.

    The renderer names the new picture on the dimension before it draws into it, so a render that
    fails part-way would leave the dimension pointing at half a picture — which the audit would then
    keep, and the artifact would carry paint nobody drew. Such a picture is taken away again and the
    reference put back, so a dimension is either drawn whole or not drawn at all.
    """
    before = dimension.dxf.get("geometry", None)
    try:
        dimension.override().render()
    except Exception:
        # Every way the renderer can fail is the same fact about this dimension — its definition is
        # one this renderer cannot draw — and the answer to that fact is the shortfall the
        # reconciliation names, not a refused drawing (L-CAD-04: a class refused on a sheet, never
        # the sheet).
        started = dimension.dxf.get("geometry", None)
        if started != before and started is not None and started in document.blocks:
            document.blocks.delete_block(started, safe=False)
        if before is None:
            dimension.dxf.discard("geometry")
        else:
            dimension.dxf.geometry = before
        return False
    return carries_picture(dimension, document)
