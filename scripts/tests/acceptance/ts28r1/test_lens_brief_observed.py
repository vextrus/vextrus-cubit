"""S28-R1 items 2 and 3 in `scripts/factory/review.py`: "The lens brief ... says to judge intent and
user impact, not to stack defensive edge cases, and how to set `observed=`" (`yes` "when the attack
test's input comes from a Development Set's conventions, `seed_demo` or the served stack"); a lens's
reply carries the tag (the finding's JSON key `observed`, a boolean beside `trust_boundary`), and a
50-74 that is neither observed nor on a trust boundary reaches the fix message as a finding to file,
with its owed check. The acceptance pin: "the lens brief text names observed= and the user-impact
rule"."""

from pathlib import Path
from typing import Any

import pytest

from scripts.factory import review

HEAD = "0123456789abcdef0123456789abcdef01234567"
LAX = "web/src/components/badge.tsx"
OWED = "a test that the badge keeps its count on a narrow sheet"
LENSES = [review.LENS_A, review.LENS_B, review.DELTA]


@pytest.mark.parametrize("lens", LENSES, ids=[lens.label for lens in LENSES])
def test_the_lens_brief_names_observed_and_how_to_set_it(lens: review.Lens, tmp_path: Path) -> None:
    run = review.Run(pr=12, round_=2, head=HEAD, merged=HEAD, slot=1)
    text = review.brief(run, lens, tmp_path / "rv1", tmp_path / "slot1")
    missing = [word for word in ("observed=", "seed_demo", "Development Set") if word not in text]
    assert not missing, f"scripts.factory.review.brief does not name {missing}"


@pytest.mark.parametrize("lens", LENSES, ids=[lens.label for lens in LENSES])
def test_the_lens_brief_says_to_judge_intent_and_user_impact(lens: review.Lens, tmp_path: Path) -> None:
    run = review.Run(pr=12, round_=2, head=HEAD, merged=HEAD, slot=1)
    text = " ".join(review.brief(run, lens, tmp_path / "rv1", tmp_path / "slot1").split()).lower()
    missing = [word for word in ("intent", "user impact") if word not in text]
    assert not missing, f"scripts.factory.review.brief does not name {missing}"


def test_a_lens_reply_may_tag_a_finding_observed() -> None:
    properties = review.FINDING_SCHEMA["properties"]
    assert "observed" in properties, "scripts.factory.review.FINDING_SCHEMA offers no observed tag"


def view(observed: bool) -> dict[str, Any]:
    """A kept finding as the fix message reads it: the lens's reply keys, its refuter word, on tree."""
    return {
        "id": "lens-b-f1",
        "score": 60,
        "file": LAX,
        "line": 7,
        "summary": "the badge drops its count",
        "status": "CONFIRMED",
        "on_tree": True,
        "class": "user-facing",
        "trust_boundary": False,
        "observed": observed,
        "owed_check": OWED,
    }


def test_a_user_facing_60_not_observed_is_filed_with_its_owed_check() -> None:
    text = review.fix_text(12, HEAD, [view(observed=False)])
    assert "Fix round for PR" not in text, (
        "scripts.factory.review.fix_text asks to fix a 60 neither observed nor on a boundary"
    )
    [row] = [row for row in text.splitlines() if f"{LAX}:7" in row]
    assert f"owes: {OWED}" in row, (
        f"scripts.factory.review.fix_text files it without its owed check: {row}"
    )


def test_a_user_facing_60_observed_is_in_the_fix_round() -> None:
    text = review.fix_text(12, HEAD, [view(observed=True)])
    assert text.startswith(f"Fix round for PR 12 at {HEAD}:"), (
        f"scripts.factory.review.fix_text does not ask to fix an observed 60: {text!r}"
    )
