"""The census pass: `dwgread -O JSON` tallied space → type → count (L-CAD-04).

LibreDWG's JSON names every object it read, entities among them, and says where an entity lives
either by naming its owner outright or, for the two spaces a drawing always has, by an `entmode`.
This module resolves that to the space names the artifact uses — the model space spelled the way
`ingest.py` spells it, a paper layout by its own name — so the geometry pass can be compared with
it class by class.
"""

from __future__ import annotations

from typing import Any, Final

from .errors import DwgError
from .vocabulary import MODEL_SPACE, NOT_TALLIED, dxf_spelling

#: LibreDWG's own names for the block headers the two default spaces are drawn in. A drawing may
#: carry several `*Paper_Space<n>`; the bare one is the layout an ownerless entity means.
_MODEL_BLOCK: Final = "*model_space"
_PAPER_BLOCK: Final = "*paper_space"

#: `entmode` says where an entity lives when it names no owner of its own.
_ENTMODE_PAPER: Final = 1
_ENTMODE_MODEL: Final = 2

#: The space entities are tallied under when their owning block header does not resolve. They are
#: counted and refused by name rather than dropped: a dropped entity would turn a shortfall into a
#: clean run, which is the one direction this audit must never fail in (L-CAD-04).
UNRESOLVED_SPACE: Final = "unresolved"


def census_of(document: dict[str, Any]) -> dict[str, dict[str, int]]:
    """Tally one `dwgread -O JSON` document, space → entity class → count."""
    objects = document.get("OBJECTS") if isinstance(document, dict) else None
    if not isinstance(objects, list):
        raise DwgError("the census names no OBJECTS — this is not a dwgread -O JSON document")

    records = [record for record in objects if isinstance(record, dict)]
    block_names, delimiters = _block_headers(records)
    spaces = _spaces(records, block_names)
    ownerless = {
        _ENTMODE_MODEL: _drawn_in(spaces, block_names, _MODEL_BLOCK),
        _ENTMODE_PAPER: _drawn_in(spaces, block_names, _PAPER_BLOCK),
    }

    tally: dict[str, dict[str, int]] = {}
    for record in records:
        entity = record.get("entity")
        if not isinstance(entity, str) or not entity:
            continue
        dxftype = dxf_spelling(entity)
        if dxftype in NOT_TALLIED:
            continue
        if _handle(record.get("handle")) in delimiters:
            continue
        owner = _owner_of(record, ownerless)
        if owner is not None and owner in block_names and not _is_space_block(block_names[owner]):
            # A block definition's own content. It is paint no sheet carries directly, and the
            # geometry pass walks layouts too, so neither side counts it. A header named as a
            # space is never that, whether or not a LAYOUT names it: what it owns is counted.
            continue
        space = spaces.get(owner) if owner is not None else None
        types = tally.setdefault(space if space is not None else UNRESOLVED_SPACE, {})
        types[dxftype] = types.get(dxftype, 0) + 1

    return {space: dict(sorted(types.items())) for space, types in sorted(tally.items())}


def _handle(value: Any) -> int | None:
    """LibreDWG spells a handle as a list ending in its absolute value; zero means none."""
    if not isinstance(value, list) or not value:
        return None
    absolute = value[-1]
    if not isinstance(absolute, int) or absolute == 0:
        return None
    return absolute


def _block_headers(records: list[dict[str, Any]]) -> tuple[dict[int, str], set[int]]:
    """Every block header by handle, and the handles of the entities that merely delimit one."""
    names: dict[int, str] = {}
    delimiters: set[int] = set()
    for record in records:
        if record.get("object") != "BLOCK_HEADER":
            continue
        handle = _handle(record.get("handle"))
        if handle is not None:
            names[handle] = str(record.get("name", ""))
        for edge in ("block_entity", "endblk_entity"):
            marker = _handle(record.get(edge))
            if marker is not None:
                delimiters.add(marker)
    return names, delimiters


def _is_space_block(name: str) -> bool:
    """A block header named as one of the spaces, whether or not a LAYOUT points at it."""
    lowered = name.lower()
    return lowered.startswith(_MODEL_BLOCK) or lowered.startswith(_PAPER_BLOCK)


def _spaces(records: list[dict[str, Any]], block_names: dict[int, str]) -> dict[int, str]:
    """The block headers a layout is drawn in, by handle, under the artifact's space names.

    A LAYOUT names the header it is drawn in. LibreDWG can also write a second `*Model_Space`
    header no LAYOUT names; an entity that header owns is model-space paint all the same, so it is
    resolved to the model space rather than dropped. A paper-space header no LAYOUT names has no
    layout name to be tallied under and is left unresolved — counted, and refused by name.
    """
    spaces: dict[int, str] = {}
    for record in records:
        if record.get("object") != "LAYOUT":
            continue
        block = _handle(record.get("block_header"))
        if block is None:
            continue
        name = block_names.get(block, "")
        layout = str(record.get("layout_name", ""))
        spaces[block] = MODEL_SPACE if name.lower().startswith(_MODEL_BLOCK) else (layout or name)
    for handle, name in block_names.items():
        if handle not in spaces and name.lower() == _MODEL_BLOCK:
            spaces[handle] = MODEL_SPACE
    return spaces


def _drawn_in(spaces: dict[int, str], block_names: dict[int, str], name: str) -> int | None:
    """The block header an ownerless entity of this kind belongs to, if the drawing has one.

    A drawing with several paper layouts spells them `*Paper_Space`, `*Paper_Space0`, …; an entity
    that names no owner means the bare one, so that is preferred over its numbered neighbours.
    """
    named = sorted(handle for handle in spaces if block_names.get(handle, "").lower() == name)
    if named:
        return named[0]
    numbered = sorted(handle for handle in spaces if block_names.get(handle, "").lower().startswith(name))
    return numbered[0] if numbered else None


def _owner_of(record: dict[str, Any], ownerless: dict[int, int | None]) -> int | None:
    owner = _handle(record.get("ownerhandle"))
    if owner is not None:
        return owner
    entmode = record.get("entmode")
    return ownerless.get(entmode) if isinstance(entmode, int) else None
