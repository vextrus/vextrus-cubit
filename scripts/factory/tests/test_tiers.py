"""Unit tests of `scripts.factory.tiers` (the risk tier and the refuter's sample) and of how
`scripts.factory.review` uses them: the refuter skipped on an unsampled ordinary head, run on every
risk head, and a lens's environment that keeps the prompt cache on (S29-F7)."""

import hashlib
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
    assert tiers.risk_matches(path for path in ["engine/a.py", "web/b.tsx"]) == ["engine/a.py"]


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


def test_the_list_is_read_afresh_for_each_call(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    tiers_file = tmp_path / "review_tiers.toml"
    monkeypatch.setattr(ledger, "TIERS_FILE", tiers_file)
    tiers_file.write_text("[risk]\npaths = ['a/**']\n")
    assert tiers.risk_matches(["a/x.py", "b/x.py"]) == ["a/x.py"]
    tiers_file.write_text("[risk]\npaths = ['b/**']\n")
    assert tiers.risk_matches(["a/x.py", "b/x.py"]) == ["b/x.py"]


@pytest.mark.parametrize(
    "path",
    [
        # Read by scripts/verify.py and scripts/land.py to excuse a failed test.
        ".github/flaky.txt",
        ".github/flaky-root.txt",
        # Imported by publish.py, allowlist.py and verify.py (which commit a leak-scan hit belongs to).
        "scripts/factory/leakwhere.py",
        # Imported by review.py (its review slots).
        "scripts/factory/governor.py",
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
