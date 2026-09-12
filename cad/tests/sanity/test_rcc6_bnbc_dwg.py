"""The DWG side of F-RCC6-BNBC's sanity number (L-CAD-04, W-04).

Both minted drawings are read back through the product's own lane — `convert_dwg`, which reconciles
`dwgread -O JSON` against `dwg2dxf` class by class — and the census must be exactly the `expected`
that `sanity.json` publishes. `expected` is what the generator drew minus the losses the DWG profile
measured with its canaries, so a drawing that lost something new fails here by name rather than
quietly reading short.

The corpus lands when the generator is run; until then the module skips by name.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest

from vextrus_cad.dwg import convert_dwg

SANITY_REL = "sanity.json"
PAPER_DWG = "rcc6-bnbc.dwg"

#: cad/tests/sanity/<this file> -> the checkout.
_CORPUS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "rcc6-bnbc"

_PRESENT = (_CORPUS_DIR / PAPER_DWG).is_file()
_TOOLCHAIN = shutil.which("dwgread") is not None and shutil.which("dwg2dxf") is not None

pytestmark = [
    pytest.mark.skipif(
        not _PRESENT,
        reason=f"fixtures/rcc6-bnbc/{PAPER_DWG} is not committed yet — Wave B's outputs land with "
        "the generator run",
    ),
    pytest.mark.skipif(not _TOOLCHAIN, reason="LibreDWG (dwgread, dwg2dxf) is not on PATH"),
]


def _document() -> dict[str, Any]:
    path = _CORPUS_DIR / SANITY_REL
    if not path.is_file():
        return {}
    document = json.loads(path.read_text(encoding="utf-8"))
    return document if isinstance(document, dict) else {}


DRAWINGS = sorted(_document().get("dwg", {}))


def _sanity(corpus) -> dict[str, Any]:
    return corpus.read_json(SANITY_REL)


def _conversion(corpus, dwg_name: str, tmp_path: Path) -> Any:
    return corpus.once(
        f"dwg:{dwg_name}", lambda: convert_dwg(corpus.require(dwg_name), tmp_path)
    )


def test_sanity_names_a_dwg(bnbc_corpus) -> None:
    dwg = _sanity(bnbc_corpus).get("dwg")
    assert isinstance(dwg, dict) and dwg, "sanity.json publishes no DWG census"
    for name, spec in dwg.items():
        assert name.endswith(".dwg"), f"dwg[{name!r}] is not a drawing"
        for key in ("source", "expected", "losses", "named_losses"):
            assert key in spec, f"dwg[{name!r}] names no {key}"
    assert DRAWINGS, "no DWG was read off sanity.json at collection time"


@pytest.mark.parametrize("dwg_name", DRAWINGS)
def test_the_census_is_what_sanity_expects(bnbc_corpus, dwg_name: str, tmp_path: Path) -> None:
    """The drawing is judged by its census, never by its bytes (E-fixture 3.9)."""
    spec = _sanity(bnbc_corpus)["dwg"][dwg_name]
    conversion = _conversion(bnbc_corpus, dwg_name, tmp_path)
    census = {space: dict(sorted(types.items())) for space, types in conversion.census.items()}
    expected = {space: dict(sorted(types.items())) for space, types in spec["expected"].items()}
    assert census == expected, (
        f"{dwg_name}: the census is not what sanity.json expects "
        f"({sorted(set(census) ^ set(expected))[:6] or 'same spaces, different counts'})"
    )
    assert conversion.refused == (), f"{dwg_name}: the lane refused classes: {conversion.refused}"


@pytest.mark.parametrize("dwg_name", DRAWINGS)
def test_expected_is_drawn_minus_the_named_losses(bnbc_corpus, dwg_name: str) -> None:
    sanity = _sanity(bnbc_corpus)
    spec = sanity["dwg"][dwg_name]
    drawn = sanity["drawn"][spec["source"]]
    expected, losses = spec["expected"], spec["losses"]
    for space, types in drawn.items():
        for dxftype, n in types.items():
            lost = losses.get(space, {}).get(dxftype, 0)
            assert lost >= 0, f"{dwg_name}: {space}/{dxftype} gained {-lost} entities in the DWG"
            assert expected.get(space, {}).get(dxftype, 0) == n - lost, (
                f"{dwg_name}: {space}/{dxftype} drew {n}, lost {lost}, expects "
                f"{expected.get(space, {}).get(dxftype, 0)}"
            )


@pytest.mark.parametrize("dwg_name", DRAWINGS)
def test_every_loss_is_a_named_loss(bnbc_corpus, dwg_name: str) -> None:
    """A loss is only lawful where the canary said the feature fails: the named list must account
    for every entity the census is short, type for type."""
    spec = _sanity(bnbc_corpus)["dwg"][dwg_name]
    named = spec["named_losses"]
    for entry in named:
        for key in ("feature", "type", "count", "reason"):
            assert key in entry, f"{dwg_name}: a named loss names no {key}"
        assert entry["reason"].strip(), f"{dwg_name}: {entry['feature']} is lost for no stated reason"
    lost_by_type: dict[str, int] = {}
    for types in spec["losses"].values():
        for dxftype, n in types.items():
            lost_by_type[dxftype] = lost_by_type.get(dxftype, 0) + n
    named_by_type: dict[str, int] = {}
    for entry in named:
        named_by_type[entry["type"]] = named_by_type.get(entry["type"], 0) + entry["count"]
    assert named_by_type == lost_by_type, (
        f"{dwg_name}: the named losses {named_by_type} do not account for the census shortfall "
        f"{lost_by_type}"
    )
    if not lost_by_type:
        assert named == [], f"{dwg_name}: features are named as lost but nothing is missing"
