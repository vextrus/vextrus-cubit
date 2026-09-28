"""Storage: files kept by key under the tenant's and the Project's ids (ticket 09).

Each attack on the trust boundary has its test: a key escaping the root (`..`, an absolute key, a
symbolic link planted under the root), a key naming another tenant's or Project's prefix, and a file
changed on disk after it was kept.
"""

import hashlib
import io
import os
import uuid
from collections.abc import Callable, Iterator
from pathlib import Path
from unittest import mock

import pytest
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.test import override_settings
from django.utils import timezone

from vextrus.platform.models import Membership, StoredFile
from vextrus.platform.services import storage, tenancy
from vextrus.testing.tenancy import Member

PROJECT = uuid.UUID("0190c0de-0000-7000-8000-000000000001")
OTHER_PROJECT = uuid.UUID("0190c0de-0000-7000-8000-000000000002")
CONTENT = b"AC1032 a drawing's bytes"


@pytest.fixture
def root(tmp_path: Path) -> Iterator[Path]:
    root = tmp_path / "root"
    with override_settings(VEXTRUS_STORAGE_ROOT=root):
        yield root


@pytest.fixture
def outside(tmp_path: Path) -> Path:
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.txt").write_bytes(b"not yours")
    return outside


@pytest.fixture
def developer(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    return make_developer()


def put(key: str, content: bytes = CONTENT) -> storage.StoredFileInfo:
    return storage.put(key, content, kind="original", media_type="image/vnd.dwg", producer="upload")


def put_then_fail(key: str) -> None:
    with transaction.atomic():
        put(key, b"first try")
        raise RuntimeError("the upload's transaction fails")


def files_under(folder: Path) -> list[str]:
    return sorted(str(path.relative_to(folder)) for path in folder.rglob("*"))


# Keeping and reading ------------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_file_is_kept_under_its_tenant_then_its_project_and_read_back(
    root: Path, developer: uuid.UUID
) -> None:
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "drawings", "f1", "original.dwg")
        kept = put(key)

        assert key == f"{developer}/{PROJECT}/drawings/f1/original.dwg"
        assert kept.sha256 == hashlib.sha256(CONTENT).hexdigest()
        assert kept.size == len(CONTENT)
        assert kept.project_id == PROJECT
        assert storage.get(key) == CONTENT
        assert storage.info(key) == kept
        row = StoredFile.objects.get(key=key)
        assert (row.tenant_id, row.kind, row.producer) == (developer, "original", "upload")
    assert (root / str(developer) / str(PROJECT) / "drawings" / "f1" / "original.dwg").read_bytes() == (
        CONTENT
    )


@pytest.mark.django_db
def test_a_file_object_is_streamed_and_its_derived_facts_kept(root: Path, developer: uuid.UUID) -> None:
    source = hashlib.sha256(CONTENT).hexdigest()
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "drawings", "f1", "entities@libredwg-0.14.json")
        kept = storage.put(
            key,
            io.BytesIO(b"{}" * 1_000_000),
            kind="derived",
            media_type="application/json",
            producer="libredwg",
            producer_version="0.14",
            source_sha256=source,
        )

        assert kept.size == 2_000_000
        assert (kept.kind, kept.producer_version, kept.source_sha256) == ("derived", "0.14", source)


@pytest.mark.django_db
def test_putting_the_same_bytes_again_returns_the_row_and_other_bytes_are_refused(
    root: Path, developer: uuid.UUID
) -> None:
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "original.dwg")
        first = put(key)

        assert put(key) == first
        with pytest.raises(storage.KeyTaken):
            put(key, b"other bytes")
        assert storage.get(key) == CONTENT
        assert StoredFile.objects.filter(key=key).count() == 1
    assert files_under(root / str(developer) / str(PROJECT)) == ["original.dwg"]


@pytest.mark.django_db
def test_a_local_copy_is_checked_and_removed_on_leaving(root: Path, developer: uuid.UUID) -> None:
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "original.dwg")
        put(key)
        with storage.local_copy(key) as path:
            assert path.read_bytes() == CONTENT
            assert path.suffix == ".dwg"
            assert not path.is_relative_to(root)

    assert not path.exists()


@pytest.mark.django_db
def test_a_rolled_back_put_leaves_no_row_and_the_key_free(root: Path, developer: uuid.UUID) -> None:
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "original.dwg")
        with pytest.raises(RuntimeError):
            put_then_fail(key)

        assert not StoredFile.objects.filter(key=key).exists()
        with pytest.raises(storage.FileMissing):
            storage.get(key)
        put(key)
        assert storage.get(key) == CONTENT


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_put_runs_only_inside_the_data_s_transaction(root: Path, developer: uuid.UUID) -> None:
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "original.dwg")
    with (
        mock.patch.object(tenancy, "current_tenant_id", return_value=developer),
        pytest.raises(storage.StorageError, match="inside the data's transaction"),
    ):
        put(key)


@pytest.mark.django_db
def test_nothing_is_kept_or_read_outside_a_tenant(root: Path, developer: uuid.UUID) -> None:
    key = f"{developer}/{PROJECT}/original.dwg"

    with pytest.raises(storage.KeyRefused, match="acting in a tenant"):
        put(key)
    with pytest.raises(storage.KeyRefused):
        storage.get(key)
    with pytest.raises(storage.KeyRefused):
        storage.key(PROJECT, "original.dwg")


# Keys that would leave the root -------------------------------------------------------------------


BAD_NAMES = ["..", ".", "", ".hidden", "a/b", "a\\b", "a\x00b", "~", "a b", "x" * 129, "日本"]


@pytest.mark.django_db
@pytest.mark.parametrize("name", BAD_NAMES)
def test_a_name_that_is_not_a_plain_name_is_refused(root: Path, developer: uuid.UUID, name: str) -> None:
    with tenancy.acting_in(developer), pytest.raises(storage.KeyRefused):
        storage.key(PROJECT, "drawings", name)


def bad_keys(tenant: uuid.UUID) -> list[str]:
    prefix = f"{tenant}/{PROJECT}"
    return [
        "/etc/passwd",
        f"/{prefix}/original.dwg",
        f"{prefix}/../../../outside/secret.txt",
        f"{prefix}/drawings/../../{OTHER_PROJECT}/original.dwg",
        f"{prefix}/./original.dwg",
        f"{prefix}//original.dwg",
        f"{prefix}/original.dwg/",
        f"{prefix}",
        f"{prefix}/",
        f"{prefix}\\..\\original.dwg",
        f"{prefix}/original.dwg\x00.txt",
        f"{prefix}/original.dwg\n",
        f"{str(tenant).upper()}/{PROJECT}/original.dwg",
        f"{tenant}/not-a-project/original.dwg",
        f"{tenant}/{PROJECT}/" + "/".join(["a"] * 9),
        f"{tenant}/{PROJECT}/{'%2e%2e'}/x",
    ]


@pytest.mark.django_db
def test_a_key_that_could_leave_the_root_is_refused_and_nothing_is_written(
    root: Path, outside: Path, developer: uuid.UUID
) -> None:
    with tenancy.acting_in(developer):
        for key in bad_keys(developer):
            with pytest.raises(storage.KeyRefused):
                put(key)
            with pytest.raises(storage.KeyRefused):
                storage.get(key)
            with pytest.raises(storage.KeyRefused), storage.local_copy(key):
                pass
            with pytest.raises(storage.KeyRefused):
                storage.info(key)
        assert not StoredFile.objects.exists()

    assert not root.exists() or files_under(root) == []
    assert files_under(outside) == ["secret.txt"]
    assert (outside / "secret.txt").read_bytes() == b"not yours"


@pytest.mark.django_db
def test_a_non_string_key_is_refused(root: Path, developer: uuid.UUID) -> None:
    with tenancy.acting_in(developer):
        for key in (None, 42, Path(f"{developer}/{PROJECT}/a"), b"a"):
            with pytest.raises(storage.KeyRefused):
                storage.get(key)  # type: ignore[arg-type]


# Another tenant's, another Project's -------------------------------------------------------------


@pytest.mark.django_db
def test_another_tenant_s_prefix_is_refused_even_when_its_file_exists(
    root: Path, make_developer: Callable[..., uuid.UUID]
) -> None:
    mine, theirs = make_developer(), make_developer()
    with tenancy.acting_in(theirs):
        their_key = storage.key(PROJECT, "original.dwg")
        put(their_key, b"their drawing")

    with tenancy.acting_in(mine):
        with pytest.raises(storage.KeyRefused, match="not the acting tenant's"):
            storage.get(their_key)
        with pytest.raises(storage.KeyRefused, match="not the acting tenant's"):
            put(their_key, b"overwritten")
        with pytest.raises(storage.KeyRefused):
            storage.info(their_key)
        assert not StoredFile.objects.filter(key=their_key).exists()  # row-level security

    with tenancy.acting_in(theirs):
        assert storage.get(their_key) == b"their drawing"


@pytest.mark.django_db
def test_a_member_scoped_to_projects_neither_reads_nor_keeps_another_project_s_files(
    root: Path, sign_in: Callable[..., Member]
) -> None:
    everyone = sign_in(role="qs")
    scoped = sign_in(role="guest", developer_id=everyone.developer_id, projects=[PROJECT])
    with everyone.acting():
        other_key = storage.key(OTHER_PROJECT, "original.dwg")
        put(other_key)

    with scoped.acting():
        with pytest.raises(storage.FileMissing):
            storage.get(other_key)
        with pytest.raises(storage.FileMissing):
            storage.info(other_key)
        with pytest.raises(storage.KeyRefused):
            put(storage.key(OTHER_PROJECT, "planted.dwg"))
        own_key = storage.key(PROJECT, "original.dwg")
        put(own_key)
        assert storage.get(own_key) == CONTENT


@pytest.mark.django_db
def test_a_person_whose_membership_has_ended_neither_reads_nor_keeps_any_file(
    root: Path, sign_in: Callable[..., Member]
) -> None:
    member = sign_in(role="qs")
    with member.acting():
        key = storage.key(PROJECT, "original.dwg")
        put(key)
        Membership.objects.filter(id=member.membership_id).update(revoked_at=timezone.now())

    with tenancy.acting_in(member.developer_id, user_id=member.user.pk) as acting:
        assert acting.membership is None
        with pytest.raises(storage.FileMissing):
            storage.get(key)
        with pytest.raises(storage.KeyRefused):
            put(storage.key(PROJECT, "planted.dwg"))
    with tenancy.acting_in(member.developer_id):  # the system, for no user, still reads it
        assert storage.get(key) == CONTENT


@pytest.mark.django_db
def test_the_database_holds_every_key_to_its_own_tenant_and_project(
    root: Path, make_developer: Callable[..., uuid.UUID]
) -> None:
    mine, theirs = make_developer(), make_developer()
    row = {
        "sha256": "0" * 64,
        "kind": "original",
        "media_type": "image/vnd.dwg",
        "size": 1,
        "producer": "upload",
    }
    with tenancy.acting_in(mine):
        with pytest.raises(IntegrityError, match="platform_storedfile_key_prefix"), transaction.atomic():
            StoredFile.objects.create(
                tenant_id=mine, project_id=PROJECT, key=f"{theirs}/{PROJECT}/a.dwg", **row
            )
        with pytest.raises(IntegrityError, match="platform_storedfile_key_prefix"), transaction.atomic():
            StoredFile.objects.create(
                tenant_id=mine, project_id=PROJECT, key=f"{mine}/{OTHER_PROJECT}/a.dwg", **row
            )
        with pytest.raises(IntegrityError, match="platform_storedfile_key_shape"), transaction.atomic():
            StoredFile.objects.create(
                tenant_id=mine, project_id=PROJECT, key=f"{mine}/{PROJECT}/../a.dwg", **row
            )
        with pytest.raises(DatabaseError, match="row-level security"), transaction.atomic():
            StoredFile.objects.create(
                tenant_id=theirs, project_id=PROJECT, key=f"{theirs}/{PROJECT}/a.dwg", **row
            )


@pytest.mark.django_db
def test_the_app_can_neither_change_nor_delete_a_kept_file_s_row(
    root: Path, developer: uuid.UUID
) -> None:
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "original.dwg")
        put(key)
        for statement in (
            "update platform_storedfile set sha256 = repeat('1', 64)",
            "delete from platform_storedfile",
            "truncate platform_storedfile",
        ):
            with (
                pytest.raises(DatabaseError, match="permission denied"),
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                cursor.execute(statement)
        assert storage.get(key) == CONTENT


# Planted links and changed files -----------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("level", ["tenant", "project", "folder"])
def test_a_link_planted_as_a_directory_is_never_followed(
    root: Path, outside: Path, developer: uuid.UUID, level: str
) -> None:
    folders = {
        "tenant": root / str(developer),
        "project": root / str(developer) / str(PROJECT),
        "folder": root / str(developer) / str(PROJECT) / "drawings",
    }
    folders[level].parent.mkdir(parents=True, exist_ok=True)
    folders[level].symlink_to(outside, target_is_directory=True)
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "drawings", "secret.txt")

        with pytest.raises(storage.UnsafePath):
            put(key, b"written outside")
        assert not StoredFile.objects.exists()

    assert files_under(outside) == ["secret.txt"]
    assert (outside / "secret.txt").read_bytes() == b"not yours"


@pytest.mark.django_db
def test_a_link_planted_as_a_kept_file_is_never_read_and_a_put_replaces_the_link_itself(
    root: Path, outside: Path, developer: uuid.UUID
) -> None:
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "original.dwg")
        put(key)
        kept = root / str(developer) / str(PROJECT) / "original.dwg"
        kept.unlink()
        kept.symlink_to(outside / "secret.txt")

        with pytest.raises(storage.UnsafePath):
            storage.get(key)
        with pytest.raises(storage.UnsafePath), storage.local_copy(key):
            pass
        put(key)  # the same bytes again: the link is replaced, its target untouched
        assert not kept.is_symlink()
        assert storage.get(key) == CONTENT

    assert (outside / "secret.txt").read_bytes() == b"not yours"


@pytest.mark.django_db
def test_a_fifo_or_a_directory_planted_as_a_kept_file_is_refused(
    root: Path, developer: uuid.UUID
) -> None:
    with tenancy.acting_in(developer):
        fifo_key = storage.key(PROJECT, "a.dwg")
        folder_key = storage.key(PROJECT, "b.dwg")
        put(fifo_key)
        put(folder_key)
        project = root / str(developer) / str(PROJECT)
        (project / "a.dwg").unlink()
        os.mkfifo(project / "a.dwg")
        (project / "b.dwg").unlink()
        (project / "b.dwg").mkdir()

        with pytest.raises(storage.UnsafePath):
            storage.get(fifo_key)
        with pytest.raises(storage.UnsafePath):
            storage.get(folder_key)
        with pytest.raises(storage.UnsafePath):
            put(folder_key)


@pytest.mark.django_db
def test_a_file_changed_or_removed_on_disk_is_never_used(root: Path, developer: uuid.UUID) -> None:
    with tenancy.acting_in(developer):
        key = storage.key(PROJECT, "original.dwg")
        put(key)
        kept = root / str(developer) / str(PROJECT) / "original.dwg"
        kept.write_bytes(CONTENT.replace(b"drawing", b"DRAWING"))

        with pytest.raises(storage.FileChanged) as changed:
            storage.get(key)
        assert changed.value.message == {"code": "platform.storage.changed", "params": {}}
        with pytest.raises(storage.FileChanged), storage.local_copy(key):
            pass

        kept.unlink()
        with pytest.raises(storage.FileMissing) as missing:
            storage.get(key)
        assert missing.value.message == {"code": "platform.storage.missing", "params": {}}
