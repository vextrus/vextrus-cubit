"""AC-3 for F-RCC6-BNBC — both DXFs read exact, and every trap opens where it was drawn (L-CAD-09).

The mirror of `test_rcc6_dxf_sanity.py` over the yardstick corpus, which carries two drawings: the
paper-layout set (one layout per sheet, the views in model space) and the model-space-frames set
(W-05). `sanity.json` says what the generator drew, per (space, DXF type), as it placed each
original; `ingest_dxf` says what the extractor recovers. Every pair must agree on both sides and no
pair may appear on one side only.

Beyond the tally this suite reads the drawing's own declarations: `$INSUNITS 0` (T-INSUNITS-0), the
frozen obsolete layer (T-LAYER-FROZEN), one layout per sheet, and every handle `traps.json` names
opening in the file it names, inside the sheet it belongs to.

The corpus lands when the generator is run; until then the whole module skips by name.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import pytest

from vextrus_cad import ingest_dxf

SANITY_REL = "sanity.json"
TRAPS_REL = "traps.json"
PAPER_REL = "rcc6-bnbc.dxf"
FROZEN_LAYER = "OLD-SCHEME-REV0"

#: cad/tests/sanity/<this file> -> the checkout.
_CORPUS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "rcc6-bnbc"

_PRESENT = (_CORPUS_DIR / PAPER_REL).is_file()

pytestmark = pytest.mark.skipif(
    not _PRESENT,
    reason=f"fixtures/rcc6-bnbc/{PAPER_REL} is not committed yet — Wave B's outputs land with the "
    "generator run, and the golden checks stand on their own until then",
)


def _document() -> dict[str, Any]:
    path = _CORPUS_DIR / SANITY_REL
    if not path.is_file():
        return {}
    document = json.loads(path.read_text(encoding="utf-8"))
    return document if isinstance(document, dict) else {}


def _drawn_pairs() -> list[tuple[str, str, str, int]]:
    """(dxf, space, dxftype, drawn) for every pair `sanity.json` names — the collection-time list."""
    drawn = _document().get("drawn")
    if not isinstance(drawn, dict):
        return []
    return [
        (dxf_name, space, dxftype, count)
        for dxf_name, spaces in sorted(drawn.items())
        if isinstance(spaces, dict)
        for space, types in sorted(spaces.items())
        for dxftype, count in sorted(types.items())
    ]


PAIRS = _drawn_pairs()
DRAWINGS = sorted({pair[0] for pair in PAIRS})


def _sanity(corpus) -> dict[str, Any]:
    return corpus.read_json(SANITY_REL)


def _artifact(corpus, dxf_name: str) -> dict[str, Any]:
    return corpus.once(f"dxf-artifact:{dxf_name}", lambda: ingest_dxf(corpus.require(dxf_name)))


def _recovered(corpus, dxf_name: str) -> Counter[tuple[str, str]]:
    return Counter((e["space"], e["type"]) for e in _artifact(corpus, dxf_name)["entities"])


def _read(corpus, dxf_name: str) -> Any:
    import ezdxf

    return corpus.once(f"ezdxf:{dxf_name}", lambda: ezdxf.readfile(str(corpus.require(dxf_name))))


def test_sanity_names_the_drawn_pairs(bnbc_corpus) -> None:
    sanity = _sanity(bnbc_corpus)
    assert sanity.get("generator") == "fixtures/gen/rcc6_bnbc/"
    drawn = sanity.get("drawn")
    assert isinstance(drawn, dict) and drawn, "sanity.json names no drawn drawing"
    for dxf_name, spaces in drawn.items():
        assert dxf_name.endswith(".dxf"), f"drawn[{dxf_name!r}] is not a DXF"
        assert isinstance(spaces, dict) and spaces, f"{dxf_name} names no space"
        for space, types in spaces.items():
            assert isinstance(space, str) and space, f"{dxf_name} holds an unnamed space"
            for dxftype, count in types.items():
                assert isinstance(count, int) and count > 0, (
                    f"drawn[{dxf_name!r}][{space!r}][{dxftype!r}] is not a tally"
                )
    assert PAIRS, "no (space, type) pair was read off sanity.json at collection time"


@pytest.mark.parametrize(
    ("dxf_name", "space", "dxftype", "drawn"), PAIRS,
    ids=[f"{d.split('.')[0]}:{s}:{t}" for d, s, t, _ in PAIRS],
)
def test_each_drawn_pair_is_recovered_exactly(bnbc_corpus, dxf_name: str, space: str,
                                              dxftype: str, drawn: int) -> None:
    found = _recovered(bnbc_corpus, dxf_name).get((space, dxftype), 0)
    assert found == drawn, (
        f"{dxf_name} {dxftype} on {space!r}: the generator drew {drawn}, ingest_dxf recovered {found}"
    )


@pytest.mark.parametrize("dxf_name", DRAWINGS)
def test_no_pair_appears_on_one_side_only(bnbc_corpus, dxf_name: str) -> None:
    spaces = _sanity(bnbc_corpus)["drawn"][dxf_name]
    named = {(space, dxftype) for space, types in spaces.items() for dxftype in types}
    found = set(_recovered(bnbc_corpus, dxf_name))
    assert found - named == set(), (
        f"{dxf_name}: ingest_dxf recovered pairs sanity.json never drew: {sorted(found - named)}"
    )
    assert named - found == set(), (
        f"{dxf_name}: sanity.json draws pairs ingest_dxf never recovered: {sorted(named - found)}"
    )


@pytest.mark.parametrize("dxf_name", DRAWINGS)
def test_no_space_truncated_its_explode(bnbc_corpus, dxf_name: str) -> None:
    counters = _artifact(bnbc_corpus, dxf_name)["counters"]
    assert counters, f"{dxf_name}: the artifact holds no counters record"
    truncated = [record["space"] for record in counters if record["explode_truncated"]]
    assert truncated == [], f"{dxf_name}: explode_truncated is set on: {truncated}"


@pytest.mark.parametrize("dxf_name", DRAWINGS)
def test_no_layout_was_dropped(bnbc_corpus, dxf_name: str) -> None:
    dropped = _artifact(bnbc_corpus, dxf_name)["dropped_layouts"]
    assert dropped == [], (
        f"{dxf_name}: content-less layouts were dropped — every sheet must draw its title block: "
        f"{dropped}"
    )


@pytest.mark.parametrize("dxf_name", DRAWINGS)
def test_the_drawing_declares_no_units(bnbc_corpus, dxf_name: str) -> None:
    """T-INSUNITS-0: the units are only inferable from the dimension texts and the scale bar."""
    header = _read(bnbc_corpus, dxf_name).header
    assert header["$INSUNITS"] == 0, f"{dxf_name}: $INSUNITS is {header['$INSUNITS']}, not 0"
    assert header["$LUNITS"] == 4, f"{dxf_name}: $LUNITS is {header['$LUNITS']}, not 4 (architectural)"


@pytest.mark.parametrize("dxf_name", DRAWINGS)
def test_the_obsolete_layer_is_frozen(bnbc_corpus, dxf_name: str) -> None:
    """T-LAYER-FROZEN: frozen content is never measured, and is listed as a named skip."""
    layers = _read(bnbc_corpus, dxf_name).layers
    assert FROZEN_LAYER in layers, f"{dxf_name}: the obsolete layer {FROZEN_LAYER} is not there"
    assert layers.get(FROZEN_LAYER).is_frozen(), f"{dxf_name}: {FROZEN_LAYER} is not frozen"


def test_every_sheet_has_its_own_layout(bnbc_corpus) -> None:
    """One paper layout per sheet, named by its S-number; sanity.json's own spaces say how many."""
    spaces = _sanity(bnbc_corpus)["drawn"][PAPER_REL]
    sheets = sorted(space for space in spaces if space != "model")
    doc = _read(bnbc_corpus, PAPER_REL)
    layouts = sorted(name for name in doc.layouts.names() if name != "Model")
    assert layouts == sheets, f"the layouts are not the sheets: {set(layouts) ^ set(sheets)}"
    assert len(sheets) >= 26, f"the roster is 26 sheets or more, not {len(sheets)}"
    numbers = sorted(name.split()[0] for name in sheets)
    assert len(set(numbers)) == len(numbers), f"two layouts share an S-number: {numbers}"


def _space_of_handles(doc: Any) -> dict[str, str]:
    out: dict[str, str] = {}
    for name in doc.layouts.names_in_taborder():
        space = "model" if name == "Model" else name
        for entity in doc.layouts.get(name):
            handle = entity.dxf.get("handle", None)
            if handle:
                out[handle] = space
    return out


def test_every_trap_opens_where_it_was_drawn(bnbc_corpus) -> None:
    """Check 8b on the committed bytes: every registered trap resolves to a live entity, in the
    file it names, inside its own sheet's layout or in the model space its views are planted in."""
    traps = bnbc_corpus.read_json(TRAPS_REL)["traps"]
    readable = set(_sanity(bnbc_corpus)["drawn"])
    spaces: dict[str, dict[str, str]] = {}
    unresolved = []
    misplaced = []
    for trap in traps:
        handle = trap.get("handle")
        if not handle:
            unresolved.append((trap["id"], "no handle"))
            continue
        file = trap.get("file", PAPER_REL)
        if file not in readable:
            # a trap may name a PDF, a raster, a DWG or the malformed twin; its anchor entity was
            # drawn in the paper set, which is where the handle lives
            file = PAPER_REL
        if file not in spaces:
            spaces[file] = _space_of_handles(_read(bnbc_corpus, file))
        space = spaces[file].get(handle)
        if space is None:
            unresolved.append((trap["id"], file, handle))
            continue
        sheet = trap["sheet"]
        if sheet != "*" and space != "model" and not space.startswith(f"{sheet} "):
            misplaced.append((trap["id"], sheet, space))
    assert not unresolved, f"traps that do not open: {unresolved}"
    assert not misplaced, f"traps drawn on another sheet than the one they are registered on: {misplaced}"
    assert len(traps) >= 52, f"the fixture registers 52 traps, not {len(traps)}"
