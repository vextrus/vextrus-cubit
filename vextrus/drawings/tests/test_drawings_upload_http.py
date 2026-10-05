"""The upload's trust boundary through Django's real request parsing and CSRF check (ticket 14): a
test-only operation shaped as 21a's will be (07's guard, then `drawings.services.add_file`), mounted
on a URLconf of its own. The body is parsed at the CSRF check, before sign-in and the guard, so the
handler bounds everyone; on every refusal nothing is kept, not even a temporary file."""

import base64
import io
import sys
import threading
import types
import uuid
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings as django_settings
from django.db import connection, connections
from django.http import HttpRequest
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.urls import path
from ninja import NinjaAPI, Router, Schema
from ninja.files import UploadedFile
from ninja.params import functions as param_functions

from engine.messages import Message
from vextrus.drawings import acts, services
from vextrus.drawings.messages import uploads as said
from vextrus.platform.http.acts import Refusal, Session, declare, install
from vextrus.platform.services import auth, tenancy
from vextrus.projects import services as projects
from vextrus.testing.drawings import QsProject, drawing
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


class AddedOut(Schema):
    file_id: uuid.UUID
    outcome: str
    message: Message | None


NO_FILE: Any = param_functions.File(None)
"""The upload operation's file: none when no whole file arrived."""


def upload_api() -> NinjaAPI:
    router = Router()

    @router.post(
        "/projects/{project_id}/upload",
        response={200: AddedOut, 400: Refusal, 413: Refusal, 415: Refusal},
    )
    @declare(acts.UPLOAD, project="project_id")
    def upload(
        request: HttpRequest, project_id: uuid.UUID, file: UploadedFile | None = NO_FILE
    ) -> AddedOut:
        if file is None:
            raise auth.Refused(said.STOPPED(), status=400)
        added = services.add_file(
            project_id, name=file.name or "", content=file, actor_name=getattr(request.user, "name", "")
        )
        return AddedOut(file_id=added.file.id, outcome=added.outcome, message=added.message)

    api = NinjaAPI(auth=Session(), urls_namespace=f"upload-{uuid.uuid4().hex}")
    install(api)
    api.add_router("", router)
    return api


@pytest.fixture
def upload_urls(settings: Any, tmp_path: Path) -> Iterator[Path]:
    """The test-only operation's URLconf, and a temporary folder of its own for uploads in flight."""
    module = types.ModuleType("drawings_upload_urls")
    module.urlpatterns = [path("api/", upload_api().urls)]  # type: ignore[attr-defined]
    sys.modules["drawings_upload_urls"] = module
    settings.ROOT_URLCONF = "drawings_upload_urls"
    spool = tmp_path / "spool"
    spool.mkdir()
    settings.FILE_UPLOAD_TEMP_DIR = str(spool)
    yield spool
    del sys.modules["drawings_upload_urls"]


def csrf_client(member: Member | None) -> tuple[Client, str]:
    client = Client(enforce_csrf_checks=True)
    if member is not None:
        client.cookies = member.client.cookies
    token = "a" * 32
    client.cookies[django_settings.CSRF_COOKIE_NAME] = token
    return client, token


def post(
    member: Member | None,
    project_id: uuid.UUID,
    body: bytes,
    *,
    csrf: bool = True,
    content_length: str | None = None,
    content_type: str = MULTIPART_CONTENT,
) -> Any:
    client, token = csrf_client(member)
    extra: dict[str, Any] = {}
    if content_length is not None:
        extra["CONTENT_LENGTH"] = content_length
    return client.generic(
        "POST",
        f"/api/projects/{project_id}/upload",
        body,
        content_type=content_type,
        headers={"X-CSRFToken": token} if csrf else {},
        **extra,
    )


def multipart(*files: tuple[str, bytes]) -> bytes:
    fields: dict[str, Any] = {}
    for n, (name, content) in enumerate(files):
        part = io.BytesIO(content)
        part.name = name
        fields["file" if n == 0 else f"file{n}"] = part
    return encode_multipart(BOUNDARY, fields)


def kept(member: Member, spool: Path) -> tuple[int, int, int, list[str]]:
    with member.acting(), connection.cursor() as cursor:
        cursor.execute(
            "select (select count(*) from drawings_drawingfile),"
            " (select count(*) from platform_storedfile), (select count(*) from drawings_drawingset)"
        )
        files, stored, sets = cursor.fetchone() or (0, 0, 0)
    root = Path(django_settings.VEXTRUS_STORAGE_ROOT) / str(member.developer_id)
    on_disk = [str(p) for p in root.rglob("*") if p.is_file()] if root.exists() else []
    assert list(spool.iterdir()) == [], "a temporary upload was left behind"
    return files, stored, sets, on_disk


NOTHING: tuple[int, int, int, list[str]] = (0, 0, 0, [])


@pytest.fixture
def limit(settings: Any) -> int:
    settings.VEXTRUS_UPLOAD_MAX_BYTES = 256 * 1024
    return int(settings.VEXTRUS_UPLOAD_MAX_BYTES)


def refusal(response: Any) -> tuple[int, Any]:
    return response.status_code, response.json()


def test_a_drawing_is_added_through_the_real_parse(upload_urls: Path, qs_project: QsProject) -> None:
    response = post(qs_project.member, qs_project.project_id, multipart(("KR-STR-R0.dwg", drawing())))

    assert response.status_code == 200, response.content
    assert response.json()["outcome"] == "added"
    assert kept(qs_project.member, upload_urls)[:3] == (1, 1, 1)


def test_one_byte_over_the_limit_is_refused_as_it_streams_and_nothing_is_kept(
    upload_urls: Path, qs_project: QsProject, limit: int
) -> None:
    over = drawing().ljust(limit + 1, b"\x00")

    response = post(qs_project.member, qs_project.project_id, multipart(("KR-ARC-R0.dwg", over)))

    assert refusal(response) == (
        413,
        {"code": "drawings.uploads.too_large", "params": {"file": "KR-ARC-R0.dwg", "megabytes": 0}},
    )
    assert kept(qs_project.member, upload_urls) == NOTHING
    at_limit = post(qs_project.member, qs_project.project_id, multipart(("KR-ARC-R0.dwg", over[:-1])))
    assert at_limit.status_code == 200


def test_a_body_with_no_content_length_is_never_read(
    upload_urls: Path, qs_project: QsProject, limit: int
) -> None:
    over = drawing().ljust(limit + 1, b"\x00")

    response = post(
        qs_project.member, qs_project.project_id, multipart(("KR-ARC-R0.dwg", over)), content_length=""
    )

    assert refusal(response) == (400, {"code": "drawings.uploads.stopped", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


@pytest.mark.parametrize("cut", ["before_the_end", "mid_file"])
def test_a_body_cut_short_adds_nothing(upload_urls: Path, qs_project: QsProject, cut: str) -> None:
    body = multipart(("KR-STR-R0.dwg", drawing().ljust(4096, b"\x00")))
    short = body[: -len(BOUNDARY) - 8] if cut == "before_the_end" else body[:2048]

    response = post(qs_project.member, qs_project.project_id, short)

    assert refusal(response) == (400, {"code": "drawings.uploads.stopped", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


def test_a_content_length_that_claims_less_cuts_the_file_and_adds_nothing(
    upload_urls: Path, qs_project: QsProject
) -> None:
    body = multipart(("KR-STR-R0.dwg", drawing().ljust(4096, b"\x00")))

    response = post(qs_project.member, qs_project.project_id, body, content_length=str(len(body) - 100))

    assert refusal(response) == (400, {"code": "drawings.uploads.stopped", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


def test_two_files_in_one_request_are_refused_and_neither_is_kept(
    upload_urls: Path, qs_project: QsProject
) -> None:
    body = multipart(("KR-STR-R0.dwg", drawing()), ("KR-ARC-R0.dwg", drawing()))

    response = post(qs_project.member, qs_project.project_id, body)

    assert refusal(response) == (400, {"code": "drawings.uploads.one_at_a_time", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


def test_with_no_csrf_token_the_body_is_refused_and_nothing_is_kept(
    upload_urls: Path, qs_project: QsProject
) -> None:
    response = post(
        qs_project.member, qs_project.project_id, multipart(("KR-STR-R0.dwg", drawing())), csrf=False
    )

    assert refusal(response) == (403, {"code": "platform.auth.csrf_failed", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


def test_the_limit_bounds_the_signed_out_before_they_are_refused(
    upload_urls: Path, qs_project: QsProject, limit: int
) -> None:
    over = drawing().ljust(limit + 1, b"\x00")

    signed_out = post(None, qs_project.project_id, multipart(("x.dwg", over)))
    small = post(None, qs_project.project_id, multipart(("x.dwg", drawing())))

    assert refusal(signed_out) == (
        413,
        {"code": "drawings.uploads.too_large", "params": {"file": "x.dwg", "megabytes": 0}},
    )
    assert refusal(small) == (401, {"code": "platform.auth.signed_out", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


@pytest.mark.parametrize(
    ("name", "content", "status", "code"),
    [
        ("KR-STR-R0.dwg", drawing("pdf"), 200, None),
        ("KR-STR-R0.pdf", drawing("dwg"), 200, None),
        ("drawings.zip", b"PK\x03\x04" + b"\x00" * 60, 415, "drawings.uploads.zip"),
        ("KR.dwg", b"PK\x03\x04" + b"\x00" * 60, 415, "drawings.uploads.zip"),
        ("notes.dwg", b"not a drawing at all", 415, "drawings.uploads.not_a_drawing"),
        ("empty.dwg", b"", 400, "drawings.uploads.empty"),
    ],
    # drawing() makes unique bytes, so fixed ids keep collection the same in every xdist worker.
    ids=["pdf-named-dwg", "dwg-named-pdf", "zip", "zip-named-dwg", "not-a-drawing", "empty"],
)
def test_the_kind_is_the_first_bytes_through_the_real_parse(
    upload_urls: Path, qs_project: QsProject, name: str, content: bytes, status: int, code: str | None
) -> None:
    response = post(qs_project.member, qs_project.project_id, multipart((name, content)))

    if code is None:
        assert response.status_code == status
    else:
        assert refusal(response) == (status, {"code": code, "params": {"file": name}})
        assert kept(qs_project.member, upload_urls) == NOTHING


@pytest.mark.parametrize(
    ("name", "label"),
    [
        ("../../x.dwg", "x.dwg"),
        ("C:\\x\\y.dwg", "y.dwg"),
        ("a\u202egpj.dwg", "agpj.dwg"),
        ("a\x00b.dwg", "ab.dwg"),
        ("n" * 300 + ".dwg", "n" * 251 + ".dwg"),
    ],
)
def test_a_hostile_name_arrives_only_as_a_label(
    upload_urls: Path, qs_project: QsProject, name: str, label: str
) -> None:
    response = post(qs_project.member, qs_project.project_id, multipart((name, drawing())))

    assert response.status_code == 200, response.content
    with qs_project.member.acting():
        shown = services.file(response.json()["file_id"])
    assert shown.name == label


def test_a_name_too_long_for_the_form_is_refused_and_nothing_is_kept(
    upload_urls: Path, qs_project: QsProject
) -> None:
    long_name = "n" * 1000 + ".dwg"

    response = post(qs_project.member, qs_project.project_id, multipart((long_name, drawing())))

    assert refusal(response) == (400, {"code": "drawings.uploads.malformed", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


@pytest.mark.parametrize("role", ["md", "guest"])
def test_the_md_and_a_guest_add_nothing(
    upload_urls: Path, qs_project: QsProject, sign_in: Callable[..., Member], role: str
) -> None:
    looker = sign_in(role=role, developer_id=qs_project.member.developer_id)

    response = post(looker, qs_project.project_id, multipart(("KR-STR-R0.dwg", drawing())))

    assert refusal(response) == (403, {"code": "platform.auth.not_allowed", "params": {"role": role}})
    assert kept(qs_project.member, upload_urls) == NOTHING


def test_another_developers_project_is_not_found(
    upload_urls: Path, qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    stranger = sign_in(role="qs")

    response = post(stranger, qs_project.project_id, multipart(("KR-STR-R0.dwg", drawing())))

    assert refusal(response) == (404, {"code": "platform.auth.not_found", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


# One file dropped twice at once, on two connections -------------------------------------------------


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_one_file_dropped_twice_at_once_is_one_row(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="qs")
    with member.acting():
        project = projects.create(code="RC-1", name="Race")
    # The Drawing Set exists already, so the two drops meet at the file, not at making the set.
    with tenancy.acting_in(member.developer_id, user_id=member.user.pk):
        services.add_file(project.id, name="KR-ARC-R0.dwg", content=io.BytesIO(drawing()))
    content = drawing()
    barrier = threading.Barrier(2)
    outcomes: list[str] = []
    errors: list[BaseException] = []

    def drop() -> None:
        try:
            with tenancy.acting_in(member.developer_id, user_id=member.user.pk):
                barrier.wait(timeout=30)
                added = services.add_file(project.id, name="KR-STR-R0.dwg", content=io.BytesIO(content))
                outcomes.append(added.outcome)
        except BaseException as error:
            errors.append(error)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=drop) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)

    assert errors == []
    assert sorted(outcomes) == ["added", "already_here"]
    with member.acting(), connection.cursor() as cursor:
        cursor.execute(
            "select count(*) from drawings_drawingfile where original_name = %s", ["KR-STR-R0.dwg"]
        )
        assert cursor.fetchone() == (1,)


# What Django's parser refuses, refused in the product's words, keeping nothing -----------------------


def raw(*parts: bytes) -> bytes:
    """A multipart body written by hand, part by part (each its headers, a blank line, its bytes)."""
    b = BOUNDARY.encode()
    return b"".join(b"--" + b + b"\r\n" + part + b"\r\n" for part in parts) + b"--" + b + b"--\r\n"


FILE_HEADERS = b'Content-Disposition: form-data; name="file"; filename="KR-STR-R0.dwg"\r\n'


@pytest.mark.parametrize(
    "body",
    [
        pytest.param(
            raw(
                FILE_HEADERS
                + b"Content-Transfer-Encoding: base64\r\n\r\n"
                + base64.b64encode(drawing().ljust(200 * 1024, b"\x00"))
                + b"!!!!"
            ),
            id="base64_that_breaks_after_the_file_began",
        ),
        pytest.param(
            raw(
                FILE_HEADERS + b"\r\n" + drawing(),
                b'Content-Disposition: form-data; name="' + b"n" * 2000 + b'"\r\n\r\nx',
            ),
            id="a_whole_file_then_headers_past_1_kb",
        ),
    ],
)
def test_a_form_that_breaks_as_it_streams_is_refused_and_no_file_is_left(
    upload_urls: Path, qs_project: QsProject, body: bytes
) -> None:
    response = post(qs_project.member, qs_project.project_id, body)

    assert refusal(response) == (400, {"code": "drawings.uploads.malformed", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


@pytest.mark.parametrize(
    ("content_type", "content_length"),
    [
        ("multipart/form-data", None),
        ("multipart/form-data; boundary=", None),
        ("multipart/form-data; boundary=\u00fc", None),
        ("multipart/form-data; boundary=" + "b" * 202, None),
        (MULTIPART_CONTENT, "-1"),
    ],
    ids=["no_boundary", "empty_boundary", "non_ascii_boundary", "boundary_too_long", "negative_length"],
)
def test_a_form_django_would_not_parse_is_refused_in_our_words(
    upload_urls: Path, qs_project: QsProject, content_type: str, content_length: str | None
) -> None:
    response = post(
        qs_project.member,
        qs_project.project_id,
        multipart(("KR-STR-R0.dwg", drawing())),
        content_type=content_type,
        content_length=content_length,
    )

    assert refusal(response) == (400, {"code": "drawings.uploads.malformed", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


def test_a_body_that_says_it_is_larger_than_any_upload_is_refused_unread(
    upload_urls: Path, qs_project: QsProject, limit: int, settings: Any
) -> None:
    most = limit + settings.DATA_UPLOAD_MAX_MEMORY_SIZE + 1024 * 1024
    body = multipart(("KR-STR-R0.dwg", drawing()))

    over = post(qs_project.member, qs_project.project_id, body, content_length=str(most + 1))
    signed_out = post(None, qs_project.project_id, body, content_length=str(most + 1))

    expected = (413, {"code": "drawings.uploads.too_large_unnamed", "params": {"megabytes": 0}})
    assert refusal(over) == refusal(signed_out) == expected
    assert kept(qs_project.member, upload_urls) == NOTHING


def test_a_file_whose_name_cleans_to_nothing_is_refused_without_a_name(
    upload_urls: Path, qs_project: QsProject, limit: int
) -> None:
    over = drawing().ljust(limit + 1, b"\x00")

    # Django keeps a name of spaces (it drops what it cannot print, "." and ".."): the label trims it.
    too_large = post(qs_project.member, qs_project.project_id, multipart(("   ", over)))
    small = post(qs_project.member, qs_project.project_id, multipart(("   ", drawing())))

    assert refusal(too_large) == (
        413,
        {"code": "drawings.uploads.too_large_unnamed", "params": {"megabytes": 0}},
    )
    assert refusal(small) == (400, {"code": "drawings.uploads.no_name", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


def test_a_fault_while_a_file_streams_leaves_no_file_behind(
    upload_urls: Path, qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    from vextrus.drawings.uploads import DrawingUploadHandler

    written = DrawingUploadHandler.receive_data_chunk

    def fails_after_the_first_chunk(self: DrawingUploadHandler, raw_data: bytes, start: int) -> None:
        if start > 0:
            raise RuntimeError("a fault")
        written(self, raw_data, start)

    monkeypatch.setattr(DrawingUploadHandler, "receive_data_chunk", fails_after_the_first_chunk)
    body = multipart(("KR-STR-R0.dwg", drawing().ljust(200 * 1024, b"\x00")))

    response = post(qs_project.member, qs_project.project_id, body)

    assert refusal(response) == (400, {"code": "drawings.uploads.malformed", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


@pytest.mark.parametrize("charset", ["rot13", "base64", "hex", "undefined"])
@pytest.mark.parametrize("signed_in", [True, False])
def test_a_charset_that_is_no_text_encoding_is_refused_in_our_words(
    upload_urls: Path, qs_project: QsProject, charset: str, signed_in: bool
) -> None:
    response = post(
        qs_project.member if signed_in else None,
        qs_project.project_id,
        multipart(("KR-STR-R0.dwg", drawing())),
        content_type=f"{MULTIPART_CONTENT}; charset={charset}",
    )

    assert refusal(response) == (400, {"code": "drawings.uploads.malformed", "params": {}})
    assert kept(qs_project.member, upload_urls) == NOTHING


@pytest.fixture
def spool(settings: Any, tmp_path: Path) -> Path:
    """The product's own URLs, and a temporary folder of its own for uploads in flight."""
    folder = tmp_path / "spool"
    folder.mkdir()
    settings.FILE_UPLOAD_TEMP_DIR = str(folder)
    return folder


@pytest.mark.parametrize(
    ("content_type", "content_length", "over"),
    [
        (MULTIPART_CONTENT, None, True),
        (MULTIPART_CONTENT, "1000000000000", False),
        ("multipart/form-data", None, False),
        (f"{MULTIPART_CONTENT}; charset=rot13", None, False),
    ],
    ids=["file_over_the_limit", "said_too_large", "no_boundary", "no_text_charset"],
)
def test_any_other_view_refuses_what_the_handler_refuses_with_a_400_never_a_500(
    spool: Path,
    qs_project: QsProject,
    limit: int,
    content_type: str,
    content_length: str | None,
    over: bool,
) -> None:
    """The admin (the product's other form) reads the body at its own CSRF check: it answers
    Django's 400, and Django's error view, reading the form again, finds it empty."""
    client, token = csrf_client(None)
    client.raise_request_exception = True
    content = drawing().ljust(limit + 1, b"\x00") if over else drawing()
    extra: dict[str, Any] = {} if content_length is None else {"CONTENT_LENGTH": content_length}

    response = client.generic(
        "POST",
        "/admin/login/",
        multipart(("KR-STR-R0.dwg", content)),
        content_type=content_type,
        headers={"X-CSRFToken": token},
        **extra,
    )

    assert response.status_code == 400
    assert kept(qs_project.member, spool) == NOTHING
