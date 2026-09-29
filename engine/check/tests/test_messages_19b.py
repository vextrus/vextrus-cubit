"""19b's codes are collected with the engine's and each is worded in its catalogue, in a QS's words
(docs/design/m0-screens.md 1.1), and formats for every value the code can pass: each message is
rendered with params the real functions produce, every `select` value and every plural."""

import re
from dataclasses import replace
from pathlib import Path

import pytest

from engine.check import coverage, plot_pages, register, storey_titles
from engine.check.catalogue import entries
from engine.check.tests.icu import arguments, branches, render
from engine.messages import Message, codes
from engine.messages.storey_titles import DIFFER
from engine.recognise.conflicts import compare
from engine.recognise.tests.candidates import plan, sheet, view
from engine.recognise.tests.stand_ins import stand_ins
from engine.recognise.types import (
    Conflict,
    DisciplineConvention,
    Layer,
    PlotMatch,
    SetReading,
    SheetConventions,
    ViewKind,
)

WEB = Path(__file__).resolve().parents[3] / "web/src/messages/engine"
NAMES = ("catalogue", "conflicts", "coverage", "plot_pages", "register_check", "storey_titles")
READERS = stand_ins({"3RD, 5TH & 7TH FLOOR": ("floor_3", "floor_5", "floor_7")})
CONVENTIONS = SheetConventions(disciplines=(DisciplineConvention("structural", ("S",)),))

# m0-screens 1.1's "never shown to a QS or an MD", whole, and the words of 19b's own machinery;
# each matched as a word, in any case.
NEVER = (
    "handle", "entity", "entities", "SDF", "DXF", "LibreDWG", "ACadSharp", "ezdxf", "pdf.js",
    "WebGL", "buffer", "artefact", "artifact", "render", "parse", "JSON", "sandbox", "worker", "job",
    "queue", "hash", "sha256", "tenant", "RLS", "API", "null", "undefined", "NaN", "stack trace",
    "error code", "code", "message code", "catalogue key", "UUID", "locale", "cell", "home region",
    "Rod", "model space", "Error:", "Oops", "sorry", "register", "subject", "candidate", "group",
    "stage", "normal form", "symbolic", "sequence", "prefix", "suffix", "recogniser",
    "conventions",
)  # fmt: skip


def worded(name: str) -> dict[str, str]:
    text = (WEB / name / "en.po").read_text(encoding="utf-8")
    return dict(re.findall(r'^msgid "([^"]+)"\nmsgstr "(.+)"$', text, flags=re.MULTILINE))


ALL = {code: text for name in NAMES for code, text in worded(name).items()}


@pytest.mark.parametrize("name", NAMES)
def test_every_code_has_its_english_and_no_other(name: str) -> None:
    prefix = f"engine.{name}."
    declared = {held.code for held in codes() if held.code.startswith(prefix)}

    assert declared == set(worded(name))
    assert all(worded(name).values())


def test_each_message_uses_only_the_parameters_its_code_declares() -> None:
    for held in codes():
        if held.code in ALL:
            assert arguments(ALL[held.code]) <= set(held.params), held.code
    # Carried for 21c, 19a and the export, not said: keys (the Discipline's, subject's, storey's) and
    # 18's reason.
    assert arguments(ALL["engine.conflicts.same_storey"]) == {
        "views", "first", "first_named", "second", "second_named", "titled", "plan", "other", "layer"
    }  # fmt: skip
    assert arguments(ALL["engine.register_check.gap"]) == {"after", "before", "missing"}
    assert arguments(ALL["engine.plot_pages.no_sheet"]) == {"page"}
    assert arguments(ALL["engine.coverage.unaccounted_untitled"]) == {"kind", "named", "sheet"}
    assert arguments(ALL["engine.storey_titles.differ"]) == set(DIFFER.params)


@pytest.mark.parametrize("word", NEVER)
def test_no_message_names_a_word_a_qs_is_never_shown(word: str) -> None:
    for code, text in ALL.items():
        plain = re.sub(r"\{\w+(, \w+)?[,}]|\b(select|plural|other|one|number|title|none)\b", " ", text)
        assert not re.search(rf"(?<![\w-]){re.escape(word)}(?![\w-])", plain, re.IGNORECASE), (
            code,
            word,
        )


# Every message formats, with what the code passes ---------------------------------------------------


def said(message: Message | None) -> str:
    assert message is not None
    return render(ALL[message["code"]], message["params"])


def test_each_check_has_a_name_with_no_values() -> None:
    """The words gate's round 1: the Library row's words are shown with no values to fill."""
    for entry in entries():
        assert render(ALL[entry.message], {}), entry.code
    assert render(ALL["engine.catalogue.register"], {}) == "The drawing list against the sheets found"


TYPICAL = "3RD, 5TH & 7TH FLOOR SLAB"


def test_the_conflicts_format_as_m0_screens_words_them() -> None:
    top = plan(["floor_5"], layer=Layer.TOP, title="5TH FLOOR SLAB, TOP")
    bottom = plan(["floor_5"], layer=Layer.BOTTOM, title="5TH FLOOR SLAB, BOTTOM")
    beam = plan(["floor_5"], "beam", title="5TH FLOOR BEAM LAYOUT")
    numbered: list[tuple[str | None, str]] = [("S-07", "Slab"), ("S-07", "Slab"), ("S-07", "Slab")]
    numbered += [(n, "Column schedule") for n in ("S-20", "S-09", "S-10")]
    numbered += [(f"S-{n}", f"Plan {n}") for n in (14, 15, 24, 31, 50, 51, 52, 60, 61)]
    numbered += [(None, "SLAB LAYOUT"), ("S-70", "Stairs"), ("S-80", "Roof"), ("S-81", "Roof again")]
    sheets = [sheet(number, title) for number, title in numbered]
    views = [
        (), (), (), (), (), (),
        (top,), (replace(top),),
        (bottom,), (replace(bottom),),
        (beam,), (replace(beam),), (replace(beam),),
        (plan(["floor_3", "floor_5", "floor_7"], "mat", Layer.BOTTOM, title=TYPICAL),),
        (plan(["floor_5"], "mat", Layer.BOTTOM, title="5TH FLOOR SLAB"),),
        (plan(["floor_9"], "stair", title="STAIR"),), (plan(["floor_9"], "stair", title="STAIR"),),
        (plan(["roof", "floor_9"], "roof", Layer.BOTTOM, title=TYPICAL),),
        (plan(["roof"], "roof", Layer.BOTTOM),),  # untitled: nothing is said of it
    ]  # fmt: skip

    all_found = compare(sheets, views, conventions=CONVENTIONS, recognisers=READERS)
    found = [c for c in all_found if isinstance(c, Conflict)]
    words = [render(ALL[f"engine.conflicts.{c.kind}"], dict(c.evidence)) for c in found]

    assert words == [
        "3 sheets are numbered S-07",
        "3 sheets are titled \u201cColumn schedule\u201d but are not all numbered one after the other",
        "S-14 and S-15 both draw \u201c5TH FLOOR SLAB, TOP\u201d, top layer",
        "S-24 and S-31 both draw \u201c5TH FLOOR SLAB, BOTTOM\u201d, bottom layer",
        "S-50, S-51 and 1 more plan draw \u201c5TH FLOOR BEAM LAYOUT\u201d",
        (  # the words gate's round 2
            "S-60 and S-61 both draw one storey, as \u201c3RD, 5TH & 7TH FLOOR SLAB\u201d and "
            "\u201c5TH FLOOR SLAB\u201d, bottom layer"
        ),
        "\u201cSLAB LAYOUT\u201d and S-70 both draw \u201cSTAIR\u201d",
        "S-80 and S-81 both draw a plan of one storey, bottom layer",  # the gate's round 3
    ]
    assert render(ALL["engine.conflicts.same_number"], {"number": "S-07", "copies": 2}) == (
        "Two sheets are numbered S-07"  # m0-screens \u00a75, verbatim
    )
    untitled: dict[str, str | int] = {
        "first": "S-14", "first_named": "number", "second": "S-15", "second_named": "number",
        "plan": "", "other": "", "titled": "none", "layer": "bottom", "views": 4,
    }  # fmt: skip
    assert render(ALL["engine.conflicts.same_storey"], untitled) == (
        "S-14, S-15 and 2 more plans draw a plan of one storey, bottom layer"
    )
    two: dict[str, str | int] = {"title": "Notes", "sheets": 2}
    assert render(ALL["engine.conflicts.same_title"], two).startswith("Two sheets are titled")
    assert branches(ALL["engine.conflicts.same_storey"], "layer") >= {str(layer) for layer in Layer}
    assert branches(ALL["engine.conflicts.same_storey"], "titled") >= {"same", "differ"}
    assert branches(ALL["engine.conflicts.same_storey"], "first_named") >= {"title"}


def test_the_drawing_list_findings_and_refusals_format() -> None:
    cover, beams = sheet("01", "Notes"), sheet("04", "Beams")
    reading = SetReading(
        sheets=(cover, beams, sheet("S-10"), sheet("S-5000001")),
        views=((), (), (), ()),
        register=(),
        read=frozenset({"register"}),
        conventions=CONVENTIONS,
    )
    gaps = [said(r.finding) for r in register.check(reading, recognisers=READERS) if r.finding]

    skips = "No drawing list, and the numbering skips from"
    state = "so these sheets have one source and are confirmed one by one."
    ask = "Paste the drawing list, or ask the consultant whether those sheets exist."
    assert gaps == [
        f"{skips} 01 to 04: 2 numbers are missing, {state} {ask}",
        f"{skips} 04 to S-10: 5 numbers are missing, {state} {ask}",
        f"{skips} S-10 to S-5000001: 4,999,990 numbers are missing, {state} {ask}",
    ]
    one: dict[str, str | int] = {"after": "13", "before": "15", "missing": 1, "discipline": "x"}
    assert render(ALL["engine.register_check.gap"], one).endswith(
        "15: 1 number is missing, so these sheets have one source and are confirmed one by one. "
        "Paste the drawing list, or ask the consultant whether that sheet exists."
    )
    assert render(ALL["engine.register_check.not_found"], {"number": "S-13"}) == (
        "S-13 is on the drawing list but in no file"  # m0-screens \u00a75, verbatim
    )
    assert render(ALL["engine.register_check.not_listed"], {"number": "S-14"}) == (
        "S-14 is in a file but not on the drawing list, so it has one source and is confirmed on its "
        "own."
    )
    mixed = said(_refused("S-101A to S-101C"))
    assert mixed.startswith("Line 1, S-101A to S-101C, cannot be read as one range:")
    for text in ("57\u201301", "A-01\u2013B-09", "01\u20135000000", "01-57", "", "S-01" * 300_000):
        assert "{" not in said(_refused(text))
    many = "\n".join(f"S-{k}" for k in range(register.ENTRY_LIMIT + 1))
    assert said(_refused(many)).startswith("This names more than 10,000 sheets")


def _refused(text: str) -> Message:
    with pytest.raises(register.Refused) as refused:
        register.parse(text, CONVENTIONS, recognisers=READERS)
    return refused.value.finding


def test_the_plot_findings_format() -> None:
    s1, s2 = sheet("S-01"), sheet("S-02")
    page = type("Page", (), {"number": 12})()
    reading = SetReading(
        sheets=(s1, s2),
        views=((), ()),
        plot=(PlotMatch(page=page, reason="no_sheet_matched"), PlotMatch(page=object(), sheet=s1)),
        read=frozenset({"plot"}),
    )
    words = [said(r.finding) for r in plot_pages.check(reading, recognisers=READERS) if r.finding]

    assert words == [
        (
            "Page 12 of the PDF matches no sheet in the DWG files. Look at it: it may show a sheet "
            "they do not have."
        ),
        (
            "S-02 is in the DWG files but on no page of its Discipline's PDF, so the PDF cannot "
            "confirm it."
        ),
    ]


@pytest.mark.parametrize(
    ("storeys", "number", "expected"),
    [
        (
            [["floor_3", "floor_4", "floor_5"]],
            "S-06",
            "S-06 {}: 1 storey in the title has no plan, and 1 storey on a plan is not in the title.",
        ),
        (
            [["floor_3", "floor_5", "floor_7", "roof", "floor_8"]],
            None,
            "\u201cBeam layout\u201d {}: 2 storeys on the plans are not in the title.",
        ),
        ([["floor_3"]], "S-06", "S-06 {}: 2 storeys in the title have no plan."),
    ],
)
def test_the_storey_finding_formats_each_side(
    storeys: list[list[str]], number: str | None, expected: str
) -> None:
    one = sheet(number, "Beam layout", storeys="3RD, 5TH & 7TH FLOOR")
    reading = SetReading(
        sheets=(one,), views=(tuple(plan(s) for s in storeys),), read=frozenset({"views"})
    )

    [result] = storey_titles.check(reading, recognisers=READERS)

    assert result.finding is not None
    middle = "names \u201c3RD, 5TH & 7TH FLOOR\u201d, but its plans do not agree"
    end = " Vextrus takes the storeys from its plans; if the title is right, correct the plans' storeys."
    start = "The title of " if number else "The sheet titled "
    assert said(result.finding) == start + expected.format(middle) + end


def test_the_coverage_findings_format_for_every_kind_and_naming() -> None:
    named = [sheet("S-20", "Beams"), sheet(None, "Stair details"), sheet(None, None)]
    views = [(*(view(kind) for kind in ViewKind), view(title="8th floor beam layout")) for _ in named]
    reading = SetReading(sheets=tuple(named), views=tuple(views), read=frozenset({"views"}))

    words = [said(r.finding) for r in coverage.check(reading, recognisers=READERS) if r.finding]

    then = (
        "is unaccounted: no step will read it and it is not excluded, so Step 1 for its Discipline "
        "cannot be confirmed. Exclude it with a reason; if a step should read it, choose Other and "
        "say which: Vextrus assigns views to steps in a later release."
    )
    assert len(words) == 3 * (len(ViewKind) + 1)
    assert words[len(ViewKind)] == f"S-20 8th floor beam layout {then}"  # 6.11's form
    assert words[0].startswith("A plan with no title, on S-20, is unaccounted")
    assert words[2].startswith("An elevation with no title, on S-20, is unaccounted")  # the article
    assert words[len(ViewKind) + 1 + 7].startswith(
        "A title block with no title, on \u201cStair details\u201d,"
    )
    assert words[-1].startswith(
        "8th floor beam layout, on a sheet with no number or title, is unaccounted"
    )
    kinds = branches(ALL["engine.coverage.unaccounted_untitled"], "kind")
    assert kinds >= {str(kind) for kind in ViewKind}
