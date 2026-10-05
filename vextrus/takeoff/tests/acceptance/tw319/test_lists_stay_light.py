"""Step 1's lists read only what they show (T-W319 section 3, cases 10 to 12): no list view, act or
conflict check loads the anchors (item 4: "Heavy JSON nobody on these screens reads"), and the batch
reads give what the single-sheet reads give (11 and 12 are guards: they pass on main and must still
pass once `proposals()` and `progress()` read in batches)."""

import re
from collections import Counter

import pytest

from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1
from vextrus.testing.drawings import QsProject

from .cost import SMALL, captured, low_confidence, posted, project_of, ready_api

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

# Only drawings' SheetRevision and View have an `anchors` column (vextrus/drawings/models.py).
_SELECTED = re.compile(r"^\s*SELECT\b(?P<columns>.*?)\bFROM\b", re.IGNORECASE | re.DOTALL)


def selects_anchors(sql: str) -> bool:
    found = _SELECTED.match(sql)
    return found is not None and '"anchors"' in found.group("columns")


def test_the_lists_and_an_act_never_select_the_anchors(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    api = ready_api(project)
    with captured() as seen, project.member.acting():
        step1.proposals(project.project_id)
        step1.progress(project.project_id)
        step1.questions(project.project_id)
    with captured() as acted:
        posted(api, f"{project.path}/confirm", {"proposals": [str(project.proposal_of["S-002"])]})()

    loading = [sql for sql in [*seen, *acted] if selects_anchors(sql)]
    assert seen
    assert acted
    assert loading == [], f"{len(loading)} statements select the anchors: {loading[0][:160]}"


def test_each_proposal_shows_the_views_its_sheet_has(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    with project.member.acting():
        shown = step1.proposals(project.project_id)
        expected = {
            p.sheet_id: [
                (v.id, v.ordinal, v.confirmed_kind or v.kind, v.title, list(v.box))
                for v in drawings.views(p.sheet_id)
            ]
            for p in shown
        }

    assert len(shown) == len(project.sheet_of)
    for proposal in shown:
        views = [(v.id, v.ordinal, v.kind, v.title, v.box) for v in proposal.views]
        assert views == expected[proposal.sheet_id], proposal.number
        assert len(views) == 3
        assert all(isinstance(edge, str) for v in proposal.views for edge in v.box)


def test_progress_counts_what_the_lists_show(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    api = ready_api(project)
    question = low_confidence(project, "A-002", "architectural")
    for number in ("S-001", "S-002", "S-003"):
        posted(api, f"{project.path}/confirm", {"proposals": [str(project.proposal_of[number])]})()
    for number in ("S-004", "S-005"):
        posted(
            api,
            f"{project.path}/exclude",
            {"proposals": [str(project.proposal_of[number])], "reason": "other", "text": "Trial"},
        )()

    with project.member.acting():
        listed = step1.proposals(project.project_id)
        asked = step1.questions(project.project_id)
        rows = step1.progress(project.project_id).disciplines
    found = Counter(p.discipline for p in listed)
    decided = Counter(p.discipline for p in listed if p.decision)
    of_sheet = {p.id: p.discipline for p in listed}
    open_rows: Counter[str | None] = Counter()
    for q in asked:
        if q.status == "open":
            for held in {of_sheet[i] for i in q.proposals if i in of_sheet} or {q.discipline}:
                open_rows[held] += 1

    assert [r.discipline for r in rows] == ["structural", "architectural", "electrical"]
    assert any(q.id == question and q.status == "open" for q in asked)
    for row in rows:
        assert row.found == found[row.discipline], row
        assert row.confirmed == decided[row.discipline], row
        assert row.open_questions == open_rows[row.discipline], row
        assert row.status == "in_review", row
    assert {r.discipline: r.confirmed for r in rows} == {
        "structural": 5,
        "architectural": 0,
        "electrical": 0,
    }
    assert {r.discipline: r.open_questions for r in rows}["architectural"] == 1
