"""Ticket #159 (M0 fix B4): the General Discipline is a row of the Market's library.

The owner's ruling (session 07): "Add a General Discipline (Recommended)": a General Discipline in the
Market's library. The issue's acceptance: "The General Discipline comes from the Market's library
(`sync_library`), no literals (`market_literals` scan)."

The row is found by its English name, "General" (a Discipline "has one name everywhere, held ... as
data", `vextrus/drawings/library.py`); its key is whatever the row names it, never asserted here.
"""

import io
import token
import tokenize
from pathlib import Path

import pytest

from tools.lint import market_literals
from vextrus.drawings.models import Discipline
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import library as platform_library
from vextrus.platform.services.markets import MarketProfile

REPO = Path(__file__).resolve().parents[5]
PRODUCT = ("vextrus", "engine")
"""Product code: every Python file under these, but tests, the test helpers, migrations and the
Library rows' own files (`library.py`, where Market data is written)."""


def general_rows(market: MarketProfile) -> list[Discipline]:
    rows = Discipline.objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    return [row for row in rows if row.labels.get("en") == "General"]


@pytest.mark.django_db(databases=["default", "owner"])
def test_sync_library_writes_the_general_discipline_into_the_markets_library(
    market: MarketProfile,
) -> None:
    Discipline.objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id).delete()

    platform_library.sync()
    [general] = general_rows(market)
    again = platform_library.sync()

    assert again["drawings"] == 0
    assert [row.id for row in general_rows(market)] == [general.id]


def _string_literals(path: Path) -> set[str]:
    found = set()
    source = path.read_text(encoding="utf-8")
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        if tok.type == token.STRING:
            text = tok.string.lstrip("rbuRBU")
            for quote in ('"""', "'''", '"', "'"):
                if text.startswith(quote) and text.endswith(quote) and len(text) >= 2 * len(quote):
                    found.add(text[len(quote) : -len(quote)])
                    break
    return found


def _product_files() -> list[Path]:
    files = []
    for root in PRODUCT:
        for path in sorted((REPO / root).rglob("*.py")):
            parts = path.relative_to(REPO).parts
            if any(p in ("tests", "migrations", "testing", "__pycache__") for p in parts):
                continue
            if path.name == "library.py" or path.name.startswith("test_") or path.name == "conftest.py":
                continue
            files.append(path)
    return files


@pytest.mark.django_db(databases=["default", "owner"])
def test_no_product_code_names_the_general_discipline_by_its_key(market: MarketProfile) -> None:
    """ "No literals": the General Discipline is Market data; code reaches it through the library
    (a row's kind or its data), never by writing its key."""
    platform_library.sync()
    [general] = general_rows(market)

    naming = [
        str(path.relative_to(REPO)) for path in _product_files() if general.key in _string_literals(path)
    ]

    assert naming == []


def test_the_market_literals_scan_passes(capsys: pytest.CaptureFixture[str]) -> None:
    assert market_literals.main(["--root", str(REPO)]) == 0, capsys.readouterr().out
