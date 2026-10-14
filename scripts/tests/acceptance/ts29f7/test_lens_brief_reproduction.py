"""S29-F7 item 4 (docs/plans/factory-s29.md 7: "the lens brief says to judge intent and user impact";
the owner's ruling Q21, 14 Oct 2026: "A finding blocks only with a reproduction on that head;
reviewers judge intent and user impact").

S28-R1 already pins "intent" and "user impact" in the brief (ts28r1/test_lens_brief_observed.py); this
pins the rest of Q21's rule in the words every review lens receives (`scripts.factory.review.brief`):
a finding blocks only with a reproduction on the head under review."""

import re
from pathlib import Path

import pytest

from scripts.factory import review

HEAD = "0123456789abcdef0123456789abcdef01234567"
LENSES = [review.LENS_A, review.LENS_B, review.DELTA]
RULE = re.compile(r"blocks only with a reproduction on (this|that) head")


@pytest.mark.parametrize("lens", LENSES, ids=[lens.label for lens in LENSES])
def test_the_lens_brief_says_a_finding_blocks_only_with_a_reproduction_on_that_head(
    lens: review.Lens, tmp_path: Path
) -> None:
    run = review.Run(pr=12, round_=2, head=HEAD, merged=HEAD, slot=1)
    text = " ".join(review.brief(run, lens, tmp_path / "rv1", tmp_path / "slot1").split()).lower()
    assert RULE.search(text), (
        "scripts.factory.review.brief does not say a finding blocks only with a reproduction"
    )
