"""The site-works words (S22-FL7) change a view's subject and Steps and nothing a sheet's kind
question is made of: the views found, their titles, kinds, boxes and storeys, and so the facts 13's
`judgement` gives Jev (title, Discipline, view titles). Synthetic sheet; every title invented. Pins the
shape a walk's `which_kind` Question moved on (Jev answers live, run to run; the facts did not
change)."""

from dataclasses import replace

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import SheetCandidate, ViewCandidate, ViewConventions

SCALE = 50.0
DRAWN = [
    ("BOUNDARY WALL TYPICAL SECTION ZQ", (40.0, 300.0, 200.0, 560.0)),
    ("SETBACK PLAN ZQ", (240.0, 300.0, 400.0, 560.0)),
    ("COLUMN LAYOUT AND SITE PLAN", (440.0, 300.0, 600.0, 560.0)),
    ("FOOTING DETAIL OF COMPOUND WALL ZQ", (40.0, 60.0, 340.0, 240.0)),
]


def _read(conventions: ViewConventions) -> tuple[SheetCandidate, list[ViewCandidate]]:
    d = Sheets()
    block = frame_block(d)
    insert = d.insert(block, (10_000.0, 0.0, 0.0), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in {0: "BOUNDARY WALL TYPICALS ZQ", 2: "S-41"}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * SCALE)
    for title, (x0, y0, x1, y1) in DRAWN:
        for i in range(5):
            x, y = x0 + (x1 - x0) * i / 4, y0 + (y1 - y0) * i / 4
            d.line((10_000.0 + x * SCALE, y0 * SCALE), (10_000.0 + x * SCALE, y1 * SCALE))
            d.line((10_000.0 + x0 * SCALE, y * SCALE), (10_000.0 + x1 * SCALE, y * SCALE))
        d.text(title, (10_000.0 + x0 * SCALE, (y0 - 12) * SCALE, 0.0), height=6.0 * SCALE)
    [sheet] = sheets.find(d.artefact(), "structural", DEFAULT)
    return sheet, views.find(d.artefact(), sheet, conventions)


def test_the_site_works_words_change_no_input_of_the_kind_question() -> None:
    default = views.default_conventions()
    without = replace(
        default,
        subject_words={k: v for k, v in default.subject_words.items() if k != "site_works"},
    )
    sheet, with_words = _read(default)
    _, bare = _read(without)

    def shape(found: list[ViewCandidate]) -> list[tuple[object, ...]]:
        return [(v.title, v.kind, v.box, v.storeys, v.layer, v.stated_scale) for v in found]

    assert shape(with_words) == shape(bare)
    titles = [v.title for v in with_words if v.title]
    asked = sheets.judgement(sheet, titles)
    again = sheets.judgement(sheet, [v.title for v in bare if v.title])
    assert asked is not None
    assert asked == again
    # ... while the Steps are what the words are for.
    assert [v.steps for v in with_words] != [v.steps for v in bare]
