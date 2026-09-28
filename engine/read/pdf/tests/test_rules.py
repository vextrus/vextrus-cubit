"""The report's rules over a PDF's facts, each edge tested just either side (engine/read/pdf)."""

from dataclasses import replace
from typing import Any

import pytest

from engine.messages import Message
from engine.messages import pdf_report as codes
from engine.read.pdf import rules
from engine.read.pdf.facts import DocumentFacts, ItemFacts, PageFacts
from engine.read.pdf.rules import EXACT_UNION, FEW_CHARS, MOSTLY_PICTURE
from engine.read.pdf.types import Lettering, MadeBy, TextSource

SHA = "a" * 64
W, H = 1000.0, 500.0


def page(**fields: Any) -> PageFacts:
    base = PageFacts(
        number=1,
        readable=True,
        rotate=0,
        width=W,
        height=H,
        crop=(0.0, 0.0, W, H),
        objects=0,
        strokes=10,
        fills=0,
        chars=FEW_CHARS,
        hidden_chars=0,
        unmapped_chars=0,
        images=(),
        fonts=(("Arial", "truetype", True),),
        layers=(),
        shx_comments=0,
        items=(),
    )
    return replace(base, **fields)


def facts(
    *pages: PageFacts, producer: str | None = "AutoCAD 2027 DWG To PDF", **extras: int
) -> DocumentFacts:
    counts = dict.fromkeys(("scripts", "launches", "links", "remote", "files"), 0) | extras
    numbered = [replace(p, number=i) for i, p in enumerate(pages, start=1)]
    return DocumentFacts(producer=producer, creator=None, extras=counts, pages=tuple(numbered))


def picture(
    share: float, *, pieces: int = 1
) -> tuple[tuple[tuple[float, float, float, float], int, int], ...]:
    """Pictures covering `share` of the page, from its left edge, in `pieces` side by side."""
    strip = W * share / pieces
    return tuple(((i * strip, 0.0, (i + 1) * strip, H), 100, 100) for i in range(pieces))


def comment(text: str = "GRID A") -> ItemFacts:
    return ItemFacts(text, TextSource.SHX_COMMENT, 5, (1.0, 1.0, 2.0, 2.0), None, None, False, None)


def codes_of(messages: tuple[Message, ...] | list[Message]) -> list[str]:
    return [m["code"].removeprefix("engine.pdf_report.") for m in messages]


# The scan rule ------------------------------------------------------------------------------------


@pytest.mark.parametrize(("share", "mostly"), [(MOSTLY_PICTURE, False), (MOSTLY_PICTURE + 0.001, True)])
def test_a_page_is_mostly_a_picture_past_half_its_area(share: float, mostly: bool) -> None:
    found = page(images=picture(share), strokes=0, chars=0)

    assert rules.picture_share(found) == pytest.approx(share)
    assert rules.is_scan(found, rules.picture_share(found)) is mostly


@pytest.mark.parametrize(
    ("changes", "scan"),
    [
        ({}, True),
        ({"strokes": 1}, False),
        ({"chars": 1}, False),
        ({"hidden_chars": 500}, True),  # a scanner's OCR is hidden text: still a scan
        ({"fills": 3}, True),
    ],
)
def test_a_scan_draws_no_text_and_no_stroke(changes: dict[str, int], scan: bool) -> None:
    found = page(**({"images": picture(0.9), "strokes": 0, "chars": 0} | changes))

    assert rules.is_scan(found, rules.picture_share(found)) is scan


def test_pictures_are_clipped_to_the_page_and_overlaps_counted_once() -> None:
    boxes = (((-100.0, -100.0, 300.0, 600.0), 1, 1), ((200.0, 0.0, 400.0, 500.0), 1, 1))

    assert rules.picture_share(page(images=boxes)) == pytest.approx(0.4)


@pytest.mark.parametrize("pieces", [EXACT_UNION, EXACT_UNION + 1])
def test_tiles_that_do_not_overlap_cover_their_sum_on_either_side_of_the_exact_union(
    pieces: int,
) -> None:
    assert rules.picture_share(page(images=picture(0.8, pieces=pieces))) == pytest.approx(0.8)


def test_a_pdf_whose_every_page_is_a_scan_is_refused_and_says_only_what_it_is() -> None:
    scan = page(images=picture(1.0), strokes=0, chars=0)

    found = rules.report(facts(scan, scan, producer="Scanner Suite 4"), SHA)

    assert found.refused == codes.SCAN()
    assert codes_of(found.messages) == ["made_by_other", "pages", "scan"]
    assert (found.counts["refused"], found.counts["scan_pages"]) == (1, 2)


def test_a_scan_page_among_drawn_pages_is_named_and_the_pdf_read() -> None:
    found = rules.report(facts(page(), page(images=picture(1.0), strokes=0, chars=0)), SHA)

    assert found.refused is None
    assert codes.SCAN_PAGE(page=2) in found.messages
    assert found.counts["scan_pages"] == 1


def test_a_page_mostly_a_picture_with_strokes_may_be_a_scan_and_is_read() -> None:
    found = rules.report(facts(page(images=picture(0.88))), SHA)

    assert codes.MOSTLY_PICTURE(page=1, percent=88) in found.messages
    assert found.refused is None
    assert found.pages[0].mostly_picture


def test_small_pictures_are_named_by_the_largest_share_a_page_has() -> None:
    found = rules.report(facts(page(images=picture(0.031)), page(images=picture(0.004)), page()), SHA)

    assert codes.PICTURES(pages=2, percent=3) in found.messages
    assert (
        codes.PICTURES(pages=1, percent=1)
        in rules.report(facts(page(images=picture(0.001))), SHA).messages
    )


def test_no_picture_is_said() -> None:
    assert codes.NO_PICTURES() in rules.report(facts(page()), SHA).messages


# The lettering rule -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("changes", "lettering"),
    [
        ({"chars": FEW_CHARS - 1}, Lettering.LINES),
        ({"chars": FEW_CHARS}, Lettering.TEXT),
        ({"chars": 0, "shx_comments": 1, "items": (comment(),)}, Lettering.COMMENTS),
        ({"chars": 0, "hidden_chars": 1}, Lettering.COMMENTS),
        ({"chars": 0, "strokes": 0}, Lettering.NONE),
        ({"chars": 0, "strokes": 1}, Lettering.LINES),
    ],
)
def test_a_pages_lettering_either_side_of_each_edge(
    changes: dict[str, object], lettering: Lettering
) -> None:
    assert rules.lettering(page(**changes)) is lettering


def lettering_messages(*pages: PageFacts) -> list[Message]:
    found = rules.report(facts(*pages), SHA).messages
    return [m for m in found if m["code"].startswith("engine.pdf_report.lettering_")]


commented = page(shx_comments=1, items=(comment(),))
lines = page(chars=FEW_CHARS - 1)
text_only = page(chars=FEW_CHARS)


def test_lettering_kept_on_every_page() -> None:
    assert lettering_messages(commented, commented) == [codes.LETTERING_KEPT()]


def test_with_comments_anywhere_a_page_of_real_text_counts_as_kept() -> None:
    assert lettering_messages(commented, text_only) == [codes.LETTERING_KEPT()]


def test_lettering_partly_kept_names_the_pages_drawn_as_lines() -> None:
    assert lettering_messages(commented, commented, lines) == [
        codes.LETTERING_PARTLY(pages=2, of=3),
        codes.LETTERING_LINES(pages=1),
    ]


def test_lettering_lines_on_every_page() -> None:
    assert lettering_messages(lines, lines) == [codes.LETTERING_LINES(pages=2)]


def test_without_comments_anywhere_real_text_leaves_the_lettering_unconfirmed() -> None:
    assert lettering_messages(text_only, lines) == [
        codes.LETTERING_LINES(pages=1),
        codes.LETTERING_UNCONFIRMED(pages=1),
    ]


def test_blank_pages_and_scans_say_nothing_of_lettering() -> None:
    blank = page(strokes=0, chars=0)
    scan = page(images=picture(1.0), strokes=0, chars=0)

    assert lettering_messages(blank, scan, commented) == [codes.LETTERING_KEPT()]
    assert lettering_messages(blank) == []


# Made by, pages, layers, fonts, extras ------------------------------------------------------------


@pytest.mark.parametrize(
    ("producer", "creator", "made"),
    [
        ("AutoCAD 2027 - English", None, MadeBy.AUTOCAD),
        ("DWG To PDF.hdi 27.0.0", None, MadeBy.AUTOCAD),
        ("pypdf", "AutoCAD 2027", MadeBy.OTHER),  # merged after the plot: the merger speaks last
        (None, "AutoCAD 2027", MadeBy.AUTOCAD),
        (None, None, MadeBy.UNKNOWN),
    ],
)
def test_made_by_is_the_producer_else_the_creator(
    producer: str | None, creator: str | None, made: MadeBy
) -> None:
    assert rules.made_by(producer, creator) is made


def test_the_report_names_another_maker_and_counts_turned_pages() -> None:
    found = rules.report(facts(page(rotate=270), page(), producer="pypdf"), SHA)

    assert found.messages[:2] == (codes.MADE_BY_OTHER(producer="pypdf"), codes.PAGES(pages=2, turned=1))


@pytest.mark.parametrize(
    ("layers", "message"),
    [(("0",), codes.LAYERS_FLATTENED()), (("0", "A-WALL"), codes.LAYERS_KEPT(layers=2))],
)
def test_layers_are_kept_when_there_are_two_or_more(layers: tuple[str, ...], message: Message) -> None:
    assert message in rules.report(facts(page(layers=layers)), SHA).messages


def test_fonts_are_flagged_once_each_across_pages() -> None:
    fonts = (("Helvetica", "type1", False), ("Glyphs", "type3", True), ("Broken", "unreadable", False))
    found = rules.report(facts(page(fonts=fonts), page(fonts=fonts)), SHA)

    assert [(f.name, f.pages) for f in found.fonts] == [("Broken", 2), ("Glyphs", 2), ("Helvetica", 2)]
    flagged = [m for m in found.messages if m["code"].startswith("engine.pdf_report.fonts_")]
    assert flagged == [
        codes.FONTS_NOT_EMBEDDED(fonts=1),
        codes.FONTS_DRAWN(fonts=1),
        codes.FONTS_UNREADABLE(fonts=1),
    ]


def test_extras_are_counted_together_and_ignored() -> None:
    found = rules.report(facts(page(), scripts=2, files=1), SHA)

    assert codes.EXTRAS_IGNORED(count=3) in found.messages
    assert (found.counts["extras_scripts"], found.counts["extras_files"]) == (2, 1)


def test_a_damaged_page_is_named() -> None:
    assert (
        codes.PAGE_UNREADABLE(page=2) in rules.report(facts(page(), page(readable=False)), SHA).messages
    )


def test_the_reports_counts_are_names_to_counts() -> None:
    found = rules.report(facts(commented, lines), SHA)

    assert all(isinstance(v, int) and v >= 0 for v in found.counts.values())
    assert found.to_json()["counts"] == found.counts


def test_page_text_anchors_each_item_on_its_page() -> None:
    item = ItemFacts("S-101", TextSource.TEXT, 7, (1.0, 2.0, 3.0, 4.0), 12.0, 90.0, False, "Arial")
    [first, second] = rules.pages(facts(page(items=(item,)), commented), SHA, "pdfminer.six", "1+1")

    anchor = first.items[0].anchor
    assert (anchor.page, anchor.path_index, anchor.box, anchor.source_sha256) == (
        1,
        7,
        (1.0, 2.0, 3.0, 4.0),
        SHA,
    )
    assert second.items[0].source is TextSource.SHX_COMMENT
    assert second.items[0].anchor.page == 2
