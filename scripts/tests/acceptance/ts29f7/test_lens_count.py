"""S29-F7 item 2 (docs/plans/factory-s29.md 7: "ordinary PRs get one clean-context lens plus CI"; the
owner's rulings Q5 and Q15, 14 Oct 2026: "One lens plus CI for ordinary PRs; the full panel on a risk
tier written down as paths").

At `scripts.factory.review run`'s boundary (S14-R1's world: a fake `claude` logs each lens it starts,
the cost line names the tier): a model-reviewed PR is `ordinary` (one review lens) unless one of its
paths is on the risk tier (`scripts.factory.tiers.is_risk`), when it is `risk` (lens A and lens B, as
the old `normal` tier). Size no longer matters: a long view component is ordinary. A change under
`web/src/messages/` still adds the `ux-critic` words lens on either tier.

Every PR here is one the old tiers called `normal` (two lenses): 150 lines or more, or a test file."""

from typing import Any

import pytest

from scripts.tests.acceptance.ts14r1._world import World, why

LONG_VIEW = {
    "web/src/components/table.tsx": "".join(f"export const ROW_{i} = {i}\n" for i in range(600))
}
VIEW_TEST = {
    "web/src/components/badge.test.tsx": "import { it } from 'vitest'\n\nit('counts', () => {})\n"
}
ENGINE = {"engine/recognise/walls.py": "".join(f"WALL_{i}: int = {i}\n" for i in range(600))}
WORDS = {"web/src/messages/rates.ts": "export const rates = { title: 'Rates' }\n"}


def reviewers(world: World) -> list[str]:
    return [call["agent"] for call in world.lens_calls() if call["agent"] != "ux-critic"]


def words_lenses(world: World) -> list[dict[str, Any]]:
    return [call for call in world.lens_calls() if call["agent"] == "ux-critic"]


def reviewed(world: World, pr: int, changes: dict[str, str]) -> dict[str, Any]:
    world.pr(pr, changes)
    done = world.run(str(pr), "--round", "1")
    assert done.returncode == 0, why(done)
    [cost] = world.cost_lines()
    return cost


@pytest.mark.parametrize("changes", [LONG_VIEW, VIEW_TEST], ids=["a long view", "a view's test"])
def test_an_ordinary_pr_gets_one_lens(
    changes: dict[str, str], tmp_path_factory: pytest.TempPathFactory
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    cost = reviewed(world, 12, changes)
    assert len(reviewers(world)) == 1, (
        f"scripts.factory.review gives an ordinary PR {len(reviewers(world))} lenses: {reviewers(world)}"
    )
    assert cost.get("tier") == "ordinary", (
        f"scripts.factory.review names an ordinary PR's tier {cost.get('tier')!r}"
    )


def test_a_risk_pr_gets_both_lenses(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    cost = reviewed(world, 12, ENGINE)
    assert len(reviewers(world)) == 2, (
        f"scripts.factory.review gives a risk PR {len(reviewers(world))} lenses: {reviewers(world)}"
    )
    assert cost.get("tier") == "risk", (
        f"scripts.factory.review names a risk PR's tier {cost.get('tier')!r}"
    )


def test_one_risk_path_gives_a_mixed_pr_both_lenses(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    cost = reviewed(world, 12, LONG_VIEW | {"engine/recognise/walls.py": "WALL: int = 1\n"})
    assert len(reviewers(world)) == 2, (
        f"scripts.factory.review gives a mixed PR {len(reviewers(world))} lenses: {reviewers(world)}"
    )
    assert cost.get("tier") == "risk", (
        f"scripts.factory.review names a mixed PR's tier {cost.get('tier')!r}"
    )


def test_an_ordinary_pr_changing_the_messages_gets_one_lens_and_the_words_lens(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    cost = reviewed(world, 12, LONG_VIEW | WORDS)
    assert (len(reviewers(world)), len(words_lenses(world))) == (1, 1), (
        f"scripts.factory.review gives an ordinary PR with words "
        f"{[call['agent'] for call in world.lens_calls()]}"
    )
    assert cost.get("tier") == "ordinary", (
        f"scripts.factory.review names an ordinary PR's tier {cost.get('tier')!r}"
    )
