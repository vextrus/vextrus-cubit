"""Ticket 21c, the whole Step 1 through the API (docs/plans/M0.md, 21c: "the whole-Step-1 API test ...
(upload, read, proposals, a Question, bulk Confirmation, Coverage 0 unaccounted, idempotent re-upload,
cancel, restart, a stalled job retried, a file held raising `file_misread`, an MEP sheet confirmed with
its view assigned to its Part, a file of a new Discipline opening only its own Step 1 while Structural
stays confirmed, a second Developer sees nothing, a member given one Project sees no other, no title
with `%%`, every Question a code with an English message)").

Here on invented sheets read by the engine's own finders from hand-built artefacts (no toolchain; the
same on a DWG written by the repo's writer is `test_step1_whole_toolchain.py`). The held file, the
Question and the MEP and new-Discipline cases are in `test_step1_questions.py` and
`test_step1_disciplines.py`.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from engine.recognise import views as view_finder
from vextrus.drawings import services as drawings
from vextrus.takeoff.models import Coverage, Proposal, ProposalTrace, Question
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, drawing
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

from .step1_whole import (
    NOT_FOUND,
    Sheet,
    confirm,
    coverage,
    english,
    files_path,
    jev_says,
    no_raw_code,
    open_questions,
    progress,
    proposals,
    questions,
    readers,
    run_job,
    seen,
    sheet_ids,
    step1,
    upload,
    uploaded,
)

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
CLEAN = {
    STRUCTURAL: [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet(
            "S-02",
            "GROUND FLOOR BEAM LAYOUT PLAN",
            ("GROUND FLOOR BEAM LAYOUT PLAN", "TYPICAL BEAM SECTION"),
        ),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ]
}
"""Three structural sheets numbered without a gap, every view with a subject 17 proposes to a step:
four views, none unaccounted, nothing to ask."""
VIEWS = 4


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    """Jev answers every sheet's kind surely (a stand-in: nothing leaves the machine)."""
    jev_says(jev_offline, "0.97")


def read_clean(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, STRUCTURAL)
    run_job(qs.member, file_id, monkeypatch, readers(CLEAN))
    return file_id


def proposed_by_the_job(listed: list[dict[str, Any]]) -> None:
    """The premise of a test on what the job wrote: sheets are listed, each a Proposal of its own
    (19a lists a sheet no job has proposed under the printed sheet's id)."""
    assert listed, "no sheet is listed"
    assert all(p["id"] != p["sheet_id"] for p in listed), "the read job proposed no sheet"


def views_recorded(member: Member, file_id: uuid.UUID) -> set[uuid.UUID]:
    with member.acting():
        found = drawings.file(file_id)
        return {
            v.id
            for s in drawings.sheets(found.set_id)
            if s.file_id == file_id
            for v in drawings.views(s.id)
        }


# Upload, read, propose ------------------------------------------------------------------------------


def test_a_file_uploaded_through_the_api_and_read_has_each_sheet_proposed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read_clean(qs_project, monkeypatch)

    listed = proposals(api_as(qs_project.member), qs_project.project_id)
    assert [(p["discipline"], p["number"]) for p in listed] == [
        ("structural", "S-01"),
        ("structural", "S-02"),
        ("structural", "S-03"),
    ]
    # Each is a Proposal the read job wrote, named by its own id (19a names a sheet no job has
    # proposed by the printed sheet's id).
    assert all(p["id"] != p["sheet_id"] for p in listed)
    assert all(p["decision"] is None for p in listed)


def test_the_job_proposes_each_sheet_and_each_view_with_their_traces(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "Proposals for sheets and views with their Traces" (the plan, 21c)."""
    file_id = read_clean(qs_project, monkeypatch)
    listed = proposals(api_as(qs_project.member), qs_project.project_id)
    views = views_recorded(qs_project.member, file_id)
    assert len(views) == VIEWS

    with qs_project.member.acting():
        by_sheet = Proposal.objects.filter(project_id=qs_project.project_id, subject="sheet")
        by_view = Proposal.objects.filter(project_id=qs_project.project_id, subject="view")
        assert {str(p.subject_id) for p in by_sheet} == sheet_ids(listed)
        assert {p.subject_id for p in by_view} == views
        for proposal in [*by_sheet, *by_view]:
            assert ProposalTrace.objects.filter(proposal=proposal).exists(), (
                f"the {proposal.subject} proposal {proposal.subject_id} has no Trace"
            )


def test_every_view_read_is_counted_once_in_coverage_as_proposed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read_clean(qs_project, monkeypatch)

    shown = coverage(api_as(qs_project.member), qs_project.project_id)
    counts = ("views", "assigned", "excluded", "proposed", "unaccounted", "used")
    assert {k: shown[k] for k in counts} == {
        "views": VIEWS, "assigned": 0, "excluded": 0, "proposed": VIEWS, "unaccounted": 0, "used": 0,
    }  # fmt: skip
    assert shown["by_step"] == {"foundations": 1, "beams": 2, "columns": 1}


# The bulk act and Coverage ---------------------------------------------------------------------------


def test_one_bulk_confirmation_leaves_no_view_proposed_or_unaccounted(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read_clean(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    ids = [p["id"] for p in proposals(api, qs_project.project_id)]

    response = confirm(api, qs_project.project_id, ids)

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 3
    shown = coverage(api, qs_project.project_id)
    assert (shown["views"], shown["assigned"], shown["proposed"], shown["unaccounted"]) == (
        VIEWS,
        VIEWS,
        0,
        0,
    )
    assert shown["unaccounted_views"] == []


def test_a_discipline_with_every_sheet_confirmed_and_nothing_open_is_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens 6.11: "A Discipline's Step 1 is confirmed when none of its files is reading, every
    sheet of it is confirmed or excluded, none of its Questions is open or kept open, and none of its
    views is unaccounted"."""
    read_clean(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert open_questions(api, qs_project.project_id) == []
    assert progress(api, qs_project.project_id)["structural"]["status"] == "in_review"

    confirm(api, qs_project.project_id, [p["id"] for p in proposals(api, qs_project.project_id)])

    row = progress(api, qs_project.project_id)["structural"]
    assert (row["status"], row["confirmed"], row["total"], row["open_questions"]) == (
        "confirmed",
        3,
        3,
        0,
    )


# The same file again, cancel and restart, a job tried again ----------------------------------------


def test_uploading_the_same_file_again_changes_nothing_in_step_1(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    content = drawing("dwg", "the same structural file")
    file_id = uploaded(qs_project.member, qs_project.project_id, STRUCTURAL, content)
    run_job(qs_project.member, file_id, monkeypatch, readers(CLEAN))
    api = api_as(qs_project.member)
    before = seen(api, qs_project.project_id)
    proposed_by_the_job(before.proposals)

    again = upload(qs_project.member, qs_project.project_id, STRUCTURAL, content)
    run_job(qs_project.member, file_id, monkeypatch, readers(CLEAN))

    assert again.status_code == 200, again.content
    assert again.json()["outcome"] == "already_here"
    assert seen(api, qs_project.project_id) == before


def test_a_cancelled_file_puts_nothing_in_step_1_and_its_restart_proposes_its_sheets(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = uploaded(qs_project.member, qs_project.project_id, STRUCTURAL)
    api = api_as(qs_project.member)

    cancelled = api.post(f"{files_path(qs_project.project_id)}/{file_id}/cancel")
    assert cancelled.status_code == 200, cancelled.content
    assert proposals(api, qs_project.project_id) == []
    assert coverage(api, qs_project.project_id)["views"] == 0

    restarted = api.post(f"{files_path(qs_project.project_id)}/{file_id}/restart")
    assert restarted.status_code == 200, restarted.content
    run_job(qs_project.member, file_id, monkeypatch, readers(CLEAN))

    assert [p["number"] for p in proposals(api, qs_project.project_id)] == ["S-01", "S-02", "S-03"]
    assert coverage(api, qs_project.project_id)["views"] == VIEWS


def test_a_job_tried_again_after_its_worker_died_proposes_each_sheet_once(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The worker dies while reading the second sheet's views (the stalled-job retrier then tries the
    job again): the next try finishes Step 1, and nothing it proposes, asks or counts is doubled."""
    file_id = uploaded(qs_project.member, qs_project.project_id, STRUCTURAL)
    original = view_finder.find
    calls = {"n": 0}

    def dies_once(*args: Any, **kwargs: Any) -> Any:
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("the worker died here, as the test asks")
        return original(*args, **kwargs)

    monkeypatch.setattr(view_finder, "find", dies_once)
    with pytest.raises(RuntimeError, match="the worker died"):
        run_job(qs_project.member, file_id, monkeypatch, readers(CLEAN), attempts=0)

    run_job(qs_project.member, file_id, monkeypatch, readers(CLEAN), attempts=1)

    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    assert [p["number"] for p in listed] == ["S-01", "S-02", "S-03"]
    assert all(p["id"] != p["sheet_id"] for p in listed)
    with qs_project.member.acting():
        assert Proposal.objects.filter(project_id=qs_project.project_id, subject="sheet").count() == 3
        assert Coverage.objects.filter(project_id=qs_project.project_id).count() == VIEWS
        assert drawings.file(file_id).state == drawings.FileState.READ
    assert coverage(api, qs_project.project_id)["views"] == VIEWS


# Tenancy walls ---------------------------------------------------------------------------------------


def test_a_second_developer_sees_nothing_of_step_1(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    read_clean(qs_project, monkeypatch)
    proposed_by_the_job(proposals(api_as(qs_project.member), qs_project.project_id))
    other = sign_in(role="qs")
    assert other.developer_id != qs_project.member.developer_id
    api = api_as(other)

    for part in ("proposals", "questions", "coverage", "progress"):
        response = api.get(f"{step1(qs_project.project_id)}/{part}")
        assert response.status_code == 404, (part, response.content)
        assert response.json() == NOT_FOUND
    with other.acting():
        assert not Proposal.objects.filter(project_id=qs_project.project_id).exists()
        assert not Question.objects.filter(project_id=qs_project.project_id).exists()
        assert not Coverage.objects.filter(project_id=qs_project.project_id).exists()


def test_a_second_developer_cannot_act_on_or_answer_anything_in_step_1(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    read_clean(qs_project, monkeypatch)
    mine = api_as(qs_project.member)
    ids = [p["id"] for p in proposals(mine, qs_project.project_id)]
    other = api_as(sign_in(role="qs"))

    refused = other.post(f"{step1(qs_project.project_id)}/confirm", {"proposals": ids})
    answered = other.post(
        f"{step1(qs_project.project_id)}/questions/{uuid.uuid4()}/answer", {"option": "keep_open"}
    )

    assert (refused.status_code, refused.json()) == (404, NOT_FOUND)
    assert (answered.status_code, answered.json()) == (404, NOT_FOUND)
    assert all(p["decision"] is None for p in proposals(mine, qs_project.project_id))


def test_a_member_given_one_project_finds_no_other(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    read_clean(qs_project, monkeypatch)
    proposed_by_the_job(proposals(api_as(qs_project.member), qs_project.project_id))
    from vextrus.projects import services as projects

    with qs_project.member.acting():
        elsewhere = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project").id
    scoped = sign_in(role="qs", developer_id=qs_project.member.developer_id, projects=[elsewhere])
    api = api_as(scoped)

    assert api.get(f"{step1(elsewhere)}/proposals").status_code == 200
    for part in ("proposals", "questions", "coverage", "progress"):
        response = api.get(f"{step1(qs_project.project_id)}/{part}")
        assert (response.status_code, response.json()) == (404, NOT_FOUND), part


# What the QS reads -----------------------------------------------------------------------------------


MESSY = {
    STRUCTURAL: [
        Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=(
            ("S-01", "GENERAL NOTES"), ("S-02", "PILE CAP LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"),
            ("S-04", "ROOF BEAM LAYOUT PLAN"),
        )),
        Sheet("S-02", "PILE CAP %%C600 LAYOUT PLAN", ("PILE CAP LAYOUT PLAN",)),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1"),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0"),
        Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
        Sheet("S-05", "BEAM %%%% LAYOUT", ("ROOF BEAM LAYOUT PLAN",)),
    ]
}  # fmt: skip
"""A drawing list naming S-04, which no file has; S-02's title with a diameter code (decoded); two
copies of S-03; a sheet with no number; S-05 whose title keeps a raw `%%` (21b leaves it out, #135)."""


def test_no_title_or_question_the_qs_reads_holds_a_raw_drawing_code(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = uploaded(qs_project.member, qs_project.project_id, STRUCTURAL)
    run_job(qs_project.member, file_id, monkeypatch, readers(MESSY))
    api = api_as(qs_project.member)

    listed = proposals(api, qs_project.project_id)
    proposed_by_the_job(listed)
    assert "S-02" in [p["number"] for p in listed]
    assert no_raw_code([p["title"] for p in listed])
    assert no_raw_code(questions(api, qs_project.project_id))
    assert no_raw_code(coverage(api, qs_project.project_id))


def test_every_question_is_a_code_and_parameters_with_its_english_in_the_catalogue(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = uploaded(qs_project.member, qs_project.project_id, STRUCTURAL)
    run_job(qs_project.member, file_id, monkeypatch, readers(MESSY))
    held = uploaded(qs_project.member, qs_project.project_id, "KR-STR-old.dwg")
    run_job(
        qs_project.member,
        held,
        monkeypatch,
        readers(MESSY | {"KR-STR-old.dwg": MESSY[STRUCTURAL]}, held=["KR-STR-old.dwg"]),
    )

    asked = questions(api_as(qs_project.member), qs_project.project_id)

    assert {q["kind"] for q in asked} >= {"file_misread", "conflict", "missing", "check"}
    for q in asked:
        assert isinstance(q["params"], dict)
        words = english(q["code"])
        assert words, f"the {q['kind']} Question's code {q['code']} has no English in the catalogue"
