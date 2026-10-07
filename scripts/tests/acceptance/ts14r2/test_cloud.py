"""S14-R2: `review.py run <PR> --where cloud` hands the lenses to cloud reviewers.

Authority: factory-next.md 8 row 6 ("`--where cloud` hook-up"), 4 ("`review.py run <PR> [--round n]
… [--where local|cloud]`") and 6 ("cloud reviewers via `review_cloud.py` as `--where cloud`");
research/review.md 2 H ("The reviewer pushes one verdict file; `ledger fetch-verdict` checks parent,
path, nonce, head"); CLAUDE.md's Law (sessions start only through `scripts.factory.launch`, run from
the main checkout as `uv run python -m scripts.factory.launch cloud …`);
docs/specs/factory/contracts/launch-cli.md (`--review-file` is `{"pr", "head_sha", "nonce"}` for
`--role reviewer`).

- No local `claude` lens process starts; each lens of the tier is one cloud launch (a normal PR: lens A
  and lens B), each `uv run python -m scripts.factory.launch cloud … --role reviewer` from the main
  checkout, with the lens's model and effort from the map.
- Each launch's `--branch` is on origin and holds the PR's head; its `--review-file` names the PR and
  the head; its prompt names the head and never the ledger.
- The hand-off records no verdict: the cloud reviewer has not answered yet.

The launcher is faked (the fake `uv`): nothing is launched; its argv and the files it names are kept."""

import json
import subprocess
from collections.abc import Iterator
from typing import Any

import pytest

from scripts.tests.acceptance.ts14r2._world import NORMAL, World, flag, fresh, why


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


HANG_GUARD = 120


def handed_off(world: World) -> tuple[str, list[dict[str, Any]], subprocess.CompletedProcess[str]]:
    head = world.pr(12, NORMAL)
    done = world.run("12", "--round", "1", "--where", "cloud", hang=HANG_GUARD)
    launches = world.launch_calls()
    assert launches, f"no cloud launch; {why(done)}"
    return head, launches, done


def launcher_args(call: dict[str, Any]) -> list[str]:
    """The arguments after `uv run python -m scripts.factory.launch`."""
    argv: list[str] = call["argv"]
    assert argv[:1] == ["run"], argv
    at = argv.index("scripts.factory.launch")
    assert argv[at - 1] == "-m", argv
    assert argv[at - 2].startswith("python"), argv
    return argv[at + 1 :]


def test_where_cloud_starts_no_local_lens(world: World) -> None:
    _, _, done = handed_off(world)
    assert world.claude_calls() == [], f"a local claude process was started; {why(done)}"


def test_where_cloud_launches_one_cloud_reviewer_per_lens_on_the_map_s_model(world: World) -> None:
    _, launches, _ = handed_off(world)
    models = sorted(
        (flag(launcher_args(c), "--model"), flag(launcher_args(c), "--effort")) for c in launches
    )
    assert models == sorted([("claude-opus-5-5", "high"), ("claude-sonnet-5-5", "high")]), models


def test_each_cloud_reviewer_is_launched_as_role_reviewer_through_launch_cloud_from_the_main_checkout(
    world: World,
) -> None:
    _, launches, _ = handed_off(world)
    for call in launches:
        args = launcher_args(call)
        assert args[:1] == ["cloud"], args
        assert flag(args, "--role") == "reviewer", args
        assert call["cwd"] == str(world.main), call["cwd"]


def test_each_cloud_reviewer_s_branch_is_on_origin_and_holds_the_head(world: World) -> None:
    head, launches, _ = handed_off(world)
    for call in launches:
        branch = flag(launcher_args(call), "--branch")
        assert branch, call["argv"]
        tip = subprocess.run(
            ["git", "-C", str(world.origin), "rev-parse", "--verify", f"refs/heads/{branch}"],
            capture_output=True,
            text=True,
            check=False,
        )
        assert tip.returncode == 0, f"{branch} is not on origin"
        holds = subprocess.run(
            ["git", "-C", str(world.origin), "merge-base", "--is-ancestor", head, tip.stdout.strip()],
            check=False,
        )
        assert holds.returncode == 0, f"{branch} does not hold the PR's head"


def test_each_cloud_reviewer_s_review_file_names_the_pr_and_its_head(world: World) -> None:
    head, launches, _ = handed_off(world)
    for call in launches:
        assert call["review"] is not None, f"no readable --review-file: {call['argv']}"
        review = json.loads(call["review"])
        assert review.get("pr") == 12, review
        assert review.get("head_sha") == head, review


def test_each_cloud_reviewer_s_prompt_names_the_head_and_never_the_ledger(world: World) -> None:
    head, launches, _ = handed_off(world)
    for call in launches:
        assert call["prompt"] is not None, f"no readable --prompt-file: {call['argv']}"
        assert head in call["prompt"]
        assert "ledger" not in call["prompt"].lower()


def test_the_cloud_hand_off_records_no_verdict(world: World) -> None:
    head, _, done = handed_off(world)
    assert world.record(12, head) is None, why(done)
    assert world.comments() == []
