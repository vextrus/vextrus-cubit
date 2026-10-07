"""G1 (ticket f9): every recorded Jev answer kept in git is clean invented data.

Green on main by design (a guard, reported apart from the acceptance counts): it holds the
fixtures the writer commits now and the builder's extras later, under both fixtures folders.
"""

import json
import re
from pathlib import Path

import pytest

TESTS = Path(__file__).resolve().parents[1]
FOLDERS = (TESTS / "acceptance" / "fixtures" / "jev", TESTS / "fixtures" / "jev")
TOKEN_RUN = re.compile(r"[A-Za-z0-9_\-+/=]{32,}")
FORBIDDEN = ("Bearer", "TYPESAFE", ".private")


def fixtures() -> list[Path]:
    return sorted(p for folder in FOLDERS if folder.is_dir() for p in folder.rglob("*") if p.is_file())


def test_g1_the_writers_fixtures_exist() -> None:
    assert any(p.is_relative_to(FOLDERS[0]) for p in fixtures())


@pytest.mark.parametrize("path", fixtures(), ids=lambda p: p.name)
def test_g1_a_fixture_is_marked_json_with_no_key_and_no_private_path(path: Path) -> None:
    text = path.read_text()
    data = json.loads(text)
    assert isinstance(data, dict)
    assert data.get("recorded") in {"live", "synthetic"}
    for word in FORBIDDEN:
        assert word not in text, word
    assert not TOKEN_RUN.search(text), TOKEN_RUN.search(text)
