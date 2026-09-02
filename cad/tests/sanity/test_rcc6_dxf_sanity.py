"""AC-3 — the DXF sanity number reads exact (L-CAD-09).

`sanity.json` says what the generator drew, tallied as it placed each original; `ingest_dxf` says
what the extractor recovers. Every (space, DXF type) pair must agree on both sides, and no pair may
appear on one side only — a silent lower or higher count is exactly what L-CAD-09 exists to catch.
The pairs are read off `sanity.json` itself, never frozen here.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import pytest

from vextrus_cad import ingest_dxf

SANITY_REL = "sanity.json"
DXF_REL = "rcc6.dxf"

#: cad/tests/sanity/<this file> -> the checkout.
_CORPUS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "rcc6"


def _drawn_pairs() -> list[tuple[str, str, int]]:
    """(space, dxftype, drawn) for every pair `sanity.json` names — empty when it is not committed."""
    path = _CORPUS_DIR / SANITY_REL
    if not path.is_file():
        return []
    document = json.loads(path.read_text(encoding="utf-8"))
    drawn = document.get("drawn") if isinstance(document, dict) else None
    if not isinstance(drawn, dict):
        return []
    return [
        (space, dxftype, count)
        for space, types in sorted(drawn.items())
        if isinstance(types, dict)
        for dxftype, count in sorted(types.items())
    ]


PAIRS = _drawn_pairs()


def _sanity(corpus) -> dict[str, Any]:
    return corpus.read_json(SANITY_REL)


def _artifact(corpus) -> dict[str, Any]:
    return corpus.once("dxf-artifact", lambda: ingest_dxf(corpus.require(DXF_REL)))


def _recovered(corpus) -> Counter[tuple[str, str]]:
    """Original entities per (space, type) — `entities`, never the derived paint."""
    return Counter((entity["space"], entity["type"]) for entity in _artifact(corpus)["entities"])


def test_ac3_sanity_names_the_drawn_pairs(corpus) -> None:
    sanity = _sanity(corpus)
    assert sanity.get("generator") == "fixtures/gen/rcc6.py"
    drawn = sanity.get("drawn")
    assert isinstance(drawn, dict) and drawn, "sanity.json names no drawn space"
    for space, types in drawn.items():
        assert isinstance(space, str) and space, "sanity.json holds an unnamed space"
        assert isinstance(types, dict) and types, f"sanity.json's {space!r} names no entity type"
        for dxftype, count in types.items():
            assert isinstance(count, int) and count > 0, f"drawn[{space!r}][{dxftype!r}] is not a tally"
    assert PAIRS, "no (space, type) pair was read off sanity.json at collection time"


@pytest.mark.parametrize(("space", "dxftype", "drawn"), PAIRS, ids=[f"{s}:{t}" for s, t, _ in PAIRS])
def test_ac3_each_drawn_pair_is_recovered_exactly(corpus, space: str, dxftype: str, drawn: int) -> None:
    found = _recovered(corpus).get((space, dxftype), 0)
    assert found == drawn, f"{dxftype} on {space!r}: the generator drew {drawn}, ingest_dxf recovered {found}"


def test_ac3_no_pair_appears_on_one_side_only(corpus) -> None:
    named = {(space, dxftype) for space, types in _sanity(corpus)["drawn"].items() for dxftype in types}
    found = set(_recovered(corpus))
    assert found - named == set(), (
        f"ingest_dxf recovered pairs sanity.json never drew: {sorted(found - named)}"
    )
    assert named - found == set(), (
        f"sanity.json draws pairs ingest_dxf never recovered: {sorted(named - found)}"
    )


def test_ac3_no_space_truncated_its_explode(corpus) -> None:
    counters = _artifact(corpus)["counters"]
    assert counters, "the artifact holds no counters record"
    truncated = [record["space"] for record in counters if record["explode_truncated"]]
    assert truncated == [], f"explode_truncated is set on: {truncated}"


def test_ac3_no_layout_was_dropped(corpus) -> None:
    dropped = _artifact(corpus)["dropped_layouts"]
    assert dropped == [], (
        f"content-less layouts were dropped — every sheet must draw its title block: {dropped}"
    )
