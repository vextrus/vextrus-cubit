"""The builder's tests for scripts/walk/measures.py and the checks it feeds, beyond the acceptance
tests (synthetic data only: invented files, numbers and titles).

They pin the choices the ticket leaves to the builder: a measured walk still matches walk.schema.json;
a malformed expectation never raises out of `attach`; Sheets and Questions of no Discipline sit in the
`none` row; a listed stale pair with a Sheet absent counts (it cannot be shown grouped); a share
times N is compared with slack; a failed act counts whether or not a read ran.
"""

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from scripts.walk import measures, ready, schema, verdict

SHA = "89abcdef0123456789abcdef0123456789abcdef"
STARTED = "2026-10-05T03:00:00Z"
TIMES = {"started_at": STARTED, "finished_at": "2026-10-05T04:00:00Z"}
LAYER = {"items": [{"item": f"M0-FL{n}", "status": "PASS"} for n in (*range(1, 12), 13)], "findings": []}


def _sheet(sid: str, number: str, discipline: str | None = "plumbing", **change: Any) -> dict[str, Any]:
    return {
        "id": sid,
        "file": "oscar.dwg",
        "number": number,
        "title": f"Invented Riser {number}",
        "discipline": discipline,
        "layout": True,
        "proposed_exclusion": None,
        "held": False,
        "agrees": True,
        "storeys": [],
        "storeys_titled": None,
        **change,
    }


def _question(qid: str, code: str, *held: str, discipline: str | None = "plumbing") -> dict[str, Any]:
    return {
        "id": qid,
        "kind": "conflict",
        "status": "open",
        "code": code,
        "check_code": None,
        "discipline": discipline,
        "proposals": list(held),
    }


def _entry(n: int = 10) -> dict[str, Any]:
    return {
        "acts_before_snapshot": 0,
        "sheets": [_sheet(f"p{k}", f"P-{k:02d}") for k in range(1, n + 1)],
        "questions": [],
        "bulk_after_gaps": {},
    }


def _expect(**change: Any) -> dict[str, Any]:
    return {
        "files": 1,
        "p95_ms_max": 900,
        "act_max_ms": 2500,
        "act_samples_min": 1,
        "questions_max_per_discipline": 3,
        "bulk_confirmable_share_min": 0.7,
        "false_continuation_max": 0,
        "phantom_sheets_max": 0,
        "stale_title_grouped_max": 0,
        "storeys_wrong_max": 0,
        "sheets_per_discipline": {"plumbing": 10},
        "true_questions": [],
        "stale_title_pairs": [],
        "storeys": [],
        **change,
    }


def _walk() -> dict[str, Any]:
    return {
        "schema": 1,
        "sha": SHA,
        "started_at": STARTED,
        "urls": {"web": "http://127.0.0.1:5511", "api": "http://127.0.0.1:8811"},
        "sets": {
            "set-c": {
                "files": [{"id": 1, "state": "done", "read_seconds": 9}],
                "acts": [
                    {"kind": kind, "ms": 70, "read_running": True, "status": 201}
                    for kind in ("confirm", "undo", "exclude", "answer")
                ],
                "questions": {},
                "burden": {},
            }
        },
    }


def _attach(tmp_path: Path, entry: dict[str, Any], expect: dict[str, Any]) -> dict[str, Any]:
    snapshot = {"schema": 1, "sha": SHA, "started_at": STARTED, "sets": {"set-c": entry}}
    (tmp_path / "snapshot.json").write_text(json.dumps(snapshot))
    found: dict[str, Any] = measures.attach(_walk(), tmp_path, {"set-c": expect})
    return found


def _judge(tmp_path: Path, entry: dict[str, Any], expect: dict[str, Any]) -> dict[str, Any]:
    judged: dict[str, Any] = verdict.evaluate(
        _attach(tmp_path, entry, expect), {"set-c": expect}, LAYER, ref="main", leak_hits=0, **TIMES
    )
    assert schema.verdict_errors(judged) == []
    assert ready.consistent(judged) is True
    return judged


def _status(judged: dict[str, Any], name: str) -> str:
    [found] = [c for c in judged["checks"] if c["check"] == name]
    status: str = found["status"]
    return status


def test_a_measured_walk_still_matches_its_schema(tmp_path: Path) -> None:
    entry = _entry()
    entry["questions"].append(
        {**_question("g1", "engine.register_check.gap", "p2"), "kind": "missing"}
    )  # no count after the gap's answer: a null bulk count

    measured = _attach(tmp_path, entry, _expect())

    assert schema.walk_errors(measured) == []
    assert measured["sets"]["set-c"]["burden"]["plumbing"]["bulk_confirmable"] is None


@pytest.mark.parametrize(
    "bad",
    [
        {"true_questions": "none"},
        {"true_questions": [{"discipline": "plumbing", "code": 7, "sheets": "P-01"}]},
        {"sheets_per_discipline": {"plumbing": -2}},
        {"storeys": [{"file": "oscar.dwg"}]},
        {"stale_title_pairs": [None]},
    ],
)
def test_attach_never_raises_on_a_malformed_expectation(tmp_path: Path, bad: dict[str, Any]) -> None:
    measured = _attach(tmp_path, _entry(), _expect(**bad))

    assert measured["sets"]["set-c"]["measures"] == {"unmeasured": 1}
    with pytest.raises(verdict.Malformed):
        verdict.evaluate(measured, {"set-c": _expect(**bad)}, LAYER, ref="main", leak_hits=0, **TIMES)


def test_sheets_and_questions_of_no_discipline_sit_in_the_none_row(tmp_path: Path) -> None:
    entry = _entry()
    entry["sheets"].append(_sheet("x1", "X-01", None))
    entry["questions"].append(_question("c1", measures.SAME_NUMBER, "x1", "p1", discipline=None))

    judged = _judge(tmp_path, entry, _expect())

    [none] = [r for r in judged["burden"] if r["discipline"] == "none"]
    assert (none["sheets"], none["sheets_expected"], none["false_continuation_questions"]) == (
        1,
        None,
        1,
    )
    assert _status(judged, "sheets_match") == "FAIL"
    assert _status(judged, "false_continuations") == "FAIL"


def test_a_listed_stale_pair_with_a_sheet_absent_counts(tmp_path: Path) -> None:
    pair = {
        "discipline": "plumbing",
        "sheets": [{"file": "oscar.dwg", "number": "P-01"}, {"file": "oscar.dwg", "number": "P-99"}],
    }

    measured = _attach(tmp_path, _entry(), _expect(stale_title_pairs=[pair]))

    assert measured["sets"]["set-c"]["measures"]["stale_grouped"] == 1


def test_a_share_times_n_is_compared_with_slack(tmp_path: Path) -> None:
    entry = _entry()
    for sheet in entry["sheets"][7:]:
        sheet["agrees"] = False  # 7 of 10 at a share of 0.7 (0.7 * 10 is 7.000000000000001)

    assert _status(_judge(tmp_path, entry, _expect()), "bulk_confirmable_share") == "PASS"


def test_a_failed_act_fails_whether_or_not_a_read_ran(tmp_path: Path) -> None:
    walk = _attach(tmp_path, _entry(), _expect())
    walk["sets"]["set-c"]["acts"].append(
        {"kind": "answer", "ms": 40, "read_running": False, "status": 409}
    )

    judged = verdict.evaluate(walk, {"set-c": _expect()}, LAYER, ref="main", leak_hits=0, **TIMES)

    [acts] = [c for c in judged["checks"] if c["check"] == "act_p95_during_read"]
    assert (acts["measured"]["failed_acts"], acts["status"]) == (1, "FAIL")


def test_a_walk_record_claiming_its_own_measures_is_measured_afresh(tmp_path: Path) -> None:
    walk = _walk()
    walk["sets"]["set-c"]["measures"] = {"unmeasured": 0, **dict.fromkeys(measures.MEASURES[1:], 0)}
    forged = copy.deepcopy(walk)

    measured = measures.attach(forged, tmp_path, {"set-c": _expect()})  # no snapshot.json here

    assert measured["sets"]["set-c"]["measures"] == {"unmeasured": 1}


def test_gaps_answered_join_the_bulk_count_after_their_answer(tmp_path: Path) -> None:
    entry = _entry()
    for sheet in entry["sheets"]:
        sheet["agrees"] = False
    entry["questions"].append({**_question("g1", "engine.register_check.gaps", "p4"), "kind": "missing"})
    entry["bulk_after_gaps"] = {"plumbing": 9}

    judged = _judge(tmp_path, entry, _expect())

    [row] = [r for r in judged["burden"] if r["discipline"] == "plumbing"]
    assert (row["bulk_confirmable_sheets"], row["machine_doubt_questions"]) == (9, 1)
    assert _status(judged, "bulk_confirmable_share") == "PASS"


@pytest.mark.parametrize("status", ["OPEN", "pending", "", None])
def test_a_question_status_the_product_never_gives_leaves_the_set_unmeasured(
    tmp_path: Path, status: Any
) -> None:
    entry = _entry()
    entry["questions"].append({**_question("c1", measures.SAME_TITLE, "p1", "p2"), "status": status})

    measured = _attach(tmp_path, entry, _expect())

    assert measured["sets"]["set-c"]["measures"] == {"unmeasured": 1}


@pytest.mark.parametrize("blank", ["title", "number", "proposed_exclusion"])
def test_an_untitled_sheet_reading_empty_text_is_measured(tmp_path: Path, blank: str) -> None:
    entry = _entry()
    entry["sheets"][0][blank] = ""  # the API's untitled Sheet, as an older snapshot holds it

    measured = _attach(tmp_path, entry, _expect())

    assert measured["sets"]["set-c"]["measures"]["unmeasured"] == 0


@pytest.mark.parametrize("views", [["not_stated"], []])
def test_a_view_that_states_no_storey_falls_back_to_the_title(tmp_path: Path, views: list[str]) -> None:
    entry = _entry()
    entry["sheets"][0].update(storeys=views, storeys_titled=["U2", "U3"])
    listed = [{"file": "oscar.dwg", "number": "P-01", "storeys": ["U3", "U2"]}]

    measured = _attach(tmp_path, entry, _expect(storeys=listed))

    assert measured["sets"]["set-c"]["measures"]["storeys_wrong"] == 0


STALE_PAIR = [{"file": "oscar.dwg", "number": "P-01"}, {"file": "oscar.dwg", "number": "P-02"}]
STALE_CASES = {
    # case: (titles of P-01 and P-02, the Question added, true_questions_raised, stale_grouped)
    "raised-as-same-title": (
        ("Invented Riser Schedule",) * 2,
        ("conflict", measures.SAME_TITLE, ["p2", "p1"]),
        "PASS",
        0,
    ),
    "untitled-raised": ((None, None), ("conflict", measures.SAME_TITLE, ["p1", "p2"]), "PASS", 0),
    "grouped-silently": (("Invented Riser Schedule",) * 2, None, "FAIL", 1),
    "held-by-another-kind": (
        ("Invented Riser Schedule",) * 2,
        ("low_confidence", "takeoff.step1.which_kind", ["p1", "p2"]),
        "FAIL",
        0,
    ),
    "same-title-with-a-third-sheet": (
        ("Invented Riser Schedule",) * 2,
        ("conflict", measures.SAME_TITLE, ["p1", "p2", "p3"]),
        "FAIL",
        0,
    ),
    "titles-differ-not-raised": (("Invented Riser A", "Invented Riser B"), None, "FAIL", 0),
}


@pytest.mark.parametrize("case", sorted(STALE_CASES))
def test_a_stale_pair_is_raised_only_as_a_same_title_conflict_over_its_two_sheets(
    tmp_path: Path, case: str
) -> None:
    titles, added, raised, stale = STALE_CASES[case]
    entry = _entry()
    for sheet, title in zip(entry["sheets"][:2], titles, strict=True):
        sheet["title"] = title
    if added is not None:
        kind, code, held = added
        entry["questions"].append({**_question("c1", code, *held), "kind": kind})
    expect = _expect(
        true_questions=[{"discipline": "plumbing", "code": measures.SAME_TITLE, "sheets": STALE_PAIR}],
        stale_title_pairs=[{"discipline": "plumbing", "sheets": STALE_PAIR}],
    )

    judged = _judge(tmp_path, entry, expect)

    [false] = [c for c in judged["checks"] if c["check"] == "false_continuations"]
    assert false["measured"]["stale_grouped"] == stale
    assert _status(judged, "true_questions_raised") == raised


def test_an_agent_project_that_carries_an_act_is_refused() -> None:
    walk = _walk()
    walk["sets"]["set-c"]["project_acts"] = 0
    assert schema.walk_errors(walk) == []

    walk["sets"]["set-c"]["project_acts"] = 1
    assert schema.walk_errors(walk) != []
    with pytest.raises(verdict.Malformed):
        verdict.evaluate(walk, {"set-c": _expect()}, LAYER, ref="main", leak_hits=0, **TIMES)


def test_a_withdrawn_question_never_groups_a_stale_pair(tmp_path: Path) -> None:
    entry = _entry()
    for sheet in entry["sheets"][:2]:
        sheet["title"] = "Invented Riser Schedule"
    entry["questions"].append(
        {**_question("w1", measures.SAME_TITLE, "p1", "p2"), "status": "withdrawn"}
    )
    pair = [{"file": "oscar.dwg", "number": "P-01"}, {"file": "oscar.dwg", "number": "P-02"}]

    measured = _attach(
        tmp_path, entry, _expect(stale_title_pairs=[{"discipline": "plumbing", "sheets": pair}])
    )

    assert measured["sets"]["set-c"]["measures"]["stale_grouped"] == 1


@pytest.mark.parametrize(
    ("before", "bulk"), [(0, 9), (3, None)], ids=["gap-answers-only", "after-other-acts"]
)
def test_a_bulk_count_read_after_other_acts_is_refused(
    tmp_path: Path, before: int, bulk: int | None
) -> None:
    entry = _entry()
    entry["questions"].append({**_question("g1", "engine.register_check.gap", "p3"), "kind": "missing"})
    entry.update(bulk_after_gaps={"plumbing": 9}, acts_before_bulk=before)

    measured = _attach(tmp_path, entry, _expect())

    assert measured["sets"]["set-c"]["burden"]["plumbing"]["bulk_confirmable"] == bulk
    judged = verdict.evaluate(measured, {"set-c": _expect()}, LAYER, ref="main", leak_hits=0, **TIMES)
    [share] = [c for c in judged["checks"] if c["check"] == "bulk_confirmable_share"]
    assert share["measured"].get("unmeasured", 0) == (0 if before == 0 else 1)
