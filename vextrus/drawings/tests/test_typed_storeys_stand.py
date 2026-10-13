"""S24-B2, review of #777: the storeys the QS typed for a plan view stand over a re-read, as a typed
number or title does (review 1 of #691); a part plan keeps its standing once corrected; a list of
`MAX_STOREYS` storeys fits its length; and another Developer can neither read nor write them."""

from collections.abc import Callable

import pytest

from engine.recognise.types import Box, StoreysMeaning, ViewCandidate, ViewKind
from vextrus.drawings import services
from vextrus.drawings.services import corrections
from vextrus.platform.services import auth, tenancy
from vextrus.testing.drawings import QsProject, add, artefact_for, drawing, sheet_candidate
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def kept(project: QsProject) -> tuple[services.FileView, services.SheetView]:
    found = add(project.member, project.project_id, "KR-STR-R0.dwg", drawing()).file
    with project.member.acting():
        services.store_artefact(found.id, artefact_for(found.sha256, "KR-STR-R0.dwg", 1))
        [printed] = services.record_sheets(found.id, [sheet_candidate(0, found.group, number="S-04")])
        services.mark_read(found.id)
    return found, printed


PLAN = ViewCandidate(
    box=Box(10, 10, 100, 100),
    kind=ViewKind.PLAN,
    title="GROUND FLOOR BEAM LAYOUT",
    storeys=("floor_3",),
    storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL,
)
LEGEND = ViewCandidate(box=Box(110, 10, 150, 60), kind=ViewKind.LEGEND)


def test_typed_storeys_stand_over_a_re_read(qs_project: QsProject) -> None:
    _found, printed = kept(qs_project)
    with qs_project.member.acting():
        [plan, _legend] = services.record_views(printed.id, [PLAN, LEGEND])
        [change] = corrections.typed_view_storeys(printed.id, [(plan.id, "2nd, 4th", "floor_to_floor")])
        services.set_view_storeys(printed.id, [change[1]])

        again = services.record_views(printed.id, [PLAN, LEGEND])

    [back] = [v for v in again if v.kind == "plan"]
    assert (back.storeys, back.storeys_meaning, back.storeys_source) == (
        ("floor_2", "floor_4"),
        "floor_to_floor",
        "typed",
    )


def test_storeys_the_reading_changed_its_mind_about_are_not_kept_for_another_view(
    qs_project: QsProject,
) -> None:
    _found, printed = kept(qs_project)
    other = ViewCandidate(
        box=Box(10, 10, 100, 100),
        kind=ViewKind.PLAN,
        title="ROOF PLAN",
        storeys=("roof",),
        storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL,
    )
    with qs_project.member.acting():
        [plan, _legend] = services.record_views(printed.id, [PLAN, LEGEND])
        [change] = corrections.typed_view_storeys(printed.id, [(plan.id, "2nd", "floor_to_floor")])
        services.set_view_storeys(printed.id, [change[1]])

        [back] = [v for v in services.record_views(printed.id, [other, LEGEND]) if v.kind == "plan"]

    assert (back.storeys, back.storeys_source) == (("roof",), None)


def test_a_list_of_the_most_storeys_fits_its_length() -> None:
    typed = ", ".join(f"{n}th floor" for n in range(4, 4 + corrections.MAX_STOREYS))

    assert len(typed) > 200
    assert len(corrections.typed_storeys(typed)) == corrections.MAX_STOREYS


def test_another_developer_cannot_read_or_write_a_views_storeys(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    _found, printed = kept(qs_project)
    with qs_project.member.acting():
        [plan, _legend] = services.record_views(printed.id, [PLAN, LEGEND])
        [change] = corrections.typed_view_storeys(printed.id, [(plan.id, "2nd", "floor_to_floor")])
        services.set_view_storeys(printed.id, [change[1]])
    stranger = sign_in(role="qs")

    with tenancy.acting_in(stranger.developer_id, user_id=stranger.user.pk):
        with pytest.raises(auth.NotFound):
            services.views(printed.id)
        with pytest.raises(auth.NotFound):
            services.set_view_storeys(printed.id, [change[1]])
        with pytest.raises(auth.NotFound):
            services.put_back_view_storeys(printed.id, [change[0]])

    with qs_project.member.acting():
        [mine] = [v for v in services.views(printed.id) if v.kind == "plan"]
    assert (mine.storeys, mine.storeys_source) == (("floor_2",), "typed")
