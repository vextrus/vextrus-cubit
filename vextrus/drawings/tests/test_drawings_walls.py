"""The database's walls around `drawings`, attacked as vextrus_app by every write (ticket 14;
docs/data-model.md §2; session 04's lesson: "blocked by UPDATE" is not "blocked"): each invariant by
UPDATE, by DELETE then INSERT, and by INSERT with a chosen id, from the app's own connection inside
the tenant, as a flaw in the app's code would write."""

import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any

import pytest
from django.db import DatabaseError, connection, transaction

from vextrus.drawings import services
from vextrus.drawings.tests.conftest import OtherMarket
from vextrus.platform.services import tenancy
from vextrus.projects import services as projects
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def sql(statement: str, params: list[Any] | None = None) -> list[tuple[Any, ...]]:
    with connection.cursor() as cursor:
        cursor.execute(statement, params or [])
        return list(cursor.fetchall()) if cursor.description else []


@contextmanager
def refused(*words: str) -> Iterator[None]:
    """The write inside fails in the database (its savepoint rolls back), with one of these words."""
    said = None
    try:
        with transaction.atomic():
            yield
            sql("set constraints all immediate")
    except DatabaseError as error:
        said = str(error)
    if said is None:
        pytest.fail("the write was not refused")
    assert any(word in said for word in words), said


def one(statement: str, params: list[Any] | None = None) -> Any:
    [(value,)] = sql(statement, params)
    return value


@pytest.fixture
def dwg(qs_project: QsProject) -> tuple[QsProject, uuid.UUID]:
    added = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg"))
    return qs_project, added.file.id


# The Library: the Market's Disciplines -----------------------------------------------------------


def test_the_app_reads_its_markets_disciplines_and_writes_none(qs_project: QsProject) -> None:
    with qs_project.member.acting():
        keys = [row[0] for row in sql("select key from drawings_discipline order by sort_order")]
        assert keys == [
            "structural", "architectural", "electrical", "plumbing",
            "fire", "mechanical", "lift", "gas",
        ]  # fmt: skip
        any_id = one("select id from drawings_discipline where key = 'gas'")
        with refused("permission denied"):
            sql('update drawings_discipline set labels = \'{"en": "Gasoline"}\' where id = %s', [any_id])
        with refused("permission denied"):
            sql("delete from drawings_discipline where id = %s", [any_id])
        with refused("permission denied"):
            sql(
                "insert into drawings_discipline (id, tenant_id, key, labels, kind, sort_order,"
                " prefixes) values (%s, %s, 'solar', '{}', 'mep', 9, '[]')",
                [uuid.uuid4(), qs_project.member.developer_id],
            )


def test_another_markets_disciplines_are_out_of_sight(
    qs_project: QsProject, other_market: OtherMarket
) -> None:
    with qs_project.member.acting():
        assert one("select count(*) from drawings_discipline where tenant_id = %s", [
            other_market.library_id
        ]) == 0  # fmt: skip
        shown = services.disciplines()
        assert len(shown) == 8
        assert all(d.id not in other_market.discipline_ids.values() for d in shown)


def test_a_file_never_names_another_markets_discipline_by_any_write(
    dwg: tuple[QsProject, uuid.UUID], other_market: OtherMarket
) -> None:
    project, file_id = dwg
    theirs = other_market.discipline_ids["structural"]
    with project.member.acting():
        with refused("names a Discipline of another Market"):
            sql("update drawings_drawingfile set discipline_id = %s where id = %s", [theirs, file_id])
        revision_id = one("select revision_id from drawings_drawingfile where id = %s", [file_id])
        set_id = one("select drawing_set_id from drawings_drawingfile where id = %s", [file_id])
        # A Revision may be deleted by the app (an emptied first issue): never re-made with theirs.
        with refused("names a Discipline of another Market"):
            sql("delete from drawings_revision where id = %s", [revision_id])
            sql(
                "insert into drawings_revision (id, tenant_id, drawing_set_id, seq, label,"
                " discipline_id, kind, received_at) values (%s, %s, %s, 99, '', %s,"
                " 'first_issue', now())",
                [uuid.uuid4(), project.member.developer_id, set_id, theirs],
            )
        with refused("names a Discipline of another Market"):
            sql(
                "insert into drawings_sheet (id, tenant_id, drawing_set_id, building_id,"
                " discipline_id, number, title, consultant_office, storeys_as_stated,"
                " location_key) values (%s, %s, %s, null, %s, 'S-99', '', '', '', '')",
                [uuid.uuid4(), project.member.developer_id, set_id, theirs],
            )


def test_a_view_never_names_another_markets_discipline_as_its_part(
    qs_project: QsProject, other_market: OtherMarket
) -> None:
    added = add(qs_project.member, qs_project.project_id, "KR-ELE-R0.dwg", drawing("dwg"))
    read_dwg(qs_project.member, added.file.id, ["E-01"])
    with qs_project.member.acting():
        view_id = one(
            "select v.id from drawings_view v join drawings_sheetrevision r"
            " on r.id = v.sheet_revision_id where r.source_file_id = %s",
            [added.file.id],
        )
        with refused("names a Discipline of another Market"):
            sql(
                "update drawings_view set part_id = %s where id = %s",
                [other_market.discipline_ids["zz_only"], view_id],
            )


# A file: its contents, its set and its reading --------------------------------------------------


@pytest.mark.parametrize(
    "column",
    ["sha256", "stored_file_id", "original_name", "drawing_set_id", "building_id", "size", "format"],
)
def test_a_files_contents_name_set_and_building_are_never_updated(
    dwg: tuple[QsProject, uuid.UUID], column: str
) -> None:
    project, file_id = dwg
    with project.member.acting(), refused("permission denied"):
        sql(f"update drawings_drawingfile set {column} = {column} where id = %s", [file_id])


def test_a_file_is_never_deleted_so_its_steps_cannot_go_with_it(
    dwg: tuple[QsProject, uuid.UUID],
) -> None:
    project, file_id = dwg
    with project.member.acting(), refused("permission denied"):
        sql("delete from drawings_drawingfile where id = %s", [file_id])


def test_a_file_names_only_its_own_contents_by_insert_with_a_chosen_id(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    first = add(member, qs_project.project_id, "A-01.dwg", drawing("dwg")).file
    second = add(member, qs_project.project_id, "A-02.dwg", drawing("dwg")).file
    with member.acting():
        row = sql(
            "select drawing_set_id, stored_file_id, size, building_id from drawings_drawingfile"
            " where id = %s",
            [first.id],
        )[0]
        insert = (
            "insert into drawings_drawingfile (id, tenant_id, drawing_set_id, sha256, format,"
            " original_name, size, stored_file_id, discipline_source, building_id, read_status,"
            " read_step, sheets_done, bangla_lines, unmatched_pages, empty_layouts, added_by_name,"
            " added_at, cancelled_by_name, held_answer) values (%s, %s, %s, %s, 'dwg', 'x.dwg',"
            " %s, %s, '', %s, 'queued', '', 0, '[]', '[]', 0, '', now(), '', '')"
        )
        # The first file's original under the second's sha256: not its own contents.
        with refused("names an original that is not its own contents"):
            sql(
                insert,
                [uuid.uuid4(), member.developer_id, row[0], second.sha256, row[2], row[1], row[3]],
            )
        # A made-up sha256 with a real original: the same.
        with refused("names an original that is not its own contents"):
            sql(insert, [uuid.uuid4(), member.developer_id, row[0], "f" * 64, row[2], row[1], row[3]])


def test_a_files_building_is_one_of_its_projects(qs_project: QsProject) -> None:
    member = qs_project.member
    added = add(member, qs_project.project_id, "S-01.dwg", drawing("dwg")).file
    with member.acting():
        other = projects.create(code="OT-1", name="Another")
        [elsewhere] = projects.buildings(other.id)
        set_id = one("select drawing_set_id from drawings_drawingfile where id = %s", [added.id])
        with refused("names a Building of another Project"):
            sql(
                "insert into drawings_sheet (id, tenant_id, drawing_set_id, building_id,"
                " discipline_id, number, title, consultant_office, storeys_as_stated,"
                " location_key) values (%s, %s, %s, %s, null, 'S-77', '', '', '', '')",
                [uuid.uuid4(), member.developer_id, set_id, elsewhere.id],
            )


def test_a_drawing_set_is_only_ever_its_own_developers_projects(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code="TH-1", name="Theirs")
    add(qs_project.member, qs_project.project_id, "S-01.dwg", drawing("dwg"))
    with qs_project.member.acting():
        set_id = one("select id from drawings_drawingset")
        with refused("permission denied"):
            sql("update drawings_drawingset set project_id = %s where id = %s", [theirs.id, set_id])
        with refused("permission denied"):
            sql("delete from drawings_drawingset where id = %s", [set_id])
        with refused("names a Project that is not this Developer's"):
            sql(
                "insert into drawings_drawingset (id, tenant_id, project_id, name, created_at)"
                " values (%s, %s, %s, '', now())",
                [uuid.uuid4(), qs_project.member.developer_id, theirs.id],
            )


# A read job's steps: insert-only -----------------------------------------------------------------


def test_a_read_step_is_never_changed_or_deleted(dwg: tuple[QsProject, uuid.UUID]) -> None:
    project, file_id = dwg
    with project.member.acting():
        step_id = uuid.uuid4()
        sql(
            "insert into drawings_readstep (id, tenant_id, file_id, step, input_hash, result,"
            " created_at) values (%s, %s, %s, 'opening', %s, '{}', now())",
            [step_id, project.member.developer_id, file_id, "a" * 64],
        )
        with refused("permission denied"):
            sql("update drawings_readstep set result = '{\"n\": 2}' where id = %s", [step_id])
        with refused("permission denied"):
            sql("delete from drawings_readstep where id = %s", [step_id])
        with refused("duplicate key"):  # the same key again: never a second answer to one step
            sql(
                "insert into drawings_readstep (id, tenant_id, file_id, step, input_hash, result,"
                " created_at) values (%s, %s, %s, 'opening', %s, '{\"n\": 2}', now())",
                [uuid.uuid4(), project.member.developer_id, file_id, "a" * 64],
            )


def test_a_step_names_only_its_own_developers_file(
    dwg: tuple[QsProject, uuid.UUID], sign_in: Callable[..., Member]
) -> None:
    _project, file_id = dwg
    stranger = sign_in(role="qs")
    with stranger.acting():
        # Their own tenant id, our file's id: the same-tenant key refuses it.
        with refused("violates foreign key", "own_tenant"):
            sql(
                "insert into drawings_readstep (id, tenant_id, file_id, step, input_hash, result,"
                " created_at) values (%s, %s, %s, 'opening', %s, '{}', now())",
                [uuid.uuid4(), stranger.developer_id, file_id, "b" * 64],
            )
        # Our tenant id: the own-tenant policy refuses the row.
        with refused("row-level security"):
            sql(
                "insert into drawings_readstep (id, tenant_id, file_id, step, input_hash, result,"
                " created_at) values (%s, %s, %s, 'opening', %s, '{}', now())",
                [uuid.uuid4(), _project.member.developer_id, file_id, "b" * 64],
            )


def test_a_kept_artefact_is_never_changed_or_deleted(qs_project: QsProject) -> None:
    added = add(qs_project.member, qs_project.project_id, "S-01.dwg", drawing("dwg"))
    read_dwg(qs_project.member, added.file.id, ["S-01"])
    with qs_project.member.acting():
        artefact_id = one("select id from drawings_artefact")
        with refused("permission denied"):
            sql("update drawings_artefact set reader_version = 'x' where id = %s", [artefact_id])
        with refused("permission denied"):
            sql("delete from drawings_artefact where id = %s", [artefact_id])


# Identities -----------------------------------------------------------------------------------------


def test_one_sheet_per_number_in_a_discipline_and_building_even_with_no_building(
    dwg: tuple[QsProject, uuid.UUID],
) -> None:
    project, file_id = dwg
    with project.member.acting():
        set_id = one("select drawing_set_id from drawings_drawingfile where id = %s", [file_id])
        discipline_id = one("select id from drawings_discipline where key = 'structural'")
        insert = (
            "insert into drawings_sheet (id, tenant_id, drawing_set_id, building_id, discipline_id,"
            " number, title, consultant_office, storeys_as_stated, location_key) values"
            " (%s, %s, %s, null, %s, 'S-01', '', '', '', '')"
        )
        sql(insert, [uuid.uuid4(), project.member.developer_id, set_id, discipline_id])
        with refused("drawings_sheet_identity"):  # a Site sheet's empty Building is one Building
            sql(insert, [uuid.uuid4(), project.member.developer_id, set_id, discipline_id])


def test_one_printed_sheet_per_place_in_a_file(qs_project: QsProject) -> None:
    added = add(qs_project.member, qs_project.project_id, "S.dwg", drawing("dwg"))
    [printed] = read_dwg(qs_project.member, added.file.id, ["S-01"])
    with qs_project.member.acting():
        row = sql(
            "select sheet_id, location_key, location, source_sha256, reader_version"
            " from drawings_sheetrevision where id = %s",
            [printed.id],
        )[0]
        with refused("drawings_sheetrevision_one_per_place", "drawings_sheetrevision_identity"):
            sql(
                "insert into drawings_sheetrevision (id, tenant_id, sheet_id, source_file_id,"
                " location_key, location, sheet_key, ordinal, title, revision_mark, issue_date,"
                " storeys_as_stated, sources, content_hash, kind, confirmed_kind, source_sha256,"
                " reader_version, anchors, proposed_exclusion, proposed_exclusion_text,"
                " render_key, plot_none_reason, decision, excluded_reason, excluded_text) values"
                " (%s, %s, %s, %s, %s, %s, '', 2, '', '', '', '', '{}', '', '', '', %s, %s, '[]',"
                " '', '', '', '', '', '', '')",
                [
                    uuid.uuid4(), qs_project.member.developer_id, row[0], added.file.id,
                    row[1], row[2], row[3], row[4],
                ],
            )  # fmt: skip


def test_one_first_issue_per_discipline_in_a_set(dwg: tuple[QsProject, uuid.UUID]) -> None:
    project, file_id = dwg
    with project.member.acting():
        set_id, discipline_id = sql(
            "select drawing_set_id, discipline_id from drawings_drawingfile where id = %s", [file_id]
        )[0]
        with refused("drawings_revision_one_first_issue"):
            sql(
                "insert into drawings_revision (id, tenant_id, drawing_set_id, seq, label,"
                " discipline_id, kind, received_at) values (%s, %s, %s, 50, '', %s,"
                " 'first_issue', now())",
                [uuid.uuid4(), project.member.developer_id, set_id, discipline_id],
            )


def test_a_printed_sheet_never_names_another_developers_sheet(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    added = add(qs_project.member, qs_project.project_id, "S.dwg", drawing("dwg"))
    [printed] = read_dwg(qs_project.member, added.file.id, ["S-01"])
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code="TH-2", name="Theirs")
    their_file = add(stranger, theirs.id, "T.dwg", drawing("dwg")).file
    [their_sheet] = read_dwg(stranger, their_file.id, ["T-01"])
    # Their own printed sheet moved onto our Sheet by UPDATE: refused (the render's trigger no
    # longer finds its Project's set, and the same-tenant key refuses the Sheet).
    with stranger.acting(), refused("violates foreign key", "own_tenant", "names a render"):
        sql(
            "update drawings_sheetrevision set sheet_id = %s where id = %s",
            [printed.sheet_id, their_sheet.id],
        )


def test_the_acting_tenant_never_sees_another_developers_drawings(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    add(qs_project.member, qs_project.project_id, "S.dwg", drawing("dwg"))
    stranger = sign_in(role="qs")
    with stranger.acting():
        for table in ("drawingset", "drawingfile", "revision", "drawingsetstate"):
            assert one(f"select count(*) from drawings_{table}") == 0, table
    with tenancy.acting_in(None):
        assert one("select count(*) from drawings_drawingfile") == 0
