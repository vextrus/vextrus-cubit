"""Check 5c — the quantity wall (F2-1, F2-2). No drawn string is a golden quantity: every
takeoff row's quantity, every per-kind total and the BBS grand total, in their decimal and
thousands-separated spellings, must match no token of any drawn string. And S-26's printed grand
total is the SAMPLE's own row sum × 1.017 within 0.0005 — a discrepancy a reader can find."""

from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any

from .. import model as M
from ..emit.scene import plain_text

_TOKEN = re.compile(r"[0-9][0-9,]*\.?[0-9]*")
RATIO = Decimal("1.017")
RATIO_TOL = Decimal("0.0005")


def spellings(q: Decimal) -> set[str]:
    out: set[str] = set()
    for places in (3, 2):
        s = f"{q:.{places}f}"
        out.add(s)
        out.add(f"{q:,.{places}f}")
    if q >= 1000:  # a bare integer only where it cannot be a bar count or a coordinate-sized figure
        out.add(f"{q:.0f}")
        out.add(f"{q:,.0f}")
    return out


def check(sheets: list[Any], written: dict[str, bytes], traps_doc: dict[str, Any]) -> dict[str, Any]:
    takeoff = json.loads(written["takeoff.golden.json"].decode("utf-8"))
    bbs = json.loads(written["bbs.golden.json"].decode("utf-8"))
    forbidden: set[str] = set()
    by_kind: dict[str, Decimal] = {}
    for r in takeoff["rows"]:
        q = Decimal(r["quantity"])
        forbidden |= spellings(q)
        by_kind[r["kind"]] = by_kind.get(r["kind"], Decimal(0)) + q
    for q in by_kind.values():
        forbidden |= spellings(q)
    forbidden |= spellings(Decimal(bbs["grand_total_kg"]))
    forbidden.discard("0.000")
    # The drawing's own authored constants are inputs, not answers: a golden row that happens to
    # equal a kg/m table entry (16 mm → 1.579) is a coincidence the notes may print.
    authored_text = json.dumps(M.CONVENTIONS, ensure_ascii=False) + " " + " ".join(
        str(v) for v in M.KG_PER_M.values()
    )
    forbidden -= set(_TOKEN.findall(authored_text))
    hits = []
    total_item = None
    for sheet in sheets:
        for scene in [sheet.paper] + [v.scene for v in sheet.views]:
            for item in scene.items:
                if item.get("role") == "bbs-total":
                    total_item = item
                raw = item.get("s") or item.get("raw") or item.get("text")
                if not raw:
                    continue
                for line in plain_text(raw):
                    for tok in _TOKEN.findall(line):
                        if tok in forbidden:
                            hits.append((sheet.number, tok, line[:60]))
    assert not hits, f"check 5c (quantity wall): a drawn string is a golden quantity: {hits[:10]}"
    # the trap is reachable: printed / (the sample's own row sum) == 1.017
    assert total_item is not None, "S-26 prints no bbs-total"
    printed = Decimal(" ".join(plain_text(total_item["s"])).replace(",", ""))
    trap = next(t for t in traps_doc["traps"] if t["id"] == "T-BBS-TOTAL")
    true = Decimal(trap["true"])
    assert abs(printed / true - RATIO) < RATIO_TOL, (printed, true, printed / true)
    assert printed != Decimal(bbs["grand_total_kg"])
    return {"forbidden_spellings": len(forbidden), "bbs_total_ratio": str((printed / true).quantize(Decimal("0.0001")))}
