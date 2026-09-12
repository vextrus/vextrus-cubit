"""Check 2 — a Python mirror of the product's notation grammar (E-fixture §3.5), one regex per
family. A drawn string that declares a family must match it after `plain_text()`; a string that
does not must name a registered trap. `plain` is never parsed."""

from __future__ import annotations

import re
from typing import Any

from ..emit.scene import plain_text

DIA = r"(?:%%[cC]|Ø|∅|âˆ…|mm\s*Ø|mm|dia\.?|T|Y|#)"
NUM = r"\d+(?:\.\d+)?"
FTIN = r"\d+'-\d+(?:½|¼|¾|⅛|⅜|⅝|⅞|\s?\d/\d)?\""
SPACING = rf"@\s*(?:{NUM}\s*(?:mm)?|\d+(?:½|¼|¾)?\")\s*(?:c/c|C/C|crs|c\.c\.)?"

GRAMMAR: dict[str, re.Pattern[str]] = {
    "diameter": re.compile(
        rf"^(?:\d+L-)?(?:\d+\s*-\s*)?(?:{NUM}\s*(?:mm)?\s*(?:Ø|∅|âˆ…|%%[cC])|\d*[TY]\d+|#\d+|{NUM}\s*mm\s*Ø?)"
        rf"(?:\s*\+\s*\d+\s*-\s*{NUM}\s*(?:mm)?\s*(?:Ø|%%[cC])|\s*\+\s*\d+[TY]\d+)*"
        rf"(?:\s*{SPACING})?(?:\s*(?:B/W|B\.W\.|E\.W\.|E\.F\.|T&B|ALT\. CRANKED|EXTRA|TOP|BOT\.?|BOTTOM|\(ends\)|\(mid\)|st\.|ext\.|[A-Z .()&/0-9-]*))?$"
    ),
    "bar_call": re.compile(
        rf"^\d+\s*-\s*{NUM}\s*(?:mm)?\s*(?:Ø|%%[cC])\s*(?:st\.|ext\.|T&B|TOP|BOT\.?|EXTRA)?"
        rf"(?:\s*\+\s*\d+\s*-\s*{NUM}\s*(?:mm)?\s*(?:Ø|%%[cC])\s*(?:st\.|ext\.|T&B|TOP|BOT\.?|EXTRA)?)*"
        rf"(?:\s*\(.*\))?$"
    ),
    "spiral": re.compile(rf"^{NUM}\s*(?:mm)?\s*(?:Ø|%%[cC])\s*spiral\s*@\s*{NUM}\s*(?:mm)?\s*c/c.*$", re.IGNORECASE),
    "section": re.compile(rf"^(?:{NUM}\s*[xX×]\s*{NUM}(?:\s*mm)?|\d+\"\s*[xX×]\s*\d+\")$"),
    "thickness": re.compile(rf"^(?:{NUM}\s*(?:mm)?|\d+\")\s*(?:THK\.?|THICK)$", re.IGNORECASE),
    "length": re.compile(rf"^(?:{FTIN}|{NUM}(?:\s*mm)?|L/\d|Ln/\d|0\.\d+\s*L|{NUM}\s*m)$"),
    "level": re.compile(
        rf"^(?:(?:EL|FFL|PL|P\.L\.?=?|E\.G\.L\.?|COL|SFL|GL)\s*)?(?:\(\s*)?[±+-]?(?:{FTIN}|{NUM})(?:\s*\))?$"
    ),
    "range": re.compile(
        r"^(?:\(?(?:GF|G\.F\.|1ST|2ND|3RD|4TH|5TH|6TH|ROOF|SRR|FDN)\s*(?:TO|-|&)\s*(?:GF|1ST|2ND|3RD|4TH|5TH|6TH|ROOF|SRR)(?:\s*(?:FLOOR|FLR\.?))?\)?|GF|G\.F\.|ROOF|ROOF-SRR|(?:1ST|2ND|3RD|4TH|5TH|6TH)\s*(?:FLOOR|FLR\.?))$"
    ),
    "mark": re.compile(r"^(?:[A-Z]{1,4}-?\s?\d{1,2}[a-z']?|\d[A-Z]{1,3}\d{1,2}|[A-Z]{1,4}\d?-[A-Z]{1,2}\d?|P\d{0,3}|S\d{1,2}|R\d{1,2}|SB-R\d|REB\d|OHWT-[BTW]|UGWR-[BTW]|ST-[BTW]|FL\d?|ML\d|SOG|RAMP|PIT|LPS|SRR|MRR|PP\d|BW\d{3}|LS\d|L\d)$"),
    "grade": re.compile(r"^(?:f'c|fc'|fy|f_y)\s*=\s*[\d,]+\s*(?:psi|MPa|N/mm²).*$|^B500DWR$|^C\d{4}PSI$"),
    "cover": re.compile(rf"^(?:{NUM}\s*mm|\d+\")\s*(?:clear\s*)?cover.*$", re.IGNORECASE),
    "grid": re.compile(r"^(?:[A-E]'?|\d'?|1a)$"),
    "count": re.compile(rf"^\d+\s*(?:R|NOS\.?|RISERS?|TREADS?)\s*(?:@\s*{NUM})?$", re.IGNORECASE),
    "number": re.compile(rf"^[+-]?(?:{NUM}|[\d,]+\.\d+|{FTIN})$"),
}


def parses(family: str, text: str) -> bool:
    if family == "plain":
        return True
    rx = GRAMMAR[family]
    return any(rx.match(line.strip()) for line in plain_text(text) if line.strip())


def strings_of(sheets: list[Any]) -> list[dict[str, Any]]:
    """Every drawn string across paper and views: {sheet, view, kind, raw, plain, family, fact,
    trap, layer} — the notation.corpus.json rows before handles are attached."""
    rows = []
    for sheet in sheets:
        scenes = [("paper", sheet.paper)] + [(v.title, v.scene) for v in sheet.views]
        for view_title, scene in scenes:
            for item in scene.strings():
                if item["kind"] == "INSERT":
                    for tag, value in sorted(item["attribs"].items()):
                        rows.append(
                            {
                                "sheet": sheet.number,
                                "view": view_title,
                                "kind": "ATTRIB",
                                "tag": tag,
                                "raw": value,
                                "plain": plain_text(value),
                                "family": item.get("family", "mark" if tag == "MARK" else "plain"),
                                "fact": item.get("fact"),
                                "trap": item.get("trap"),
                                "layer": item["layer"],
                            }
                        )
                    continue
                raw = item.get("s") if item["kind"] in ("TEXT", "MLEADER") else item.get("raw", item.get("text"))
                rows.append(
                    {
                        "sheet": sheet.number,
                        "view": view_title,
                        "kind": item["kind"],
                        "raw": raw,
                        "plain": plain_text(raw),
                        "family": item.get("family", "plain"),
                        "fact": item.get("fact"),
                        "trap": item.get("trap"),
                        "layer": item["layer"],
                    }
                )
    return rows


def check(sheets: list[Any], traps_doc: dict[str, Any]) -> dict[str, Any]:
    ids = {t["id"] for t in traps_doc["traps"]}
    bad = []
    by_family: dict[str, int] = {}
    for row in strings_of(sheets):
        by_family[row["family"]] = by_family.get(row["family"], 0) + 1
        if row["family"] not in GRAMMAR and row["family"] != "plain":
            bad.append(("unknown family", row["family"], row["raw"]))
            continue
        if row["trap"] is not None and row["trap"] not in ids:
            bad.append(("unregistered trap", row["trap"], row["raw"]))
            continue
        if row["trap"] is None and not parses(row["family"], row["raw"]):
            bad.append((row["sheet"], row["family"], row["raw"]))
    assert not bad, f"check 2 (notation): {bad[:12]}"
    return {"strings": sum(by_family.values()), "by_family": dict(sorted(by_family.items()))}
