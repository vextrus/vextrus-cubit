"""S15-R3b (issue #521, wanted items 2 and 3): the replay gate can be rerun by a committed driver, not
"a private driver": it reviews each listed PR's head with `review run <PR> --replay-head` and scores the
recall against a committed expected-findings file. S14-R3's gate stands: "recall of at least 90 % is
required" and a finding is matched "within 5 lines of the same file" (#521: "recall 28.1 % (9 of 32)
within 5 lines of the same file").

The seam (named here, beside S14-R3's `--cases <dir> [--reviews <dir>]`, which stays):

    python -m scripts.factory.replay --expected <file>

- The file is a JSON object `{"cases": [{"pr": <int>, "head": "<40 hex>", "confirmed": [{"file": ...,
  "line": <int>, "summary": ...}, ...]}, ...]}`: each PR, the head that was reviewed and the findings
  confirmed on it.
- Run from the main checkout, for each case it runs the PR's replay (`review run <PR> --replay-head`)
  and scores the JSON object the replay prints as `--cases` scores a review result: a confirmed finding
  is recalled by a finding of 50 or more, not REFUTED, in the same file within 5 lines of it.
- It prints `recall NN.N % (...)` over every case together, and exits 1 below 90 %, 0 at 90 % or more.
- Refused, exit 2: a file with no case, and a case whose head is not the PR's head as `gh` gives it (a
  review of another head says nothing about this one).
- Like the replay, it writes no ledger record and posts no PR comment.

The lenses are the world's fake `claude` (no model is called); the PRs are merged in the world.
"""

import json
import subprocess
from collections.abc import Iterator
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts15r3b._world import (
    NORMAL,
    World,
    fresh,
    item,
    review_reply,
    why,
)

TABLE = "vextrus/rates/table.py"
OTHER = "vextrus/rates/other.py"
OTHER_PR = {OTHER: "".join(f"OTHER_{i}: int = {i}\n" for i in range(300))}


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


def case(pr: int, head: str, *confirmed: tuple[str, int]) -> dict[str, object]:
    return {
        "pr": pr,
        "head": head,
        "confirmed": [
            {"file": file, "line": line, "summary": f"confirmed at {file}:{line}"}
            for file, line in confirmed
        ],
    }


def expected(world: World, *cases: dict[str, object]) -> Path:
    path = world.root / "expected.json"
    path.write_text(json.dumps({"cases": list(cases)}))
    return path


def lens_reports(world: World, line: int, file: str = TABLE) -> None:
    """Every lens reports one finding of 75 at `file`:`line` (no repro: the refuter judges nothing)."""
    world.lenses(review_reply("FIX", [item(75, line, "the rate table drops the last rate", None, file)]))


def drive(world: World, path: Path) -> subprocess.CompletedProcess[str]:
    return world.driver("--expected", str(path))


def test_the_driver_replays_each_pr_and_fails_below_the_gate(world: World) -> None:
    first = world.pr(12, NORMAL)
    second = world.pr(13, OTHER_PR)
    world.merge(12)
    world.merge(13)
    lens_reports(world, 43)  # near PR 12's confirmed finding; nothing on PR 13's file
    done = drive(world, expected(world, case(12, first, (TABLE, 40)), case(13, second, (OTHER, 10))))
    assert "recall 50.0 %" in done.stdout, why(done)
    assert done.returncode == 1, why(done)
    replayed = {call["pr"] for call in world.lens_calls()}
    assert replayed == {"12", "13"}, f"the PRs whose heads a lens read: {replayed}; {why(done)}"


def test_the_driver_passes_the_gate_when_every_confirmed_finding_is_found(world: World) -> None:
    head = world.pr(12, NORMAL)
    world.merge(12)
    lens_reports(world, 43)
    done = drive(world, expected(world, case(12, head, (TABLE, 40))))
    assert "recall 100.0 %" in done.stdout, why(done)
    assert done.returncode == 0, why(done)


@pytest.mark.parametrize(
    ("shift", "recall", "code"),
    [(5, "100.0", 0), (-5, "100.0", 0), (6, "0.0", 1)],
    ids=["five-lines-after", "five-lines-before", "six-lines-after"],
)
def test_a_finding_is_matched_within_five_lines_of_the_same_file(
    world: World, shift: int, recall: str, code: int
) -> None:
    head = world.pr(12, NORMAL)
    world.merge(12)
    lens_reports(world, 40 + shift)
    done = drive(world, expected(world, case(12, head, (TABLE, 40))))
    assert f"recall {recall} %" in done.stdout, why(done)
    assert done.returncode == code, why(done)


def test_the_same_line_in_another_file_is_not_recalled(world: World) -> None:
    head = world.pr(12, NORMAL)
    world.merge(12)
    lens_reports(world, 40, file="vextrus/rates/elsewhere.py")
    done = drive(world, expected(world, case(12, head, (TABLE, 40))))
    assert "recall 0.0 %" in done.stdout, why(done)
    assert done.returncode == 1, why(done)


def test_the_driver_writes_no_ledger_record_and_posts_no_comment(world: World) -> None:
    head = world.pr(12, NORMAL)
    world.merge(12)
    lens_reports(world, 40)
    done = drive(world, expected(world, case(12, head, (TABLE, 40))))
    assert "recall 100.0 %" in done.stdout, why(done)
    assert world.ledger_files() == {}, f"the driver wrote to the ledger: {sorted(world.ledger_files())}"
    assert world.comments() == [], f"the driver posted a comment: {world.comments()}"


def test_a_case_whose_head_is_not_the_pr_s_head_is_refused(world: World) -> None:
    world.pr(12, NORMAL)
    world.merge(12)
    lens_reports(world, 40)
    done = drive(world, expected(world, case(12, "ab" * 20, (TABLE, 40))))
    assert done.returncode == 2, why(done)
    assert "recall" not in done.stdout, why(done)


def test_an_expected_file_with_no_case_is_refused(world: World) -> None:
    done = drive(world, expected(world))
    assert done.returncode == 2, why(done)
    assert "recall" not in done.stdout, why(done)
    assert world.claude_calls() == [], "a lens was started with nothing to replay"
