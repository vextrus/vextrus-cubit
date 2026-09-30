"""Ticket #168 (M0 fix F4): the Discipline is guessed from a file's name.

The issue's acceptance: "Architecture, electrical, plumbing, structural and general-notes name forms
(upper and lower case, DWG and PDF) are guessed" and "The name forms are Market data, no literals
(`market_literals` scan)."

Every Discipline is found by its English name (a Discipline "has one name everywhere, held ... as data",
`vextrus/drawings/library.py`); the General Discipline is ticket #159's row, "General". Every file name
here is invented.
"""

import io
import token
import tokenize
from pathlib import Path

import pytest

from tools.lint import market_literals
from vextrus.drawings import services
from vextrus.drawings.models import Discipline
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services.markets import MarketProfile
from vextrus.testing.drawings import QsProject, add, drawing

REPO = Path(__file__).resolve().parents[5]

ARCHITECTURAL = "Architectural"
ELECTRICAL = "Electrical"
PLUMBING = "Plumbing and sanitary"
STRUCTURAL = "Structural"
GENERAL = "General"

NAMED = [
    # Architecture, in the forms a Developer's files carry it.
    ("ARCHITECTURE.dwg", ARCHITECTURAL),
    ("architecture.pdf", ARCHITECTURAL),
    ("Zenith Heights ARCHITECTURE.dwg", ARCHITECTURAL),
    ("Zenith Heights ARCHITECTURE.pdf", ARCHITECTURAL),
    ("maple_court_architecture_rev2.dwg", ARCHITECTURAL),
    ("Maple-Court-Architecture.pdf", ARCHITECTURAL),
    ("Architectural Drawings_Maple Court.dwg", ARCHITECTURAL),
    ("ARCHITECTURAL-ZENITH-HEIGHTS.pdf", ARCHITECTURAL),
    # Electrical.
    ("ELECTRICAL.dwg", ELECTRICAL),
    ("Zenith Heights ELECTRICAL.pdf", ELECTRICAL),
    ("maple_court_electrical.dwg", ELECTRICAL),
    ("Electrical-Layout-Maple-Court.pdf", ELECTRICAL),
    # Plumbing.
    ("PLUMBING.dwg", PLUMBING),
    ("Zenith Heights PLUMBING.pdf", PLUMBING),
    ("maple_court_plumbing.dwg", PLUMBING),
    ("Plumbing-Design-Maple-Court.pdf", PLUMBING),
    # Structural.
    ("STRUCTURAL.dwg", STRUCTURAL),
    ("Zenith Heights STRUCTURAL.pdf", STRUCTURAL),
    ("maple_court_structural.dwg", STRUCTURAL),
    ("Structural-Drawings-Maple-Court.pdf", STRUCTURAL),
    # General notes.
    ("General Note_Zenith Heights.dwg", GENERAL),
    ("General Note_Zenith Heights.pdf", GENERAL),
    ("GENERAL NOTES.dwg", GENERAL),
    ("general notes.pdf", GENERAL),
    ("general_notes_maple_court.dwg", GENERAL),
    ("Maple-Court-General-Notes.pdf", GENERAL),
    ("ZENITH HEIGHTS GENERAL NOTE.dwg", GENERAL),
]

NAMING_NONE = [
    "Zenith Heights.dwg",
    "zenith heights rev 2.pdf",
    "maple_court_site_photos.pdf",
    "Maple-Court-Drawings.dwg",
]


def _key_named(english: str) -> str:
    """The key of the Market's Discipline whose English name is `english`."""
    found = [d.key for d in services.disciplines() if d.labels.get("en") == english]
    assert len(found) == 1, f"the Market holds {len(found)} Discipline(s) named {english!r}"
    return found[0]


def _kind(name: str) -> str:
    return "pdf" if name.endswith(".pdf") else "dwg"


@pytest.mark.parametrize(("name", "discipline"), NAMED)
def test_a_files_name_form_guesses_its_discipline(
    qs_project: QsProject, name: str, discipline: str
) -> None:
    added = add(qs_project.member, qs_project.project_id, name, drawing(_kind(name)))

    with qs_project.member.acting():
        wanted = _key_named(discipline)
    assert (added.file.discipline, added.file.discipline_source) == (wanted, "file_name")


@pytest.mark.parametrize("name", NAMING_NONE)
def test_a_name_naming_no_discipline_guesses_none(qs_project: QsProject, name: str) -> None:
    added = add(qs_project.member, qs_project.project_id, name, drawing(_kind(name)))

    assert (added.file.discipline, added.file.discipline_source) == (None, None)


# The name forms are Market data ---------------------------------------------------------------------


def _row_data_but_its_names(row: Discipline) -> str:
    """Everything a Discipline row holds but its identity (id, Library, key), its names and kind,
    as one lower-cased text: where its name forms must be, in whichever field the row keeps them."""
    held = {
        field.attname: getattr(row, field.attname)
        for field in Discipline._meta.concrete_fields
        if field.attname not in ("id", "tenant_id", "key", "labels", "kind")
    }
    return repr(held).casefold()


@pytest.mark.django_db(databases=["default", "owner"])
@pytest.mark.parametrize(("discipline", "form"), [(ARCHITECTURAL, "architect"), (GENERAL, "note")])
def test_the_name_forms_are_a_field_of_the_markets_library_row(
    market: MarketProfile, discipline: str, form: str
) -> None:
    rows = Discipline.objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    [row] = [r for r in rows if r.labels.get("en") == discipline]

    assert form in _row_data_but_its_names(row)


def _string_literals(path: Path) -> set[str]:
    found = set()
    source = path.read_text(encoding="utf-8")
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        if tok.type == token.STRING:
            text = tok.string.lstrip("rbuRBUfF")
            for quote in ('"""', "'''", '"', "'"):
                if text.startswith(quote) and text.endswith(quote) and len(text) >= 2 * len(quote):
                    found.add(text[len(quote) : -len(quote)].casefold())
                    break
    return found


NAME_FORM_LITERALS = {
    "architecture",
    "general",
    "general note",
    "general notes",
    "general_note",
    "general_notes",
    "general-note",
    "general-notes",
}
"""The name forms this ticket adds, which may be written only as the Library's data (`library.py`)."""


def test_no_drawings_code_writes_a_name_form_as_a_literal() -> None:
    files = [
        path
        for path in sorted((REPO / "vextrus" / "drawings").rglob("*.py"))
        if not {"tests", "migrations", "__pycache__"} & set(path.relative_to(REPO).parts)
        and path.name != "library.py"
    ]

    naming = {
        str(path.relative_to(REPO)): sorted(_string_literals(path) & NAME_FORM_LITERALS)
        for path in files
        if _string_literals(path) & NAME_FORM_LITERALS
    }

    assert naming == {}


def test_the_market_literals_scan_passes(capsys: pytest.CaptureFixture[str]) -> None:
    assert market_literals.main(["--root", str(REPO)]) == 0, capsys.readouterr().out
