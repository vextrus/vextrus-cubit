"""The committed artifacts regenerate byte-for-byte (L-CAD-01, L-CAD-02).

A source key is scoped to (file bytes, extractor identity), so the same bytes read by the same
pinned extractor must mint the same key multiset — and, through the pinned serialisation, the very
same file. That is what makes a committed artifact evidence rather than a snapshot: if this suite
reds, either the drawing changed or the extractor's identity did, and the second is a declared
re-ingest.
"""

from __future__ import annotations

import pytest

from corpus import artifact_names, artifact_path, drawing_path
from vextrus_cad import dumps, ingest_dxf

NAMES = artifact_names()


def test_the_corpus_pairs_every_artifact_with_a_drawing() -> None:
    assert NAMES, "no committed artifact was found beside the DXF corpus"
    missing = [name for name in NAMES if not drawing_path(name).is_file()]
    assert missing == [], f"committed artifacts with no drawing beside them: {missing}"


@pytest.mark.parametrize("name", NAMES)
def test_a_fresh_ingest_reproduces_the_committed_artifact(name: str) -> None:
    fresh = dumps(ingest_dxf(drawing_path(name))).encode("utf-8")
    assert fresh == artifact_path(name).read_bytes(), (
        f"a fresh ingest of {name}.dxf does not reproduce the committed artifact byte-for-byte"
    )


@pytest.mark.parametrize("name", NAMES)
def test_two_ingests_of_one_drawing_agree_byte_for_byte(name: str) -> None:
    drawing = drawing_path(name)
    assert dumps(ingest_dxf(drawing)) == dumps(ingest_dxf(drawing))
