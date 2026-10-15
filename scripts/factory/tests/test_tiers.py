"""Unit tests of `scripts.factory.tiers` (the risk tier and the refuter's sample) and of how
`scripts.factory.review` uses them: the refuter skipped on an unsampled ordinary head, run on every
risk head, and a lens's environment that keeps the prompt cache on (S29-F7)."""

import hashlib
import re
import subprocess
from pathlib import Path

import pytest

from scripts import ledger
from scripts.factory import review, tiers

HEAD = "0123456789abcdef0123456789abcdef01234567"


def test_risk_matches_keeps_the_order_given_and_ignores_case() -> None:
    paths = ["web/src/components/a.tsx", "Engine/read/x.py", "docs/notes/a.md", "vextrus/boq/m.py"]
    assert tiers.risk_matches(paths) == ["Engine/read/x.py", "vextrus/boq/m.py"]
    assert tiers.is_risk(paths)
    assert not tiers.is_risk(["web/src/components/a.tsx"])


def test_risk_matches_reads_a_generator_once() -> None:
    assert tiers.risk_matches(path for path in ["engine/a.py", "web/src/b.tsx"]) == ["engine/a.py"]


@pytest.mark.parametrize(
    "text", [None, "", "not toml [", "[risk]\npaths = []\n", "[lax]\npaths = ['x']\n"]
)
def test_an_unusable_tier_list_makes_every_path_risk(
    text: str | None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tiers_file = tmp_path / "review_tiers.toml"
    if text is not None:
        tiers_file.write_text(text)
    monkeypatch.setattr(ledger, "TIERS_FILE", tiers_file)
    assert tiers.risk_matches(["web/src/components/a.tsx"]) == ["web/src/components/a.tsx"]
    assert not tiers.is_risk([]), "an empty change is never risk"


LISTS = (
    "[docs_only]\npaths = ['n/**']\nnever = ['p/**']\n[risk]\npaths = ['a/m/**']\n"
    "[strict]\npaths = ['a/w/**']\n[lax]\npaths = ['a/**/*.tsx']\n"
)


def test_the_list_is_read_afresh_for_each_call(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    tiers_file = tmp_path / "review_tiers.toml"
    monkeypatch.setattr(ledger, "TIERS_FILE", tiers_file)
    tiers_file.write_text(LISTS)
    assert tiers.risk_matches(["a/x.tsx", "a/m/x.tsx"]) == ["a/m/x.tsx"]
    tiers_file.write_text(LISTS.replace("'a/m/**'", "'a/x.tsx'"))
    assert tiers.risk_matches(["a/x.tsx", "a/m/x.tsx"]) == ["a/x.tsx"]


def test_a_leftover_ordinary_list_makes_nothing_ordinary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """S30-F7: there is no second ordinary list; an `[ordinary]` table is read by nobody."""
    tiers_file = tmp_path / "review_tiers.toml"
    monkeypatch.setattr(ledger, "TIERS_FILE", tiers_file)
    tiers_file.write_text(LISTS + "[ordinary]\npaths = ['**']\n")
    assert tiers.risk_matches(["a/x.py", "b/x.tsx", "a/x.tsx"]) == ["a/x.py", "b/x.tsx"]


@pytest.mark.parametrize("path", ["a/x.tsx:12", "a/x.tsx#L3", "a/x.tsx:1-4"])
def test_a_path_the_bar_shortens_is_judged_as_it_is(
    path: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The bar drops a location suffix before it judges; a changed file so named is no view: risk."""
    tiers_file = tmp_path / "review_tiers.toml"
    monkeypatch.setattr(ledger, "TIERS_FILE", tiers_file)
    tiers_file.write_text(LISTS)
    assert tiers.risk_matches([path, "a/x.tsx"]) == [path]


@pytest.mark.parametrize(
    "path",
    [
        # Read by scripts/verify.py and scripts/land.py to excuse a failed test.
        ".github/flaky.txt",
        ".github/flaky-root.txt",
        # Imported by publish.py, allowlist.py and verify.py (which commit a leak-scan hit belongs to).
        "scripts/factory/leakwhere.py",
        # Imported by review.py (its review slots; the revert tier's no-model PASS, S29-F3).
        "scripts/factory/governor.py",
        "scripts/factory/main_watch.py",
        # Read by the acceptance check (tools/lint/acceptance.py, acceptance_lint.py) at the base.
        "tools/lint/acceptance_legacy.txt",
        "docs/rulings.md",
        # Whether the acceptance check runs import-linter on a ticket's tree.
        ".importlinter",
        "setup.cfg",
    ],
)
def test_the_files_the_listed_gate_code_imports_or_reads_are_risk(path: str) -> None:
    """A PR that changes what a listed gate imports or reads gets the full panel (PR #884 round 1)."""
    assert tiers.is_risk([path])


@pytest.mark.parametrize(
    "path",
    [
        # PR #884 round 2: the CI matrix's builder, its shard list and the workflow it builds.
        "tools/lint/ci_shards.py",
        ".github/ci-shards.json",
        ".github/workflows/ci.yml",
        # Fed to the real-drawing check's matcher beside .github/engine-paths.txt.
        ".github/checkout-also.txt",
    ],
)
def test_round_twos_gate_files_are_risk(path: str) -> None:
    assert tiers.is_risk([path])
    assert tiers.risk_matches([path]) == [path]


@pytest.mark.parametrize(
    "path",
    [
        # A gate nobody has listed yet is risk by default (lesson (e)): risk unless plainly product.
        "tools/newgate/x.py",
        ".github/new.txt",
        ".claude/skills/new/SKILL.md",
        "scripts/new_gate.py",
        "Makefile",
        "web/package.json",
        "vextrus/settings/job.py",
        "vextrus/newmodule/models.py",
        # An instruction file Claude Code loads, inside an ordinary folder.
        "web/src/CLAUDE.md",
        "docs/plans/AGENTS.md",
        "vextrus/exports/CLAUDE.local.md",
    ],
)
def test_a_path_on_no_ordinary_list_is_risk(path: str) -> None:
    assert tiers.is_risk([path])
    assert tiers.risk_matches(["web/src/components/a.tsx", path]) == [path]


@pytest.mark.parametrize("path", ["web/src/components/badge.tsx", "docs/notes/howto.md"])
def test_plain_product_work_stays_ordinary(path: str) -> None:
    assert not tiers.is_risk([path])


@pytest.mark.parametrize(
    "path",
    [
        # S30-F7: once on PR #896's `[ordinary]` folders, off the bar's lax set or a never glob now.
        "docs/handoff/session-29-prompt.md",
        "vextrus/exports/services.py",
        "vextrus/drawings/models.py",
        "vextrus/measurement/quantities.py",
        "web/src/ui/cn.ts",
        # The web views the access tree walk marks (issue #898), named on `[risk]`.
        "web/src/app/TopBar.tsx",
        "web/src/takeoff/Step1Screen.tsx",
        "web/src/ui/ReadOnlyChip.tsx",
        # pytest's configuration in any folder, also inside a lax glob's reach.
        "web/src/ui/conftest.py",
    ],
)
def test_what_896_called_ordinary_off_the_lax_set_is_risk(path: str) -> None:
    assert tiers.risk_matches(["web/src/components/badge.tsx", path]) == [path]


@pytest.mark.parametrize(
    "text",
    [
        None,
        "[risk]\npaths = ['a/**']\n",
        LISTS.replace("never = ['p/**']\n", ""),
        LISTS.replace("never = ['p/**']", "never = []"),
        LISTS.replace("never = ['p/**']", "never = ['p/**', '']"),
        LISTS.replace("never = ['p/**']", "never = 'p/**'"),
        LISTS.replace("[strict]\npaths = ['a/w/**']\n", ""),
    ],
)
def test_an_unusable_list_makes_every_path_risk(
    text: str | None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tiers_file = tmp_path / "review_tiers.toml"
    if text is not None:
        tiers_file.write_text(text)
    monkeypatch.setattr(ledger, "TIERS_FILE", tiers_file)
    assert tiers.risk_matches(["b/x.py", "a/x.tsx"]) == ["b/x.py", "a/x.tsx"]


# A view that takes the read-only role as a prop and gates the acts on it, without importing `@/auth`
# (S30-F7's refuter: ts30f7's tree walk marks imports and nouns, not a `readOnly` prop or a `'guest'`).
ROLE_PROP = re.compile(r"""\breadOnly\??\s*:|(?<!role=)["']guest["']""")
ROOT = Path(__file__).resolve().parents[3]


def test_no_ordinary_view_takes_the_read_only_role() -> None:
    done = subprocess.run(
        ["git", "ls-tree", "-r", "-z", "--name-only", "HEAD"], cwd=ROOT, capture_output=True, check=True
    )
    tree = [name.decode() for name in done.stdout.split(b"\0") if name]
    risk = set(tiers.risk_matches(tree))
    marked = [
        path
        for path in tree
        if path not in risk
        and path.endswith((".ts", ".tsx"))
        and ROLE_PROP.search((ROOT / path).read_text(errors="replace"))
    ]
    assert not marked, f"views that take the read-only role judged ordinary (one lens): {marked}"


def test_the_read_only_mark_catches_the_views_the_refuter_found() -> None:
    for path in ("web/src/takeoff/SheetList.tsx", "web/src/takeoff/Step1Inspector.tsx"):
        assert ROLE_PROP.search((ROOT / path).read_text()), path
    assert not ROLE_PROP.search('<ReadOnlyChip role="guest" /> <TextField readOnly size="md" />')


@pytest.mark.parametrize("pr", [1, 12, 881])
def test_the_sample_is_the_hash_of_the_pr_and_head(pr: int) -> None:
    expected = int(hashlib.sha256(f"{pr}:{HEAD}".encode()).hexdigest(), 16) % 5 == 0
    assert tiers.refuter_sampled(pr, HEAD) is expected
    assert tiers.refuter_sampled(pr, HEAD) is tiers.refuter_sampled(pr, HEAD)


def pr_with_sample(sampled: bool) -> int:
    return next(pr for pr in range(1, 100) if tiers.refuter_sampled(pr, HEAD) is sampled)


def findings() -> list[review.Finding]:
    blocking = review.Finding("l1-f1", 80, "vextrus/summary/views.py", 3, "a 75", None, word="UNPROVEN")
    replayed = review.Finding("l1-f2", 80, "vextrus/summary/views.py", 4, "s", "t.py", word="CONFIRMED")
    filed = review.Finding("l1-f3", 60, "web/src/components/a.tsx", 1, "a 60", None, word="UNPROVEN")
    filed.on_tree = True  # a lax file: a 50-74 there cannot block
    return [blocking, replayed, filed]


def started_refuter(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    started: list[str] = []

    def run_lens(lens: review.Lens, *_: object) -> dict[str, object]:
        started.append(lens.label)
        raise review.Refused("no refuter in a unit test")

    monkeypatch.setattr(review, "refuter_tree", lambda *_: None)
    monkeypatch.setattr(review, "refuter_brief", lambda *_: "brief")
    monkeypatch.setattr(review, "run_lens", run_lens)
    return started


def test_an_unsampled_ordinary_head_starts_no_refuter_and_files_the_unreproduced(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = started_refuter(monkeypatch)
    run = review.Run(pr=pr_with_sample(False), round_=1, head=HEAD, tier="ordinary", slot=1)
    run.findings = findings()
    review.refute(run, tmp_path, tmp_path, tmp_path)
    assert started == []
    assert run.refuter == "not sampled"
    assert [item.word for item in run.findings] == ["UNPROVEN", "CONFIRMED", "-"]
    lines = [f"FINDING {f.id} {f.score} {f.word} {f.file}" for f in run.findings]
    decided = ledger.decide("\n".join([f"VERDICT: FIX at {HEAD}", *lines]).encode(), HEAD)
    assert decided.verdict == "FIX", "the replayed 80 still blocks"
    alone = ledger.decide(f"VERDICT: FIX at {HEAD}\n{lines[0]}\n".encode(), HEAD)
    assert alone.verdict == "PASS", "an unreproduced 80 on an unsampled head is filed"


@pytest.mark.parametrize(("tier", "sampled"), [("ordinary", True), ("risk", False), ("risk", True)])
def test_a_sampled_ordinary_head_and_every_risk_head_start_the_refuter(
    tier: str, sampled: bool, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = started_refuter(monkeypatch)
    run = review.Run(pr=pr_with_sample(sampled), round_=1, head=HEAD, tier=tier, slot=1)
    run.findings = findings()
    review.refute(run, tmp_path, tmp_path, tmp_path)
    assert started == ["refuter"]
    assert run.refuter == ("sampled" if tier == "ordinary" else "every head")
    assert run.findings[0].word == "UNJUDGED", "told to a refuter that gave no answer: it stands"


def test_the_cost_line_names_the_refuters_sample() -> None:
    run = review.Run(pr=12, round_=1, head=HEAD, tier="ordinary")
    run.refuter = "not sampled"
    assert review.summary(run, 0, None)["refuter"] == "not sampled"
    assert "refuter" not in review.summary(review.Run(pr=12, round_=1), 0, None)


def test_a_lens_never_inherits_a_switch_that_turns_the_prompt_cache_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in (
        "DISABLE_PROMPT_CACHING",
        "DISABLE_PROMPT_CACHING_SONNET",
        "DISABLE_PROMPT_CACHING_OPUS",
    ):
        monkeypatch.setenv(name, "1")
    monkeypatch.setenv("VEXTRUS_KEEP_ME", "1")
    env = review.lens_env(2)
    assert not [name for name in env if name.startswith("DISABLE_PROMPT_CACHING")]
    assert env["VEXTRUS_KEEP_ME"] == "1"
