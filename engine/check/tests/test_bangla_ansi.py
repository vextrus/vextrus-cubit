"""The Bangla-ANSI Check: by font name, by pattern, and never a Unicode Bangla font or plain English."""

import pytest

from engine.check import bangla_ansi
from engine.check.bangla_ansi import FoundBy
from engine.export import to_json
from engine.harness import _counts
from engine.render.fixtures.artefacts import Drawing

# "আমার সোনার বাংলা" as Bijoy stores it (bondhon's README gives `evsjv` for বাংলা); invented text.
BIJOY = "Avgvi †mvbvi evsjv"


def test_a_text_in_a_bijoy_font_is_flagged_by_its_name() -> None:
    drawing = Drawing()
    handle = drawing.text("Kÿ", font="SutonnyMJ.ttf")
    result = bangla_ansi.run(drawing.artefact())
    assert [(t.handle, t.by, t.font) for t in result.texts] == [(handle, FoundBy.FONT, "SutonnyMJ")]
    assert result.findings(lambda _: "A-02") == [
        {
            "code": "engine.bangla_ansi.found",
            "params": {"texts": 1, "sheets": 1, "font": "SutonnyMJ", "other_fonts": 0},
        }
    ]


def test_an_inline_bijoy_font_is_flagged() -> None:
    drawing = Drawing()
    drawing.text("ROOM {\\fSutonnyMJ|b0;KÿQ}", kind="MTEXT", font="arial.ttf")
    assert bangla_ansi.run(drawing.artefact()).counts["by_font"] == 1


def test_a_text_in_another_font_is_flagged_by_its_pattern() -> None:
    drawing = Drawing()
    drawing.text(BIJOY, font="arial.ttf")
    result = bangla_ansi.run(drawing.artefact())
    assert result.counts == {"texts": 1, "by_font": 0, "by_pattern": 1, "fonts": 0}
    assert result.findings(lambda _: None) == [
        {"code": "engine.bangla_ansi.found_by_pattern", "params": {"texts": 1, "sheets": 0}}
    ]


@pytest.mark.parametrize(
    ("text", "font"),
    [
        ("GROUND FLOOR PLAN", "arial.ttf"),
        ("আমার", "SutonnyOMJ.ttf"),  # Unicode Bangla in the Unicode OpenType font
        ("আমার", "Nikosh.ttf"),
        ("SEE NOTE †", "arial.ttf"),  # a footnote dagger with no letter after it
        ("ACCURACY 5‰ MAX", "arial.ttf"),
    ],
)
def test_english_and_unicode_bangla_are_not_flagged(text: str, font: str) -> None:
    drawing = Drawing()
    drawing.text(text, font=font)
    assert bangla_ansi.run(drawing.artefact()).texts == ()


def test_the_most_used_font_is_named_and_the_others_counted() -> None:
    drawing = Drawing()
    for _ in range(2):
        drawing.text("K", font="JamunaMJ.ttf")
    drawing.text("K", font="SutonnyMJ.ttf")
    result = bangla_ansi.run(drawing.artefact())
    [finding] = result.findings(lambda _: "A-01")
    assert finding["params"]["font"] == "JamunaMJ"
    assert finding["params"]["other_fonts"] == 1


def test_nothing_found_is_no_finding_and_the_harness_reads_the_counts() -> None:
    result = bangla_ansi.run(Drawing().artefact())
    assert result.findings(lambda _: "A-01") == []
    assert _counts(to_json(result)) == {"texts": 0, "by_font": 0, "by_pattern": 0, "fonts": 0}


def test_the_check_declares_its_code_version_and_milestone() -> None:
    assert (bangla_ansi.CODE, bangla_ansi.VERSION, bangla_ansi.MILESTONE) == ("bangla_ansi", 1, "M0")


def test_a_sheet_line() -> None:
    assert bangla_ansi.sheet_line("A-02", 5) == {
        "code": "engine.bangla_ansi.sheet",
        "params": {"sheet": "A-02", "texts": 5},
    }


def test_texts_found_by_their_font_and_by_their_characters_are_two_lines() -> None:
    """The design gate: `found` said "3 texts … in SutonnyMJ" when only one was in SutonnyMJ; the
    texts found only by their characters now have their own line, each with its own sheets."""
    drawing = Drawing()
    in_font = drawing.text("Kÿ", font="sutonnymj.ttf")
    on_a01 = drawing.text(BIJOY, font="arial.ttf")
    on_a02 = drawing.text(BIJOY, font="arial.ttf")
    sheets = {in_font: "A-01", on_a01: "A-01", on_a02: "A-02"}
    result = bangla_ansi.run(drawing.artefact())
    assert result.findings(sheets.get) == [
        {
            "code": "engine.bangla_ansi.found",
            "params": {"texts": 1, "sheets": 1, "font": "SutonnyMJ", "other_fonts": 0},
        },
        {"code": "engine.bangla_ansi.found_by_pattern", "params": {"texts": 2, "sheets": 2}},
    ]
