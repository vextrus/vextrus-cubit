"""Colour resolved server-side: true colour → explicit → BYLAYER → BYBLOCK (L-CAD-05).

The app never sees an ACI index or a BYLAYER sentinel. It sees `#RRGGBB` and the rule that
produced it, because "resolved server-side" means the resolution happened here, once, with
the drawing's tables still open.
"""

from __future__ import annotations

from typing import Any

from ezdxf import colors

#: ACI 256 is BYLAYER, ACI 0 is BYBLOCK — the two sentinels that are not colours.
BYLAYER = 256
BYBLOCK = 0

#: What a BYBLOCK entity resolves to when nothing encloses it: the drawing's default pen.
DEFAULT_ACI = 7

#: The four rules, as the artifact names them.
TRUE_COLOUR = "true_colour"
EXPLICIT = "explicit"
BY_LAYER = "bylayer"
BY_BLOCK = "byblock"


def _hex(rgb: tuple[int, int, int]) -> str:
    red, green, blue = rgb
    return f"#{red:02X}{green:02X}{blue:02X}"


def _aci_hex(index: int) -> str:
    """An ACI index as a hex triple; an index outside the palette falls back to the pen."""
    try:
        return _hex(tuple(colors.aci2rgb(abs(index))))
    except (IndexError, ValueError):
        return _hex(tuple(colors.aci2rgb(DEFAULT_ACI)))


def _layer_colour(doc: Any, layer_name: str) -> str:
    """The layer's own colour — its true colour when it carries one, else its ACI."""
    try:
        layer = doc.layers.get(layer_name)
    except Exception:
        return _aci_hex(DEFAULT_ACI)
    rgb = layer.rgb
    if rgb is not None:
        return _hex(tuple(rgb))
    return _aci_hex(layer.dxf.color)


def resolve_colour(entity: Any, doc: Any, inherited: str | None = None) -> dict[str, str]:
    """`{rgb, source}` for one entity.

    `inherited` is what BYBLOCK means here: the resolved colour of the block reference
    this entity was painted by. A top-level entity has no such parent, so BYBLOCK falls
    back to the drawing's default pen rather than inventing a colour.
    """
    if entity.dxf.hasattr("true_color"):
        return {"rgb": _hex(tuple(colors.int2rgb(entity.dxf.true_color))), "source": TRUE_COLOUR}
    aci = entity.dxf.get("color", BYLAYER)
    if aci == BYBLOCK:
        rgb = inherited if inherited is not None else _aci_hex(DEFAULT_ACI)
        return {"rgb": rgb, "source": BY_BLOCK}
    if aci == BYLAYER:
        return {"rgb": _layer_colour(doc, entity.dxf.get("layer", "0")), "source": BY_LAYER}
    return {"rgb": _aci_hex(aci), "source": EXPLICIT}
