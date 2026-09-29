"""`sync_library`: each module's `library.py` writes its Library rows into each Market's Library, as
the owner (docs/data-model.md §2, the Library rule)."""

from collections.abc import Sequence

import pytest
from django.core.management import call_command

from vextrus.platform.services import library
from vextrus.platform.services.markets import MarketProfile


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_libraries_are_the_markets_library_tenants(market: MarketProfile) -> None:
    assert library.libraries() == [library.Library(market.id, market.code, market.library_id)]


@pytest.mark.django_db(databases=["default", "owner"])
def test_sync_runs_each_module_s_sync_in_layer_order_as_the_owner(
    monkeypatch: pytest.MonkeyPatch, market: MarketProfile
) -> None:
    calls: list[tuple[str, list[str], str]] = []

    def fake(module: str, written: int) -> object:
        def sync(libraries: Sequence[library.Library], using: str) -> int:
            calls.append((module, [found.market_code for found in libraries], using))
            return written

        return sync

    # Named by string: platform's tests import no higher module.
    monkeypatch.setattr("vextrus.takeoff.library.sync", fake("takeoff", 14), raising=False)
    monkeypatch.setattr("vextrus.drawings.library.sync", fake("drawings", 8), raising=False)

    written = library.sync()

    assert calls == [("drawings", ["BD"], "owner"), ("takeoff", ["BD"], "owner")]
    assert written == {"drawings": 8, "takeoff": 14}


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_command_reports_what_it_wrote(capsys: pytest.CaptureFixture[str]) -> None:
    call_command("sync_library")

    # The tests' setup has synced already (vextrus/testing/tenancy.py); drawings writes the
    # Markets' Disciplines (14) and takeoff its Takeoff Steps and Checks (19a), so two modules have
    # rows, and none is left to write.
    assert "sync_library: 0 rows from 2 module(s)" in capsys.readouterr().out


@pytest.mark.django_db(databases=["default", "owner"])
def test_sync_puts_back_a_markets_later_fields(market: MarketProfile) -> None:
    """After a flush the Market is written afresh from its first data migration; its date order
    (0009, ticket 22) must come back with it, or every drawn date reads as none."""
    from vextrus.platform.models import Market

    Market.objects.using("owner").filter(id=market.id).update(date_order="")

    library.sync()

    assert Market.objects.using("owner").get(id=market.id).date_order == "DMY"
