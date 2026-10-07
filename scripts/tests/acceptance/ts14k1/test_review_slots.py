"""S14-K1 (c): eight review slots. The owner (6 Oct 2026 08:22Z): "raise the cap of reviewer cap also
from the next session for maximum performance". So eight review runs hold a slot each at once
(`review.claim_slot`, the slot claim every run makes: an exclusive lock on `.slot<N>.lock` held until
the run ends), and a ninth is refused in the existing words, "all <n> review slots are busy: run again
when one finishes"."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import IO

import pytest

from scripts.factory import review
from scripts.tests.acceptance.ts14k1._world import REVIEW_SLOTS


@pytest.fixture
def held() -> Iterator[list[IO[str]]]:
    handles: list[IO[str]] = []
    yield handles
    for handle in handles:
        handle.close()


def test_eight_review_runs_hold_eight_slots_at_once(tmp_path: Path, held: list[IO[str]]) -> None:
    slots = []
    for _ in range(REVIEW_SLOTS):
        n, handle = review.claim_slot(tmp_path)
        held.append(handle)
        slots.append(n)
    assert sorted(slots) == list(range(1, REVIEW_SLOTS + 1))


def test_a_ninth_review_run_is_refused_in_the_existing_words(
    tmp_path: Path, held: list[IO[str]]
) -> None:
    for _ in range(REVIEW_SLOTS):
        held.append(review.claim_slot(tmp_path)[1])
    with pytest.raises(review.Refused) as refused:
        held.append(review.claim_slot(tmp_path)[1])
    assert str(refused.value) == "all 8 review slots are busy: run again when one finishes"
