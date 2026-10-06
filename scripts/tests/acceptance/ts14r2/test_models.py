"""S14-R2: each `claude -p` process runs on the model and effort of the map, with its caps
(factory-next.md 2 "Per-lens table" and 3; the owner's Q1, 5 Oct 2026: lens A (depth) Opus 5.5 high,
lens B (adversary), the words gate and the refuter Sonnet 5.5 high; research/review.md 3 step 4: each
lens is `claude -p … --output-format json --json-schema <REVIEW schema> … --max-turns <T>
--max-budget-usd <B> --no-session-persistence`).

The tier decides the lenses (S14-R1): a small PR gets lens B only; a normal PR lens A and lens B; a
change under `web/src/messages/` adds the `ux-critic` words lens."""

import json
from collections.abc import Iterator

import pytest

from scripts.tests.acceptance.ts14r2._world import (
    NORMAL,
    SMALL,
    WORDS,
    World,
    flag,
    fresh,
    model_effort,
    why,
)


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


OPUS = ("claude-opus-5-5", "high")
SONNET = ("claude-sonnet-5-5", "high")


def test_a_normal_pr_runs_lens_a_on_opus_5_5_high_and_lens_b_on_sonnet_5_5_high(world: World) -> None:
    world.pr(12, NORMAL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    lenses = [model_effort(call) for call in world.lens_calls()]
    assert sorted(lenses) == sorted([OPUS, SONNET]), lenses


def test_the_one_lens_of_a_small_pr_runs_on_sonnet_5_5_high(world: World) -> None:
    world.pr(12, SMALL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert [model_effort(call) for call in world.lens_calls()] == [SONNET]


def test_the_words_lens_runs_on_sonnet_5_5_high(world: World) -> None:
    world.pr(12, WORDS)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    words = [model_effort(call) for call in world.claude_calls() if call["agent"] == "ux-critic"]
    assert words == [SONNET], words


def test_every_lens_process_is_capped_and_answers_in_the_review_schema(world: World) -> None:
    world.pr(12, WORDS)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    calls = world.lens_calls()
    assert len(calls) == 3, f"{len(calls)} lens processes"
    for call in calls:
        argv = call["argv"]
        label = f"{call['agent']} on {flag(argv, '--model')}"
        assert "-p" in argv or "--print" in argv, f"{label} is not a headless run"
        assert flag(argv, "--output-format") == "json", label
        schema = flag(argv, "--json-schema")
        assert schema is not None, f"{label} has no --json-schema"
        assert {"verdict", "head", "findings"} <= set(json.loads(schema).get("required", [])), label
        turns = flag(argv, "--max-turns")
        assert turns is not None, f"{label} has no --max-turns cap"
        assert int(turns) > 0, f"{label} has no --max-turns cap"
        budget = flag(argv, "--max-budget-usd")
        assert budget is not None, f"{label} has no --max-budget-usd cap"
        assert float(budget) > 0, f"{label} has no --max-budget-usd cap"
        assert "--no-session-persistence" in argv, label
