"""A sheet's issue date as its title block writes it, made an ISO date (the design gate's M1).

A title block writes "12.09.2026", "12/09/26", "20 Aug 2026" or "2026-09-12". Only the Market knows
whether "12.09.2026" is the 12th of September or the 9th of December, so the order of day, month and
year in a date written in numbers is the Market's (`MarketProfile.date_order`: "dmy", "mdy" or
"ymd"); a four-digit first part is always year first, whatever the order (so a Market that has not
said its order still has "2026-09-12" read). A month written as a word needs no order. A two-digit
year is this century's only up to next year ("26" is 2026; "99" is not read: 1999 or 2099 would be a
guess). What cannot be read as one real calendar day gives None, never a guess.

    iso_date("12.09.2026", "dmy")  # "2026-09-12"
    iso_date("20 Aug 2026", "dmy")  # "2026-08-20"
    iso_date("31.02.2026", "dmy")  # None
"""

import re
from datetime import date

ORDERS = frozenset({"dmy", "mdy", "ymd"})

_MONTHS = {
    name: number
    for number, names in enumerate(
        (
            ("jan", "january"),
            ("feb", "february"),
            ("mar", "march"),
            ("apr", "april"),
            ("may",),
            ("jun", "june"),
            ("jul", "july"),
            ("aug", "august"),
            ("sep", "sept", "september"),
            ("oct", "october"),
            ("nov", "november"),
            ("dec", "december"),
        ),
        start=1,
    )
    for name in names
}

_NUMERIC = re.compile(r"(\d{1,4})\s*[./\-\s]\s*(\d{1,2})\s*[./\-\s]\s*(\d{1,4})")
_DAY_MONTH = re.compile(r"(\d{1,2})(?:st|nd|rd|th)?[\s./\-,]*([a-z]+)\.?[\s./\-,]*(\d{2}|\d{4})")
_MONTH_DAY = re.compile(r"([a-z]+)\.?[\s./\-]*(\d{1,2})(?:st|nd|rd|th)?[\s,./\-]+(\d{2}|\d{4})")


def iso_date(text: str | None, order: str, today: date | None = None) -> str | None:
    """`text` as "YYYY-MM-DD", reading a date in numbers in the Market's `order`; else None."""
    latest = (today or date.today()).year + 1
    written = " ".join((text or "").lower().split())
    if not written:
        return None
    numeric = _NUMERIC.fullmatch(written)
    if numeric:
        return _numeric(numeric.groups(), order, latest)
    day_month = _DAY_MONTH.fullmatch(written)
    if day_month:
        day, month, year = day_month.groups()
        return _day(_year(year, latest), _MONTHS.get(month), int(day))
    month_day = _MONTH_DAY.fullmatch(written)
    if month_day:
        month, day, year = month_day.groups()
        return _day(_year(year, latest), _MONTHS.get(month), int(day))
    return None


def _numeric(parts: tuple[str, ...], order: str, latest: int) -> str | None:
    first, second, third = parts
    if len(first) == 4:
        return _day(int(first), int(second), int(third)) if len(third) <= 2 else None
    if len(third) not in (2, 4) or order not in ORDERS:
        return None
    if order == "dmy":
        return _day(_year(third, latest), int(second), int(first))
    if order == "mdy":
        return _day(_year(third, latest), int(first), int(second))
    return None  # "ymd" with a short year first is not a date anyone writes on a title block


def _year(written: str, latest: int) -> int | None:
    """A four-digit year as written; a two-digit one in this century up to `latest`, else None."""
    if len(written) != 2:
        return int(written)
    year = 2000 + int(written)
    return year if year <= latest else None


def _day(year: int | None, month: int | None, day: int) -> str | None:
    if year is None or month is None or not 1900 <= year <= 2199:
        return None
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None
