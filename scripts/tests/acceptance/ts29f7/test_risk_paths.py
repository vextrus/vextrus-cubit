"""S29-F7 item 1 (docs/plans/factory-s29.md 7; the owner's rulings Q5 and Q15, 14 Oct 2026: "the
full panel on a risk tier written down as paths (engine, takeoff, money, access and members,
migrations, factory gate code, hooks, the scorer); session 29 confirms the globs against the module
map").

The risk tier is a `[risk]` table of `paths` globs in `scripts/factory/review_tiers.toml`, read by one
shared reader the landing (S29-F4) imports too: `scripts.factory.tiers.is_risk(paths) -> bool` and
`scripts.factory.tiers.risk_matches(paths) -> list[str]` (the given paths that are on the risk tier,
in the order given). One risk path makes a whole PR risk; a path on no list is ordinary.

The representative paths are files of the real tree (docs/architecture.md's module map): `engine`,
`takeoff`, money (`boq`, `rates`), access and members (`platform`'s auth, members and tenancy, the
web's members and auth screens), any module's migrations, the factory's gate code, the hooks and
settings, and the scorer. The tier list and its reader are themselves risk: a PR never relaxes its
own tier."""

import tomllib
from pathlib import Path

import pytest

import scripts.factory.tiers as tiers  # type: ignore[import-not-found, unused-ignore]
from scripts import ledger

TIERS_TOML = Path(__file__).resolve().parents[3] / "factory" / "review_tiers.toml"

RISK = {
    "engine": ["engine/read/sandbox.py", "engine/recognise/__init__.py"],
    "takeoff": ["vextrus/takeoff/models.py"],
    "money": ["vextrus/boq/models.py", "vextrus/rates/models.py"],
    "access and members": [
        "vextrus/platform/http/members.py",
        "vextrus/platform/services/auth.py",
        "vextrus/platform/services/tenancy.py",
        "web/src/members/InviteDialog.tsx",
        "web/src/auth/index.ts",
    ],
    "migrations": [
        "vextrus/summary/migrations/0002_target_cost.py",
        "vextrus/exports/migrations/0001_initial.py",
    ],
    "factory gate code": [
        "scripts/factory/review.py",
        "scripts/ledger.py",
        "scripts/merge_ready.py",
        "scripts/land.py",
        "scripts/factory/ci_gate.py",
        "tools/lint/acceptance.py",
        "tools/lint/acceptance_lint.py",
        "tools/leakscan/scan.py",
        "scripts/factory/publish.py",
    ],
    "the tier list and its reader": [
        "scripts/factory/review_tiers.toml",
        "scripts/factory/tiers.py",
    ],
    "hooks and settings": [".claude/hooks/guard.mjs", ".claude/settings.json"],
    "the scorer": ["tools/scorer/score.py"],
}
RISK_PATHS = [(kind, path) for kind, paths in RISK.items() for path in paths]
IDS = [path for _, path in RISK_PATHS]

ORDINARY = ["web/src/components/badge.tsx", "docs/notes/howto.md"]


@pytest.mark.parametrize(("kind", "path"), RISK_PATHS, ids=IDS)
def test_a_path_of_each_risk_kind_is_risk(kind: str, path: str) -> None:
    assert tiers.is_risk([path]), f"scripts.factory.tiers.is_risk: {path} ({kind}) is not risk"


@pytest.mark.parametrize("path", ORDINARY)
def test_a_path_on_no_risk_list_is_ordinary(path: str) -> None:
    assert not tiers.is_risk([path]), f"scripts.factory.tiers.is_risk: {path} is risk"
    assert tiers.risk_matches([path]) == [], f"scripts.factory.tiers.risk_matches: {path} matched"


def test_one_risk_path_makes_a_mixed_pr_risk() -> None:
    paths = [*ORDINARY, "engine/read/sandbox.py"]
    assert tiers.is_risk(paths), "scripts.factory.tiers.is_risk: one engine path did not make it risk"


def test_risk_matches_names_exactly_the_risk_paths_in_order() -> None:
    paths = [
        "web/src/components/badge.tsx",
        "vextrus/takeoff/models.py",
        "docs/notes/howto.md",
        ".claude/hooks/guard.mjs",
    ]
    assert tiers.risk_matches(paths) == ["vextrus/takeoff/models.py", ".claude/hooks/guard.mjs"]


def test_an_empty_change_is_not_risk() -> None:
    assert not tiers.is_risk([]), "scripts.factory.tiers.is_risk: an empty change is risk"
    assert tiers.risk_matches([]) == []


@pytest.mark.parametrize(("kind", "path"), RISK_PATHS, ids=IDS)
def test_the_risk_table_of_review_tiers_lists_each_risk_kind(kind: str, path: str) -> None:
    assert tiers.is_risk([path])  # the reader (and its module) first
    data = tomllib.loads(TIERS_TOML.read_text())
    globs = data.get("risk", {}).get("paths", [])
    assert any(ledger.glob_regex(glob).fullmatch(path) for glob in globs), (
        f"scripts/factory/review_tiers.toml [risk] paths name no glob for {path} ({kind})"
    )
