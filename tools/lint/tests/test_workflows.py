"""The workflow check (the M0 plan, 01c; s02 review R3): no workflow but main's not-applicable one can
post the real-drawing or design-gate status, so a PR's own workflow cannot forge it."""

from pathlib import Path

import pytest

from tools.lint.workflows import NOT_APPLICABLE, main, problems

ROOT = Path(__file__).resolve().parents[3]

HARMLESS = """\
name: lint
on: pull_request
permissions:
  contents: read
jobs:
  lint:
    runs-on: ubuntu-24.04
    steps:
      - run: echo hello
"""

NOT_APPLICABLE_OK = """\
name: not-applicable
on:
  pull_request_target:
    types: [opened, synchronize, reopened]
permissions:
  statuses: write
jobs:
  post:
    runs-on: ubuntu-24.04
    steps:
      - run: echo real-drawings design-gate
"""


def plant(root: Path, name: str, text: str) -> Path:
    path = root / ".github" / "workflows" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return path


def test_a_harmless_workflow_passes(tmp_path: Path) -> None:
    plant(tmp_path, "lint.yml", HARMLESS)

    assert problems(tmp_path) == []


def test_a_planted_workflow_that_could_post_real_drawings_fails(tmp_path: Path) -> None:
    plant(
        tmp_path,
        "sneaky.yml",
        HARMLESS.replace("contents: read", "contents: read\n  statuses: write").replace(
            "echo hello", "gh api -f context=real-drawings -f state=success"
        ),
    )

    assert problems(tmp_path) == [
        ".github/workflows/sneaky.yml: requests statuses: write",
        ".github/workflows/sneaky.yml: names real-drawings",
    ]


@pytest.mark.parametrize(
    "permissions",
    ["statuses: write", "statuses:   'write'", '"statuses": "write"', "{ statuses: write }"],
)
def test_statuses_write_is_found_however_it_is_written(tmp_path: Path, permissions: str) -> None:
    plant(tmp_path, "a.yml", HARMLESS.replace("contents: read", permissions))

    assert problems(tmp_path) == [".github/workflows/a.yml: requests statuses: write"]


def test_write_all_requests_statuses_write_too(tmp_path: Path) -> None:
    plant(
        tmp_path, "a.yaml", HARMLESS.replace("permissions:\n  contents: read", "permissions: write-all")
    )

    assert problems(tmp_path) == [".github/workflows/a.yaml: requests statuses: write"]


def test_a_job_named_design_gate_fails(tmp_path: Path) -> None:
    plant(tmp_path, "a.yml", HARMLESS.replace("  lint:\n", "  lint:\n    name: Design-Gate\n"))

    assert problems(tmp_path) == [".github/workflows/a.yml: names design-gate"]


def test_a_local_action_is_checked_as_a_workflow_is(tmp_path: Path) -> None:
    action = tmp_path / ".github" / "actions" / "post" / "action.yml"
    action.parent.mkdir(parents=True)
    action.write_text("runs:\n  using: composite\n  steps:\n    - run: echo real-drawings\n")

    assert problems(tmp_path) == [".github/actions/post/action.yml: names real-drawings"]


def test_the_not_applicable_workflow_may_post_both(tmp_path: Path) -> None:
    plant(tmp_path, NOT_APPLICABLE, NOT_APPLICABLE_OK)

    assert problems(tmp_path) == []


@pytest.mark.parametrize(
    "trigger",
    [
        "on:\n  pull_request:\n  pull_request_target:\n",
        "on: [pull_request_target, push]\n",
        "on: pull_request\n",
        "on:\n  workflow_dispatch:\n",
    ],
)
def test_the_not_applicable_workflow_runs_only_on_pull_request_target(
    tmp_path: Path, trigger: str
) -> None:
    text = NOT_APPLICABLE_OK.replace(
        "on:\n  pull_request_target:\n    types: [opened, synchronize, reopened]\n", trigger
    )
    plant(tmp_path, NOT_APPLICABLE, text)

    assert problems(tmp_path) == [
        f".github/workflows/{NOT_APPLICABLE}: runs on something other than pull_request_target"
    ]


def test_the_not_applicable_workflow_may_list_its_one_trigger_inline(tmp_path: Path) -> None:
    text = NOT_APPLICABLE_OK.replace(
        "on:\n  pull_request_target:\n    types: [opened, synchronize, reopened]\n",
        "on: [pull_request_target]\n",
    )
    plant(tmp_path, NOT_APPLICABLE, text)

    assert problems(tmp_path) == []


def test_this_repository_passes(capsys: pytest.CaptureFixture[str]) -> None:
    assert main([str(ROOT)]) == 0, capsys.readouterr().out
