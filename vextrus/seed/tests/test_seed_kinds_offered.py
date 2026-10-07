"""Sheet kinds carry words and code narrows them (S15-Q1): each demo seed sheet's drawn kind stays among
the kinds its title is offered, so the demo's stand-in Jev still finds it (t19a's and t182's Questions
broke on a crude narrowing)."""

from engine.recognise import sheets as sheet_finder
from vextrus.seed import kr01

DISCIPLINE_OF = {"S": "structural", "A": "architectural", "E": "electrical"}


def test_each_demo_seed_sheets_drawn_kind_stays_among_the_kinds_offered() -> None:
    conventions = sheet_finder.default_conventions()
    for name, (drawn, _fonts) in kr01.FILES.items():
        discipline = DISCIPLINE_OF[name.split("-")[1][0]]
        for sheet in drawn:
            offered = sheet_finder.narrowed(sheet.title, conventions.kinds(discipline), conventions)
            assert sheet.kind is None or sheet.kind in offered, (name, sheet.number, offered)
