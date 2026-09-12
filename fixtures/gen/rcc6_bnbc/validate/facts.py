"""Check 5 — every printed fact equals its authored value unless a registered trap says so.

A composer attaches `fact={"member": id, "field": name, "value": v}` (looked up in world.members)
or `fact={"authored": v}` (a value it took from model constants) to a TEXT/MTEXT/DIMENSION. The
printed string must contain `v` verbatim, or its exact ft-in spelling, or — with `trap` set — the
trap's registered `printed` value."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from ..emit.scene import ft_in, plain_text


def spellings(value: str) -> set[str]:
    out = {value}
    try:
        d = Decimal(value)
    except Exception:
        return out
    out.add(format(d.normalize(), "f"))
    out.add(f"{d:.0f}")
    if d == d.to_integral_value():
        out.add(str(int(d)))
    try:
        out.add(ft_in(float(d)))
        out.add(" ".join(plain_text(ft_in(float(d)))))
    except Exception:
        pass
    out.add(f"{(d / 1000):.3f}")  # mm → m
    return out


def check(world: dict[str, Any], sheets: list[Any], traps_doc: dict[str, Any]) -> dict[str, Any]:
    members = {m["id"]: m for m in world["members"]}
    traps = {t["id"]: t for t in traps_doc["traps"]}
    checked = 0
    bad = []
    for sheet in sheets:
        scenes = [sheet.paper] + [v.scene for v in sheet.views]
        for scene in scenes:
            for item in scene.items:
                fact = item.get("fact")
                if not fact:
                    continue
                checked += 1
                if "member" in fact:
                    m = members.get(fact["member"])
                    if m is None:
                        bad.append(("no such member", fact))
                        continue
                    authored = str(m[fact["field"]])
                else:
                    authored = str(fact["authored"])
                if fact.get("value") is not None and str(fact["value"]) != authored:
                    bad.append(("fact value is not the authored value", sheet.number, fact, authored))
                    continue
                printed = " ".join(plain_text(item.get("s") or item.get("raw") or item.get("text") or ""))
                trap = item.get("trap")
                if trap:
                    t = traps[trap]
                    want = t.get("printed")
                    if want is not None and want not in printed and not (spellings(want) & set(printed.split())):
                        if not any(sp in printed for sp in spellings(want)):
                            bad.append(("trap prints another value", sheet.number, trap, printed, want))
                    continue
                if not any(sp in printed for sp in spellings(authored)):
                    bad.append((sheet.number, printed, authored))
    assert not bad, f"check 5 (printed == authored): {bad[:12]}"
    return {"facts": checked}
