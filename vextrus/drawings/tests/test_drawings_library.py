"""The Market's Disciplines as Library rows (ticket 14; the M0 plan's review Q8): `sync_library`
writes Bangladesh's nine (General, #159, the ninth), and run again changes nothing."""

import pytest
from django.core.management import call_command

from vextrus.drawings import library
from vextrus.drawings.models import Discipline
from vextrus.drawings.services import library_disciplines
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import library as platform_library
from vextrus.platform.services.markets import MarketProfile

NINE = {
    "structural": ("Structural", "structural", ["S", "ST", "STR"]),
    "architectural": ("Architectural", "architectural", ["A", "AR", "ARC", "ARCH"]),
    "electrical": ("Electrical", "mep", ["E", "EL", "ELE", "ELEC"]),
    "plumbing": ("Plumbing and sanitary", "mep", ["P", "PL", "PLB", "SAN"]),
    "fire": ("Fire", "mep", ["F", "FF", "FP", "FS"]),
    "mechanical": ("Mechanical (HVAC)", "mep", ["M", "MEC", "MECH", "HVAC"]),
    "lift": ("Lift", "mep", ["L", "LF", "LIFT"]),
    "gas": ("Gas", "mep", ["G", "GS", "GAS"]),
    "general": ("General", "notes", []),
}


@pytest.mark.django_db(databases=["default", "owner"])
def test_sync_library_writes_the_markets_nine_and_again_changes_nothing(
    market: MarketProfile, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = Discipline.objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    rows.delete()

    first = platform_library.sync()
    found = {row.key: (row.labels["en"], row.kind, row.prefixes, row.sort_order) for row in rows.all()}
    before = list(rows.order_by("key").values_list("id", "labels", "kind", "prefixes", "sort_order"))
    again = platform_library.sync()
    call_command("sync_library")

    assert first == {"drawings": 9, "takeoff": 0}
    assert {key: value[:3] for key, value in found.items()} == {
        key: (name, kind, prefixes) for key, (name, kind, prefixes) in NINE.items()
    }
    assert sorted(found, key=lambda key: found[key][3]) == list(NINE)
    assert again == {"drawings": 0, "takeoff": 0}
    assert "sync_library: 0 rows from 2 module(s)" in capsys.readouterr().out
    assert (
        list(rows.order_by("key").values_list("id", "labels", "kind", "prefixes", "sort_order"))
        == before
    )


@pytest.mark.django_db(databases=["default", "owner"])
def test_sync_puts_back_a_row_changed_by_hand(market: MarketProfile) -> None:
    rows = Discipline.objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    rows.filter(key="plumbing").update(labels={"en": "Plumbing"}, prefixes=["P"])

    assert platform_library.sync() == {"drawings": 1, "takeoff": 0}
    plumbing = rows.get(key="plumbing")
    assert (plumbing.labels, plumbing.prefixes) == (
        {"en": "Plumbing and sanitary"},
        ["P", "PL", "PLB", "SAN"],
    )


def test_a_markets_list_refuses_a_prefix_naming_two_disciplines() -> None:
    rows = [*library.DISCIPLINES["BD"], library._row("solar", "Solar", library.MEP, ("S",))]
    with pytest.raises(ValueError, match="prefix names two Disciplines"):
        library.check(rows)


def test_a_markets_list_refuses_a_key_given_twice() -> None:
    rows = [*library.DISCIPLINES["BD"], library._row("gas", "Gas again", library.MEP, ("GG",))]
    with pytest.raises(ValueError, match="key is given twice"):
        library.check(rows)


def test_a_markets_list_refuses_a_file_name_form_naming_two_disciplines() -> None:
    """#168: a form two Disciplines share (case and separators aside) could default a file to either."""
    rows = [*library.DISCIPLINES["BD"], library._row("site", "Site", library.MEP, (), ("General-Note",))]
    with pytest.raises(ValueError, match="form names two Disciplines"):
        library.check(rows)


def test_a_markets_list_refuses_a_file_name_form_of_no_word() -> None:
    rows = [*library.DISCIPLINES["BD"], library._row("site", "Site", library.MEP, (), ("--",))]
    with pytest.raises(ValueError, match="form has no word"):
        library.check(rows)


@pytest.mark.django_db(databases=["default", "owner"])
def test_sync_writes_each_rows_file_name_forms_and_puts_back_a_changed_one(
    market: MarketProfile,
) -> None:
    """#168: the forms are the row's own field, apart from its sheet-number prefixes."""
    rows = Discipline.objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    rows.filter(key="general").update(name_forms=["notes"])

    assert platform_library.sync() == {"drawings": 1, "takeoff": 0}
    assert {row.key: row.name_forms for row in rows} == {
        row.key: list(row.name_forms) for row in library.DISCIPLINES["BD"]
    }
    assert rows.get(key="general").prefixes == []


def test_a_form_of_several_words_matches_them_in_a_row_only() -> None:
    general = Discipline(key="general", kind="notes", name_forms=["general note"])
    named = library_disciplines.from_name

    assert named("Zenith-General_Note.pdf", [general]) == general
    assert named("General Zenith Note.pdf", [general]) is None
    assert named("Note General.pdf", [general]) is None


@pytest.mark.parametrize("held", [None, 5, 3.5, "gas", {"gas": 1}, [None, 7, "", "  "]])
def test_a_row_holding_no_list_of_forms_names_no_file(held: object) -> None:
    """The refuter's finding: `null` or a number crashed the default; a bare string read as
    one-letter forms ("gas" named "A Block.dwg")."""
    gas = Discipline(key="gas", kind="mep", name_forms=held)

    assert library_disciplines.from_name("A S G Block gas.dwg", [gas]) is None


def test_bangladeshs_list_is_whole() -> None:
    library.check(library.DISCIPLINES["BD"])
