"""The child's reading of a page, case by case: spacing, scaling, turned pages, vertical text, pictures,
comments and the crop box. Each PDF is generated here and read in this process (`walk.read_file`, the
child's own function), so a case shows exactly what the child writes.
"""

import math
from pathlib import Path
from typing import Any

import pytest

from engine.fixtures.pdf._writer import (
    Page,
    Pdf,
    dictionary,
    document,
    image,
    nums,
    ref,
    shx_comment,
    strokes,
    truetype_font,
)
from engine.read.pdf import walk


def read(tmp_path: Path, pdf: Pdf, *pages: Page) -> list[dict[str, Any]]:
    path = tmp_path / "case.pdf"
    path.write_bytes(document(pdf, list(pages)))
    found: list[dict[str, Any]] = walk.read_file(path)["pages"]
    return found


def one_page(tmp_path: Path, content: bytes, **options: Any) -> dict[str, Any]:
    pdf = Pdf()
    [page] = read(tmp_path, pdf, Page(content=content, fonts={"F1": truetype_font(pdf)}, **options))
    return page


def items(page: dict[str, Any]) -> list[str]:
    return [item["text"] for item in page["items"]]


# Spacing and scaling (the PDF specification, 9.4.4) ---------------------------------------------


def test_character_spacing_is_no_word_space(tmp_path: Path) -> None:
    [item] = one_page(tmp_path, b"BT /F1 10 Tf 2.5 Tc 100 100 Td (BEAM) Tj ET")["items"]

    assert item["text"] == "BEAM"
    assert item["box"][2] == pytest.approx(100 + 3 * (6 + 2.5) + 6)


def test_character_spacing_follows_the_last_glyph_of_each_show_too(tmp_path: Path) -> None:
    [item] = one_page(tmp_path, b"BT /F1 10 Tf 3 Tc 100 100 Td (A) Tj (B) Tj (C) Tj ET")["items"]

    assert item["text"] == "ABC"
    assert item["box"][2] == pytest.approx(124.0)  # origins at 100, 109 and 118, each 6 wide


@pytest.mark.parametrize(
    "setup", [b"80 Tz 1 0 0 1 100 100 Tm", b"0.5 0 0 1 100 100 Tm", b"1 0 0 3 100 100 Tm"]
)
def test_a_word_gap_in_narrow_or_tall_text_is_a_space(tmp_path: Path, setup: bytes) -> None:
    page = one_page(tmp_path, b"BT /F1 10 Tf " + setup + b" [(AB) -400 (CD)] TJ ET")

    assert items(page) == ["AB CD"]


def test_one_show_operator_is_one_item_however_wide_its_gap(tmp_path: Path) -> None:
    page = one_page(tmp_path, b"BT /F1 10 Tf 100 100 Td [(LEVEL) -3000 (+3.00)] TJ ET")

    assert items(page) == ["LEVEL +3.00"]


def test_word_spacing_after_a_drawn_space_is_not_a_second_space(tmp_path: Path) -> None:
    page = one_page(tmp_path, b"BT /F1 10 Tf 5 Tw 100 100 Td (GRID A) Tj ET")

    assert items(page) == ["GRID A"]


# Turned pages ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("rotate", "angle", "size"), [(90, 270.0, (400, 600)), (180, 180.0, (600, 400))]
)
def test_a_turned_page_reads_in_the_frame_it_is_seen_in(
    tmp_path: Path, rotate: int, angle: float, size: tuple[int, int]
) -> None:
    page = one_page(tmp_path, b"BT /F1 10 Tf 100 100 Td (S-101) Tj ET", size=(600, 400), rotate=rotate)

    assert (page["width"], page["height"]) == size
    [item] = page["items"]
    assert (item["text"], item["angle"]) == ("S-101", angle)


def test_the_crop_box_is_the_part_of_the_page_it_overlaps(tmp_path: Path) -> None:
    page = one_page(
        tmp_path,
        strokes(1),
        size=(600, 400),
        rotate=90,
        entries={"CropBox": nums((-50, -50, 700, 500))},
    )

    assert page["crop"] == [0.0, 0.0, 400.0, 600.0]


# Vertical text -----------------------------------------------------------------------------------

_TO_UNICODE = (
    b"/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Letters def "
    b"1 begincodespacerange <0000> <FFFF> endcodespacerange "
    b"1 beginbfrange <0041> <005A> <0041> endbfrange endcmap "
    b"CMapName currentdict /CMap defineresource pop end end"
)


def test_a_vertical_glyph_hangs_from_its_position_vector(tmp_path: Path) -> None:
    pdf = Pdf()
    descriptor = pdf.add(
        dictionary(
            {
                "Type": b"/FontDescriptor",
                "FontName": b"/Upright",
                "Flags": b"32",
                "FontBBox": b"[0 -200 1000 800]",
                "ItalicAngle": b"0",
                "Ascent": b"800",
                "Descent": b"-200",
                "CapHeight": b"700",
                "StemV": b"80",
            }
        )
    )
    descendant = pdf.add(
        dictionary(
            {
                "Type": b"/Font",
                "Subtype": b"/CIDFontType2",
                "BaseFont": b"/Upright",
                "CIDSystemInfo": b"<</Registry (Adobe) /Ordering (Identity) /Supplement 0>>",
                "FontDescriptor": ref(descriptor),
                "DW2": b"[880 -1000]",
            }
        )
    )
    font = pdf.add(
        dictionary(
            {
                "Type": b"/Font",
                "Subtype": b"/Type0",
                "BaseFont": b"/Upright",
                "Encoding": b"/Identity-V",
                "DescendantFonts": b"[" + ref(descendant) + b"]",
                "ToUnicode": ref(pdf.stream(_TO_UNICODE)),
            }
        )
    )
    content = b"BT /F2 10 Tf 1 0 0 1 100 300 Tm <004100420043> Tj ET"
    [page] = read(tmp_path, pdf, Page(content=content, fonts={"F2": font}))

    [item] = page["items"]
    assert (item["text"], item["angle"]) == ("ABC", 270.0)
    assert item["box"] == pytest.approx([95.0, 269.2, 105.0, 299.2])


# Pictures ------------------------------------------------------------------------------------------


def test_a_turned_picture_covers_its_own_area(tmp_path: Path) -> None:
    pdf = Pdf()
    side, c, s = 200.0, math.cos(math.radians(45)), math.sin(math.radians(45))
    turned = b"q %.4f %.4f %.4f %.4f 300 50 cm /Im1 Do Q" % (side * c, side * s, -side * s, side * c)
    [page] = read(tmp_path, pdf, Page(content=turned, size=(600, 400), xobjects={"Im1": image(pdf)}))

    assert page["picture_share"] == pytest.approx(side * side / (600 * 400), rel=0.01)


def test_pictures_drawn_over_each_other_are_counted_once_and_are_no_scan(tmp_path: Path) -> None:
    pdf = Pdf()
    stacked = b"q 100 0 0 100 50 50 cm /Im1 Do Q\n" * 300
    [page] = read(tmp_path, pdf, Page(content=stacked, size=(600, 400), xobjects={"Im1": image(pdf)}))

    assert page["images"] == 300
    assert page["picture_share"] == pytest.approx(10_000 / (600 * 400), abs=0.001)


# Comments --------------------------------------------------------------------------------------------


def test_a_comment_in_utf8_reads_as_its_letters(tmp_path: Path) -> None:
    pdf = Pdf()
    comment = shx_comment(pdf, "placeholder", (10, 10, 40, 16))
    written = pdf._bodies[comment - 1]
    assert written is not None
    pdf.put(comment, written.replace(b"(placeholder)", b"<EFBBBF414243>"))
    [page] = read(tmp_path, pdf, Page(content=strokes(1), annots=[comment]))

    assert items(page) == ["ABC"]
