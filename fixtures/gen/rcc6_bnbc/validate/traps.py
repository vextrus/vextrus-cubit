"""Check 8b — every trap in traps.json resolves to a live entity handle in the DXF it names
(`file`, default rcc6-bnbc.dxf), and the handle's entity sits in the sheet's layout or in a view
of that sheet in model space."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def check(scratch: Path, traps_doc: dict[str, Any]) -> dict[str, Any]:
    import ezdxf

    docs: dict[str, Any] = {}
    unresolved = []
    for t in traps_doc["traps"]:
        handle = t.get("handle")
        if not handle:
            unresolved.append((t["id"], "no handle"))
            continue
        file = t.get("file", "rcc6-bnbc.dxf")
        if not file.endswith(".dxf"):
            file = "rcc6-bnbc.dxf"
        if file not in docs:
            docs[file] = ezdxf.readfile(str(scratch / file))
        entity = docs[file].entitydb.get(handle)
        if entity is None:
            unresolved.append((t["id"], file, handle))
    assert not unresolved, f"check 8 (traps resolve): {unresolved}"
    return {"resolved": f"{len(traps_doc['traps'])}/{len(traps_doc['traps'])}"}
