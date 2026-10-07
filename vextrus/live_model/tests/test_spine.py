"""The spine's walls and rules beyond S16-L's acceptance tests: vextrus_app may only close a state, a
trace or a placement; a reference never crosses a tenant; `apply` refuses what it cannot hold; a
figure, not a mark, changes the figures hash; the Library sync is idempotent; and the inspector
answers 404 for an Element of another Project of the same Developer."""

import uuid
from collections.abc import Callable
from decimal import Decimal

import pytest
from django.core.exceptions import PermissionDenied
from django.db import connections

from vextrus.live_model import library, services
from vextrus.live_model.models import ElementState, ElementTrace, ModelVersion
from vextrus.live_model.tests.acceptance.ts16l.model import building_of, column
from vextrus.live_model.tests.attacks import DENIED, OUT_OF_REACH, immediate, refused
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import library as platform_library
from vextrus.projects import services as projects
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

CLOSE_ONLY = ("live_model_elementstate", "live_model_elementtrace", "live_model_viewplacement")


def storey(name: str, index: int, level: str, height: str) -> services.StateChange:
    return services.StateChange(
        family="storey",
        identity_key=f"storey|{name}",
        mark=name,
        attrs={
            "vx.storey.index": str(index),
            "vx.storey.slab_level": level,
            "vx.storey.height": height,
        },
    )


@pytest.mark.django_db
@pytest.mark.parametrize("table", CLOSE_ONLY)
def test_the_app_may_close_a_validity_and_change_nothing_else(table: str, qs_project: QsProject) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting(), connections["default"].cursor() as cursor:
        services.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        if table == "live_model_viewplacement":
            cursor.execute(
                "insert into live_model_viewplacement (id, tenant_id, building_id, view_id, meaning, "
                "valid_from_seq) values (%s, %s, %s, %s, 'at_floor_level', 1)",
                [uuid.uuid4(), qs_project.member.developer_id, building, uuid.uuid4()],
            )
        cursor.execute(f"update {table} set valid_to_seq = 7")
        assert cursor.rowcount == 1
        assert DENIED in refused(lambda: cursor.execute(f"update {table} set valid_from_seq = 2"))
        assert DENIED in refused(lambda: cursor.execute(f"delete from {table}"))


@pytest.mark.django_db
def test_a_state_never_names_another_tenant_s_element(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        services.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        theirs = ElementState.objects.get().element_id
    other = sign_in(role="qs")
    with other.acting():
        write = immediate(
            lambda: ElementState.objects.create(
                tenant_id=other.developer_id,
                element_id=theirs,
                valid_from_seq=1,
                facts_hash="x",
                figures_hash="x",
            )
        )
        assert "violates foreign key constraint" in refused(write)


@pytest.mark.django_db
def test_a_family_classification_never_names_another_tenant_s_family(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    other = sign_in(role="qs")
    with qs_project.member.acting(), connections["default"].cursor() as cursor:
        cursor.execute("select id from live_model_classificationreference limit 1")
        reference = cursor.fetchone()[0]
        cursor.execute(
            "insert into live_model_elementfamily (id, tenant_id, key, discipline, takeoff_step, labels,"
            " identity_rule, ifc_class, ifc_predefined_type, milestone) values (%s, %s, 'own_column',"
            " 'structural', '', '{}', 'grid_point', 'IfcColumn', '', 'M1')",
            [family := uuid.uuid4(), qs_project.member.developer_id],
        )
    with other.acting(), connections["default"].cursor() as cursor:
        write = lambda: cursor.execute(  # noqa: E731
            "insert into live_model_familyclassification (id, tenant_id, family_id, reference_id) "
            "values (%s, %s, %s, %s)",
            [uuid.uuid4(), other.developer_id, family, reference],
        )
        assert OUT_OF_REACH in refused(write)


@pytest.mark.django_db
def test_apply_needs_an_acting_tenant_and_refuses_what_it_cannot_hold(qs_project: QsProject) -> None:
    building = building_of(qs_project)
    with pytest.raises(PermissionDenied):
        services.apply(building, uuid.uuid4(), [column()], cause="confirmation")
    with qs_project.member.acting():
        with pytest.raises(ValueError, match="cause"):
            services.apply(building, uuid.uuid4(), [column()], cause="guess")
        with pytest.raises(services.UnknownFamily):
            services.apply(
                building,
                uuid.uuid4(),
                [services.StateChange(family="no_such", identity_key="x|1|f")],
                cause="confirmation",
            )
        floats = services.StateChange(
            family="column",
            identity_key="column|A/1|floor_1",
            attrs={"vx.column.section_b": 0.3},  # type: ignore[dict-item]  # what a caller may send
        )
        with pytest.raises(TypeError, match="float"):
            services.apply(building, uuid.uuid4(), [floats], cause="confirmation")
        assert not ModelVersion.objects.filter(building_id=building).exists()


@pytest.mark.django_db
def test_a_mark_changes_the_state_but_not_the_figures(qs_project: QsProject) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        first = services.apply(building, uuid.uuid4(), [column(mark="C2")], cause="confirmation")
        renamed = services.apply(building, uuid.uuid4(), [column(mark="C9")], cause="confirmation")
        resized = services.apply(
            building, uuid.uuid4(), [column("0.305", mark="C9")], cause="confirmation"
        )
        assert (first.figures_changed, renamed.figures_changed, resized.figures_changed) == (
            True,
            False,
            True,
        )
        assert renamed.figures_hash == first.figures_hash
        assert ElementState.objects.count() == 3
        assert [s.mark for s in services.snapshot(building).states] == ["C9"]


@pytest.mark.django_db
def test_an_unchanged_change_opens_no_state_and_a_retired_element_leaves_the_snapshot(
    qs_project: QsProject,
) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        services.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        services.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        assert ElementState.objects.count() == 1
        assert ElementTrace.objects.count() == 1
        gone = services.StateChange(family="column", identity_key="column|B/2|floor_1", retire=True)
        retired = services.apply(building, uuid.uuid4(), [gone], cause="unconfirm")
        assert services.snapshot(building).states == ()
        assert [s.mark for s in services.snapshot(building, 2).states] == ["C2"]
        assert ElementTrace.objects.get().valid_to_seq == retired.seq


@pytest.mark.django_db
def test_the_snapshot_gives_the_storeys_in_order_and_each_state_its_storey(
    qs_project: QsProject,
) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        services.apply(
            building,
            uuid.uuid4(),
            [storey("Floor 1", 1, "3.050", "3.050"), storey("Ground", 0, "0.000", "3.050")],
            cause="confirmation",
        )
        ground = services.snapshot(building).storeys[0]
        on_ground = services.StateChange(
            family="column",
            identity_key="column|B/2|ground",
            mark="C2",
            attrs={"vx.column.section_b": "0.254"},
            storey_id=ground.id,
        )
        services.apply(building, uuid.uuid4(), [on_ground], cause="confirmation")
        found = services.snapshot(building)
    assert [(s.name, s.order, s.level_m, s.height_m) for s in found.storeys] == [
        ("Ground", 0, Decimal("0.000"), Decimal("3.050")),
        ("Floor 1", 1, Decimal("3.050"), Decimal("3.050")),
    ]
    assert [(e.family, e.storey_id) for e in found.elements] == [("column", ground.id)]
    assert found.states == found.elements


@pytest.mark.django_db
def test_another_tenant_s_building_reads_as_an_empty_snapshot(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        services.apply(building, uuid.uuid4(), [column()], cause="confirmation")
    other = sign_in(role="qs")
    with other.acting():
        found = services.snapshot(building)
    assert (found.seq, found.storeys, found.elements) == (0, (), ())


@pytest.mark.django_db
def test_the_inspector_answers_404_for_an_element_of_another_project(qs_project: QsProject) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        version = services.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        element = ElementState.objects.get(valid_from_seq=version.seq).element_id
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project")
    reply = api_as(qs_project.member).get(f"/api/projects/{other.id}/model/elements/{element}")
    assert reply.status_code == 404
    assert reply.json() == {"code": "platform.auth.not_found", "params": {}}
    missing = api_as(qs_project.member).get(
        f"/api/projects/{qs_project.project_id}/model/elements/{uuid.uuid4()}"
    )
    assert missing.status_code == 404


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_library_sync_is_idempotent_and_every_definition_has_its_c8_words() -> None:
    assert platform_library.sync(OWNER_ALIAS)["live_model"] == 0
    for definition in library.DEFINITIONS:
        words = (definition.meaning, definition.reference_face, definition.datum)
        mapping = (definition.storage_unit, definition.ifc.get("ifc"), definition.ifc.get("property"))
        assert all(words), definition.key
        assert all(mapping), definition.key
