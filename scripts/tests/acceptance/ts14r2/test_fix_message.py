"""S14-R2: the fix message comes from the recorded review, by code (factory-next.md 8 row 6:
"`--from-verdict` fix messages"; 6: "`launch say --from-verdict <PR>` builds the fix message from the
ledger, so the orchestrator never reads finding text"; issue #460: "fix/unblock composers fall out of
R2 (`--from-verdict`)").

`python -m scripts.factory.review fix-message <PR> --from-verdict` prints one fix message for the PR's
recorded review: one line for every standing finding (of 50 or more, CONFIRMED or UNPROVEN) naming its
`file:line`, its score and its summary, and nothing of a finding the refuter refuted. A PR with no
recorded review is refused (exit 3, review.py's code for a refusal).

Seam assumed (the orchestrator's brief names it; the authority names only `--from-verdict`): the
subcommand `fix-message <PR> --from-verdict` of `scripts.factory.review`. The refuter's reply is as in
test_refuter.py."""

from collections.abc import Iterator

import pytest

from scripts.tests.acceptance.ts14r2._world import (
    ATTACK,
    PASSING,
    SMALL,
    World,
    fresh,
    item,
    judged,
    mentions,
    names_place,
    review_reply,
    why,
)


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


REPLAYS = "tests/test_count_fails.py"
PASSES = "tests/test_flicker_passes.py"
WRITE = {REPLAYS: ATTACK, PASSES: PASSING}

REPLAYED = item(80, 2, "the badge count leaves out a deleted Element", REPLAYS)
CONFIRMED = item(70, 3, "the badge flickers when the Takeoff reloads", PASSES)
REFUTED = item(60, 1, "the badge shows the count of another Project", None)
UNPROVEN = item(55, 5, "the badge has no accessible name", None)
LOW = item(30, 4, "the badge could carry a tooltip", None)
OTHER = item(90, 2, "the other change loses every Storey", None, file="web/src/components/other.tsx")


def reviewed(world: World) -> None:
    world.pr(12, SMALL)
    world.lenses(
        review_reply("FIX", [REPLAYED, CONFIRMED, REFUTED, UNPROVEN, LOW]),
        write=WRITE,
        refuter={
            "findings": [
                judged(CONFIRMED, "CONFIRMED"),
                judged(REFUTED, "REFUTED"),
                judged(UNPROVEN, "UNPROVEN"),
            ]
        },
    )
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)


def test_the_fix_message_lists_every_standing_finding_with_file_line_score_and_summary(
    world: World,
) -> None:
    reviewed(world)
    done = world.review("fix-message", "12", "--from-verdict")
    assert done.returncode == 0, why(done)
    for found in (REPLAYED, CONFIRMED, UNPROVEN):
        assert mentions(done.stdout, found), (
            f"no line names {found['file']}:{found['line']}, {found['score']} and its summary; "
            f"{why(done)}"
        )


def test_the_fix_message_leaves_out_a_refuted_finding(world: World) -> None:
    reviewed(world)
    done = world.review("fix-message", "12", "--from-verdict")
    assert done.returncode == 0, why(done)
    assert done.stdout.strip(), "no fix message was printed"
    assert REFUTED["summary"] not in done.stdout, why(done)
    assert not names_place(done.stdout, REFUTED), why(done)


def test_the_fix_message_lists_only_that_prs_findings(world: World) -> None:
    reviewed(world)
    world.pr(13, {"web/src/components/other.tsx": "export const Other = () => null\n"})
    world.lenses(review_reply("FIX", [OTHER]))
    other = world.run("13", "--round", "1")
    assert world.records(), why(other)
    done = world.review("fix-message", "12", "--from-verdict")
    assert done.returncode == 0, why(done)
    assert mentions(done.stdout, REPLAYED), why(done)
    assert OTHER["summary"] not in done.stdout, "PR 13's finding is in PR 12's fix message"


def test_a_pr_with_no_recorded_review_gets_no_fix_message(world: World) -> None:
    world.pr(12, SMALL)
    done = world.review("fix-message", "12", "--from-verdict")
    assert done.returncode == 3, why(done)
    assert world.claude_calls() == [], "a lens was started"
