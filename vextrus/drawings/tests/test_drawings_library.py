"""The Market's Disciplines as Library rows (ticket 14; the M0 plan's review Q8): `sync_library`
writes Bangladesh's nine (General, #159, the ninth), and run again changes nothing."""

import pytest
from django.core.management import call_command

from vextrus.drawings import library
from vextrus.drawings.models import Discipline
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

    assert first == {"drawings": 8, "takeoff": 0}
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
    rows = [*library.DISCIPLINES["BD"], library._row("solar", "Solar", library.MEP, "S")]
    with pytest.raises(ValueError, match="prefix names two Disciplines"):
        library.check(rows)


def test_a_markets_list_refuses_a_key_given_twice() -> None:
    rows = [*library.DISCIPLINES["BD"], library._row("gas", "Gas again", library.MEP, "GG")]
    with pytest.raises(ValueError, match="key is given twice"):
        library.check(rows)


def test_bangladeshs_list_is_whole() -> None:
    library.check(library.DISCIPLINES["BD"])
