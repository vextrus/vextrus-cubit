"""The override log (ticket 15; ADR 0011 item 4; story 85): each QS change of a Jev proposal, with the
answer's node, model and choice and the acting user, never the caller's; refused for the wrong person
with auth's code, and for a choice that is no override; and the tally per node and model version."""

import inspect
import uuid
from collections.abc import Callable
from datetime import timedelta

import pytest
from django.utils import timezone

from vextrus.platform.messages import auth as codes
from vextrus.platform.models import JevOverride, Membership
from vextrus.platform.services import auth, jev, tenancy
from vextrus.testing.jev import INVENTED_SHEETS, STAND_IN_KINDS, STAND_IN_QUESTION
from vextrus.testing.tenancy import Member, add_member

PROJECT = uuid.UUID("0199a0a0-0000-7000-8000-000000000001")
OTHER_PROJECT = uuid.UUID("0199a0a0-0000-7000-8000-000000000002")


def answer_in(developer: uuid.UUID, sheet: int = 0) -> jev.Answer:
    with tenancy.acting_in(developer):
        answer = jev.ask("sheet_type", INVENTED_SHEETS[sheet], STAND_IN_QUESTION, STAND_IN_KINDS)
    assert isinstance(answer, jev.Answer)
    return answer


def overrides(developer: uuid.UUID) -> list[JevOverride]:
    with tenancy.acting_in(developer):
        return list(JevOverride.objects.order_by("at"))


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["qs", "vextrus_engineer"])
def test_a_qs_s_change_is_logged_with_the_answer_s_node_model_and_choice_and_the_acting_user(
    role: str, sign_in: Callable[..., Member]
) -> None:
    member = sign_in(role=role)
    answer = answer_in(member.developer_id)
    subject = uuid.uuid4()

    with member.acting():
        override_id = jev.record_override(
            answer.id, subject_id=subject, qs_choice="column_layout", project_id=PROJECT
        )

    [row] = overrides(member.developer_id)
    assert row.id == override_id
    assert (row.tenant_id, row.answer_id, row.subject_id) == (member.developer_id, answer.id, subject)
    assert (row.node, row.model_version, row.jev_choice, row.qs_choice) == (
        "sheet_type",
        "jev-1.13.0",
        "beam_layout",
        "column_layout",
    )
    assert row.user_id == member.user.pk


def test_the_caller_names_neither_the_node_nor_the_model_nor_jev_s_choice_nor_the_user() -> None:
    parameters = inspect.signature(jev.record_override).parameters

    assert list(parameters) == ["answer_id", "subject_id", "qs_choice", "project_id"]


@pytest.mark.django_db
def test_jev_s_own_choice_is_no_override(sign_in: Callable[..., Member]) -> None:
    member = sign_in()
    answer = answer_in(member.developer_id)

    with member.acting(), pytest.raises(jev.NotAnOverride) as refused:
        jev.record_override(
            answer.id, subject_id=uuid.uuid4(), qs_choice="beam_layout", project_id=PROJECT
        )

    assert refused.value.reason == "jev_s_own"
    assert overrides(member.developer_id) == []


@pytest.mark.django_db
@pytest.mark.parametrize("choice", ["storey_plan", "Column_layout", " column_layout", "", "other_kind"])
def test_an_option_not_offered_is_no_override(choice: str, sign_in: Callable[..., Member]) -> None:
    member = sign_in()
    answer = answer_in(member.developer_id)

    with member.acting(), pytest.raises(jev.NotAnOverride) as refused:
        jev.record_override(answer.id, subject_id=uuid.uuid4(), qs_choice=choice, project_id=PROJECT)

    assert refused.value.reason == "not_offered"
    assert overrides(member.developer_id) == []


# The wrong person -----------------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["guest", "md"])
def test_a_guest_and_the_md_are_refused_with_auth_s_code(
    role: str, sign_in: Callable[..., Member]
) -> None:
    member = sign_in(role=role)
    answer = answer_in(member.developer_id)

    with member.acting(), pytest.raises(auth.NotAllowed) as refused:
        jev.record_override(
            answer.id, subject_id=uuid.uuid4(), qs_choice="column_layout", project_id=PROJECT
        )

    assert (refused.value.status, refused.value.message) == (403, codes.NOT_ALLOWED(role=role))
    assert overrides(member.developer_id) == []


@pytest.mark.django_db
def test_a_signed_out_caller_is_refused_with_auth_s_code(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    answer = answer_in(developer)

    with tenancy.acting_in(developer), pytest.raises(auth.NotSignedIn) as refused:
        jev.record_override(
            answer.id, subject_id=uuid.uuid4(), qs_choice="column_layout", project_id=PROJECT
        )

    assert (refused.value.status, refused.value.message) == (401, codes.SIGNED_OUT())
    assert overrides(developer) == []


@pytest.mark.django_db
@pytest.mark.parametrize("ended", ["expired", "revoked"])
def test_a_lapsed_member_is_refused_with_auth_s_code(
    ended: str, make_developer: Callable[..., uuid.UUID]
) -> None:
    developer = make_developer()
    answer = answer_in(developer)
    user, membership_id = add_member(developer)
    with tenancy.acting_in(developer):
        change = (
            {"expires_at": timezone.now() - timedelta(days=1)}
            if ended == "expired"
            else {"revoked_at": timezone.now()}
        )
        Membership.objects.filter(id=membership_id).update(**change)

    with tenancy.acting_in(developer, user_id=user.pk), pytest.raises(auth.NoDeveloper) as refused:
        jev.record_override(
            answer.id, subject_id=uuid.uuid4(), qs_choice="column_layout", project_id=PROJECT
        )

    assert (refused.value.status, refused.value.message) == (403, codes.NO_ACCESS())
    assert overrides(developer) == []


@pytest.mark.django_db
def test_a_member_outside_the_project_is_refused_as_not_found(sign_in: Callable[..., Member]) -> None:
    member = sign_in(projects=[PROJECT])
    answer = answer_in(member.developer_id)

    with member.acting(), pytest.raises(auth.NotFound) as refused:
        jev.record_override(
            answer.id, subject_id=uuid.uuid4(), qs_choice="column_layout", project_id=OTHER_PROJECT
        )

    assert (refused.value.status, refused.value.message) == (404, codes.NOT_FOUND())
    assert overrides(member.developer_id) == []
    with member.acting():  # inside the Project it is logged
        jev.record_override(
            answer.id, subject_id=uuid.uuid4(), qs_choice="column_layout", project_id=PROJECT
        )
    assert len(overrides(member.developer_id)) == 1


@pytest.mark.django_db
def test_another_developer_s_answer_is_not_found(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    elsewhere = make_developer("A")
    theirs = answer_in(elsewhere)
    member = sign_in()

    for answer_id in (theirs.id, uuid.uuid4()):
        with member.acting(), pytest.raises(auth.NotFound) as refused:
            jev.record_override(
                answer_id, subject_id=uuid.uuid4(), qs_choice="column_layout", project_id=PROJECT
            )
        assert (refused.value.status, refused.value.message) == (404, codes.NOT_FOUND())

    assert overrides(elsewhere) == overrides(member.developer_id) == []


# The tally ------------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_the_tally_counts_each_node_s_answers_and_overrides_per_model_in_the_tenant(
    sign_in: Callable[..., Member],
) -> None:
    member = sign_in()
    other = sign_in()
    first, second, _third = (answer_in(member.developer_id, sheet) for sheet in (0, 1, 2))
    answer_in(other.developer_id)
    with member.acting():
        jev.record_override(
            first.id, subject_id=uuid.uuid4(), qs_choice="column_layout", project_id=PROJECT
        )
        jev.record_override(
            first.id, subject_id=uuid.uuid4(), qs_choice="slab_layout", project_id=PROJECT
        )
        jev.record_override(second.id, subject_id=uuid.uuid4(), qs_choice="section", project_id=PROJECT)
    with other.acting():
        jev.record_override(
            answer_in(other.developer_id).id,
            subject_id=uuid.uuid4(),
            qs_choice="detail",
            project_id=PROJECT,
        )

    with member.acting():
        tally = jev.tally()

    assert tally == (
        jev.NodeTally("sheet_type", "jev-1.13.0", answers=3, overrides=3, answers_overridden=2),
    )


@pytest.mark.django_db
def test_a_tenant_with_nothing_asked_tallies_nothing(make_developer: Callable[..., uuid.UUID]) -> None:
    with tenancy.acting_in(make_developer()):
        assert jev.tally() == ()
