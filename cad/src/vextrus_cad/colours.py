"""Server-side colour resolution: true colour, then explicit index, then BYLAYER, then BYBLOCK.

L-CAD-05 fixes that order, and the artifact records both the resolved channels and which link of
the chain resolved them, so a renderer never re-derives it.
"""

from __future__ import annotations

from typing import Final

from ezdxf.colors import DXF_DEFAULT_COLORS

#: The two indices that name no colour of their own.
BYBLOCK_INDEX: Final = 0
BYLAYER_INDEX: Final = 256

#: The index a drawing falls back to when it names none.
DEFAULT_INDEX: Final = 7

Channels = tuple[int, int, int]


def unpack(packed: int) -> Channels:
    """A packed 24-bit DXF colour as its three channels."""
    value = packed & 0xFFFFFF
    return ((value >> 16) & 255, (value >> 8) & 255, value & 255)


def from_index(index: int) -> Channels:
    """An AutoCAD Color Index entry, with anything off the table taking the drawing's default."""
    if 0 <= index < len(DXF_DEFAULT_COLORS):
        return unpack(DXF_DEFAULT_COLORS[index])
    return unpack(DXF_DEFAULT_COLORS[DEFAULT_INDEX])


class LayerColours:
    """Every layer's own resolved colour, read once from the drawing's LAYER table."""

    def __init__(self, resolved: dict[str, Channels]) -> None:
        self._resolved = resolved

    @classmethod
    def of(cls, doc: object) -> LayerColours:
        resolved: dict[str, Channels] = {}
        for layer in getattr(doc, "layers", ()):
            rgb = layer.rgb
            if rgb is not None:
                resolved[layer.dxf.name] = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
            else:
                resolved[layer.dxf.name] = from_index(abs(int(layer.color)))
        return cls(resolved)

    def __getitem__(self, name: str) -> Channels:
        return self._resolved.get(name, from_index(DEFAULT_INDEX))


def resolve(entity: object, layers: LayerColours, inherited: Channels | None) -> dict[str, object]:
    """The artifact's `colour` record for one entity.

    `inherited` is the resolved colour of the block reference that painted this entity, which is
    what BYBLOCK names; an entity nothing painted falls back to its layer.
    """
    dxf = entity.dxf  # type: ignore[attr-defined]
    layer = str(getattr(dxf, "layer", "0"))

    if dxf.hasattr("true_color"):
        return {"rgb": list(unpack(int(dxf.true_color))), "source": "truecolor"}

    index = abs(int(getattr(dxf, "color", BYLAYER_INDEX)))
    if index == BYBLOCK_INDEX:
        return {"rgb": list(inherited if inherited is not None else layers[layer]), "source": "byblock"}
    if index == BYLAYER_INDEX:
        return {"rgb": list(layers[layer]), "source": "bylayer"}
    return {"rgb": list(from_index(index)), "source": "explicit"}
