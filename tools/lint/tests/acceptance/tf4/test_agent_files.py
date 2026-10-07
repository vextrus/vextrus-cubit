"""Ticket f4, T5 and T6: the builder's contract, the writer's counts and the reviewers' last lines live
in the agent files (docs/specs/factory.md 3.3, 3.4; `contracts/trailers.md`), and the skills a builder
loads never tell it to wait for a user (the `tdd` fix).
"""

import re

from tools.lint.tests.acceptance.tf4._frontmatter import REPO, as_list, split

AGENTS = REPO / ".claude/agents"
SKILLS = REPO / ".claude/skills"
OPUS = {"opus", "claude-opus-5-5"}
SONNET = {"sonnet", "claude-sonnet-5-5"}


def paragraphs(body: str) -> list[str]:
    return [part.lower() for part in re.split(r"\n\s*\n", body)]


def together(body: str, *words: str) -> bool:
    """Some paragraph holds every word (case-insensitive)."""
    return any(all(word.lower() in part for word in words) for part in paragraphs(body))


def test_the_builder_runs_on_a_builder_row_of_the_map_with_verify_and_tdd() -> None:
    meta, _ = split(AGENTS / "builder.md")
    pair = (meta.get("model"), meta.get("effort"))
    # Amended 5 Oct 2026: the owner's Q1 model and effort map (session 14) supersedes this pin.
    assert (pair[0] in SONNET and pair[1] in {"medium", "high"}) or (
        pair[0] in OPUS and pair[1] == "high"
    ), meta
    assert {"verify", "tdd"} <= set(as_list(meta.get("skills")))


def test_the_builders_body_is_the_contract() -> None:
    _, body = split(AGENTS / "builder.md")
    lower = body.lower()
    for words in (
        "Factory-State: READY",
        "Factory-State: BLOCKED",
        "Factory-Verify:",
        "Factory-Reason:",
        "git remote get-url origin",
    ):
        assert words.lower() in lower, words
    assert together(body, "never change", "acceptance")
    assert "explicit paths" in lower
    assert together(body, "before each commit", "verify")
    assert any(
        "pgrep" in part and any(no in part for no in ("never", "do not", "don't", "no "))
        for part in paragraphs(body)
    )
    assert together(body, "foreground", "timeout")
    order = [
        lower.find(step)
        for step in ("export_openapi_schema", "api:types", "typecheck", "npm --prefix web test")
    ]
    assert -1 not in order
    assert order == sorted(order)
    assert ".private/work/session-11" not in body
    assert "common.md" not in body


def test_the_builder_writes_its_own_budget_record_for_the_clock() -> None:
    _, body = split(AGENTS / "builder.md")
    assert "budget-" in body
    assert "started_utc" in body


def test_the_acceptance_writer_runs_on_opus_and_commits_its_counts() -> None:
    meta, body = split(AGENTS / "acceptance-writer.md")
    assert meta.get("model") == "opus"
    # Amended 5 Oct 2026: the owner's Q1 model and effort map (session 14) supersedes this pin.
    assert meta.get("effort") == "high"
    for words in ("red-on-main:", "green-on-throwaway:", "tests/acceptance"):
        assert words in body


def test_the_pr_reviewer_ends_on_a_verdict_line_and_runs_only_the_prs_tests() -> None:
    meta, body = split(AGENTS / "pr-reviewer.md")
    assert (meta.get("model"), meta.get("effort")) == ("opus", "high")
    lower = body.lower()
    assert "sub-agents if you have them" not in lower
    assert "run the full suite together" not in lower
    assert "VERDICT: PASS|FIX|BLOCK at" in body
    assert "pytest.lock" in body


def test_the_refuter_runs_on_sonnet_at_high_with_its_three_words() -> None:
    meta, body = split(AGENTS / "refuter.md")
    # Amended 5 Oct 2026: the owner's Q1 model and effort map (session 14) supersedes this pin.
    assert meta.get("model") in SONNET, meta
    assert meta.get("effort") == "high", meta
    for word in ("CONFIRMED", "REFUTED", "UNPROVEN"):
        assert word in body


def test_tdd_takes_the_committed_acceptance_tests_as_the_agreed_seams() -> None:
    text = (SKILLS / "tdd/SKILL.md").read_text()
    assert "No test is written at an unconfirmed seam" not in text
    assert "the committed acceptance tests are the agreed seams" in text.lower()


def test_no_skill_the_builder_loads_tells_it_to_confirm_with_the_user() -> None:
    meta, _ = split(AGENTS / "builder.md")
    skills = as_list(meta.get("skills"))
    assert skills
    for skill in skills:
        text = (SKILLS / skill / "SKILL.md").read_text()
        assert not re.search(r"confirm[^.\n]*with the user", text, re.IGNORECASE), skill


def test_the_verify_skill_calls_the_script_and_may_be_invoked_by_the_model() -> None:
    meta, body = split(SKILLS / "verify/SKILL.md")
    assert meta.get("name") == "verify"
    assert meta.get("description")
    assert meta.get("disable-model-invocation") != "true"
    assert "scripts.verify" in body
    assert "Factory-Verify" in body
