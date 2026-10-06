"""Ticket S15-A6 (#546), its Discipline half: a Discipline correction moves its Views (#189), and clears
the stale "held" words (#190) and "choice undone" (#191).

The issues' promises:
- #189: "Correcting a wrong General default moves the sheets but leaves the views in Step 2. Ruling
  (session 08): never widen the grants; re-run the file's proposal/coverage steps as a job". The
  QS's correction moves the file's Views out of Step 2 (Coverage follows); the strict xfail
  `vextrus/takeoff/tests/test_general_discipline.py::test_a_wrong_general_default_corrected_proposes_
  the_files_views_again` pinned it until now (the builder removes it).
- #190: "for a QUARANTINED file read anyway the report's Readers line then falls back to
  `engine.decoders_agree.disagree` ('nothing from it reaches the sheet list'), which is false". A
  held file read anyway keeps its "read anyway" Readers line through a Discipline change.
- #191: "after an undo a file that fell back to General keeps the line forever (the select already
  shows General)". Choosing the Discipline the file already has answers the choice undone.

Every test goes through the API the web calls and the read job, on 21c's invented sheets
(`t21c/step1_whole`; no toolchain, no real drawing). The Disciplines are found by their English
names in the Market's library (`GET .../drawings/disciplines`), as t159's tests find General. Where the
re-run is a job (the ruling's "as a job"), the jobs the correction queued are run here, as a worker
would run them, before the result is read; a correction that re-runs in its own transaction needs none.
"""

import json
import uuid
from typing import Any

import pytest
from django.db import connection

from vextrus.drawings.messages import files as file_words
from vextrus.drawings.messages import reports as report_words
from vextrus.platform.services import jobs, tenancy
from vextrus.takeoff import library as takeoff_library
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    a_file,
    answer,
    confirm,
    coverage,
    files_path,
    got,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db

STEP_2 = takeoff_library.STEPS[1].key
"""Step 2, the general notes (ADR 0007's second Takeoff Step)."""

TAKEN = "KR-STR-R0.dwg"
TAKEN_SHEETS = [
    Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("02", "COLUMN SCHEDULE", ()),
]
"""A Structural file read first: its sheets take Structural's numbers 01 and 02."""

NOTES = "KR-SET3-R0.dwg"
NOTES_SHEETS = [Sheet(f"{n:02d}", f"GENERAL NOTES {n}", ("GENERAL NOTES",)) for n in range(1, 4)]
"""A bare-numbered series of general notes, 01 to 03 (the General default's own)."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def key_of(api: Any, project_id: uuid.UUID, english: str) -> str:
    """A Discipline's key, as the Market's library names it (found by its English name)."""
    listed = got(api, f"/api/projects/{project_id}/drawings/disciplines")
    named = [d["key"] for d in listed if d["labels"].get("en") == english]
    assert len(named) == 1, f"the Market's Disciplines hold no one {english}: {listed}"
    return str(named[0])


def choose(api: Any, project_id: uuid.UUID, file_id: uuid.UUID, key: str) -> Any:
    """The QS's choice of the file's Discipline (the Drawing Set's select)."""
    return api.send("put", f"{files_path(project_id)}/{file_id}/discipline", {"discipline": key})


def report(api: Any, project_id: uuid.UUID, file_id: uuid.UUID) -> dict[str, Any]:
    found: dict[str, Any] = got(api, f"{files_path(project_id)}/{file_id}/report")
    return found


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def last_job() -> int:
    with connection.cursor() as cursor:
        cursor.execute("select coalesce(max(id), 0) from procrastinate_jobs")
        row = cursor.fetchone()
    assert row is not None
    return int(row[0])


def run_jobs_queued_after(marker: int) -> None:
    """Every job queued after `marker` (and every job those queue), run here once each, in queue
    order, as a worker would run it: the correction's re-run when it is a job."""
    done: set[int] = set()
    while True:
        with connection.cursor() as cursor:
            cursor.execute(
                "select id, task_name, args from procrastinate_jobs"
                " where id > %s and status = 'todo' order by id",
                [marker],
            )
            due = [row for row in cursor.fetchall() if row[0] not in done]
        if not due:
            return
        for job_id, name, args in due:
            done.add(job_id)
            raw = dict(json.loads(args) if isinstance(args, str) else args)
            tenant = uuid.UUID(raw.pop("tenant_id"))
            user = raw.pop("user_id", None)
            inline: Any = run_inline  # the job's own ids, by name, as its worker passes them
            inline(
                jobs._registered[name],
                tenant_id=tenant,
                user_id=None if user is None else uuid.UUID(user),
                job_id=job_id,
                **{k: uuid.UUID(v) for k, v in raw.items()},
            )


def chosen_while_reading(
    qs: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    file_id: uuid.UUID,
    key: str,
    use: files.Readers,
) -> list[Any]:
    """The file's read job run with `use`, the QS choosing `key` while its reader runs (before its
    sheets' numbers are read): the replies to that choice."""
    api = api_as(qs.member)
    chosen: list[Any] = []

    def reading_while_the_qs_chooses(path: Any, name: str) -> Any:
        with tenancy.acting_in(qs.member.developer_id, user_id=qs.member.user.pk):
            chosen.append(choose(api, qs.project_id, file_id, key))
        return use.dwg(path, name)

    run_job(
        qs.member,
        file_id,
        monkeypatch,
        files.Readers(
            dwg=reading_while_the_qs_chooses,
            second=use.second,
            fonts=use.fonts,
            bangla_ansi=use.bangla_ansi,
            pdf=use.pdf,
        ),
    )
    return chosen


# #189 ------------------------------------------------------------------------------------------------


def test_a_wrong_general_default_corrected_moves_the_files_views_out_of_step_2(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A bare-numbered structural file defaults to General (every view Step 2's); the QS's Structural
    moves its views out of Step 2, to Structural's own proposals, and Coverage follows."""
    name = "KR-SET4-R0.dwg"
    file_id = read(
        qs_project,
        monkeypatch,
        name,
        [
            Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
            Sheet("02", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
        ],
    )
    api = api_as(qs_project.member)
    general = key_of(api, qs_project.project_id, "General")
    structural = key_of(api, qs_project.project_id, "Structural")
    assert a_file(api, qs_project.project_id, file_id)["discipline"] == general
    marker = last_job()

    chosen = choose(api, qs_project.project_id, file_id, structural)

    assert chosen.status_code == 200, chosen.content
    run_jobs_queued_after(marker)
    listed = [p for p in proposals(api, qs_project.project_id) if p["file_name"] == name]
    assert listed
    assert {p["discipline"] for p in listed} == {structural}
    for proposal in listed:  # each sheet has one source (no drawing list): confirmed on its own
        confirmed = confirm(api, qs_project.project_id, [proposal["id"]])
        assert confirmed.status_code == 200, confirmed.content
    shown = coverage(api, qs_project.project_id)
    assert STEP_2 not in shown["by_step"], shown
    assert shown["by_step"], shown


# #190 ------------------------------------------------------------------------------------------------


def test_a_held_file_read_anyway_keeps_its_read_anyway_words_after_its_discipline_changes(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A held file (its readers disagree), its Discipline chosen while it was read, answered "read
    anyway" and read again, the choice undone as its sheets are listed (its numbers are
    Structural's), then a Discipline chosen again: its report's Readers
    line still says it was read anyway, never the held words "nothing from it reaches the sheet
    list" (its sheets are in the sheet list)."""
    read(qs_project, monkeypatch, TAKEN, TAKEN_SHEETS)
    api = api_as(qs_project.member)
    structural = key_of(api, qs_project.project_id, "Structural")
    architectural = key_of(api, qs_project.project_id, "Architectural")
    file_id = uploaded(qs_project.member, qs_project.project_id, NOTES)
    held = readers({NOTES: NOTES_SHEETS}, held=[NOTES])
    replies = chosen_while_reading(qs_project, monkeypatch, file_id, structural, held)
    assert [r.status_code for r in replies] == [200]
    [question] = open_questions(api, qs_project.project_id, "file_misread")
    answered = answer(api, qs_project.project_id, question["id"], "read_anyway")
    assert answered.status_code == 200, answered.content
    run_job(qs_project.member, file_id, monkeypatch, held)  # read anyway: its sheets are listed
    shown = a_file(api, qs_project.project_id, file_id)
    assert shown["finding"]["code"] == file_words.DISCIPLINE_CHOICE_UNDONE.code
    [before] = report(api, qs_project.project_id, file_id)["readers"]
    assert before["code"] == report_words.READ_ANYWAY.code

    chosen = choose(api, qs_project.project_id, file_id, architectural)

    assert chosen.status_code == 200, chosen.content
    assert a_file(api, qs_project.project_id, file_id)["discipline"] == architectural
    [after] = report(api, qs_project.project_id, file_id)["readers"]
    assert after["code"] == report_words.READ_ANYWAY.code, after
    assert after["params"] == before["params"]


# #191 ------------------------------------------------------------------------------------------------


def test_choosing_the_discipline_the_file_already_has_clears_its_choice_undone(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A Discipline chosen while the file read, undone once its numbers were read (they are
    Structural's), leaves the file on General with its "choice undone" line; the QS then chooses
    General, the Discipline the select already shows: the line is answered and goes."""
    read(qs_project, monkeypatch, TAKEN, TAKEN_SHEETS)
    api = api_as(qs_project.member)
    general = key_of(api, qs_project.project_id, "General")
    structural = key_of(api, qs_project.project_id, "Structural")
    file_id = uploaded(qs_project.member, qs_project.project_id, NOTES)
    replies = chosen_while_reading(
        qs_project, monkeypatch, file_id, structural, readers({NOTES: NOTES_SHEETS})
    )
    assert [r.status_code for r in replies] == [200]
    shown = a_file(api, qs_project.project_id, file_id)
    assert shown["discipline"] == general
    assert shown["finding"]["code"] == file_words.DISCIPLINE_CHOICE_UNDONE.code

    chosen = choose(api, qs_project.project_id, file_id, general)

    assert chosen.status_code == 200, chosen.content
    assert chosen.json()["finding"] is None
    shown = a_file(api, qs_project.project_id, file_id)
    assert shown["discipline"] == general
    assert shown["finding"] is None
