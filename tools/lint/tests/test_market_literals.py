"""The market-literal scan: no currency, locale, time zone or unit system written in code (ADR 0038)."""

from pathlib import Path

import pytest

from tools.lint.market_literals import (
    ALLOWLIST,
    Allow,
    AllowlistError,
    load_allowlist,
    main,
    scan,
)

REPO = Path(__file__).resolve().parents[3]


def write(root: Path, relative: str, text: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def found(root: Path, allow: list[Allow] | None = None) -> list[tuple[str, int, str, str]]:
    return [(f.path, f.line, f.kind, f.text) for f in scan(root, allow or [])]


def test_a_taka_sign_in_module_code_is_found(tmp_path: Path) -> None:
    write(tmp_path, "vextrus/boq/services/totals.py", 'LABEL = "Total"\nSIGN = "৳"\n')

    assert found(tmp_path) == [("vextrus/boq/services/totals.py", 2, "currency symbol", "৳")]


@pytest.mark.parametrize(
    ("line", "kind", "text"),
    [
        ('code = "BDT"', "currency code", "BDT"),
        ('price = {"currency": "KWD"}', "currency code", "KWD"),
        ('fmt = "en-IN"', "locale tag", "en-IN"),
        ('fmt = "bn_BD"', "locale tag", "bn_BD"),
        ('zone = "Asia/Dhaka"', "time zone", "Asia/Dhaka"),
        ('zone = "GMT+6"', "time zone", "GMT+6"),
        ('units = "imperial"', "unit system", "imperial"),
        ('units = "Metric"', "unit system", "Metric"),
        ("euro = '€'", "currency symbol", "€"),
        ("from django.utils.formats import localize", "server-side localisation", "localize"),
    ],
)
def test_each_kind_of_market_literal_is_found_in_python(
    tmp_path: Path, line: str, kind: str, text: str
) -> None:
    write(tmp_path, "engine/recognise/sheets.py", line + "\n")

    assert found(tmp_path) == [("engine/recognise/sheets.py", 1, kind, text)]


@pytest.mark.parametrize(
    "line",
    [
        'TIME_ZONE = "UTC"',
        'LANGUAGE_CODE = "en"',
        'template = f"{name} ${value}"',
        'kind = "CAD"',  # a drawing, not Canada's dollar
        'metrics = "metrics"',
        "note = 'drawn in IN-house style'",
    ],
)
def test_what_is_not_a_market_literal_passes(tmp_path: Path, line: str) -> None:
    write(tmp_path, "vextrus/platform/services/jobs.py", line + "\n")

    assert found(tmp_path) == []


def test_python_comments_and_docstrings_are_prose_not_literals(tmp_path: Path) -> None:
    write(
        tmp_path,
        "vextrus/boq/services/totals.py",
        '"""Totals in ৳, shown as en-IN groups them."""\n\n\n'
        "def total() -> int:\n"
        '    """Rounded to BDT\'s minor units."""\n'
        "    return 1  # Asia/Dhaka\n",
    )

    assert found(tmp_path) == []


def test_typescript_strings_are_scanned_and_its_comments_are_not(tmp_path: Path) -> None:
    write(
        tmp_path,
        "web/src/format/money.ts",
        "// Bangladesh groups as en-IN does\n"
        "/* the sign ৳ comes\n   from Market data */\n"
        'const url = "https://example.com/a"; // not a comment inside a string\n'
        "export const sign = `৳`;\n",
    )

    assert found(tmp_path) == [("web/src/format/money.ts", 5, "currency symbol", "৳")]


def test_css_is_scanned(tmp_path: Path) -> None:
    write(tmp_path, "web/src/ui/money.css", ".money::before { content: '৳'; } /* ৳ */\n")

    assert found(tmp_path) == [("web/src/ui/money.css", 1, "currency symbol", "৳")]


@pytest.mark.parametrize(
    "relative",
    [
        "vextrus/boq/tests/test_totals.py",
        "vextrus/testing/tenancy.py",
        "engine/read/tests/test_read.py",
        "conftest.py",
        "web/src/format/money.test.ts",
        "web/src/format/__tests__/money.ts",
        "web/src/messages/boq/totals/en.po",
        "web/src/app/locales/en.po",
        "web/src/app/locales/en.ts",
        "docs/markets.md",
        "tools/lint/market_literals.py",
    ],
)
def test_tests_catalogues_and_files_outside_the_scan_s_roots_pass(tmp_path: Path, relative: str) -> None:
    write(tmp_path, relative, 'sign = "৳"\n')

    assert found(tmp_path) == []


def test_an_allowlisted_path_passes_and_only_there(tmp_path: Path) -> None:
    write(tmp_path, "vextrus/seed/platform.py", 'code = "BDT"\n')
    write(tmp_path, "vextrus/platform/services/markets.py", 'code = "BDT"\n')
    allow = [Allow(path="vextrus/seed/**", reason="invented demo data on one Market")]

    assert found(tmp_path, allow) == [
        ("vextrus/platform/services/markets.py", 1, "currency code", "BDT")
    ]


def test_an_allowlist_entry_naming_a_literal_allows_only_that_literal(tmp_path: Path) -> None:
    write(
        tmp_path,
        "web/src/ui/fonts.css",
        "@font-face { font-family: 'Vextrus Taka'; }\n.x { content: '৳'; }\n",
    )
    write(tmp_path, "web/src/ui/other.css", ".y { font-family: 'en-IN'; }\n")
    allow = [
        Allow(path="web/src/ui/fonts.css", reason="the font's name", literal="৳"),
    ]

    assert found(tmp_path, allow) == [("web/src/ui/other.css", 1, "locale tag", "en-IN")]


def test_the_allowlist_needs_a_reason_for_every_entry(tmp_path: Path) -> None:
    path = tmp_path / "allow.toml"
    path.write_text('[[allow]]\npath = "vextrus/seed/**"\nreason = " "\n')

    with pytest.raises(AllowlistError, match="reason"):
        load_allowlist(path)


def test_an_allowlist_entry_matching_no_file_is_stale(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, "vextrus/boq/services/totals.py", "x = 1\n")
    allowlist = tmp_path / "allow.toml"
    allowlist.write_text('[[allow]]\npath = "vextrus/gone/**"\nreason = "was here once"\n')

    assert main(["--root", str(tmp_path), "--allowlist", str(allowlist)]) == 1
    assert "vextrus/gone/**" in capsys.readouterr().out


def test_the_command_fails_on_a_literal_and_names_where(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, "vextrus/boq/services/totals.py", 'SIGN = "৳"\n')
    allowlist = tmp_path / "allow.toml"
    allowlist.write_text("")

    assert main(["--root", str(tmp_path), "--allowlist", str(allowlist)]) == 1
    assert "vextrus/boq/services/totals.py:1:" in capsys.readouterr().out


def test_this_repository_holds_no_market_literal(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--root", str(REPO), "--allowlist", str(REPO / ALLOWLIST)]) == 0, (
        capsys.readouterr().out
    )
