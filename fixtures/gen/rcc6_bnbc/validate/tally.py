"""Check 6 — the L-CAD-09 tally. dxf.py counts each original per (space, DXF type) as it places
it; here the written DXF is re-read with ezdxf and counted the way the product's ingest counts
(every entity in every layout except ATTRIB/ATTDEF/SEQEND/VERTEX/VIEWPORT), and both must agree
pair for pair. sanity.json's `drawn` is the placing-time tally; `dwg.expected` is `drawn` minus
the named losses, per DXF."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

NOT_CONTENT = frozenset({"ATTRIB", "ATTDEF", "SEQEND", "VERTEX", "VIEWPORT"})


def reread(path: Path) -> dict[str, dict[str, int]]:
    import ezdxf

    doc = ezdxf.readfile(str(path))
    out: dict[str, Counter[str]] = {}
    for name in doc.layouts.names_in_taborder():
        layout = doc.layouts.get(name)
        space = "model" if name == "Model" else name
        c: Counter[str] = Counter()
        for e in layout:
            if e.dxftype() in NOT_CONTENT or e.dxf.get("handle", None) is None:
                continue
            c[e.dxftype()] += 1
        if c:
            out[space] = c
    return {s: dict(sorted(c.items())) for s, c in sorted(out.items())}


def check(scratch: Path, written: dict[str, bytes]) -> dict[str, Any]:
    sanity = json.loads(written["sanity.json"].decode("utf-8"))
    report = {}
    for dxf_name, drawn in sanity["drawn"].items():
        path = scratch / dxf_name
        got = reread(path)
        assert got == drawn, f"check 6 (tally) {dxf_name}: placed {_diff(drawn, got)}"
        report[dxf_name] = {"spaces": len(drawn), "entities": sum(sum(t.values()) for t in drawn.values())}
    for dwg_name, spec in sanity.get("dwg", {}).items():
        src = spec["source"]
        drawn = sanity["drawn"][src]
        expected = spec["expected"]
        losses = spec["losses"]
        for space, types in drawn.items():
            for t, n in types.items():
                lost = losses.get(space, {}).get(t, 0)
                assert expected.get(space, {}).get(t, 0) == n - lost, (dwg_name, space, t, n, lost)
        extra = [
            (space, t)
            for space, types in expected.items()
            for t in types
            if t not in drawn.get(space, {})
        ]
        assert not extra, f"check 6 (tally) {dwg_name}: expected holds pairs nothing drew: {extra[:8]}"
    return report


def _diff(a: dict, b: dict) -> list[tuple[str, str, int, int]]:
    out = []
    for space in sorted(set(a) | set(b)):
        for t in sorted(set(a.get(space, {})) | set(b.get(space, {}))):
            x, y = a.get(space, {}).get(t, 0), b.get(space, {}).get(t, 0)
            if x != y:
                out.append((space, t, x, y))
    return out[:20]
