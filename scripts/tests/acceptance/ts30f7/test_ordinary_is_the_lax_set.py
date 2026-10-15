"""S30-F7 (issue #898; the orchestrator's replanned contract, session 30, after PR #896's round 1).

A PR is ordinary (one lens) only when every changed file is on the review bar's lax set, read from
the same lists `scripts/ledger.py` judges lax by (`[lax] paths` of `scripts/factory/review_tiers.toml`,
`web/src/**/*.tsx` and `docs/**/*.md`, less its `[strict] paths` carve-outs), and on no
`[docs_only] never` glob and no `[risk] paths` glob. There is no second ordinary list. A
`conftest.py` is risk everywhere. Anything else is risk; a missing or unreadable list makes every path
risk. An empty change is not risk.

Pinned through the reader PR #896 introduced: `scripts.factory.tiers.is_risk(paths) -> bool` and
`scripts.factory.tiers.risk_matches(paths) -> list[str]` (the given paths on the risk tier, in the
order given). The synthetic lists are pointed at through `scripts.ledger.TIERS_FILE`, the one tiers
file the bar and the tiers read afresh for each call."""

from pathlib import Path

import pytest

import scripts.factory.tiers as tiers  # type: ignore[import-not-found, unused-ignore]
from scripts import ledger

# PR #896's round 1, finding l1-f1 (60): access-deciding files its `[ordinary]` folders gave one lens.
FOUND_BY_896 = [
    "vextrus/drawings/acts.py",
    "vextrus/drawings/http/files.py",
    "web/src/routes/_app/members/index.tsx",
    "web/src/api/client.ts",
]

# On the lax set, on no carve-out, no never glob and no risk glob.
ORDINARY = ["web/src/ui/Button.tsx", "web/src/components/badge.tsx", "docs/research/stack-data.md"]

STRICT_CARVE_OUTS = [
    "web/src/ui/Button.test.tsx",  # a wall's own tests are a wall
    "web/src/acceptance/t1/x.test.tsx",
    "web/src/routes/index.tsx",
    "web/src/ui/AuthorBadge.tsx",  # names auth
    "web/src/app/SessionMenu.tsx",  # names the session
    "web/src/ui/PermissionNote.tsx",
    "docs/rulings.md",  # Markdown a lint reads at run time
    "docs/knowledge/lessons.md",
    "docs/design/m0-screens.md",
    "web/src/CLAUDE.md",
]

NOT_LAX = [
    "web/src/auth/can.ts",
    "web/src/app/session.ts",
    "web/src/ui/cn.ts",
    "docs/notes/howto.txt",
    "vextrus/drawings/models.py",
    "vextrus/exports/services.py",
    "scripts/new_gate.py",
    "Makefile",
]

DOCS_ONLY_NEVER = [
    "docs/plans/m0.md",
    "docs/specs/factory.md",
    "docs/adr/0043-reviews-run-by-code.md",
    "docs/handoff/session-30-prompt.md",
    "docs/research/notes.local.md",
]

MEMBERS_SCREENS = ["web/src/members/MembersPage.tsx", "web/src/members/RevokeDialog.tsx"]

CONFTESTS = ["conftest.py", "vextrus/drawings/tests/conftest.py", "web/src/conftest.py"]


def assert_risk(path: str) -> None:
    assert tiers.is_risk([path]), f"scripts.factory.tiers.is_risk: {path} is ordinary"
    assert tiers.risk_matches([ORDINARY[0], path]) == [path], (
        f"scripts.factory.tiers.risk_matches does not name {path} beside an ordinary file"
    )


@pytest.mark.parametrize("path", FOUND_BY_896)
def test_each_access_file_896_gave_one_lens_is_risk(path: str) -> None:
    assert_risk(path)


@pytest.mark.parametrize("path", ORDINARY)
def test_a_lax_file_on_no_carve_out_is_ordinary(path: str) -> None:
    assert not tiers.is_risk([path]), f"scripts.factory.tiers.is_risk: {path} is risk"
    assert tiers.risk_matches([path]) == []


@pytest.mark.parametrize("path", STRICT_CARVE_OUTS)
def test_a_strict_carve_out_inside_the_lax_globs_is_risk(path: str) -> None:
    assert_risk(path)


@pytest.mark.parametrize("path", NOT_LAX)
def test_a_file_off_the_lax_globs_is_risk(path: str) -> None:
    assert_risk(path)


@pytest.mark.parametrize("path", DOCS_ONLY_NEVER)
def test_a_docs_only_never_path_is_risk(path: str) -> None:
    assert_risk(path)


@pytest.mark.parametrize("path", MEMBERS_SCREENS)
def test_a_members_screen_is_risk(path: str) -> None:
    assert_risk(path)


@pytest.mark.parametrize("path", CONFTESTS)
def test_a_conftest_is_risk(path: str) -> None:
    assert_risk(path)


@pytest.mark.parametrize("path", ["web/src/ui/Button.TSX", "WEB/src/ui/Button.tsx", "Docs/x.md"])
def test_a_lax_glob_is_matched_as_written(path: str) -> None:
    assert_risk(path)


def test_risk_matches_names_exactly_the_risk_paths_in_order() -> None:
    paths = [ORDINARY[0], "vextrus/drawings/acts.py", ORDINARY[2], "web/src/api/client.ts"]
    assert tiers.risk_matches(paths) == ["vextrus/drawings/acts.py", "web/src/api/client.ts"]
    assert tiers.is_risk(paths)


def test_an_empty_change_is_not_risk() -> None:
    assert not tiers.is_risk([])
    assert tiers.risk_matches([]) == []


# Synthetic tiers files: one table per list the tiers read.
TABLES = {
    "docs_only": '[docs_only]\npaths = ["a/notes/**"]\nnever = ["a/plans/**"]\n',
    "risk": '[risk]\npaths = ["a/money/**"]\n',
    "strict": '[strict]\npaths = ["a/wall/**"]\n',
    "lax": '[lax]\npaths = ["a/**/*.tsx"]\n',
}


def point_at(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, text: str | None) -> None:
    tiers_file = tmp_path / "review_tiers.toml"
    if text is not None:
        tiers_file.write_text(text)
    monkeypatch.setattr(ledger, "TIERS_FILE", tiers_file)


def test_the_tiers_read_the_bars_lists_and_no_other(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    point_at(tmp_path, monkeypatch, "".join(TABLES.values()))
    paths = ["a/x.tsx", "a/wall/x.tsx", "a/plans/x.tsx", "a/money/x.tsx", "a/x.py", "b/x.tsx"]
    assert tiers.risk_matches(paths) == paths[1:], (
        "scripts.factory.tiers does not judge ordinary exactly `[lax]` less `[strict]`, "
        f"`[docs_only] never` and `[risk]`: {tiers.risk_matches(paths)}"
    )


def test_a_change_to_the_bars_lists_changes_the_tier(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    point_at(tmp_path, monkeypatch, "".join(TABLES.values()))
    assert tiers.risk_matches(["a/x.tsx", "a/y.tsx"]) == []
    (tmp_path / "review_tiers.toml").write_text(
        "".join(TABLES.values()).replace('"a/wall/**"', '"a/y.tsx"')
    )
    assert tiers.risk_matches(["a/x.tsx", "a/y.tsx"]) == ["a/y.tsx"]


def test_a_conftest_is_risk_even_on_a_lax_glob(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    point_at(tmp_path, monkeypatch, "".join(TABLES.values()).replace('"a/**/*.tsx"', '"**"'))
    paths = ["a/b.py", "a/conftest.py", "conftest.py", "a/tests/conftest.py"]
    assert tiers.risk_matches(paths) == paths[1:], (
        f"scripts.factory.tiers lets a conftest.py take one lens: {tiers.risk_matches(paths)}"
    )


@pytest.mark.parametrize("missing", list(TABLES))
def test_a_missing_list_makes_every_path_risk(
    missing: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    point_at(tmp_path, monkeypatch, "".join(t for name, t in TABLES.items() if name != missing))
    assert tiers.risk_matches(["a/x.tsx"]) == ["a/x.tsx"], (
        f"scripts.factory.tiers judges a path ordinary with no [{missing}] list"
    )
    assert not tiers.is_risk([])


@pytest.mark.parametrize("text", [None, "", "not toml [", "[lax]\npaths = []\n"], ids=repr)
def test_an_unreadable_tiers_file_makes_every_path_risk(
    text: str | None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    point_at(tmp_path, monkeypatch, text)
    assert tiers.risk_matches(["a/x.tsx", "web/src/ui/Button.tsx"]) == [
        "a/x.tsx",
        "web/src/ui/Button.tsx",
    ]
    assert not tiers.is_risk([])
