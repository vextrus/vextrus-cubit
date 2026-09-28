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
        # A Revision is never deleted (so never re-made with theirs), nor made anew with theirs.
        with refused("permission denied"):
            sql("delete from drawings_revision where id = %s", [revision_id])
        with refused("names a Discipline of another Market"):
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
        with refused("permission denied"):  # a view's part is never updated
            sql(
                "update drawings_view set part_id = %s where id = %s",
                [other_market.discipline_ids["zz_only"], view_id],
            )
        sheet_revision_id = one("select sheet_revision_id from drawings_view where id = %s", [view_id])
        with refused("names a Discipline of another Market"):
            sql(
                VIEW,
                [uuid.uuid4(), qs_project.member.developer_id, sheet_revision_id,
                 other_market.discipline_ids["zz_only"], None],
            )  # fmt: skip


VIEW = (
    "insert into drawings_view (id, tenant_id, sheet_revision_id, part_id, predecessor_view_id,"
    " reader_version, ordinal, kind, confirmed_kind, title, box, drawing_unit, not_to_scale,"
    " stated_scale_text, storeys_as_stated, storeys, storeys_meaning, subject, layer, steps,"
    " proposed_exclusion, proposed_exclusion_text, source_sha256, anchors, decision,"
    " excluded_reason, excluded_text) values (%s, %s, %s, %s, %s, '1', 99, 'plan', '', '',"
    " '[\"0\", \"0\", \"1\", \"1\"]', '', false, '', '', '[]', '', '', '', '[]', '', '',"
    " repeat('a', 64), '[]', '', '', '')"
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
            "select sheet_id, location_key, location, source_sha256, reader_version, drawing_set_id"
            " from drawings_sheetrevision where id = %s",
            [printed.id],
        )[0]
        with refused("drawings_sheetrevision_one_per_place", "drawings_sheetrevision_identity"):
            sql(
                PRINTED_SHEET,
                [
                    uuid.uuid4(), qs_project.member.developer_id, row[5], row[0], added.file.id,
                    row[1], row[2], row[3], row[4],
                ],
            )  # fmt: skip


PRINTED_SHEET = (
    "insert into drawings_sheetrevision (id, tenant_id, drawing_set_id, sheet_id, source_file_id,"
    " location_key, location, sheet_key, ordinal, title, revision_mark, issue_date,"
    " storeys_as_stated, sources, content_hash, kind, confirmed_kind, source_sha256,"
    " reader_version, anchors, proposed_exclusion, proposed_exclusion_text,"
    " render_key, plot_none_reason, decision, excluded_reason, excluded_text) values"
    " (%s, %s, %s, %s, %s, %s, %s, '', 2, '', '', '', '', '{}', '', '', '', %s, %s, '[]',"
    " '', '', '', '', '', '', '')"
)


def test_no_reference_crosses_from_one_projects_drawing_set_to_another(qs_project: QsProject) -> None:
    """Within one Developer: a printed sheet, a file's Revision, a state's map row never name a row of
    another Project's Drawing Set, by UPDATE or by INSERT with a chosen id."""
    member = qs_project.member
    ours = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg")).file
    [printed] = read_dwg(member, ours.id, ["S-01"])
    with member.acting():
        other = projects.create(code="OT-6", name="Another project")
    theirs = add(member, other.id, "BP-STR-R0.dwg", drawing("dwg")).file
    [their_sheet] = read_dwg(member, theirs.id, ["S-01"])
    with member.acting():
        our_set, our_revision = sql(
            "select drawing_set_id, revision_id from drawings_drawingfile where id = %s", [ours.id]
        )[0]
        their_revision = one("select revision_id from drawings_drawingfile where id = %s", [theirs.id])
        with refused("permission denied"):  # a printed sheet never moves to another file
            sql(
                "update drawings_sheetrevision set source_file_id = %s where id = %s",
                [theirs.id, printed.id],
            )
        for column, value in (
            ("plot_file_id", theirs.id),
            ("sheet_id", their_sheet.sheet_id),
            ("revision_id", their_revision),
        ):
            with refused("_own_set"):
                # Without its render (whose own check would refuse first), so the key is what holds.
                sql(
                    "update drawings_sheetrevision set render_file_id = null where id = %s", [printed.id]
                )
                sql(
                    f"update drawings_sheetrevision set {column} = %s where id = %s", [value, printed.id]
                )
        with refused("_own_set"):
            sql(
                "update drawings_drawingfile set revision_id = %s where id = %s",
                [their_revision, ours.id],
            )
        location = one("select location from drawings_sheetrevision where id = %s", [printed.id])
        with refused("_own_set"):  # our set's id, their Sheet: a chosen id across Projects
            sql(
                PRINTED_SHEET,
                [uuid.uuid4(), member.developer_id, our_set, their_sheet.sheet_id, ours.id,
                 '{"layout":"X"}', location, ours.sha256, "1"],
            )  # fmt: skip
        state = one("select current_state_id from drawings_drawingset where id = %s", [our_set])
        with refused("_own_set"):
            sql(
                "insert into drawings_statesheet (id, tenant_id, drawing_set_id, state_id,"
                " sheet_revision_id) values (%s, %s, %s, %s, %s)",
                [uuid.uuid4(), member.developer_id, our_set, state, their_sheet.id],
            )
    assert our_revision is not None


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


def test_a_file_inserted_with_a_chosen_id_names_only_its_markets_discipline_and_projects_building(
    qs_project: QsProject, other_market: OtherMarket
) -> None:
    member = qs_project.member
    first = add(member, qs_project.project_id, "A-01.dwg", drawing("dwg")).file
    with member.acting():
        other = projects.create(code="OT-8", name="Another")
        [elsewhere] = projects.buildings(other.id)
        set_id, stored_id, size, building_id = sql(
            "select drawing_set_id, stored_file_id, size, building_id from drawings_drawingfile"
            " where id = %s",
            [first.id],
        )[0]
        insert = (
            "insert into drawings_drawingfile (id, tenant_id, drawing_set_id, sha256, format,"
            " original_name, size, stored_file_id, discipline_id, discipline_source, building_id,"
            " read_status, read_step, sheets_done, bangla_lines, unmatched_pages, empty_layouts,"
            " added_by_name, added_by_vextrus, added_at, cancelled_by_name, cancelled_by_vextrus,"
            " held_answer, read_tries, revision_id) values (%s, %s, %s, %s, 'dwg', 'x.dwg', %s, %s,"
            " %s, %s, %s, 'queued', '', 0, '[]', '[]', 0, '', false, now(), '', false, '', 0, %s)"
        )
        with refused("names a Discipline of another Market"):
            sql(
                insert,
                [uuid.uuid4(), member.developer_id, set_id, "1" * 64, size, stored_id,
                 other_market.discipline_ids["structural"], "qs", building_id, None],
            )  # fmt: skip
        with refused("names a Building of another Project"):
            sql(
                insert,
                [uuid.uuid4(), member.developer_id, set_id, first.sha256, size, stored_id, None, "",
                 elsewhere.id, None],
            )  # fmt: skip
        electrical = one("select id from drawings_discipline where key = 'electrical'")
        revision_id = one("select revision_id from drawings_drawingfile where id = %s", [first.id])
        with refused("names a Revision of another Discipline"):
            sql(
                insert,
                [uuid.uuid4(), member.developer_id, set_id, first.sha256, size, stored_id,
                 electrical, "qs", building_id, revision_id],
            )  # fmt: skip


def test_a_kept_artefact_names_only_a_file_derived_from_its_own(qs_project: QsProject) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "S.dwg", drawing("dwg")).file
    with member.acting():
        original = one("select stored_file_id from drawings_drawingfile where id = %s", [found.id])
        with refused("names a kept file not derived from this file"):
            sql(
                "insert into drawings_artefact (id, tenant_id, file_id, reader, reader_version,"
                " schema_version, insunits, stored_file_id, created_at) values"
                " (%s, %s, %s, 'r', '1', 1, 4, %s, now())",
                [uuid.uuid4(), member.developer_id, found.id, original],
            )


def test_a_render_is_a_kept_file_of_its_own_project(qs_project: QsProject) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "S.dwg", drawing("dwg")).file
    [printed] = read_dwg(member, found.id, ["S-01"])
    with member.acting():
        other = projects.create(code="OT-7", name="Another")
    theirs = add(member, other.id, "T.dwg", drawing("dwg")).file
    [their_sheet] = read_dwg(member, theirs.id, ["T-01"])
    with member.acting():
        their_render = one(
            "select render_file_id from drawings_sheetrevision where id = %s", [their_sheet.id]
        )
        original = one("select stored_file_id from drawings_drawingfile where id = %s", [found.id])
        for stored in (their_render, original):
            with refused("names a render that is not a kept file of its Project"):
                sql(
                    "update drawings_sheetrevision set render_file_id = %s where id = %s",
                    [stored, printed.id],
                )


def test_one_unnumbered_sheet_per_place_in_a_file(qs_project: QsProject) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "S.dwg", drawing("dwg")).file
    with member.acting():
        set_id = one("select drawing_set_id from drawings_drawingfile where id = %s", [found.id])
        insert = (
            "insert into drawings_sheet (id, tenant_id, drawing_set_id, building_id, discipline_id,"
            " number, title, consultant_office, storeys_as_stated, source_file_id, location_key)"
            " values (%s, %s, %s, null, null, '', 'SCHEDULE', '', '', %s, '{\"layout\":\"L\"}')"
        )
        sql(insert, [uuid.uuid4(), member.developer_id, set_id, found.id])
        with refused("drawings_sheet_unnumbered_identity"):
            sql(insert, [uuid.uuid4(), member.developer_id, set_id, found.id])
        with refused("drawings_sheet_number_or_place"):  # no number and no place
            sql(
                "insert into drawings_sheet (id, tenant_id, drawing_set_id, building_id, discipline_id,"
                " number, title, consultant_office, storeys_as_stated, location_key) values"
                " (%s, %s, %s, null, null, '', '', '', '', '')",
                [uuid.uuid4(), member.developer_id, set_id],
            )


def test_drawings_holds_no_security_definer_function() -> None:
    rows = sql(
        "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace"
        " where n.nspname = 'public' and p.proname like 'drawings%%' and p.prosecdef"
    )
    assert rows == []
    assert len(sql("select 1 from pg_proc where proname like 'drawings%%'")) == 7


def test_a_files_revision_is_one_of_its_own_discipline(dwg: tuple[QsProject, uuid.UUID]) -> None:
    project, file_id = dwg
    with project.member.acting():
        set_id, revision_id = sql(
            "select drawing_set_id, revision_id from drawings_drawingfile where id = %s", [file_id]
        )[0]
        electrical = one("select id from drawings_discipline where key = 'electrical'")
        theirs = uuid.uuid4()
        sql(
            "insert into drawings_revision (id, tenant_id, drawing_set_id, seq, label,"
            " discipline_id, kind, received_at) values (%s, %s, %s, 7, '', %s, 'first_issue', now())",
            [theirs, project.member.developer_id, set_id, electrical],
        )
        with refused("names a Revision of another Discipline"):
            sql("update drawings_drawingfile set revision_id = %s where id = %s", [theirs, file_id])
        with refused("names a Revision of another Discipline"):  # its Discipline alone, not its Revision
            sql(
                "update drawings_drawingfile set discipline_id = %s where id = %s", [electrical, file_id]
            )
        with refused("permission denied"):
            sql(
                "update drawings_revision set discipline_id = %s where id = %s",
                [electrical, revision_id],
            )


@pytest.mark.parametrize(
    ("table", "column", "value"),
    [
        ("drawings_sheet", "drawing_set_id", "set"),
        ("drawings_sheet", "building_id", "null"),
        ("drawings_sheet", "source_file_id", "file"),
        ("drawings_sheet", "location_key", "'elsewhere'"),
        ("drawings_sheet", "tenant_id", "tenant"),
        ("drawings_sheetrevision", "drawing_set_id", "set"),
        ("drawings_sheetrevision", "source_file_id", "file"),
        ("drawings_sheetrevision", "location_key", "'elsewhere'"),
        ("drawings_sheetrevision", "tenant_id", "tenant"),
        ("drawings_view", "sheet_revision_id", "printed"),
        ("drawings_view", "box", "'[]'"),
        ("drawings_view", "kind", "'section'"),
        ("drawings_view", "predecessor_view_id", "null"),
        ("drawings_view", "tenant_id", "tenant"),
        ("drawings_statesheet", "sheet_revision_id", "printed"),
        ("drawings_revision", "kind", "'reissue'"),
    ],
)
def test_what_a_reading_holds_in_place_is_never_updated(
    qs_project: QsProject, table: str, column: str, value: str
) -> None:
    """A Sheet never moves to another set, Building, file or place; a printed sheet never to another
    set, file or place; a view takes only a decision; a state's map row and a Revision never change."""
    member = qs_project.member
    added = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg"))
    [printed] = read_dwg(member, added.file.id, ["S-01"])
    with member.acting():
        set_id = one("select drawing_set_id from drawings_drawingfile where id = %s", [added.file.id])
        values = {
            "set": set_id,
            "file": added.file.id,
            "printed": printed.id,
            "tenant": member.developer_id,
        }
        row_id = one(
            f"select id from {table} where drawing_set_id = %s limit 1"
            if table != "drawings_view"
            else "select v.id from drawings_view v join drawings_sheetrevision r"
            " on r.id = v.sheet_revision_id where r.drawing_set_id = %s limit 1",
            [set_id],
        )
        literal = value if value not in values else "%s"
        params = [values[value]] if value in values else []
        with refused("permission denied"):
            sql(f"update {table} set {column} = {literal} where id = %s", [*params, row_id])


def test_a_views_predecessor_is_a_view_of_its_own_drawing_set(qs_project: QsProject) -> None:
    member = qs_project.member
    ours = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg")).file
    [printed] = read_dwg(member, ours.id, ["S-01"])
    with member.acting():
        other = projects.create(code="OT-9", name="Another project")
    theirs = add(member, other.id, "BP-STR-R0.dwg", drawing("dwg")).file
    [their_printed] = read_dwg(member, theirs.id, ["S-01"])
    with member.acting():
        view_of = "select id from drawings_view where sheet_revision_id = %s limit 1"
        our_view, their_view = one(view_of, [printed.id]), one(view_of, [their_printed.id])
        with refused("names a view of another Drawing Set"):
            sql(VIEW, [uuid.uuid4(), member.developer_id, printed.id, None, their_view])
        sql(VIEW, [uuid.uuid4(), member.developer_id, printed.id, None, our_view])  # its own set's


# A reading's own rows, which the app may delete: never while something names them ----------------------


def their_printed_sheet(member: Member) -> tuple[Any, Any]:
    """A printed sheet of another Project's Drawing Set (the same Developer)."""
    with member.acting():
        other = projects.create(code="OT-10", name="Another project")
    theirs = add(member, other.id, "BP-STR-R0.dwg", drawing("dwg")).file
    [printed] = read_dwg(member, theirs.id, ["S-01"])
    return theirs, printed


@pytest.mark.parametrize("deferred", [False, True])
def test_a_printed_sheet_is_never_deleted_and_made_again_in_another_set_with_its_views(
    qs_project: QsProject, deferred: bool
) -> None:
    """The refuter's sequence: its map row, then the printed sheet, then it again under its id in
    another Project's set, its views still naming it. The views' key is checked at the delete."""
    member = qs_project.member
    ours = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg")).file
    [printed] = read_dwg(member, ours.id, ["S-01"])
    theirs, their_printed = their_printed_sheet(member)
    with member.acting():
        their_set, location = sql(
            "select drawing_set_id, location from drawings_sheetrevision where id = %s",
            [their_printed.id],
        )[0]
        with refused("drawings_view_sheet_revision_own_tenant"):
            if deferred:
                sql("set constraints all deferred")
            sql("delete from drawings_statesheet where sheet_revision_id = %s", [printed.id])
            sql("delete from drawings_sheetrevision where id = %s", [printed.id])
            sql(
                PRINTED_SHEET,
                [printed.id, member.developer_id, their_set, their_printed.sheet_id, theirs.id,
                 '{"layout":"MOVED"}', location, theirs.sha256, "1"],
            )  # fmt: skip


def test_a_sheet_is_never_deleted_and_made_again_in_another_building(qs_project: QsProject) -> None:
    member = qs_project.member
    ours = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg")).file
    [printed] = read_dwg(member, ours.id, ["S-01"])
    with member.acting():
        set_id, discipline_id = sql(
            "select drawing_set_id, discipline_id from drawings_sheet where id = %s", [printed.sheet_id]
        )[0]
        with refused("drawings_sheetrevision_sheet_own_set"):
            sql("delete from drawings_sheet where id = %s", [printed.sheet_id])
            sql(
                "insert into drawings_sheet (id, tenant_id, drawing_set_id, building_id,"
                " discipline_id, number, title, consultant_office, storeys_as_stated,"
                " location_key) values (%s, %s, %s, null, %s, 'S-01', '', '', '', '')",
                [printed.sheet_id, member.developer_id, set_id, discipline_id],
            )


def test_a_views_predecessor_is_never_deleted_and_made_again_in_another_set(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    ours = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing("dwg")).file
    [printed] = read_dwg(member, ours.id, ["S-01"])
    _theirs, their_printed = their_printed_sheet(member)
    with member.acting():
        earlier = one("select id from drawings_view where sheet_revision_id = %s limit 1", [printed.id])
        sql(VIEW, [uuid.uuid4(), member.developer_id, printed.id, None, earlier])
        with refused("drawings_view_predecessor_view_own_tenant"):
            sql("delete from drawings_view where id = %s", [earlier])
            sql(VIEW, [earlier, member.developer_id, their_printed.id, None, None])
