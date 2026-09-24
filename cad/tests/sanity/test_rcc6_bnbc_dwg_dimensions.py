"""F-RCC6-BNBC's DWG reaches the artifact with every dimension it holds (L-CAD-04, L-MEA-05).

Session 8's walk-0 uploaded `rcc6-bnbc.dwg` and no view of it proposed a scale, where the DXF of the
same drawing proposes DIMENSION_RATIO on ten. The DWG held 125 dimensions then; Rev C holds 152 (its
census, `sanity.json`: W-44's new sections each carry their outer dimension, and W-50's DWG source keeps
every model-space entity Rev C appends), and LibreDWG's writer left every one naming no picture, so the recover-mode audit removed them all and
nothing but a count of repairs said so. This reads the committed DWG through the product's own lane and
holds the artifact to the census: every dimension an original, each with the one measurement text and
the definition points rank 3 measures between — and every text the draughtsman typed in feet and
inches (`15'-0"`, the words S-10's scale is read from) the same words the DXF's dimensions carry.
"""

from __future__ import annotations

import re
import shutil
from collections import Counter
from pathlib import Path
from typing import Any

import pytest

from vextrus_cad import report
from vextrus_cad.dwg import convert_dwg, losses_by_space
from vextrus_cad.ingest import ingest_dxf

DWG = "rcc6-bnbc.dwg"
DXF = "rcc6-bnbc.dxf"

#: The layer AutoCAD reserves for a dimension's definition points.
DEFPOINTS = "DEFPOINTS"

#: A feet-and-inches text as the draughtsman typed it over a dimension (`15'-0"`).
FEET_AND_INCHES = re.compile(r"^\d+'-\d+\"$")

pytestmark = pytest.mark.skipif(
    shutil.which("dwgread") is None or shutil.which("dwg2dxf") is None,
    reason="LibreDWG (dwgread, dwg2dxf) is not on PATH",
)


def _conversion(corpus, tmp_path: Path) -> Any:
    # The same memo key test_rcc6_bnbc_dwg.py converts under, so one worker converts the DWG once.
    return corpus.once(f"dwg:{DWG}", lambda: convert_dwg(corpus.require(DWG), tmp_path))


def _artifact(corpus, tmp_path: Path) -> dict[str, Any]:
    """The DWG's artifact, as the CLI writes it: the conversion's losses carried onto its counters."""
    conversion = _conversion(corpus, tmp_path)
    return corpus.once(
        f"dwg-artifact:{DWG}",
        lambda: ingest_dxf(conversion.dxf_path, report.Report(), losses_by_space(conversion.refused)),
    )


def _dimension_texts(graph: dict[str, Any]) -> Counter[str]:
    keys = {entity["key"] for entity in graph["entities"] if entity["type"] == "DIMENSION"}
    return Counter(
        record["text"].strip()
        for record in graph["derived"]
        if record["src"] in keys and isinstance(record.get("text"), str)
    )


def test_every_dimension_of_the_dwg_reaches_the_artifact_with_its_text_and_points(
    bnbc_corpus, tmp_path: Path
) -> None:
    conversion = _conversion(bnbc_corpus, tmp_path)
    counted = sum(types.get("DIMENSION", 0) for types in conversion.census.values())
    # 152 since Rev C (fixtures/gen/rcc6_bnbc/DECISIONS.md W-44, W-50; sanity.json's census): Rev B's 125
    # and the 27 dimensions Rev C draws — each new section's outer dimension among them.
    assert counted == 152, f"the census of {DWG} counts {counted} dimensions; this proof is written for 152"
    assert conversion.drawn_dimensions == counted, (
        "LibreDWG's writer left every one naming no picture, and each was drawn"
    )
    assert conversion.refused == (), [entry.message() for entry in conversion.refused]

    graph = _artifact(bnbc_corpus, tmp_path)
    dimensions = [entity["key"] for entity in graph["entities"] if entity["type"] == "DIMENSION"]
    assert len(dimensions) == counted, "every dimension the DWG holds is an original of the artifact"
    for key in dimensions:
        paint = [record for record in graph["derived"] if record["src"] == key]
        texts = [record for record in paint if isinstance(record.get("text"), str)]
        points = [
            record
            for record in paint
            if record["type"] == "POINT" and str(record.get("layer", "")).upper() == DEFPOINTS
        ]
        assert len(texts) == 1, f"{key} carries its one measurement text"
        assert len(points) >= 2, f"{key} carries the definition points it measures between (I-295b)"


def test_the_typed_feet_and_inches_are_the_words_the_dxf_carries(bnbc_corpus, tmp_path: Path) -> None:
    from_dwg = _dimension_texts(_artifact(bnbc_corpus, tmp_path))
    from_dxf = _dimension_texts(
        bnbc_corpus.once(f"dxf-artifact:{DXF}", lambda: ingest_dxf(bnbc_corpus.require(DXF)))
    )
    typed = Counter({text: n for text, n in from_dxf.items() if FEET_AND_INCHES.match(text)})
    assert sum(typed.values()) > 0, (
        f"{DXF} carries no feet-and-inches dimension text; this proof reads nothing"
    )
    assert Counter({text: n for text, n in from_dwg.items() if FEET_AND_INCHES.match(text)}) == typed, (
        "every typed length S-10's scale is read from reaches the DWG's artifact word for word"
    )
