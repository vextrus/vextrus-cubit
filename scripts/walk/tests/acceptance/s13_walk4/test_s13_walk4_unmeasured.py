"""T-WALK-4 acceptance, case 11: a set the snapshot cannot measure reads as unmeasured, not a plain FAIL.

"A missing, unreadable, schema-wrong or another walk's snapshot.json (its sha, started_at), a set not in
it, acts_before_snapshot != 0, a Question holding an id no Sheet has, or a malformed entry makes that set
measures.unmeasured = 1; each of the six snapshot-derived checks ... then has status FAIL (not UNSET,
not PASS) and measured.unmeasured == 1, and the verdict is still written. With the expectation key
missing, UNSET wins." Synthetic data only.
"""

import json
from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    FINISHED,
    SET_A,
    SET_B,
    SHA,
    SNAPSHOT_CHECKS,
    check,
    judged,
    lay_out,
    main_argv,
    measures,
    snapshot,
    standard_expect,
    standard_set,
    walk,
)


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    from scripts.walk import verdict

    monkeypatch.setattr(verdict, "utc_now", lambda: FINISHED)


def _sets() -> dict[str, dict[str, Any]]:
    return {SET_A: standard_set(), SET_B: standard_set()}


def _snap(case: str) -> dict[str, Any] | str | None:
    """The snapshot.json of each unmeasurable case (None: no file; a str: its text)."""
    sets = _sets()
    made: dict[str, Any]
    match case:
        case "absent":
            return None
        case "unreadable":
            return '{"schema": 1, "sets": '
        case "schema-2":
            made = snapshot(sets, schema=2)
        case "another-walks-sha":
            made = snapshot(sets, sha="fedcba9876543210fedcba9876543210fedcba98")
        case "another-started-at":
            made = snapshot(sets, started_at="2026-10-04T23:00:00Z")
        case _:
            raise AssertionError(case)
    return made


def _one_set(case: str) -> dict[str, Any]:
    """A snapshot in which set-a alone cannot be measured (set-b is sound)."""
    sets = _sets()
    entry = sets[SET_A]
    match case:
        case "set-not-in-it":
            del sets[SET_A]
        case "acts-before-snapshot":
            entry["acts_before_snapshot"] = 1
        case "unknown-sheet-id":
            entry["questions"][1]["proposals"].append("s-nowhere")
        case "sheet-without-agrees":
            del entry["sheets"][4]["agrees"]
        case "questions-not-a-list":
            entry["questions"] = {"q1": "open"}
        case _:
            raise AssertionError(case)
    made: dict[str, Any] = snapshot(sets)
    return made


def _assert_unmeasured(verdict: dict[str, Any], set_: str) -> None:
    for name in SNAPSHOT_CHECKS:
        found = check(verdict, name, set_)
        assert found["status"] == "FAIL", (name, found)
        assert found["measured"].get("unmeasured") == 1, (name, found)
    for name in ("reads_complete", "act_p95_during_read"):
        assert check(verdict, name, set_)["status"] == "PASS", name


WHOLE = ("absent", "unreadable", "schema-2", "another-walks-sha", "another-started-at")
ONE = (
    "set-not-in-it",
    "acts-before-snapshot",
    "unknown-sheet-id",
    "sheet-without-agrees",
    "questions-not-a-list",
)


@pytest.mark.parametrize("case", WHOLE)
def test_a_snapshot_that_is_not_this_walks_leaves_every_set_unmeasured(
    tmp_path: Path, case: str
) -> None:
    from scripts.walk import verdict as verdict_module

    walks, expect_dir = lay_out(
        tmp_path, _sets(), {SET_A: standard_expect(), SET_B: standard_expect()}, snap=_snap(case)
    )

    code = verdict_module.main(main_argv(walks, expect_dir))

    written = walks / SHA / "verdict.json"
    assert written.exists(), f"exit {code}, no verdict written"
    verdict = json.loads(written.read_text())
    assert code == 1
    assert verdict["result"] == "FAIL"
    for set_ in (SET_A, SET_B):
        _assert_unmeasured(verdict, set_)


@pytest.mark.parametrize("case", ONE)
def test_a_set_the_snapshot_cannot_measure_is_unmeasured_alone(tmp_path: Path, case: str) -> None:
    from scripts.walk import verdict as verdict_module

    walks, expect_dir = lay_out(
        tmp_path, _sets(), {SET_A: standard_expect(), SET_B: standard_expect()}, snap=_one_set(case)
    )

    code = verdict_module.main(main_argv(walks, expect_dir))

    written = walks / SHA / "verdict.json"
    assert written.exists(), f"exit {code}, no verdict written"
    verdict = json.loads(written.read_text())
    assert code == 1
    _assert_unmeasured(verdict, SET_A)
    for name in SNAPSHOT_CHECKS:
        assert check(verdict, name, SET_B)["status"] == "PASS", name


def test_attach_marks_an_unmeasurable_set_and_keeps_its_rows(tmp_path: Path) -> None:
    sets = _sets()
    folder = tmp_path / "folder"
    folder.mkdir()
    (folder / "snapshot.json").write_text(json.dumps(_one_set("acts-before-snapshot")))
    given = walk(sets)

    measured = measures().attach(given, folder, {SET_A: standard_expect(), SET_B: standard_expect()})

    assert measured["sets"][SET_A]["measures"] == {"unmeasured": 1}
    assert measured["sets"][SET_A]["burden"] == given["sets"][SET_A]["burden"]
    assert measured["sets"][SET_B]["measures"]["unmeasured"] == 0


@pytest.mark.parametrize("snap", ["default", None], ids=["measured", "snapshot-absent"])
def test_a_missing_expectation_key_is_unset_never_unmeasured(tmp_path: Path, snap: str | None) -> None:
    expect = standard_expect()
    del expect["sheets_per_discipline"]
    del expect["storeys_wrong_max"]

    verdict = judged(tmp_path, {SET_A: standard_set()}, {SET_A: expect}, snap=snap)

    for name in ("sheets_match", "storeys_match"):
        unset = check(verdict, name)
        assert unset["status"] == "UNSET", (name, unset)
        assert unset["expected"] is None
        if snap is not None:
            assert unset["measured"].get("unmeasured", 0) == 0, (name, unset)
