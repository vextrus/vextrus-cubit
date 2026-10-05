"""Ticket W316 (#316, #335; G1's finish line item 7, "Coverage ... 0 unaccounted"): on a whole
invented set of the shapes the ticket names (site works, general notes, structure plans, presentation
plans and working sheets), the only View left with no Step, no Part and no exclusion is a section that
nothing names on a Sheet whose kind names no Step ("the ruling's else a Question": the Sheet's
`which_kind` Question asks). The rules add homes and proposed exclusions; they never move a View
already homed to another Step: read with the new words taken out of the conventions (the subjects
`site_works` and `presentation`, the ticket's build step 1), every View homed there keeps its Steps
or is proposed out (a duplicate, or for information).

The seam: `views.find(artefact, sheet, conventions)` on the sheets `sheets.find` reads, each View's
`steps`, `part` and `exclusion`. Every title is invented.
"""

from collections import Counter
from dataclasses import replace

from engine.recognise import views
from engine.recognise.types import ExclusionReason, ViewCandidate, ViewConventions

from .drawing import CONVENTIONS, Sheet, model_file, placed

NEW_SUBJECTS = frozenset({"site_works", "presentation"})
WITHOUT_NEW_WORDS: ViewConventions = replace(
    CONVENTIONS,
    subject_words={k: v for k, v in CONVENTIONS.subject_words.items() if k not in NEW_SUBJECTS},
)
NOTES = (
    ("NOTES:", (450.0, 270.0), 6.0),
    ("1. LEVELS ARE FINISHED LEVELS.", (450.0, 258.0), 4.0),
    ("2. BARS LAPPED AWAY FROM SUPPORTS.", (450.0, 250.0), 4.0),
    ("3. CONCRETE MIX AS SCHEDULED.", (450.0, 242.0), 4.0),
)

STRUCTURAL = [
    Sheet("S-21", "BOUNDARY WALL AND SITE DRAIN DETAILS",
          placed(["SECTION 3-3", "SECTION 7-7", None, "TYPICAL COPING DETAIL",
                  "COLUMN DETAIL AT GATE"])),
    Sheet("S-22", "TYPICAL DETAILS", placed(["SECTION 9-9", "ENTRY PAVING DETAIL", "STAIR SECTION"])),
    Sheet("S-23", "GENERAL NOTES AND SCHEDULE OF CONCRETE MIXES",
          placed(["SCHEDULE OF CLEAR COVER", None, "TYPICAL BAR SPLICE DETAIL", "LEGEND",
                  "COLUMN REINFORCEMENT SCHEDULE"]), NOTES),
    Sheet("S-24", "GRADE BEAM DETAILS", placed(["SECTION 5-5", "PILE CAP DETAIL"])),
    Sheet("S-25", "RETAINING WALL DETAILS", placed(["SECTION 2-2", None])),
    Sheet("S-26", "FIRST FLOOR SLAB LAYOUT PLAN", ((None, (30.0, 60.0, 630.0, 560.0)),)),
]  # fmt: skip
ARCHITECTURAL = [
    Sheet("A-21", "SLAB OUTLINE SHOWING BEAMS", placed([None])),
    Sheet("A-22", "DROPPED BEAM AND SLAB OUTLINE", placed(["SECOND FLOOR PLAN", None])),
    Sheet("A-23", "RENDERED FLOOR PLANS", placed([None, "FURNISHED THIRD FLOOR PLAN"])),
    Sheet("A-24", "TYPICAL FLOOR PLAN",
          placed([None, "BATHROOM LAYOUT PLAN", "COLOURED SOUTH ELEVATION"])),
    Sheet("A-25", "GENERAL NOTES AND SCHEDULE OF FINISHES", placed(["SCHEDULE OF FINISHES"])),
    Sheet("A-26", "THIRD FLOOR LINTEL LAYOUT PLAN", placed([None])),
]  # fmt: skip
SET = (("structural", STRUCTURAL), ("architectural", ARCHITECTURAL))
LEFT_OUT = frozenset({ExclusionReason.DUPLICATE, ExclusionReason.FOR_INFORMATION})

type Read = list[tuple[str, ViewCandidate]]


def read(conventions: ViewConventions) -> Read:
    """Every View of the set, with its Sheet's title, as `views.find` proposes it."""
    found: Read = []
    for discipline, drawn_sheets in SET:
        d, sheets = model_file(drawn_sheets, discipline=discipline)
        for sheet in sheets:
            assert sheet.title is not None
            found += [(sheet.title.value, v) for v in views.find(d.artefact(), sheet, conventions)]
    return found


def unaccounted(found: Read) -> list[tuple[str, str | None]]:
    return [
        (sheet, v.title) for sheet, v in found if not v.steps and v.part is None and v.exclusion is None
    ]


def test_the_only_view_left_over_is_a_section_nothing_names_on_a_sheet_of_no_step() -> None:
    found = read(CONVENTIONS)

    assert unaccounted(found) == [("TYPICAL DETAILS", "SECTION 9-9")]


def test_the_new_rules_never_move_a_view_already_homed_to_another_step() -> None:
    full = read(CONVENTIONS)
    without = read(WITHOUT_NEW_WORDS)
    assert [(s, v.kind, v.title) for s, v in full] == [(s, v.kind, v.title) for s, v in without]

    moved = [
        (sheet, f.title, b.steps, f.steps)
        for (sheet, f), (_, b) in zip(full, without, strict=True)
        if b.steps and f.steps != b.steps and not (f.exclusion and f.exclusion.reason in LEFT_OUT)
    ]
    kept = Counter(s for _, v in full for s in v.steps if s not in {"site_mep", "general_notes"})
    homed = Counter(
        s
        for (_, f), (_, b) in zip(full, without, strict=True)
        if not (f.exclusion and f.exclusion.reason in LEFT_OUT)
        for s in b.steps
        if s not in {"site_mep", "general_notes"}
    )

    assert moved == []
    assert kept == homed
    # The new words are data: without them the site-works Views have no home, and the rest stands.
    assert ("BOUNDARY WALL AND SITE DRAIN DETAILS", "SECTION 3-3") in unaccounted(without)
    assert unaccounted(full) == [("TYPICAL DETAILS", "SECTION 9-9")]
