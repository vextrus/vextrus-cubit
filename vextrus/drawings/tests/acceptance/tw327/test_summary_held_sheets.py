"""T-W327 (#327, G1 walk item FL4): the Drawing Set's summary line says how many of the sheets it
counts as read come from a held file.

The ticket's seam: `SUMMARY` gets two more params, `held_sheets` and `held_files_read`, so
`SUMMARY(files, sheets, held_sheets, held_files_read, reading, failed, held, refused)`. `sheets` counts
the sheet list as before (a held file's sheets are in it once it was read anyway and its read ended);
`held_sheets` is the part of it that comes from held files read anyway, and `held_files_read` the
number of those files (the words' plural follows it). A held file set aside counts in none of them (on
main its row has no `sheets_found`, whatever sheets it once recorded).

Every file name here is invented.
"""

import uuid
from typing import Any

import pytest

from engine.messages import Message
from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

DISAGREE: Message = {"code": "engine.decoders_agree.disagree", "params": {}}


def listed(project: QsProject) -> dict[str, Any]:
    response = api_as(project.member).get(f"/api/projects/{project.project_id}/drawings/files")
    assert response.status_code == 200, response.content
    return dict(response.json()["summary"])


def views(member: Member, any_file: uuid.UUID) -> list[services.FileView]:
    with member.acting():
        return services.files(services.file(any_file).set_id)


def a_read_dwg(project: QsProject, name: str, numbers: list[str]) -> uuid.UUID:
    found = add(project.member, project.project_id, name, drawing()).file
    read_dwg(project.member, found.id, numbers)
    return found.id


def a_held_dwg(project: QsProject, name: str, numbers: list[str], *answers: str) -> uuid.UUID:
    """A held DWG whose sheets were recorded; read anyway (its read ended) when the first answer is
    `read_anyway`, and answered on with the others."""
    member = project.member
    found = add(member, project.project_id, name, drawing()).file
    if numbers:
        read_dwg(member, found.id, numbers, mark_read=False)
    with member.acting():
        services.quarantine(found.id, DISAGREE)
        for answer in answers:
            services.answer_held(found.id, answer)
            if answer == "read_anyway":
                services.mark_read(found.id)  # its read again ended: its sheets listed
    return found.id


def test_the_summary_names_the_sheets_that_come_from_a_held_file(qs_project: QsProject) -> None:
    read = a_read_dwg(qs_project, "QV-ARC-R2.dwg", ["A-41", "A-42"])
    a_held_dwg(qs_project, "QV-STR-old.dwg", ["S-51", "S-52", "S-53"], "read_anyway")
    expected = said.SUMMARY(
        files=2, sheets=5, held_sheets=3, held_files_read=1, reading=0, failed=0, held=1, refused=0
    )

    assert services.summary(views(qs_project.member, read)) == expected
    assert listed(qs_project) == expected


def test_a_held_file_not_yet_answered_adds_no_sheets(qs_project: QsProject) -> None:
    read = a_read_dwg(qs_project, "QV-ARC-R2.dwg", ["A-41", "A-42"])
    a_held_dwg(qs_project, "QV-ELE-old.dwg", [])
    expected = said.SUMMARY(
        files=2, sheets=2, held_sheets=0, held_files_read=0, reading=0, failed=0, held=1, refused=0
    )

    assert services.summary(views(qs_project.member, read)) == expected
    assert listed(qs_project) == expected


def test_with_no_held_file_no_sheets_are_named_held(qs_project: QsProject) -> None:
    first = a_read_dwg(qs_project, "QV-ARC-R2.dwg", ["A-41", "A-42"])
    a_read_dwg(qs_project, "QV-PLB-R1.dwg", ["P-61"])
    expected = said.SUMMARY(
        files=2, sheets=3, held_sheets=0, held_files_read=0, reading=0, failed=0, held=0, refused=0
    )

    assert services.summary(views(qs_project.member, first)) == expected
    assert listed(qs_project)["params"]["held_sheets"] == 0


@pytest.mark.parametrize("set_aside", ["await_resaved", "sent_to_vextrus"])
def test_a_held_file_set_aside_after_it_was_read_anyway_counts_none_of_its_sheets(
    qs_project: QsProject, set_aside: str
) -> None:
    read = a_read_dwg(qs_project, "QV-ARC-R2.dwg", ["A-41", "A-42"])
    a_held_dwg(qs_project, "QV-MEC-old.dwg", ["M-71", "M-72", "M-73", "M-74"], "read_anyway", set_aside)
    expected = said.SUMMARY(
        files=2, sheets=2, held_sheets=0, held_files_read=0, reading=0, failed=0, held=1, refused=0
    )

    assert services.summary(views(qs_project.member, read)) == expected
    assert listed(qs_project) == expected
