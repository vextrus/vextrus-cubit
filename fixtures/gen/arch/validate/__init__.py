"""The drawing-side checks over the written bytes, run in the scratch directory before anything lands
under fixtures/arch/ (a failure writes nothing):

  tally      the DXF re-read with ezdxf and counted the way the product counts equals the tally taken
             while placing, pair for pair (sanity.json's `drawn`);
  traps      every registered trap resolves to a live handle, on the sheet it names;
  labels     every room label on a plan parses as NAME + a feet-inches W x L, and every drawn tag is a
             mark the schedules carry (T-MARK-SPELLING aside: the schedule's hyphen is the spelling);
  captions   every sheet carries its numbered title line and every view its caption under its window.
"""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import Any

NOT_CONTENT = frozenset({"ATTRIB", "ATTDEF", "SEQEND", "VERTEX", "VIEWPORT"})
LABEL = re.compile(r"^[A-Z][A-Z0-9 .'-]*\\P\d+'-\d+\" x \d+'-\d+\"$")


def reread(path: Path) -> dict[str, dict[str, int]]:
    import ezdxf

    doc = ezdxf.readfile(str(path))
    out: dict[str, Counter[str]] = {}
    for name in doc.layouts.names_in_taborder():
        layout = doc.layouts.get(name)
        space = "model" if name == "Model" else name
        c: Counter[str] = Counter(e.dxftype() for e in layout if e.dxftype() not in NOT_CONTENT)
        if c:
            out[space] = c
    return {s: dict(sorted(c.items())) for s, c in sorted(out.items())}


def tally(path: Path, drawn: dict[str, dict[str, int]]) -> dict[str, Any]:
    got = reread(path)
    assert got == drawn, f"validate (tally): placed {drawn} but the file reads {got}"
    return {"spaces": len(drawn), "entities": sum(sum(t.values()) for t in drawn.values())}


def traps(path: Path, doc: dict[str, Any], sheets: dict[str, str]) -> dict[str, Any]:
    import ezdxf

    dxf = ezdxf.readfile(str(path))
    unresolved = []
    for t in doc["traps"]:
        h = t.get("handle")
        e = dxf.entitydb.get(h) if h else None
        if e is None:
            unresolved.append(t["id"])
            continue
        owner = e.get_layout()
        where = "model" if owner is None or owner.name == "Model" else owner.name
        if where != "model":
            assert where == sheets[t["sheet"]], f"validate (traps): {t['id']}'s entity is on {where}, not {t['sheet']}"
    assert not unresolved, f"validate (traps): no live handle for {unresolved}"
    return {"resolved": f"{len(doc['traps'])}/{len(doc['traps'])}"}


def strings(rows: list[dict[str, Any]], marks: set[str]) -> dict[str, Any]:
    by_family = Counter(r["family"] for r in rows)
    for r in rows:
        if r["family"] == "room_label" and "\\P" in r["text"]:
            assert LABEL.match(r["text"]), f"validate (labels): {r['text']!r} is not NAME + W x L in feet-inches"
        if r["family"] == "mark":
            assert r["text"] in marks, f"validate (tags): {r['text']} is not a scheduled mark"
    return {"strings": len(rows), "by_family": dict(sorted(by_family.items()))}


def captions(rows: list[dict[str, Any]], sheet_titles: dict[str, str], views: dict[str, list[str]]) -> int:
    texts = {(r["sheet"], r["text"]) for r in rows}
    for number, title in sheet_titles.items():
        assert (number, f"{number}  {title}") in texts, f"validate (captions): {number} has no numbered title line"
        for cap in views[number]:
            assert any(s == number and t.startswith(cap) for s, t in texts), f"validate (captions): {cap} is uncaptioned"
    return len(sheet_titles)
