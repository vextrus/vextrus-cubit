"""merge-ready (ADR 0041): the orchestrator merges only when both gates were posted by the App (or main's
not-applicable workflow) and every check passed."""

import copy
from typing import Any

import pytest

from scripts.merge_ready import main, problems

HEAD = "0123456789abcdef0123456789abcdef01234567"


def status(
    context: str, login: str = "vextrus-status", state: str = "SUCCESS", text: str = ""
) -> dict[str, Any]:
    return {"context": context, "state": state, "description": text, "creator": {"login": login}}


def check(name: str, conclusion: str | None = "SUCCESS", state: str = "COMPLETED") -> dict[str, Any]:
    return {"name": name, "status": state, "conclusion": conclusion}


def pull(
    contexts: list[dict[str, Any]], runs: list[dict[str, Any]] | None = None, state: str = "OPEN"
) -> dict[str, Any]:
    runs = [check("ci"), check("python"), check("check-sandbox", "SKIPPED")] if runs is None else runs
    return {
        "state": state,
        "headRefOid": HEAD,
        "commits": {
            "nodes": [
                {
                    "commit": {
                        "oid": HEAD,
                        "status": {"contexts": contexts},
                        "checkSuites": {
                            "nodes": [{"checkRuns": {"nodes": []}}, {"checkRuns": {"nodes": runs}}]
                        },
                    }
                }
            ]
        },
    }


READY = pull([status("real-drawings"), status("design-gate")])


def test_both_gates_by_the_app_and_green_checks_are_ready() -> None:
    assert problems(READY) == []
    assert main(["105"], get=lambda pr: READY) == 0


def test_not_applicable_from_mains_workflow_is_ready() -> None:
    na = "Not applicable: this PR changes no engine path"
    assert (
        problems(pull([status("real-drawings", "github-actions", text=na), status("design-gate")])) == []
    )


@pytest.mark.parametrize("login", ["riz", "someone-else", "github-actions", ""])
def test_a_gate_posted_by_anyone_else_is_refused(login: str) -> None:
    [problem] = problems(
        pull([status("real-drawings"), status("design-gate", login, text="passed 1-11")])
    )
    assert problem.startswith("design-gate: posted by")


def test_a_missing_or_failed_gate_is_refused() -> None:
    assert problems(pull([status("design-gate")])) == ["real-drawings: not posted"]
    failed = pull([status("real-drawings", state="FAILURE"), status("design-gate")])
    assert problems(failed) == ["real-drawings: failure"]


def test_a_failed_pending_or_missing_check_is_refused() -> None:
    gates = [status("real-drawings"), status("design-gate")]
    assert problems(pull(gates, [check("ci"), check("python", "FAILURE")])) == ["check python: failure"]
    assert problems(pull(gates, [check("ci"), check("web", None, "IN_PROGRESS")])) == [
        "check web: in_progress"
    ]
    assert problems(pull(gates, [check("python")])) == ["ci: not succeeded"]


def test_statuses_of_an_older_head_or_a_closed_pr_are_refused() -> None:
    stale = copy.deepcopy(READY)
    stale["headRefOid"] = "f" * 40
    assert problems(stale) == ["the statuses read are not the head's: run again"]
    assert problems(pull([], state="MERGED")) == ["the PR is merged, not open"]
    assert main(["x"], get=lambda pr: READY) == 2
    assert main(["105"], get=lambda pr: pull([])) == 1
