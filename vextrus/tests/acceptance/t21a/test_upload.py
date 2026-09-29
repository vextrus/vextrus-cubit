"""21a's upload operation through the product's own API (`vextrus.urls`, CSRF enforced).

The contract (docs/plans/M0.md, 21a; the orchestrator's session-06 rulings, 21a):
`POST /api/projects/{project_id}/drawings/files`, one multipart part `file`, CSRF. 201
`{file, outcome: "added", message}`; 200 `{file, outcome: "already_here", message}`; 200
`{file, outcome: "replaced", message}`. Refusals `{code, params}` with 14's `drawings.uploads.*` codes
and 07's `platform.auth.*`. The read job runs on queue `cad`; the file's `read_job_id` is set; a
deferral that fails rolls the add back with a stated code.
"""

import io
import json
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings as django_settings
from django.db import DatabaseError, connection
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

from vextrus.api import message_codes
from vextrus.drawings import services
from vextrus.platform.services import jobs
from vextrus.testing.drawings import QsProject, drawing
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

DWG_NAME = "KR-STR-R0.dwg"


# The request, as the web sends it --------------------------------------------------------------


def url(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/drawings/files"


def multipart(*files: tuple[str, bytes], field: str = "file") -> bytes:
    fields: dict[str, Any] = {}
    for n, (name, content) in enumerate(files):
        part = io.BytesIO(content)
        part.name = name
        fields[field if n == 0 else f"{field}{n}"] = part
    return encode_multipart(BOUNDARY, fields)


def post(member: Member | None, project_id: uuid.UUID, body: bytes, *, csrf: bool = True) -> Any:
    client = Client(enforce_csrf_checks=True)
    if member is not None:
        client.cookies = member.client.cookies
    token = "a" * 32
    client.cookies[django_settings.CSRF_COOKIE_NAME] = token
    return client.generic(
        "POST",
        url(project_id),
        body,
        content_type=MULTIPART_CONTENT,
        headers={"X-CSRFToken": token} if csrf else {},
    )


def upload(member: Member, project_id: uuid.UUID, name: str, content: bytes) -> Any:
    return post(member, project_id, multipart((name, content)))


# What was kept ---------------------------------------------------------------------------------


def kept(member: Member) -> tuple[int, int]:
    """The Developer's DrawingFile rows and read jobs on the `cad` queue, as the app sees them."""
    with member.acting(), connection.cursor() as cursor:
        cursor.execute("select count(*) from drawings_drawingfile")
        [files] = cursor.fetchone() or (0,)
        cursor.execute(
            "select count(*) from procrastinate_jobs where queue_name = %s",
            [django_settings.VEXTRUS_CAD_QUEUE],
        )
        [cad_jobs] = cursor.fetchone() or (0,)
    return files, cad_jobs


def job_of(member: Member, job_id: int) -> dict[str, Any]:
    with member.acting(), connection.cursor() as cursor:
        cursor.execute(
            "select queue_name, task_name, args from procrastinate_jobs where id = %s", [job_id]
        )
        row = cursor.fetchone()
    assert row is not None, f"no job {job_id} for this Developer"
    return dict(zip(("queue", "task", "args"), row, strict=True))


def read_job_id(member: Member, file_id: str) -> int | None:
    with member.acting():
        return services.file(uuid.UUID(file_id)).read_job_id


def refusal(response: Any) -> tuple[int, Any]:
    return response.status_code, response.json()


@pytest.fixture
def limit(settings: Any) -> int:
    settings.VEXTRUS_UPLOAD_MAX_BYTES = 256 * 1024
    return int(settings.VEXTRUS_UPLOAD_MAX_BYTES)


# Added, already here, replaced -----------------------------------------------------------------


def test_a_new_drawing_is_added_with_201_and_the_file_it_became(qs_project: QsProject) -> None:
    response = upload(qs_project.member, qs_project.project_id, DWG_NAME, drawing("dwg"))

    assert response.status_code == 201, response.content
    body = response.json()
    assert set(body) == {"file", "outcome", "message"}
    assert body["outcome"] == "added"
    assert body["message"] is None
    assert body["file"]["name"] == DWG_NAME
    assert kept(qs_project.member)[0] == 1
    with qs_project.member.acting():
        assert services.file(uuid.UUID(body["file"]["id"])).name == DWG_NAME


def test_an_added_file_waits_to_be_read(qs_project: QsProject) -> None:
    response = upload(qs_project.member, qs_project.project_id, DWG_NAME, drawing("dwg"))

    assert response.status_code == 201, response.content
    assert response.json()["file"]["status"] == {
        "code": "drawings.files.waiting",
        "params": {"ahead": 0},
    }


def test_the_same_name_with_other_contents_is_added_beside_it(qs_project: QsProject) -> None:
    upload(qs_project.member, qs_project.project_id, DWG_NAME, drawing("dwg", "first"))

    response = upload(qs_project.member, qs_project.project_id, DWG_NAME, drawing("dwg", "second"))

    assert response.status_code == 201, response.content
    assert response.json()["outcome"] == "added"
    assert response.json()["message"] == {"code": "drawings.uploads.same_name_kept", "params": {}}
    assert kept(qs_project.member) == (2, 2)


def test_the_same_contents_again_is_200_already_here_and_adds_nothing(
    qs_project: QsProject,
) -> None:
    content = drawing("dwg")
    first = upload(qs_project.member, qs_project.project_id, DWG_NAME, content).json()

    response = upload(qs_project.member, qs_project.project_id, DWG_NAME, content)

    assert response.status_code == 200, response.content
    body = response.json()
    assert set(body) == {"file", "outcome", "message"}
    assert body["outcome"] == "already_here"
    assert body["file"]["id"] == first["file"]["id"]
    assert body["message"]["code"] == "drawings.uploads.already_here"
    assert body["message"]["params"]["file"] == DWG_NAME
    assert body["message"]["params"]["actor"] == qs_project.member.user.name
    assert kept(qs_project.member) == (1, 1)
    assert read_job_id(qs_project.member, first["file"]["id"]) == read_job_id(
        qs_project.member, body["file"]["id"]
    )


def test_the_same_contents_under_another_name_is_already_here_as(qs_project: QsProject) -> None:
    content = drawing("dwg")
    upload(qs_project.member, qs_project.project_id, DWG_NAME, content)

    response = upload(qs_project.member, qs_project.project_id, "copy of it.dwg", content)

    assert response.status_code == 200, response.content
    assert response.json()["outcome"] == "already_here"
    assert response.json()["message"]["code"] == "drawings.uploads.already_here_as"
    assert response.json()["message"]["params"]["existing_file"] == DWG_NAME
    assert kept(qs_project.member)[0] == 1


def test_a_missing_copy_is_replaced_with_200(qs_project: QsProject) -> None:
    content = drawing("dwg")
    first = upload(qs_project.member, qs_project.project_id, DWG_NAME, content).json()
    base = (
        Path(django_settings.VEXTRUS_STORAGE_ROOT)
        / str(qs_project.member.developer_id)
        / str(qs_project.project_id)
        / "drawings"
    )
    [original] = list(base.rglob("original.dwg"))
    original.unlink()

    response = upload(qs_project.member, qs_project.project_id, DWG_NAME, content)

    assert response.status_code == 200, response.content
    body = response.json()
    assert set(body) == {"file", "outcome", "message"}
    assert body["outcome"] == "replaced"
    assert body["file"]["id"] == first["file"]["id"]
    assert body["message"] == {"code": "drawings.uploads.replaced", "params": {"file": DWG_NAME}}
    assert original.read_bytes() == content
    assert kept(qs_project.member)[0] == 1


# The read job ----------------------------------------------------------------------------------


def test_the_added_file_has_its_read_job_on_the_cad_queue(qs_project: QsProject) -> None:
    body = upload(qs_project.member, qs_project.project_id, DWG_NAME, drawing("dwg")).json()

    job_id = read_job_id(qs_project.member, body["file"]["id"])

    assert job_id is not None
    job = job_of(qs_project.member, job_id)
    assert job["queue"] == "cad"
    # jsonb reads as text through the app's connection
    args = job["args"] if isinstance(job["args"], dict) else json.loads(job["args"])
    assert args["file_id"] == body["file"]["id"]
    assert args["tenant_id"] == str(qs_project.member.developer_id)
    with qs_project.member.acting():
        state = jobs.state(job_id)
    assert state is not None
    assert state.status == "waiting"


def test_a_pdf_is_read_on_the_cad_queue_too(qs_project: QsProject) -> None:
    body = upload(qs_project.member, qs_project.project_id, "KR-ARC-R0.pdf", drawing("pdf")).json()

    job_id = read_job_id(qs_project.member, body["file"]["id"])

    assert job_id is not None
    assert job_of(qs_project.member, job_id)["queue"] == "cad"


@pytest.mark.parametrize(
    "failure",
    [jobs.JobRefused("refused for the test"), DatabaseError("the queue could not be written")],
    ids=["job_refused", "database_error"],
)
def test_a_deferral_that_fails_rolls_the_add_back_with_a_stated_code(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, failure: Exception
) -> None:
    def fail(self: jobs.Job, **ids: uuid.UUID) -> jobs.JobId:
        raise failure

    monkeypatch.setattr(jobs.Job, "defer", fail)

    response = upload(qs_project.member, qs_project.project_id, DWG_NAME, drawing("dwg"))

    assert response.status_code >= 400, response.content
    body = response.json()
    assert set(body) == {"code", "params"}
    assert body["code"] in {held.code for held in message_codes()}
    assert kept(qs_project.member) == (0, 0)
    with qs_project.member.acting():
        assert services.set_of(qs_project.project_id) is None


# Refusals: `{code, params}`, nothing kept, no job ----------------------------------------------


@pytest.mark.parametrize(
    ("name", "content", "status", "code"),
    [
        ("empty.dwg", b"", 400, "drawings.uploads.empty"),
        ("notes.dwg", b"not a drawing at all", 415, "drawings.uploads.not_a_drawing"),
        ("drawings.zip", b"PK\x03\x04" + b"\x00" * 60, 415, "drawings.uploads.zip"),
    ],
)
def test_a_file_that_is_no_drawing_is_refused_and_nothing_is_kept(
    qs_project: QsProject, name: str, content: bytes, status: int, code: str
) -> None:
    response = upload(qs_project.member, qs_project.project_id, name, content)

    assert refusal(response) == (status, {"code": code, "params": {"file": name}})
    assert kept(qs_project.member) == (0, 0)


def test_a_file_over_the_limit_is_refused_413(qs_project: QsProject, limit: int) -> None:
    over = drawing("dwg").ljust(limit + 1, b"\x00")

    response = upload(qs_project.member, qs_project.project_id, DWG_NAME, over)

    assert refusal(response) == (
        413,
        {"code": "drawings.uploads.too_large", "params": {"file": DWG_NAME, "megabytes": 0}},
    )
    assert kept(qs_project.member) == (0, 0)


def test_two_files_in_one_request_are_refused(qs_project: QsProject) -> None:
    body = multipart((DWG_NAME, drawing("dwg")), ("KR-ARC-R0.dwg", drawing("dwg")))

    response = post(qs_project.member, qs_project.project_id, body)

    assert refusal(response) == (400, {"code": "drawings.uploads.one_at_a_time", "params": {}})
    assert kept(qs_project.member) == (0, 0)


def test_a_request_with_no_file_part_is_stopped(qs_project: QsProject) -> None:
    body = encode_multipart(BOUNDARY, {"note": "no file here"})

    response = post(qs_project.member, qs_project.project_id, body)

    assert refusal(response) == (400, {"code": "drawings.uploads.stopped", "params": {}})
    assert kept(qs_project.member) == (0, 0)


def test_a_body_cut_short_is_stopped(qs_project: QsProject) -> None:
    body = multipart((DWG_NAME, drawing("dwg").ljust(4096, b"\x00")))

    response = post(qs_project.member, qs_project.project_id, body[:2048])

    assert refusal(response) == (400, {"code": "drawings.uploads.stopped", "params": {}})
    assert kept(qs_project.member) == (0, 0)


def test_a_name_too_long_for_the_form_is_malformed(qs_project: QsProject) -> None:
    response = upload(qs_project.member, qs_project.project_id, "n" * 1000 + ".dwg", drawing("dwg"))

    assert refusal(response) == (400, {"code": "drawings.uploads.malformed", "params": {}})
    assert kept(qs_project.member) == (0, 0)


def test_with_no_csrf_token_nothing_is_added(qs_project: QsProject) -> None:
    body = multipart((DWG_NAME, drawing("dwg")))

    response = post(qs_project.member, qs_project.project_id, body, csrf=False)

    assert refusal(response) == (403, {"code": "platform.auth.csrf_failed", "params": {}})
    assert kept(qs_project.member) == (0, 0)


def test_the_signed_out_add_nothing(qs_project: QsProject) -> None:
    response = post(None, qs_project.project_id, multipart((DWG_NAME, drawing("dwg"))))

    assert refusal(response) == (401, {"code": "platform.auth.signed_out", "params": {}})
    assert kept(qs_project.member) == (0, 0)


@pytest.mark.parametrize("role", ["md", "guest"])
def test_the_md_and_a_guest_add_nothing(
    qs_project: QsProject, sign_in: Callable[..., Member], role: str
) -> None:
    looker = sign_in(role=role, developer_id=qs_project.member.developer_id)

    response = upload(looker, qs_project.project_id, DWG_NAME, drawing("dwg"))

    assert refusal(response) == (
        403,
        {"code": "platform.auth.not_allowed", "params": {"role": role}},
    )
    assert kept(qs_project.member) == (0, 0)


def test_a_second_developer_cannot_add_to_the_project(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    stranger = sign_in(role="qs")

    response = upload(stranger, qs_project.project_id, DWG_NAME, drawing("dwg"))

    assert refusal(response) == (404, {"code": "platform.auth.not_found", "params": {}})
    assert kept(qs_project.member) == (0, 0)
    assert kept(stranger) == (0, 0)


def test_a_project_that_does_not_exist_is_not_found(qs_project: QsProject) -> None:
    response = upload(qs_project.member, uuid.uuid4(), DWG_NAME, drawing("dwg"))

    assert refusal(response) == (404, {"code": "platform.auth.not_found", "params": {}})
    assert kept(qs_project.member) == (0, 0)
