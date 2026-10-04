"""Ticket f7, tier 2 (cut second): the `docs/sdlc.md` rewrite for ADR 0042 (factory spec §3.2; ticket
f7 §3 E).

Text checks on the quote-stripped, whitespace-collapsed file. If this item is cut, this whole file
is deleted by a later `acceptance:` commit.
"""

import re

import pytest

from tools.lint.tests.acceptance.f7.support import REPO, normalise

SDLC = REPO / "docs/sdlc.md"


def text() -> str:
    return normalise(SDLC.read_text())


@pytest.mark.parametrize("stale", ["three hooks", "no orchestrator code", "account B"])
def test_the_small_harness_and_account_b_lines_are_gone(stale: str) -> None:
    assert stale not in text(), f"docs/sdlc.md still says {stale!r}"


def test_the_owners_q1_ruling_is_quoted() -> None:
    flat = text()
    for sentence in (
        "Factory code is committed, tested and reviewed like product code.",
        "A harness change should remove as much as it adds",
    ):
        assert sentence in flat, f"docs/sdlc.md lacks {sentence!r}"


def test_every_walk_finding_becomes_an_issue() -> None:
    assert "Every walk finding of any severity becomes an issue" in text()


def test_the_harness_net_and_merge_ready_are_named() -> None:
    flat = text()
    assert "Harness net" in flat
    assert "merge_ready" in flat


def test_cloud_builders_push_their_own_branch_and_local_builders_never_push() -> None:
    flat = text().lower()
    assert "local builders" in flat
    assert "own branch" in flat


def test_the_seed_proves_only_mechanics() -> None:
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text()) if "seeded demo" in s]
    assert sentences, "docs/sdlc.md no longer says what the seeded demo proves"
    for sentence in sentences:
        assert "mechanics" in sentence, (
            f"the seeded demo is offered as more than mechanics: {sentence!r}"
        )
