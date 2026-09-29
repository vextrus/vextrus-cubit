"""A title block's issue date made ISO in the Market's order (the design gate's M1)."""

import pytest

from vextrus.takeoff.services.issue_dates import iso_date


@pytest.mark.parametrize(
    ("written", "order", "iso"),
    [
        ("12.09.2026", "dmy", "2026-09-12"),  # the gate's case: never 9 Dec
        ("12.09.2026", "mdy", "2026-12-09"),
        ("12/09/26", "dmy", "2026-09-12"),
        ("1-9-2026", "dmy", "2026-09-01"),
        ("2026-09-12", "dmy", "2026-09-12"),
        ("2026.09.12", "mdy", "2026-09-12"),
        ("20 Aug 2026", "dmy", "2026-08-20"),
        ("20-AUG-2026", "mdy", "2026-08-20"),
        ("14th September 2026", "dmy", "2026-09-14"),
        ("Sept. 14, 2026", "dmy", "2026-09-14"),
        ("  12 . 09 . 2026 ", "dmy", "2026-09-12"),
    ],
)
def test_a_written_date_is_read_in_the_markets_order(written: str, order: str, iso: str) -> None:
    assert iso_date(written, order) == iso


@pytest.mark.parametrize(
    ("written", "order"),
    [
        ("", "dmy"),
        (None, "dmy"),
        ("31.02.2026", "dmy"),  # no such day
        ("13.13.2026", "dmy"),
        ("12.09.2026", ""),  # a Market that has not said its order: never a guess
        ("12.09.2026", "ymd"),
        ("Aug 2026", "dmy"),
        ("R1", "dmy"),
        ("12 Foo 2026", "dmy"),
        ("12.09.0026", "dmy"),
        ("12.09.20266", "dmy"),
    ],
)
def test_what_is_not_one_calendar_day_is_none(written: str | None, order: str) -> None:
    assert iso_date(written, order) is None
