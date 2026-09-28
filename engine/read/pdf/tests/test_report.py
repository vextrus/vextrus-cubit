"""The two stages on generated PDFs, through the child: the report and each page's text.

Synthetic fixtures prove the mechanics only (docs/sdlc.md); what real plots carry is the local step's.
"""

from collections.abc import Callable
from pathlib import Path

import pytest

from engine.messages import pdf_report as codes
from engine.read import pdf
from engine.read.anchor import PdfAnchor
from engine.read.pdf import FEW_CHARS, MAX_PAGES, TextSource
from engine.read.pdf.tests.conftest import SMALL

type Fixture = Callable[..., Path]


def test_a_plot_with_shx_comments_reports_what_a_qs_reads(pdf_fixture: Fixture) -> None:
    found = pdf.report(pdf_fixture("plot"))

    assert found.messages == (
        codes.MADE_BY_AUTOCAD(),
        codes.PAGES(pages=3, turned=1),
        codes.LETTERING_KEPT(),
        codes.LAYERS_KEPT(layers=2),
        codes.PICTURES(pages=1, percent=1),
    )
    assert found.layers == ("A-TEXT", "A-WALL")
    assert [(f.name, f.kind, f.embedded) for f in found.fonts] == [("ArialNarrow", "truetype", True)]
    assert [p.shx_comments for p in found.pages] == [2, 1, 0]
    assert [p.rotate for p in found.pages] == [0, 270, 0]


def test_the_counts_are_what_the_check_compares(pdf_fixture: Fixture) -> None:
    counts = pdf.report(pdf_fixture("plot")).counts

    assert {
        k: counts[k] for k in ("pages", "rotated_pages", "shx_comments", "pages_with_shx_comments")
    } == {
        "pages": 3,
        "rotated_pages": 1,
        "shx_comments": 3,
        "pages_with_shx_comments": 2,
    }
    assert (counts["mirrored_texts"], counts["layers"], counts["images"]) == (1, 2, 1)


def test_page_text_holds_the_body_and_the_title_block_and_the_comments(pdf_fixture: Fixture) -> None:
    first, second, third = pdf.page_text(pdf_fixture("plot"))

    assert [(i.text, i.source) for i in first.items] == [
        ("S-101", TextSource.TEXT),
        ("GROUND FLOOR PLAN", TextSource.TEXT),
        ("COLUMN C1", TextSource.TEXT),
        ("%%C12 BAR", TextSource.SHX_COMMENT),  # kept raw: 11's decode function reads it
        ("GRID A", TextSource.SHX_COMMENT),
    ]
    assert [(i.text, i.angle) for i in second.items] == [("BEAM B-12", 0.0), ("GRID 1", None)]
    assert (third.items[0].text, third.items[0].mirrored) == ("MIRRORED NOTE", True)


def test_a_turned_page_reads_as_displayed(pdf_fixture: Fixture) -> None:
    rotated = pdf.page_text(pdf_fixture("plot"))[1]

    assert (rotated.rotate, rotated.width, rotated.height) == (270, 1190.55, 841.89)
    beam = rotated.items[0]
    assert beam.size == 10.0
    x0, y0, x1, y1 = beam.anchor.box
    # 9 glyphs of 0.6 em, laid flat
    assert [x1 - x0, y1 - y0] == pytest.approx([54.0, 10.0])


def test_each_item_is_anchored_by_page_drawing_order_and_box(pdf_fixture: Fixture) -> None:
    path = pdf_fixture("plot")
    first = pdf.page_text(path)[0]
    report = pdf.report(path)

    anchors = [item.anchor for item in first.items]
    assert all(isinstance(a, PdfAnchor) and a.page == 1 for a in anchors)
    assert {a.source_sha256 for a in anchors} == {report.source_sha256}
    assert anchors[0].reader == "pdfminer.six"
    # 40 strokes, then three text objects, then an image; the comments follow the content's 44 objects.
    assert [a.path_index for a in anchors] == [40, 41, 42, 44, 45]
    assert anchors[0].box == (900.0, 57.6, 936.0, 69.6)
    assert PdfAnchor.from_json(anchors[3].to_json()) == anchors[3]


def test_items_and_pages_are_values_with_json(pdf_fixture: Fixture) -> None:
    page = pdf.page_text(pdf_fixture("plot"))[0]

    data = page.to_json()
    assert (data["number"], data["width"]) == (1, "1190.55")
    assert (data["items"][0]["anchor"]["kind"], data["items"][0]["size"]) == ("pdf", "12.0")
    assert data["items"][3]["size"] is None


@pytest.mark.parametrize(
    ("chars", "code"), [(FEW_CHARS - 1, "lettering_lines"), (FEW_CHARS, "lettering_unconfirmed")]
)
def test_the_lettering_edge_on_a_generated_page(pdf_fixture: Fixture, chars: int, code: str) -> None:
    found = pdf.report(pdf_fixture("lettering", chars=chars))

    assert f"engine.pdf_report.{code}" in [m["code"] for m in found.messages]


def test_hidden_text_is_page_text_and_keeps_the_lettering(pdf_fixture: Fixture) -> None:
    path = pdf_fixture("lettering", hidden=5)

    assert codes.LETTERING_KEPT() in pdf.report(path).messages
    [item] = pdf.page_text(path)[0].items
    assert (item.text, item.source) == ("HHHHH", TextSource.HIDDEN_TEXT)


def test_comments_on_some_pages_leave_the_rest_as_lines(pdf_fixture: Fixture) -> None:
    found = pdf.report(pdf_fixture("lettering", comments=2, pages=3, comment_pages=1))

    assert codes.LETTERING_PARTLY(pages=1, of=3) in found.messages
    assert codes.LETTERING_LINES(pages=2) in found.messages


@pytest.mark.parametrize(("share", "refused"), [(0.49, False), (0.51, True)])
def test_the_scan_edge_on_a_generated_page(pdf_fixture: Fixture, share: float, refused: bool) -> None:
    found = pdf.report(pdf_fixture("scan", share=share))

    assert (found.refused == codes.SCAN()) is refused


@pytest.mark.parametrize(
    ("options", "refused"),
    [
        ({}, True),
        ({"strokes_drawn": 1}, False),
        ({"chars": 1}, False),
        ({"hidden": 40}, True),
        ({"tiles": 300}, True),
    ],
)
def test_a_full_page_picture_is_a_scan_unless_it_draws(
    pdf_fixture: Fixture, options: dict[str, int], refused: bool
) -> None:
    found = pdf.report(pdf_fixture("scan", **options))

    assert (found.refused is not None) is refused


def test_a_scan_page_among_drawn_ones_is_named_and_the_rest_read(pdf_fixture: Fixture) -> None:
    path = pdf_fixture("scan", drawn=2)
    found = pdf.report(path)

    assert found.refused is None
    assert codes.SCAN_PAGE(page=1) in found.messages
    assert [p.scan for p in pdf.page_text(path)] == [True, False, False]


@pytest.mark.parametrize(
    ("producer", "creator", "message"),
    [
        ("pypdf", None, codes.MADE_BY_OTHER(producer="pypdf")),
        (None, None, codes.MADE_BY_UNKNOWN()),
    ],
)
def test_who_made_the_pdf(
    pdf_fixture: Fixture, producer: str | None, creator: str | None, message: object
) -> None:
    assert pdf.report(pdf_fixture("plot", producer=producer, creator=creator)).messages[0] == message


@pytest.mark.parametrize(("pages", "read"), [(MAX_PAGES, True), (MAX_PAGES + 1, False)])
def test_the_page_limit(pdf_fixture: Fixture, pages: int, read: bool) -> None:
    path = pdf_fixture("page_tree", kind="many", pages=pages)
    if read:
        assert pdf.report(path).counts["pages"] == MAX_PAGES
        return
    with pytest.raises(pdf.ReadError) as raised:
        pdf.report(path)
    assert raised.value.message == codes.TOO_MANY_PAGES(limit=MAX_PAGES)


def test_one_reading_serves_both_stages_and_a_changed_file_is_read_again(
    pdf_fixture: Fixture, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "set.pdf"
    path.write_bytes(pdf_fixture("plot").read_bytes())
    calls: list[Path] = []
    real = pdf._read

    def counted(file: Path, limits: object) -> object:
        calls.append(file)
        return real(file, limits)  # type: ignore[arg-type]

    monkeypatch.setattr(pdf, "_read", counted)
    pdf.report(path)
    pdf.page_text(path)
    assert len(calls) == 1
    path.write_bytes(pdf_fixture("plot", producer="pypdf").read_bytes())
    assert pdf.report(path).messages[0] == codes.MADE_BY_OTHER(producer="pypdf")
    assert len(calls) == 2


def test_a_file_refused_once_is_refused_again_without_a_second_reading(
    pdf_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = pdf_fixture("damaged", kind="locked")
    with pytest.raises(pdf.ReadError):
        pdf.report(path, limits=SMALL)
    monkeypatch.setattr(pdf, "_read", lambda *_: pytest.fail("read twice"))
    with pytest.raises(pdf.ReadError) as raised:
        pdf.page_text(path, limits=SMALL)
    assert raised.value.message == codes.LOCKED()
