"""scripts/walk/continuations.py: the matching rule, the counting rule and what cannot be measured.

Synthetic data only (invented file names and sheet numbers); no clock, no network.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.walk import continuations as c

SHA = "0123456789abcdef0123456789abcdef01234567"
STARTED = "2026-10-05T01:00:00Z"
TITLE = "engine.conflicts.same_title"
STOREY = "engine.conflicts.same_storey"


def _sheet(number: str, file: str = "A.dwg", plot_page: int | None = None) -> dict[str, Any]:
    sheet: dict[str, Any] = {"file": file, "page": 1, "sheet_number": number}
    if plot_page is not None:
        sheet["plot_page"] = plot_page
    return sheet


def _truth_file(tmp_path: Path, sets: dict[str, Any], schema: int = 1) -> Path:
    path = tmp_path / "continuations.json"
    path.write_text(json.dumps({"schema": schema, "sets": sets}))
    return path


def _truth(groups: list[dict[str, Any]], near: list[dict[str, Any]] | None = None) -> c.Truth:
    return c.Truth(c._entries(groups, "title_form", c.FORMS), c._entries(near or [], "why", None))


def _group(form: str, *sheets: dict[str, Any], discipline: str = "structural") -> dict[str, Any]:
    return {"discipline": discipline, "title_form": form, "title": "never read", "sheets": list(sheets)}


@pytest.mark.parametrize(
    ("proposal", "sheet", "matched"),
    [
        (("A.dwg", "S-1", 2), ("A.dwg", "S-1", 2), True),
        (("A.dwg", "S-1", None), ("A.dwg", "S-1", 2), True),
        (("A.dwg", "S-1", 2), ("A.dwg", "S-1", None), True),
        (("A.dwg", "S-1", 3), ("A.dwg", "S-1", 2), False),
        (("B.dwg", "S-1", 2), ("A.dwg", "S-1", 2), False),
        (("A.dwg", "S-2", 2), ("A.dwg", "S-1", 2), False),
        (("A.dwg", None, None), ("A.dwg", "S-1", None), False),
    ],
)
def test_a_proposal_matches_by_file_number_and_plot_page_when_both_have_one(
    proposal: c.Key, sheet: c.Key, matched: bool
) -> None:
    assert c.matches(proposal, sheet) is matched


def test_the_judged_count_is_same_groups_only_and_the_qs_view_every_group() -> None:
    truth = _truth(
        [
            _group("same", _sheet("S-1"), _sheet("S-2")),
            _group("mark_range", _sheet("A-1"), _sheet("A-2"), discipline="architectural"),
        ],
        [{"discipline": "structural", "why": "unsure", "sheets": [_sheet("S-8"), _sheet("S-9")]}],
    )
    questions: list[tuple[str, list[c.Key]]] = [
        (TITLE, [("A.dwg", "S-1", None), ("A.dwg", "S-2", None)]),
        (STOREY, [("A.dwg", "A-1", None), ("A.dwg", "A-2", None)]),
        (TITLE, [("A.dwg", "S-8", None), ("A.dwg", "S-9", None)]),
        ("engine.conflicts.same_number", [("A.dwg", "S-1", None), ("A.dwg", "S-2", None)]),
        (TITLE, [("A.dwg", "S-1", None)]),
    ]

    assert c.count(questions, truth) == {
        "structural": {c.JUDGED: 1, c.QS_VIEW: 1, c.UNSURE_COUNT: 1},
        "architectural": {c.JUDGED: 0, c.QS_VIEW: 1, c.UNSURE_COUNT: 0},
    }


def test_a_question_inside_two_groups_cannot_be_measured() -> None:
    truth = _truth(
        [_group("same", _sheet("S-1"), _sheet("S-2")), _group("same", _sheet("S-1"), _sheet("S-2"))]
    )
    with pytest.raises(c.Unmeasurable):
        c.count([(TITLE, [("A.dwg", "S-1", None), ("A.dwg", "S-2", None)])], truth)


def test_load_truth_keeps_no_title(tmp_path: Path) -> None:
    path = _truth_file(
        tmp_path, {"set-a": {"groups": [_group("same", _sheet("S-1"))], "near_misses": []}}
    )
    loaded = c.load_truth(path)
    assert "never read" not in repr(loaded)
    assert loaded["set-a"].groups[0].sheets == (("A.dwg", "S-1", None),)


@pytest.mark.parametrize(
    "broken",
    [
        {"groups": [_group("rough", _sheet("S-1"))], "near_misses": []},
        {"groups": [_group("same", _sheet("S-1"), discipline="Not A Code")], "near_misses": []},
        {"groups": [_group("same")], "near_misses": []},
        {"groups": [_group("same", {"file": "A.dwg", "sheet_number": 7})], "near_misses": []},
        {"groups": [_group("same", _sheet("S-1") | {"plot_page": "2"})], "near_misses": []},
        {"groups": [_group("same", _sheet("S-1"))]},
    ],
    ids=["unknown-title-form", "discipline", "no-sheets", "number-not-text", "page-not-int", "no-near"],
)
def test_a_malformed_truth_is_refused(tmp_path: Path, broken: dict[str, Any]) -> None:
    with pytest.raises(c.Unmeasurable):
        c.load_truth(_truth_file(tmp_path, {"set-a": broken}))


def test_a_truth_of_another_schema_is_refused(tmp_path: Path) -> None:
    with pytest.raises(c.Unmeasurable):
        c.load_truth(_truth_file(tmp_path, {}, schema=3))


def _walk() -> dict[str, Any]:
    row = {
        "sheets": 2,
        "one_source": 0,
        "bulk_confirmable": 2,
        "continuation_questions": 0,
        c.JUDGED: None,
    }
    return {
        "schema": 1,
        "sha": SHA,
        "started_at": STARTED,
        "sets": {"set-a": {"burden": {"structural": dict(row)}}, "set-b": {"burden": {"x1": row}}},
    }


def test_attach_counts_each_measurable_set_and_leaves_the_rest(tmp_path: Path) -> None:
    _truth_file(
        tmp_path,
        {"set-a": {"groups": [_group("same", _sheet("S-1"), _sheet("S-2"))], "near_misses": []}},
    )
    (tmp_path / "conflicts.json").write_text(
        json.dumps(
            {
                "schema": 1,
                "sha": SHA,
                "started_at": STARTED,
                "sets": {
                    "set-a": {
                        "questions": [
                            {
                                "code": TITLE,
                                "proposals": [
                                    {"file": "A.dwg", "number": "S-1", "plot_page": None},
                                    {"file": "A.dwg", "number": "S-2", "plot_page": 4},
                                ],
                            }
                        ]
                    },
                    "set-b": {"questions": []},
                },
            }
        )
    )
    walk = _walk()

    counted = c.attach(walk, tmp_path, tmp_path)

    assert counted["sets"]["set-a"]["burden"]["structural"][c.JUDGED] == 1
    assert counted["sets"]["set-b"] == walk["sets"]["set-b"], "a set the truth lacks was changed"
    assert walk == _walk()


def test_attach_without_its_files_changes_nothing(tmp_path: Path) -> None:
    assert c.attach(_walk(), tmp_path, tmp_path) == _walk()
    assert c.attach(["not a walk"], tmp_path, tmp_path) == ["not a walk"]


def test_a_malformed_set_in_conflicts_json_leaves_only_that_set_unmeasured(tmp_path: Path) -> None:
    group = {"groups": [_group("same", _sheet("S-1"), _sheet("S-2"))], "near_misses": []}
    _truth_file(tmp_path, {"set-a": group, "set-b": group})
    inside = [
        {"file": "A.dwg", "number": "S-1", "plot_page": None},
        {"file": "A.dwg", "number": "S-2", "plot_page": None},
    ]
    (tmp_path / "conflicts.json").write_text(
        json.dumps(
            {
                "schema": 1,
                "sha": SHA,
                "started_at": STARTED,
                "sets": {
                    "set-a": {"questions": [{"code": TITLE, "proposals": inside}]},
                    "set-b": {"questions": [{"code": TITLE, "proposals": [inside[0], None]}]},
                },
            }
        )
    )
    walk = _walk()
    walk["sets"]["set-b"]["burden"] = {"structural": dict(walk["sets"]["set-a"]["burden"]["structural"])}

    counted = c.attach(walk, tmp_path, tmp_path)

    assert counted["sets"]["set-a"]["burden"]["structural"][c.JUDGED] == 1
    assert counted["sets"]["set-b"] == walk["sets"]["set-b"]


def _three() -> c.Truth:
    """A `same` group of three sheets in one file, each on its own plot page."""
    return _truth([_group("same", *(_sheet(f"S-0{n}", plot_page=n) for n in (1, 2, 3)))])


@pytest.mark.parametrize(
    "third",
    [("A.dwg", "S-O3", 3), ("A.dwg", None, 3), ("A.dwg", None, None)],
    ids=["a-misread-number", "no-number-on-its-plot-page", "no-number-and-no-plot-page"],
)
def test_a_question_over_a_group_with_a_misread_sheet_cannot_be_measured(third: c.Key) -> None:
    proposals = [("A.dwg", "S-01", 1), ("A.dwg", "S-02", 2), third]
    with pytest.raises(c.Unmeasurable):
        c.count([(TITLE, proposals)], _three())


def test_a_misread_sheet_leaves_its_set_null_through_attach(tmp_path: Path) -> None:
    sheets = [_sheet(f"S-0{n}", plot_page=n) for n in (1, 2, 3)]
    _truth_file(tmp_path, {"set-a": {"groups": [_group("same", *sheets)], "near_misses": []}})
    keys = [{"file": "A.dwg", "number": n, "plot_page": p} for n, p in (("S-01", 1), ("S-O3", 3))]
    (tmp_path / "conflicts.json").write_text(
        json.dumps(
            {
                "schema": 1,
                "sha": SHA,
                "started_at": STARTED,
                "sets": {"set-a": {"questions": [{"code": TITLE, "proposals": keys}]}},
            }
        )
    )

    counted = c.attach(_walk(), tmp_path, tmp_path)

    assert counted["sets"]["set-a"]["burden"]["structural"][c.JUDGED] is None


@pytest.mark.parametrize(
    "outside",
    [("B.dwg", "S-09", 3), ("A.dwg", "S-09", 7), ("B.dwg", None, None)],
    ids=["another-file", "another-plot-page", "no-number-in-a-file-with-no-group"],
)
def test_a_proposal_that_cannot_be_a_group_sheet_counts_nothing_and_stays_measured(
    outside: c.Key,
) -> None:
    proposals = [("A.dwg", "S-01", 1), ("A.dwg", "S-02", 2), outside]
    assert c.count([(TITLE, proposals)], _three()) == {}
    assert c.count([(TITLE, proposals[:2])], _three())["structural"][c.JUDGED] == 1


def test_doubt_only_matters_for_a_question_that_could_count() -> None:
    misread: list[c.Key] = [("A.dwg", "S-01", 1), ("A.dwg", "S-O3", 3)]
    assert c.count([("engine.conflicts.same_number", misread), (TITLE, misread[:1])], _three()) == {}


def _schema_2(file_sheets: object) -> dict[str, Any]:
    """A schema 2 set: a page-less `same` group of S-1 and S-2 in A.dwg."""
    return {
        "groups": [_group("same", _sheet("S-1"), _sheet("S-2"))],
        "near_misses": [],
        "file_sheets": file_sheets,
    }


@pytest.mark.parametrize(
    ("third", "doubt"),
    [
        (("A.dwg", "S-3", None), False),
        (("A.dwg", "S-O2", None), True),
        (("A.dwg", None, None), True),
        (("B.dwg", "S-O2", None), False),
    ],
    ids=["a-listed-outside-sheet", "a-number-its-file-lacks", "no-number", "a-file-with-no-group"],
)
def test_schema_2_a_number_its_file_does_not_hold_is_doubt(
    tmp_path: Path, third: c.Key, doubt: bool
) -> None:
    path = _truth_file(tmp_path, {"set-a": _schema_2({"A.dwg": ["S-3", "S-2", "S-1"]})}, schema=2)
    truth = c.load_truth(path)["set-a"]
    questions: list[tuple[str, list[c.Key]]] = [
        (STOREY, [("A.dwg", "S-1", None), ("A.dwg", "S-2", None), third])
    ]

    if doubt:
        with pytest.raises(c.Unmeasurable):
            c.count(questions, truth)
    else:
        assert c.count(questions, truth) == {}
    assert c.count([(STOREY, questions[0][1][:2])], truth)["structural"][c.JUDGED] == 1


@pytest.mark.parametrize(
    "file_sheets",
    [None, {"A.dwg": ["S-1"]}, {"B.dwg": ["S-1", "S-2"]}, {"A.dwg": "S-1 S-2"}, {"A.dwg": [1, 2]}],
    ids=["absent", "a-group-number-missing", "the-group-file-missing", "not-a-list", "not-text"],
)
def test_schema_2_file_sheets_without_every_group_sheet_is_refused(
    tmp_path: Path, file_sheets: object
) -> None:
    with pytest.raises(c.Unmeasurable):
        c.load_truth(_truth_file(tmp_path, {"set-a": _schema_2(file_sheets)}, schema=2))


def test_schema_1_ignores_file_sheets(tmp_path: Path) -> None:
    path = _truth_file(tmp_path, {"set-a": _schema_2({"B.dwg": []})}, schema=1)
    truth = c.load_truth(path)["set-a"]
    assert truth.file_sheets is None
    proposals: list[c.Key] = [("A.dwg", "S-1", None), ("A.dwg", "S-2", None), ("A.dwg", "S-O2", None)]
    assert c.count([(TITLE, proposals)], truth) == {}
