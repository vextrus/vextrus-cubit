"""The files and sheets API (ticket 14; m0-screens 4.5): each operation through 07's guard; a file or
sheet of another Project or Developer, or none, one 404 body; the MD and a Guest look but never
change; every refusal a `{code, params}` body."""

import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings

from engine.read.pdf.types import Page
from engine.recognise.types import PlotMatch
from engine.render.buffers import SheetBuffers
from vextrus.drawings import services
from vextrus.projects import services as projects
from vextrus.testing.auth import Api, api_as
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report, read_dwg, sheet_candidate
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

NOT_FOUND = {"code": "platform.auth.not_found", "params": {}}


def base(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/drawings"


@pytest.fixture
def kr(qs_project: QsProject) -> dict[str, Any]:
    """A set with a read DWG of two sheets, its PDF matched to the first, and a waiting DWG."""
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    printed = read_dwg(member, dwg.id, ["S-01", "S-02"])
    pdf = add(member, qs_project.project_id, "KR-STR-R0.pdf", drawing("pdf")).file
    waiting = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    with member.acting():
        services.record_reports(pdf.id, upload_report=pdf_report(pdf.sha256, 2))
        services.mark_read(pdf.id)
        page = Page(pdf.sha256, 1, 1190.0, 842.0, 0, (0.0, 0.0, 1190.0, 842.0), False, ())
        services.record_plot(printed[0].id, PlotMatch(page, sheet_candidate(0, dwg.group, number="S")))
        services.record_plot(printed[1].id, services.PlotNone.NO_PAGE, pdf_file_id=pdf.id)
    return {"dwg": dwg, "pdf": pdf, "waiting": waiting, "sheets": printed, "project": qs_project}


def test_the_list_shows_every_file_in_its_words_and_the_summary(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    response = api_as(project.member).get(f"{base(project.project_id)}/files")

    body = response.json()
    assert response.status_code == 200
    assert [f["name"] for f in body["files"]] == ["KR-STR-R0.dwg", "KR-STR-R0.pdf", "KR-ARC-R0.dwg"]
    dwg, pdf, waiting = body["files"]
    assert (dwg["state"], dwg["status"], dwg["sheets_found"]) == (
        "read",
        {"code": "drawings.files.read", "params": {}},
        2,
    )
    assert (pdf["status"], pdf["plot_for"]) == (
        {"code": "drawings.files.plot_matched", "params": {"matched": 1, "pages": 2}},
        [str(kr["dwg"].id)],
    )
    assert waiting["status"] == {"code": "drawings.files.waiting", "params": {"ahead": 0}}
    assert body["summary"] == {
        "code": "drawings.files.summary",
        # The waiting file is not being read (the orchestrator's ruling on "reading").
        "params": {"files": 3, "sheets": 2, "reading": 0, "failed": 0, "held": 0, "refused": 0},
    }
    assert set(dwg) == {
        "id", "name", "format", "size", "discipline", "state", "status", "finding",
        "sheets_found", "plot_for", "added_at", "added_by_name", "added_by_vextrus",
        "marked_for_vextrus",
    }  # fmt: skip
    assert dwg["added_by_vextrus"] is False
    assert dwg["marked_for_vextrus"] is False


def test_an_empty_project_lists_no_set(qs_project: QsProject) -> None:
    response = api_as(qs_project.member).get(f"{base(qs_project.project_id)}/files")

    assert response.json() == {
        "set_id": None,
        "summary": {
            "code": "drawings.files.summary",
            "params": {"files": 0, "sheets": 0, "reading": 0, "failed": 0, "held": 0, "refused": 0},
        },
        "files": [],
    }


def test_the_disciplines_are_the_markets_nine_by_key_and_name(qs_project: QsProject) -> None:
    response = api_as(qs_project.member).get(f"{base(qs_project.project_id)}/disciplines")

    assert [(d["key"], d["labels"]["en"]) for d in response.json()] == [
        ("structural", "Structural"),
        ("architectural", "Architectural"),
        ("electrical", "Electrical"),
        ("plumbing", "Plumbing and sanitary"),
        ("fire", "Fire"),
        ("mechanical", "Mechanical (HVAC)"),
        ("lift", "Lift"),
        ("gas", "Gas"),
        ("general", "General"),
    ]


def test_cancel_then_read_again_and_a_second_click_is_refused(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    client = api_as(project.member)
    at = f"{base(project.project_id)}/files/{kr['waiting'].id}"

    cancelled = client.post(f"{at}/cancel")
    cancelled_again = client.post(f"{at}/cancel")
    restarted = client.post(f"{at}/restart")
    restarted_again = client.post(f"{at}/restart")

    assert cancelled.json()["state"] == "cancelled"
    assert cancelled.json()["status"]["params"]["actor"] == project.member.user.name
    assert cancelled_again.json()["status"] == cancelled.json()["status"]
    assert (restarted.status_code, restarted.json()["state"]) == (200, "waiting")
    assert (restarted_again.status_code, restarted_again.json()) == (
        409,
        {"code": "drawings.files.not_stopped", "params": {}},
    )


def test_a_discipline_is_set_by_key_and_refused_by_code(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    client = api_as(project.member)
    at = f"{base(project.project_id)}/files/{kr['waiting'].id}/discipline"

    changed = client.send("put", at, {"discipline": "electrical"})
    unknown = client.send("put", at, {"discipline": "solar"})
    extra = client.send("put", at, {"discipline": "gas", "tenant_id": str(uuid.uuid4())})

    assert (changed.status_code, changed.json()["discipline"]) == (200, "electrical")
    assert (unknown.status_code, unknown.json()) == (
        400,
        {"code": "drawings.files.discipline_unknown", "params": {}},
    )
    assert extra.status_code == 422


def test_a_dwgs_report_and_a_pdfs(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    client = api_as(project.member)

    dwg = client.get(f"{base(project.project_id)}/files/{kr['dwg'].id}/report").json()
    pdf = client.get(f"{base(project.project_id)}/files/{kr['pdf'].id}/report").json()

    assert dwg["readers"] == [{"code": "drawings.reports.readers_agree", "params": {}}]
    assert dwg["sheets"] == [{"code": "drawings.reports.sheets_found_drawn", "params": {"sheets": 2}}]
    assert dwg["plot"] == [
        {
            "code": "drawings.reports.plot_of_dwg",
            "params": {"plot_file": "KR-STR-R0.pdf", "with_page": 1, "sheets": 2},
        }
    ]
    assert pdf["pages"] == [
        {"code": "drawings.reports.pages_matched", "params": {"matched": 1, "pages": 2}},
        {"code": "drawings.reports.sheet_without_page", "params": {"sheet": "S-02"}},
    ]


def test_a_pdf_is_served_and_a_dwg_never(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    client = api_as(project.member)

    pdf = client.get(f"{base(project.project_id)}/files/{kr['pdf'].id}/pdf")
    dwg = client.get(f"{base(project.project_id)}/files/{kr['dwg'].id}/pdf")

    assert (pdf.status_code, pdf["Content-Type"], pdf.content) == (200, "application/pdf", pdf.content)
    assert pdf.content.startswith(b"%PDF-")
    assert (dwg.status_code, dwg.json()) == (404, NOT_FOUND)


def test_a_missing_pdf_copy_says_so(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    root = Path(settings.VEXTRUS_STORAGE_ROOT) / str(project.member.developer_id)
    [original] = root.rglob(f"{kr['pdf'].sha256}/original.pdf")
    original.unlink()

    response = api_as(project.member).get(f"{base(project.project_id)}/files/{kr['pdf'].id}/pdf")

    assert (response.status_code, response.json()) == (
        409,
        {"code": "platform.storage.missing", "params": {}},
    )


def test_a_sheets_render_and_plot(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    client = api_as(project.member)
    first, second = kr["sheets"]

    render = client.get(f"{base(project.project_id)}/sheets/{first.id}/render")
    plotted = client.get(f"{base(project.project_id)}/sheets/{first.id}/plot").json()
    none = client.get(f"{base(project.project_id)}/sheets/{second.id}/plot").json()

    assert render.status_code == 200
    assert SheetBuffers.from_bytes(render.content).paper.width_mm > 0
    assert (plotted["file_id"], plotted["page"], plotted["none"]) == (str(kr["pdf"].id), 1, None)
    assert none == {
        "file_id": None,
        "page": None,
        "transform": None,
        "residual": None,
        "none": {"code": "drawings.sheets.plot_no_page", "params": {"plot_file": "KR-STR-R0.pdf"}},
    }


# Who may do what ----------------------------------------------------------------------------------


@pytest.mark.parametrize("role", ["md", "guest"])
def test_the_md_and_a_guest_look_but_change_nothing(
    kr: dict[str, Any], sign_in: Callable[..., Member], role: str
) -> None:
    project: QsProject = kr["project"]
    looker = api_as(sign_in(role=role, developer_id=project.member.developer_id))
    at = f"{base(project.project_id)}/files/{kr['waiting'].id}"

    assert looker.get(f"{base(project.project_id)}/files").status_code == 200
    assert (
        looker.get(f"{base(project.project_id)}/sheets/{kr['sheets'][0].id}/render").status_code == 200
    )
    refused = {"code": "platform.auth.not_allowed", "params": {"role": role}}
    for method, path, body in (
        ("post", f"{at}/cancel", None),
        ("post", f"{at}/restart", None),
        ("put", f"{at}/discipline", {"discipline": "gas"}),
    ):
        response = looker.send(method, path, body)
        assert (response.status_code, response.json()) == (403, refused), path
    with project.member.acting():
        assert services.file(kr["waiting"].id).state == "waiting"


def _every_path(project_id: uuid.UUID, kr: dict[str, Any]) -> list[tuple[str, str, Any]]:
    at = f"{base(project_id)}/files/{kr['dwg'].id}"
    sheet = f"{base(project_id)}/sheets/{kr['sheets'][0].id}"
    return [
        ("get", at, None),
        ("get", f"{at}/report", None),
        ("get", f"{base(project_id)}/files/{kr['pdf'].id}/pdf", None),
        ("post", f"{at}/cancel", None),
        ("post", f"{at}/restart", None),
        ("put", f"{at}/discipline", {"discipline": "gas"}),
        ("get", f"{sheet}/render", None),
        ("get", f"{sheet}/plot", None),
    ]


def test_a_file_or_sheet_of_another_project_is_not_found_under_this_one(
    kr: dict[str, Any],
) -> None:
    project: QsProject = kr["project"]
    with project.member.acting():
        other = projects.create(code="OT-9", name="Another project")
    client = api_as(project.member)

    for method, path, body in _every_path(other.id, kr):
        response = client.send(method, path, body)
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path


def test_another_developers_file_or_sheet_is_not_found(
    kr: dict[str, Any], sign_in: Callable[..., Member]
) -> None:
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code="TH-9", name="Theirs")
    client = api_as(stranger)

    for method, path, body in _every_path(theirs.id, kr):
        response = client.send(method, path, body)
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path
    for method, path, body in _every_path(kr["project"].project_id, kr):
        response = client.send(method, path, body)
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path


def test_a_random_id_is_not_found(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    client = api_as(project.member)
    nothing = uuid.uuid4()

    for path in (
        f"{base(project.project_id)}/files/{nothing}",
        f"{base(project.project_id)}/files/{nothing}/report",
        f"{base(project.project_id)}/sheets/{nothing}/plot",
        f"{base(nothing)}/files",
    ):
        response = client.get(path)
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path


def test_a_member_given_other_projects_finds_none_of_these(
    kr: dict[str, Any], sign_in: Callable[..., Member]
) -> None:
    project: QsProject = kr["project"]
    with project.member.acting():
        mine = projects.create(code="MI-9", name="Mine")
    scoped = api_as(sign_in(role="qs", developer_id=project.member.developer_id, projects=[mine.id]))

    for method, path, body in [
        ("get", f"{base(project.project_id)}/files", None),
        *_every_path(project.project_id, kr),
    ]:
        response = scoped.send(method, path, body)
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path


def test_a_sheet_of_a_file_not_in_the_list_is_not_found(kr: dict[str, Any]) -> None:
    project: QsProject = kr["project"]
    member = project.member
    later = add(member, project.project_id, "KR-ELE-R0.dwg", drawing()).file
    [printed] = read_dwg(member, later.id, ["E-01"], mark_read=False)
    with member.acting():
        services.cancel(later.id, actor_name="N")

    response = api_as(member).get(f"{base(project.project_id)}/sheets/{printed.id}/render")

    assert (response.status_code, response.json()) == (404, NOT_FOUND)


def test_signed_out_is_refused_with_a_body(kr: dict[str, Any]) -> None:
    response = Api().get(f"{base(kr['project'].project_id)}/files")

    assert (response.status_code, response.json()) == (
        401,
        {"code": "platform.auth.signed_out", "params": {}},
    )
