"""Check 8b — every trap resolves to its own evidence (W-06, F2-7). A sheet trap's handle opens
in the paper DXF; a document trap either carries the handle of its evidence entity (opened in the
file it names) or `handle: null` with an anchor that is verified here against the written bytes:
a header variable's value, a file's presence, or the line of the malformed twin that the resync
drops."""

from __future__ import annotations

from pathlib import Path
from typing import Any

READABLE = ("rcc6-bnbc.dxf", "rcc6-bnbc.model.dxf", "arch-plan.dxf")


def check(scratch: Path, traps_doc: dict[str, Any], written: dict[str, bytes] | None = None) -> dict[str, Any]:
    import ezdxf

    docs: dict[str, Any] = {}

    def doc_of(name: str) -> Any:
        if name not in docs:
            docs[name] = ezdxf.readfile(str(scratch / name))
        return docs[name]

    bad = []
    anchored = 0
    for t in traps_doc["traps"]:
        handle, file = t.get("handle"), t.get("file", "rcc6-bnbc.dxf")
        if t["sheet"] != "*":
            if not handle:
                bad.append((t["id"], "sheet trap without a handle"))
            elif doc_of("rcc6-bnbc.dxf").entitydb.get(handle) is None:
                bad.append((t["id"], "handle does not open", handle))
            continue
        anchor = t.get("anchor")
        if not anchor:
            bad.append((t["id"], "document trap without an anchor"))
            continue
        anchored += 1
        if handle:
            source = file if file in READABLE else "rcc6-bnbc.dxf"
            entity = doc_of(source).entitydb.get(handle)
            if entity is None:
                bad.append((t["id"], "handle does not open", source, handle))
            elif "layout" in anchor and entity.dxf.get("paperspace", 0) != 1:
                bad.append((t["id"], "the anchor entity is not in a paper layout"))
            continue
        if "header" in anchor:
            got = doc_of(file).header.get(anchor["header"])
            if got != anchor["value"]:
                bad.append((t["id"], anchor["header"], got, anchor["value"]))
        elif "line" in anchor:
            lines = (scratch / anchor["file"]).read_bytes().splitlines()
            n = anchor["line"]
            if not (isinstance(n, int) and 1 <= n <= len(lines)) or lines[n - 1].strip() != b"AcDbAlignedDimension":
                bad.append((t["id"], "the anchored line is not the mis-paired line", n))
        elif "file" in anchor:
            name = anchor["file"]
            present = (scratch / name).exists() or (
                written is not None and any(k == name or k.startswith(name) for k in written)
            )
            if not present:
                bad.append((t["id"], "anchored file not written", name))
        else:
            bad.append((t["id"], "anchor names nothing verifiable", anchor))
    assert not bad, f"check 8 (traps resolve): {bad}"
    n = len(traps_doc["traps"])
    return {"resolved": f"{n}/{n}", "with_handle": sum(1 for t in traps_doc["traps"] if t.get("handle")), "anchored": anchored}
