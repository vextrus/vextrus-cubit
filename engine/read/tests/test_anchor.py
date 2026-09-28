"""The Trace's anchors: where on a drawing a figure was read, to and from JSON."""

import json

import pytest

from engine.read.anchor import Anchor, DwgAnchor, PdfAnchor, anchor_from_json

SHA = "ab" * 32


def dwg_anchor() -> DwgAnchor:
    return DwgAnchor(
        source_sha256=SHA,
        reader="libredwg",
        reader_version="0.14",
        sheet="Model",
        inserts=("2A0", "2B1"),
        handle="3C",
    )


def pdf_anchor() -> PdfAnchor:
    return PdfAnchor(
        source_sha256=SHA,
        reader="pdfplumber",
        reader_version="0.11.10",
        page=3,
        path_index=41,
        box=(10.5, 20.0, 110.25, 0.1),
    )


def test_a_dwg_anchor_is_written_as_json_with_its_kind() -> None:
    assert dwg_anchor().to_json() == {
        "kind": "dwg",
        "source_sha256": SHA,
        "reader": "libredwg",
        "reader_version": "0.14",
        "sheet": "Model",
        "inserts": ["2A0", "2B1"],
        "handle": "3C",
    }


def test_a_pdf_anchors_box_is_written_as_decimal_strings() -> None:
    # docs/data-model.md §2: numbers inside JSONB are decimal strings, never floats.
    assert pdf_anchor().to_json() == {
        "kind": "pdf",
        "source_sha256": SHA,
        "reader": "pdfplumber",
        "reader_version": "0.11.10",
        "page": 3,
        "path_index": 41,
        "box": ["10.5", "20.0", "110.25", "0.1"],
    }


@pytest.mark.parametrize("anchor", [dwg_anchor(), pdf_anchor()], ids=["dwg", "pdf"])
def test_an_anchor_survives_json_text_unchanged(anchor: Anchor) -> None:
    text = json.dumps(anchor.to_json())

    assert anchor_from_json(json.loads(text)) == anchor


def test_the_kind_picks_the_type() -> None:
    assert isinstance(anchor_from_json(dwg_anchor().to_json()), DwgAnchor)
    assert isinstance(anchor_from_json(pdf_anchor().to_json()), PdfAnchor)
    assert DwgAnchor.from_json(dwg_anchor().to_json()) == dwg_anchor()


def test_an_anchor_outside_any_insert_has_an_empty_chain() -> None:
    anchor = DwgAnchor(SHA, "libredwg", "0.14", "Layout1", (), "1F")

    assert anchor_from_json(anchor.to_json()) == anchor
    assert anchor.to_json()["inserts"] == []


@pytest.mark.parametrize(
    "change",
    [
        {"kind": "dxf"},
        {"handle": "not hex"},
        {"handle": ""},
        {"inserts": ["2A0", "zz"]},
        {"source_sha256": "abc"},
        {"sheet": 4},
        {"extra": 1},
    ],
)
def test_a_malformed_dwg_anchor_is_refused(change: dict[str, object]) -> None:
    data = {**dwg_anchor().to_json(), **change}

    with pytest.raises(ValueError, match="anchor"):
        anchor_from_json(data)


@pytest.mark.parametrize(
    "change",
    [{"box": [1, 2, 3, 4]}, {"box": ["1", "2", "3"]}, {"page": "3"}, {"page": 0}, {"path_index": -1}],
)
def test_a_malformed_pdf_anchor_is_refused(change: dict[str, object]) -> None:
    data = {**pdf_anchor().to_json(), **change}

    with pytest.raises(ValueError, match="anchor"):
        anchor_from_json(data)


def test_a_missing_field_is_refused() -> None:
    data = dwg_anchor().to_json()
    del data["reader_version"]

    with pytest.raises(ValueError, match="reader_version"):
        anchor_from_json(data)


def test_handles_are_kept_as_the_file_writes_them_in_upper_case() -> None:
    with pytest.raises(ValueError, match="anchor"):
        DwgAnchor(SHA, "libredwg", "0.14", "Model", (), "3c")
