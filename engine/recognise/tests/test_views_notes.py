"""17's notes headings (session 10's scored loop 2): a text a notes heading word leads heads the lines
stacked under it, on invented A1 sheets at 1:1, proving mechanics only, never a reading
(docs/sdlc.md)."""

from engine.recognise import views
from engine.recognise.tests.drawing import Sheets
from engine.recognise.tests.test_views import CONVENTIONS, drawn, grid, near, one_sheet
from engine.recognise.types import ViewCandidate, ViewConventions, ViewKind

LINES = (
    "1. KEEP ALL SLEEVES CLEAR",
    "2. PAINT EVERY RAIL TWICE",
    "3. SEAL THE JOINTS AFTER CURING",
    "4. CHECK THE LEVELS BEFORE FIXING THE RAILS",
)


def plan_with_labels(d: Sheets) -> None:
    """A titled plan whose grid marks (4 mm) make the sheet's lettering taller than a small heading."""
    grid(d, (40, 300, 340, 560))
    d.text("FOOTING LAYOUT PLAN", (40, 288, 0.0), height=6.0)
    for i in range(10):
        d.text(chr(ord("A") + i), (40 + 30 * i, 566, 0.0), height=4.0)


def column(d: Sheets, heading: str, at: tuple[float, float], lines: tuple[str, ...], h: float) -> None:
    """A heading of height `h` and its lines (0.7 of it) stacked under it, one line apart."""
    x, y = at
    d.text(heading, (x, y, 0.0), height=h)
    for i, line in enumerate(lines):
        d.text(line, (x, y - 1.6 * h - 1.2 * h * i, 0.0), height=0.7 * h)


def notes_of(d: Sheets) -> list[ViewCandidate]:
    return [v for v in drawn(d, one_sheet(d)) if v.kind is ViewKind.NOTES]


def test_a_small_note_heading_and_its_lines_are_a_notes_view() -> None:
    """A singular "NOTE :", lettered smaller than the sheet's grid marks, over four numbered lines."""
    d = Sheets()
    plan_with_labels(d)
    column(d, "NOTE :", (400, 500), LINES, 3.0)
    (notes,) = notes_of(d)
    assert notes.title == "NOTE :"
    assert near(notes.box, (400, 500 - 1.6 * 3 - 1.2 * 3 * 3, 400 + 0.7 * 3 * 30, 503), by=8.0)
    assert notes.box.y0 <= 500 - 1.6 * 3 - 1.2 * 3 * 3 + 0.5  # down to its last line
    assert notes.box.y1 >= 502.5  # up to its heading


def test_a_heading_its_words_after_note_is_a_notes_heading() -> None:
    """ "NOTE ON LAPS :" names no other kind's words but leads with the notes heading word."""
    assert views.describe("NOTE ON LAPS :").kind is ViewKind.NOTES
    assert views.describe("NOTES ON SECTION Q-Q").kind is ViewKind.NOTES
    assert views.describe("NOTE 2").kind is None  # a callout naming a note (review 1, loop 2)
    assert views.describe("NOTE THE SECTION BELOW").kind is ViewKind.SECTION  # a sentence
    assert views.describe("SECTION A-A (SEE NOTE 3)").kind is ViewKind.SECTION  # led by another kind


def test_a_notes_heading_under_a_table_takes_its_lines_not_the_table() -> None:
    """A table drawn just over the heading (the convention is a title under its drawing): the
    heading's view is its lines, under it; the table is a view of its own."""
    d = Sheets()
    plan_with_labels(d)
    grid(d, (400, 506, 600, 560))  # the table, 4 mm over the heading's top
    column(d, "NOTES :", (400, 499), LINES, 3.0)
    (notes,) = notes_of(d)
    assert notes.box.y1 <= 503  # none of the table
    assert notes.box.y0 <= 499 - 1.6 * 3 - 1.2 * 3 * 3 + 0.5
    others = [v for v in drawn(d, one_sheet(d)) if v.kind is not ViewKind.NOTES]
    assert any(near(v.box, (400, 506, 600, 560)) for v in others)


def test_a_one_line_note_is_a_view_of_its_own() -> None:
    """A long sentence led by "NOTE :" under a section's title: a notes view, its box the line; the
    section's box stops at its title."""
    d = Sheets()
    grid(d, (40, 330, 500, 400))
    d.text("SECTION 1-1", (40, 318, 0.0), height=6.0)
    sentence = (
        "NOTE : KEEP EVERY SLEEVE CLEAR OF THE FRAME AND SEAL EACH JOINT WITH THE CHOSEN SEALANT ONLY"
    )
    d.text(sentence, (40, 300, 0.0), height=4.0)
    found = drawn(d, one_sheet(d))
    (notes,) = [v for v in found if v.kind is ViewKind.NOTES]
    (section,) = [v for v in found if v.kind is ViewKind.SECTION]
    assert notes.title == sentence
    assert notes.box.y0 >= 299
    assert notes.box.y1 <= 305
    assert section.box.y0 >= 310


def test_a_scale_like_line_among_the_notes_is_a_notes_line() -> None:
    """A ratio ("1:12") reads as a scale; standing in the column, it is the notes' last line."""
    d = Sheets()
    plan_with_labels(d)
    lines = (*LINES[:3], "4. KEEP THE RAMP AT 1:12")
    column(d, "NOTES :", (400, 500), lines, 3.0)
    (notes,) = notes_of(d)
    assert notes.box.y0 <= 500 - 1.6 * 3 - 1.2 * 3 * 3 + 0.5


def test_a_taller_line_under_the_notes_heads_the_next_block() -> None:
    """Two blocks in one column, each led by a heading taller than its lines: two notes views."""
    d = Sheets()
    plan_with_labels(d)
    column(d, "NOTES :", (400, 520), LINES[:2], 3.0)
    column(d, "FINISHES", (400, 520 - 1.6 * 3 - 1.2 * 3 * 2), LINES[2:], 3.0)
    (notes,) = notes_of(d)
    assert notes.box.y0 >= 520 - 1.6 * 3 - 1.2 * 3 - 0.5  # its own two lines, not the next block's


def test_a_line_led_by_note_inside_a_column_of_notes_heads_nothing() -> None:
    """The third of four lines alike starts "NOTE": a line of the notes, not a heading of its own."""
    d = Sheets()
    plan_with_labels(d)
    lines = ("PAINT EVERY RAIL TWICE", "NOTE THE SLEEVES ARE GREY", "SEAL THE JOINTS AFTER CURING")
    column(d, "WORK NOTES", (400, 520), ("KEEP ALL SLEEVES CLEAR", *lines), 5.0)
    titles = [v.title for v in notes_of(d)]
    assert "NOTE THE SLEEVES ARE GREY" not in titles


def test_a_notes_heading_takes_at_most_max_note_lines() -> None:
    """A column of more lines than `MAX_NOTE_LINES`: the heading takes that many, and stops."""
    d = Sheets()
    n = views.MAX_NOTE_LINES + 50
    lines = tuple(f"{i + 1}. LINE" for i in range(n))
    column(d, "NOTES :", (400, 560), lines, 1.0)
    (notes,) = notes_of(d)
    assert notes.box.y0 >= 560 - 1.6 - 1.2 * (views.MAX_NOTE_LINES - 1) - 0.5


def test_heading_words_are_data_and_absent_from_the_json_when_none() -> None:
    """The default's heading words round-trip; conventions with none write no key (a held digest
    stays as it was)."""
    assert CONVENTIONS.heading_words[ViewKind.NOTES] == ("note", "notes")
    assert ViewConventions.from_json(CONVENTIONS.to_json()) == CONVENTIONS
    assert "heading_words" not in ViewConventions().to_json()
    without = ViewConventions.from_json(
        {k: v for k, v in CONVENTIONS.to_json().items() if k != "heading_words"}
    )
    assert views.describe("NOTE ON LAPS :", without).kind is None


def test_a_notes_heading_with_no_lines_aligned_takes_the_piece_under_it() -> None:
    """A heading set in from its notes (no line starts under its left edge), a drawing just over it
    and a ruled box of notes just under it: the heading's view is the box under it."""
    d = Sheets()
    plan_with_labels(d)
    grid(d, (400, 508, 600, 560))  # a drawing 4 mm over the heading's top
    d.text("NOTES", (470, 498, 0.0), height=6.0)
    grid(d, (400, 420, 600, 492))  # the notes' box, 6 mm under its baseline
    (notes,) = notes_of(d)
    assert notes.box.y1 <= 506
    assert notes.box.y0 <= 421


def test_a_blank_line_between_two_notes_keeps_them_one_column() -> None:
    """A blank line's gap (three line heights) between the first note and the rest: one column."""
    d = Sheets()
    plan_with_labels(d)
    d.text("NOTES :", (400, 500, 0.0), height=3.0)
    d.text(LINES[0], (400, 495.2, 0.0), height=2.1)
    for i, line in enumerate(LINES[1:]):
        d.text(line, (400, 495.2 - 2.1 - 3.0 * 2.1 - 3.6 * i, 0.0), height=2.1)
    (notes,) = notes_of(d)
    assert notes.box.y0 <= 495.2 - 2.1 - 3.0 * 2.1 - 3.6 * 2 + 0.5


def detail_titled_under(d: Sheets, with_notes: bool) -> None:
    """Refuter, loop 2: a notes column, right under it a detail's title over its drawing, and the
    title's scale line under the title, in the heading's reach."""
    plan_with_labels(d)
    if with_notes:
        d.text("NOTES :", (400, 500, 0.0), height=3.0)
        for i, line in enumerate(LINES):
            d.text(line, (400, 495.0 - 4.5 * i, 0.0), height=2.8)
    d.text("DETAIL A", (400, 475.3, 0.0), height=5.0)
    d.text("SCALE 1:20", (400, 472.0, 0.0), height=3.0)
    grid(d, (400, 380, 600, 465))


def test_a_notes_column_ends_at_another_views_title() -> None:
    """Refuter, loop 2 (55): the column ran past the detail's taller title and took its scale line."""
    d = Sheets()
    detail_titled_under(d, with_notes=False)
    (alone,) = [v for v in drawn(d, one_sheet(d)) if v.kind is ViewKind.DETAIL]
    d = Sheets()
    detail_titled_under(d, with_notes=True)
    found = drawn(d, one_sheet(d))
    (notes,) = [v for v in found if v.kind is ViewKind.NOTES]
    (detail,) = [v for v in found if v.kind is ViewKind.DETAIL]
    assert notes.box.y0 >= 480
    assert detail.stated_scale == alone.stated_scale == "1:20"


def test_a_note_line_under_a_scale_like_line_heads_nothing() -> None:
    """Refuter, loop 2 (35): a ratio over a line led by NOTE hid the column from the heading test."""
    d = Sheets()
    plan_with_labels(d)
    d.text("WORK NOTES", (400, 520, 0.0), height=5.0)
    lines = (
        "KEEP ALL SLEEVES CLEAR",
        "PAINT EVERY RAIL TWICE",
        "KEEP THE RAMP AT 1:12",
        "NOTE THE SLEEVES ARE GREY",
        "SEAL THE JOINTS AFTER CURING",
        "CHECK THE LEVELS",
    )
    for i, line in enumerate(lines):
        d.text(line, (400, 520 - 1.6 * 5 - 1.2 * 5 * i, 0.0), height=3.5)
    assert "NOTE THE SLEEVES ARE GREY" not in [v.title for v in notes_of(d)]


def test_a_block_of_notes_in_one_text_led_by_note_is_a_notes_view() -> None:
    """An MTEXT of three lines, "NOTE ON LAPS:" first: its own notes view (a title is two
    lines at most, so it was none)."""
    d = Sheets()
    plan_with_labels(d)
    block = "NOTE ON LAPS:\\P(A) PAINT EVERY RAIL\\P(B) SEAL EVERY JOINT\\P(C) CHECK EVERY LEVEL"
    d.text(block, (400, 500, 0.0), kind="MTEXT", height=3.0)
    (notes,) = notes_of(d)
    assert notes.title is not None
    assert notes.title.startswith("NOTE ON LAPS")
    assert notes.box.y1 >= 499.0
    assert notes.box.y0 <= 492.0  # its lines under its first


def test_a_notes_block_continued_in_a_column_beside_it_is_one_view() -> None:
    """The block runs on in a second text set just right of the first, its top level with it."""
    d = Sheets()
    plan_with_labels(d)
    first = "NOTE ON LAPS:\\P(A) PAINT EVERY RAIL\\P(B) SEAL EVERY JOINT"
    d.text(first, (400, 500, 0.0), kind="MTEXT", height=3.0)
    (alone,) = notes_of(d)
    d.text(
        "(C) CHECK EVERY LEVEL\\P(D) CLEAN EVERY SLEEVE",
        (alone.box.x1 + 4.0, 500, 0.0),
        kind="MTEXT",
        height=3.0,
    )
    (notes,) = notes_of(d)
    assert notes.box.x1 >= alone.box.x1 + 20.0


BLOCK = "NOTE ON LAPS:\\P(A) PAINT EVERY RAIL\\P(B) SEAL EVERY JOINT"


def test_a_notes_block_takes_no_dimension_of_a_plan_beside_it() -> None:
    """Refuter 2, loop 2 (60): a plan just right of the block, its dimension text near the block's
    top but lower than it."""
    d = Sheets()
    plan_with_labels(d)
    d.text(BLOCK, (400, 500, 0.0), kind="MTEXT", height=3.0)
    (alone,) = notes_of(d)
    x = alone.box.x1 + 6.0
    grid(d, (x + 8, 420, x + 150, 520))
    d.text("FIRST FLOOR PLAN", (x + 8, 408, 0.0), height=6.0)
    d.text("3000", (x + 2, 495, 0.0), height=2.5)
    (notes,) = notes_of(d)
    assert notes.box.x1 <= alone.box.x1 + 1.0


def test_a_notes_block_takes_no_scale_line_of_a_detail_beside_it() -> None:
    """Refuter 2, loop 2 (75): a detail just right of the block, its title and scale line level
    with the block: the scale line stays the detail's."""
    d = Sheets()
    plan_with_labels(d)
    d.text(BLOCK, (400, 500, 0.0), kind="MTEXT", height=3.0)
    (alone,) = notes_of(d)
    x = alone.box.x1 + 4.0
    grid(d, (x, 505, x + 120, 560))
    d.text("DETAIL B", (x, 497, 0.0), height=5.0)
    d.text("SCALE 1:20", (x, 493.5, 0.0), height=3.0)
    found = drawn(d, one_sheet(d))
    (notes,) = [v for v in found if v.kind is ViewKind.NOTES]
    (detail,) = [v for v in found if v.kind is ViewKind.DETAIL]
    assert detail.stated_scale == "1:20"
    assert notes.box.x1 <= alone.box.x1 + 1.0


def test_a_short_note_within_a_drawing_is_the_drawings_annotation() -> None:
    """Refuter 2 and review 1, loop 2: a two-line note standing within a titled plan heads no block:
    no notes view, the plan as it was without it."""
    d = Sheets()
    plan_with_labels(d)
    (alone,) = drawn(d, one_sheet(d))
    d = Sheets()
    plan_with_labels(d)
    d.text("NOTE: SEE DETAIL Q\\PFOR SLEEVES", (100, 450, 0.0), kind="MTEXT", height=3.0)
    found = drawn(d, one_sheet(d))
    (plan,) = [v for v in found if v.kind is ViewKind.PLAN]
    assert plan.box.to_json() == alone.box.to_json()
    assert not [v for v in found if v.kind is ViewKind.NOTES]


def test_a_block_of_notes_within_a_drawing_is_a_view_and_leaves_the_drawing_whole() -> None:
    """A block of four lines in one text standing within a titled plan (a slab's notes in its plan):
    a notes view of its own, the plan's box as it was."""
    d = Sheets()
    plan_with_labels(d)
    (alone,) = drawn(d, one_sheet(d))
    d = Sheets()
    plan_with_labels(d)
    block = "NOTE ON LAPS:\\P(A) PAINT EVERY RAIL\\P(B) SEAL EVERY JOINT\\P(C) CHECK EVERY LEVEL"
    d.text(block, (100, 450, 0.0), kind="MTEXT", height=3.0)
    found = drawn(d, one_sheet(d))
    (plan,) = [v for v in found if v.kind is ViewKind.PLAN]
    assert plan.box.to_json() == alone.box.to_json()
    assert len([v for v in found if v.kind is ViewKind.NOTES]) == 1


def test_a_callout_naming_a_note_inside_a_plan_heads_nothing() -> None:
    """Review 1, loop 2 (50): "NOTE 2" in a plan over three room labels: a callout, no heading; the
    labels stay the plan's and the plan is as it was without them heading anything."""
    d = Sheets()
    plan_with_labels(d)
    for i, word in enumerate(("STORE", "HALL", "PANTRY")):
        d.text(word, (150, 392 - 8 * i, 0.0), height=3.0)
    (alone,) = drawn(d, one_sheet(d))
    d = Sheets()
    plan_with_labels(d)
    d.text("NOTE 2", (150, 400, 0.0), height=3.0)
    for i, word in enumerate(("STORE", "HALL", "PANTRY")):
        d.text(word, (150, 392 - 8 * i, 0.0), height=3.0)
    found = drawn(d, one_sheet(d))
    assert not [v for v in found if v.kind is ViewKind.NOTES]
    (plan,) = [v for v in found if v.kind is ViewKind.PLAN]
    assert plan.box.to_json() == alone.box.to_json()


def test_many_small_note_texts_leave_the_drawings_titles() -> None:
    """Review 1, loop 2 (50): 200 tiny "NOTE n" texts written before two titled drawings took every
    title slot; headings have their own."""
    d = Sheets()
    for i in range(views.MAX_TITLES):
        d.text(f"NOTE {i}:", (560 + (i % 4) * 15, 560 - (i // 4) * 4, 0.0), height=0.5)
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    grid(d, (40, 40, 340, 250))
    d.text("SECTION 1-1", (40, 28, 0.0), height=6.0)
    titles = {v.title for v in drawn(d, one_sheet(d))}
    assert {"GROUND FLOOR PLAN", "SECTION 1-1"} <= titles


def test_a_notes_heading_takes_no_scale_text_beside_it() -> None:
    """A scale text level with a notes heading is no scale of the notes (a notes view has no scale
    line); the notes keep their own box."""
    d = Sheets()
    plan_with_labels(d)
    column(d, "NOTES :", (400, 500), LINES, 3.0)
    (alone,) = notes_of(d)
    d.text("SCALE 1:50", (430, 500, 0.0), height=3.0)
    (notes,) = notes_of(d)
    assert notes.stated_scale is None
    assert notes.box.to_json() == alone.box.to_json()


def test_a_heading_too_small_to_letter_heads_nothing() -> None:
    """Review 1, loop 2: a one-text note 1e-300 mm high made a notes view of no height."""
    d = Sheets()
    plan_with_labels(d)
    sentence = (
        "NOTE : KEEP EVERY SLEEVE CLEAR OF THE FRAME AND SEAL EACH JOINT WITH THE CHOSEN SEALANT ONLY"
    )
    d.text(sentence, (400, 500, 0.0), height=1e-300)
    assert not notes_of(d)
