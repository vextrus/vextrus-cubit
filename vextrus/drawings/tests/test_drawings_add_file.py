"""Adding a file (ticket 14; m0-screens 4.5's toasts; stories 6, 7, 10, 12): known by its contents,
refused by its first bytes with nothing kept, its name only a label, the same contents adding
nothing, a damaged copy replaced, its Discipline from its name, and a Discipline's first issue."""

import io
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings
from django.db import connection

from vextrus.drawings import services
from vextrus.platform.services import auth
from vextrus.projects import services as projects
from vextrus.testing.drawings import QsProject, add, drawing
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def rows(statement: str, params: list[Any] | None = None) -> list[tuple[Any, ...]]:
    with connection.cursor() as cursor:
        cursor.execute(statement, params or [])
        return list(cursor.fetchall())


def kept(member: Member) -> dict[str, Any]:
    """What the member's Developer keeps of drawings: rows and files under the storage root."""
    with member.acting():
        counts = {
            table: rows(f"select count(*) from {table}")[0][0]
            for table in ("drawings_drawingfile", "drawings_drawingset", "platform_storedfile")
        }
    root = Path(settings.VEXTRUS_STORAGE_ROOT) / str(member.developer_id)
    counts["files"] = sorted(str(p) for p in root.rglob("*") if p.is_file()) if root.exists() else []
    return counts


NOTHING = {"drawings_drawingfile": 0, "drawings_drawingset": 0, "platform_storedfile": 0, "files": []}

ZIP = b"PK\x03\x04" + b"\x14\x00" + b"\x00" * 20 + (5).to_bytes(2, "little") + b"\x00\x00" + b"a.dwg"
DOCX = (
    b"PK\x03\x04" + b"\x14\x00" + b"\x00" * 20 + (19).to_bytes(2, "little") + b"\x00\x00"
    + b"[Content_Types].xml" + b"<Types/>"
)  # fmt: skip


# Known by its first bytes, never by its name --------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "content", "kind"),
    [
        ("KR-STR-R0.dwg", drawing("dwg"), "dwg"),
        ("KR-STR-R0.pdf", drawing("pdf"), "pdf"),
        ("a-pdf-named.dwg", drawing("pdf"), "pdf"),
        ("a-dwg-named.pdf", drawing("dwg"), "dwg"),
        ("AC1014 from R14.dwg", b"AC1014" + b"\x00" * 64, "dwg"),
    ],
)
def test_a_files_kind_is_its_first_bytes(
    qs_project: QsProject, name: str, content: bytes, kind: str
) -> None:
    added = add(qs_project.member, qs_project.project_id, name, content)

    assert (added.outcome, added.file.format, added.file.name) == ("added", kind, name)


@pytest.mark.parametrize(
    ("name", "content", "code", "status"),
    [
        ("drawings.zip", ZIP, "drawings.uploads.zip", 415),
        ("KR-STR-R0.dwg", ZIP, "drawings.uploads.zip", 415),
        ("notes.docx", DOCX, "drawings.uploads.not_a_drawing", 415),
        ("KR-STR-R0.dwg", DOCX, "drawings.uploads.not_a_drawing", 415),
        ("site-plan.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 64, "drawings.uploads.not_a_drawing", 415),
        ("empty.dwg", b"", "drawings.uploads.not_a_drawing", 415),
        ("text.pdf", b"%PD", "drawings.uploads.not_a_drawing", 415),
        ("AC10.dwg", b"AC10", "drawings.uploads.not_a_drawing", 415),
    ],
)
def test_anything_but_a_dwg_or_a_pdf_is_refused_and_nothing_is_kept(
    qs_project: QsProject, name: str, content: bytes, code: str, status: int
) -> None:
    with pytest.raises(auth.Refused) as refused:
        add(qs_project.member, qs_project.project_id, name, content)

    assert (refused.value.status, refused.value.message) == (
        status,
        {"code": code, "params": {"file": name}},
    )
    assert kept(qs_project.member) == NOTHING


def test_a_file_over_the_limit_is_refused_and_nothing_is_kept(
    qs_project: QsProject, settings: Any
) -> None:
    settings.VEXTRUS_UPLOAD_MAX_BYTES = 2 * 1024 * 1024
    content = drawing("dwg").ljust(2 * 1024 * 1024 + 1, b"\x00")

    with pytest.raises(auth.Refused) as refused:
        add(qs_project.member, qs_project.project_id, "KR-ARC-R0.dwg", content)

    assert (refused.value.status, refused.value.message) == (
        413,
        {"code": "drawings.uploads.too_large", "params": {"file": "KR-ARC-R0.dwg", "megabytes": 2}},
    )
    assert kept(qs_project.member) == NOTHING
    at_the_limit = add(qs_project.member, qs_project.project_id, "KR-ARC-R0.dwg", content[:-1])
    assert at_the_limit.outcome == "added"


# The name: the QS's label, never a path or a key ---------------------------------------------------


@pytest.mark.parametrize(
    ("name", "label"),
    [
        ("../../x.dwg", "x.dwg"),
        ("C:\\x\\y.dwg", "y.dwg"),
        ("a\x00b.dwg", "ab.dwg"),
        ("x\u202egpj.dwg", "xgpj.dwg"),
        ("tab\tand\nline.dwg", "tabandline.dwg"),
        ("  spaced   out .dwg  ", "spaced out .dwg"),
        ("n" * 1000 + ".dwg", "n" * 251 + ".dwg"),
    ],
)
def test_a_hostile_name_is_only_a_label(qs_project: QsProject, name: str, label: str) -> None:
    added = add(qs_project.member, qs_project.project_id, name, drawing("dwg"))

    with qs_project.member.acting():
        [(key,)] = rows("select key from platform_storedfile")
    assert added.file.name == label
    assert key == (
        f"{qs_project.member.developer_id}/{qs_project.project_id}/drawings/"
        f"{added.file.sha256}/original.dwg"
    )
    assert not any(p.name not in (added.file.sha256, "original.dwg") for p in _files_of(qs_project))


def _files_of(project: QsProject) -> list[Path]:
    base = (
        Path(settings.VEXTRUS_STORAGE_ROOT) / str(project.member.developer_id) / str(project.project_id)
    )
    return list((base / "drawings").rglob("*"))


def test_a_name_with_nothing_left_after_cleaning_is_refused(qs_project: QsProject) -> None:
    with pytest.raises(auth.Refused) as refused:
        add(qs_project.member, qs_project.project_id, "../\u202e/", drawing("dwg"))

    assert refused.value.message == {"code": "drawings.uploads.stopped", "params": {}}
    assert kept(qs_project.member) == NOTHING


# The same contents again ------------------------------------------------------------------------------


def test_the_same_contents_again_add_nothing_and_say_when_and_by_whom(qs_project: QsProject) -> None:
    content = drawing("dwg")
    first = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content)
    before = kept(qs_project.member)

    again = add(qs_project.member, qs_project.project_id, "copy of it.dwg", content)

    assert again.outcome == "already_here"
    assert again.file.id == first.file.id
    assert again.message == {
        "code": "drawings.uploads.already_here",
        "params": {
            "file": "copy of it.dwg",
            "added_date": first.file.added_at.isoformat(),
            "actor": qs_project.member.user.name,
        },
    }
    assert kept(qs_project.member) == before


def test_the_same_contents_in_another_project_or_developer_are_their_own(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    content = drawing("dwg")
    add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content)
    with qs_project.member.acting():
        other = projects.create(code="OT-2", name="Other")
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code="TH-3", name="Theirs")

    in_another_project = add(qs_project.member, other.id, "KR-STR-R0.dwg", content)
    in_another_developer = add(stranger, theirs.id, "KR-STR-R0.dwg", content)

    assert (in_another_project.outcome, in_another_project.message) == ("added", None)
    assert (in_another_developer.outcome, in_another_developer.message) == ("added", None)
    assert in_another_developer.file.added_by_name == stranger.user.name


def test_the_same_name_with_other_contents_is_added_beside_it(qs_project: QsProject) -> None:
    add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg"))

    second = add(qs_project.member, qs_project.project_id, "kr-str-r0.dwg", drawing("dwg"))

    assert second.outcome == "added"
    assert second.message == {"code": "drawings.uploads.same_name_kept", "params": {}}
    with qs_project.member.acting():
        assert rows("select count(*) from drawings_drawingfile") == [(2,)]


@pytest.mark.parametrize("damage", ["missing", "changed"])
def test_the_same_contents_replace_a_missing_or_damaged_copy_and_read_again(
    qs_project: QsProject, damage: str
) -> None:
    content = drawing("dwg")
    first = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content)
    with qs_project.member.acting():
        services.mark_failed(first.file.id, {"code": "engine.read.reader_failed", "params": {}})
    [original] = [p for p in _files_of(qs_project) if p.name == "original.dwg"]
    if damage == "missing":
        original.unlink()
    else:
        original.write_bytes(b"AC1032 damaged")

    again = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content)

    assert again.outcome == "replaced"
    assert again.message == {"code": "drawings.uploads.replaced", "params": {"file": "KR-STR-R0.dwg"}}
    assert original.read_bytes() == content
    assert again.file.state == services.FileState.WAITING
    with qs_project.member.acting(), services.original(first.file.id) as path:
        assert path.read_bytes() == content


# Its Discipline, and a Discipline's first issue -------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "discipline"),
    [
        ("KR-STR-R0.dwg", "structural"),
        ("kr-arc-r0.dwg", "architectural"),
        ("KR-ELE-R0.pdf", "electrical"),
        ("PLUMBING LAYOUT.dwg", "plumbing"),
        ("hvac_ducts.dwg", "mechanical"),
        ("site-photos.pdf", None),
        ("KR-STR-ARC.dwg", None),
        ("STRUCTURAL-S-01.dwg", "structural"),
        ("STRUCTURE.dwg", None),
    ],
)
def test_a_files_discipline_is_the_one_its_names_whole_words_name(
    qs_project: QsProject, name: str, discipline: str | None
) -> None:
    kind = "pdf" if name.endswith(".pdf") else "dwg"
    added = add(qs_project.member, qs_project.project_id, name, drawing(kind))

    assert added.file.discipline == discipline
    assert added.file.discipline_source == ("file_name" if discipline else None)


def test_a_file_of_a_discipline_not_yet_held_is_its_first_issue_and_touches_no_other(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg"))
    query = (
        "select r.seq, d.key, r.kind, r.id from drawings_revision r"
        " join drawings_discipline d on d.id = r.discipline_id order by r.seq"
    )
    with member.acting():
        structural_before = rows(query)

    add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing("dwg"))
    add(member, qs_project.project_id, "KR-STR-R0.pdf", drawing("pdf"))

    with member.acting():
        after = rows(query)
        per_file = rows(
            "select f.original_name, r.seq from drawings_drawingfile f"
            " join drawings_revision r on r.id = f.revision_id order by f.original_name"
        )
    assert [(seq, key, kind) for seq, key, kind, _ in after] == [
        (1, "structural", "first_issue"),
        (2, "architectural", "first_issue"),
    ]
    assert after[0] == structural_before[0]
    assert per_file == [("KR-ARC-R0.dwg", 2), ("KR-STR-R0.dwg", 1), ("KR-STR-R0.pdf", 1)]


def test_a_member_given_other_projects_adds_to_none_of_these(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    with qs_project.member.acting():
        mine = projects.create(code="MI-1", name="Mine")
    scoped = sign_in(role="qs", developer_id=qs_project.member.developer_id, projects=[mine.id])

    with pytest.raises(auth.NotFound):
        add(scoped, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg"))


def test_the_upload_handler_s_file_is_read_as_given(qs_project: QsProject) -> None:
    content = drawing("pdf")
    upload = io.BytesIO(content)
    with qs_project.member.acting():
        added = services.add_file(qs_project.project_id, name="p.pdf", content=upload, actor_name="N")

    assert (added.file.size, added.file.format, added.file.added_by_name) == (len(content), "pdf", "N")
    assert added.file.id == uuid.UUID(str(added.file.id))
