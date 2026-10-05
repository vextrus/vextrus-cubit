"""land's ledger reading, beside the acceptance tests."""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.land import Gh, Refused, failed_tests, has_pass, order, pending, red, reviewed

HEAD = "0123456789abcdef0123456789abcdef01234567"


def write(store: Path, **fields: object) -> None:
    record = {"pr": 12, "head": HEAD, "round": 1, "verdict": "PASS", "exception": None} | fields
    (store / f"12-{HEAD}.json").write_text(json.dumps(record))


def test_a_round_three_pass_needs_its_exception(tmp_path: Path) -> None:
    write(tmp_path, round=3)
    assert not has_pass(tmp_path, 12, HEAD)
    write(tmp_path, round=3, exception={"kind": "crash", "reason": "x"})
    assert has_pass(tmp_path, 12, HEAD)


def test_a_record_for_another_pr_or_an_unreadable_one_is_no_pass(tmp_path: Path) -> None:
    write(tmp_path, pr=13)
    assert not has_pass(tmp_path, 12, HEAD)
    (tmp_path / f"12-{HEAD}.json").write_text("{")
    assert not has_pass(tmp_path, 12, HEAD)


def test_order_with_nothing_passing_is_empty() -> None:
    assert order([{"number": 1, "engine": True, "pass": False}]) == []


def test_failed_tests_reads_pytest_and_vitest_lines_once_each() -> None:
    log = "\n".join(
        [
            "job\tstep\t2026-10-05T03:09:31Z FAILED vextrus/a/tests/test_x.py::test_one - assert 1",
            "job\tstep\t2026-10-05T03:09:32Z FAILED vextrus/a/tests/test_x.py::test_one - assert 1",
            "FAILED vextrus/a/tests/test_x.py::TestCase::test_two[case-1] - KeyError",
            "FAILED vextrus/a/tests/test_x.py::test_three",
            " FAIL  src/takeoff/acts.test.tsx > acts > says the 16 were confirmed",
            " FAIL  web/src/b.test.tsx > draws it",
            "1 failed, 214 passed",
        ]
    )
    assert failed_tests(log) == [
        "vextrus/a/tests/test_x.py :: test_one",
        "vextrus/a/tests/test_x.py :: TestCase::test_two",
        "vextrus/a/tests/test_x.py :: test_three",
        "web/src/takeoff/acts.test.tsx :: says the 16 were confirmed",
        "web/src/b.test.tsx :: draws it",
    ]
    assert failed_tests("##[error]Process completed with exit code 1.") == []


def test_reviewed_refuses_an_unreadable_record_and_an_empty_ledger(tmp_path: Path) -> None:
    other = "f" * 40
    assert not reviewed(tmp_path / "none", 12, HEAD, repo=tmp_path)
    (tmp_path / f"12-{other}.json").write_text("{")
    assert not reviewed(tmp_path, 12, HEAD, repo=tmp_path)
    write(tmp_path)
    assert reviewed(tmp_path, 12, HEAD, repo=tmp_path), "the exact head's PASS needs no other record"


def test_reviewed_ignores_files_not_named_for_a_head(tmp_path: Path) -> None:
    (tmp_path / "12-notes.json").write_text("{")
    assert not reviewed(tmp_path, 12, HEAD, repo=tmp_path / "no-repo")


class Stuck(Gh):
    """CI that never settles: always pending on the PR's head."""

    def head_sha(self, pr: int) -> str:
        return HEAD

    def rollup(self, pr: int) -> dict[str, Any]:
        return {
            "headRefOid": HEAD,
            "statusCheckRollup": [{"__typename": "CheckRun", "status": "QUEUED"}],
        }


def test_ci_that_never_settles_is_refused_after_the_poll_limit(tmp_path: Path) -> None:
    sleeps: list[float] = []
    with pytest.raises(Refused, match="did not settle"):
        Stuck(tmp_path, sleep=sleeps.append, polls=4).wait_ci(12)
    assert sleeps == [20, 20, 20]


def test_an_unknown_conclusion_is_red_and_pending_contexts_wait() -> None:
    assert red({"__typename": "CheckRun", "conclusion": "STALE"})
    assert not red({"__typename": "CheckRun", "conclusion": "NEUTRAL"})
    assert red({"__typename": "StatusContext", "state": "ERROR"})
    assert pending({"__typename": "StatusContext", "state": "EXPECTED"})
    assert not pending({"__typename": "StatusContext", "state": "SUCCESS"})


def test_merge_refuses_before_ci_was_read(tmp_path: Path) -> None:
    with pytest.raises(Refused, match="CI was not read"):
        Stuck(tmp_path).merge(12)
