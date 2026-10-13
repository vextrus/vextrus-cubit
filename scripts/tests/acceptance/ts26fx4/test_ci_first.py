"""S26-FX7: no lens starts on a head whose required CI is red: the review is refused, nothing recorded,
no spend (session 26's brief, "The factory fixes": "no lens starts on a head whose CI is red"; session
25's retrospective: three runs refused for red CI after their lenses ran, $12.05).

`review.py` already refuses a head whose `ci` has failed when it starts (S14-R1's test_start.py). The
runs that spent were heads whose `ci` had not finished when the review began and failed while the
lenses ran, refused only at the end. So a head whose `ci` is still running starts no lens: the review
waits for it to finish or refuses, and when it ends red nothing is recorded and no `claude` ran
(`merge_ready`: "no check run ... is still running"). The fake `gh` answers the checks as running on
its first `pr view` and red on every later read.
"""

import pytest

from scripts.tests.acceptance.ts14r1._world import SMALL, why
from scripts.tests.acceptance.ts26fx4._world import PENDING_STATES, PR, DeltaWorld, pending


@pytest.mark.parametrize("state", sorted(PENDING_STATES))
def test_a_head_whose_ci_has_not_finished_and_fails_starts_no_lens_and_records_nothing(
    tmp_path_factory: pytest.TempPathFactory, state: str
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    head = world.pr(PR, SMALL, rollup=pending(state))
    world.ci_flips_red()
    done = world.run(str(PR), "--round", "1")
    assert done.returncode == 3, why(done)
    assert world.claude_calls() == [], "a lens started on a head whose CI was not green"
    assert world.record(PR, head) is None
    assert world.comments() == []
    assert all(float(line.get("total_cost_usd") or 0) == 0 for line in world.cost_lines())
