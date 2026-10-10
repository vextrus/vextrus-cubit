"""Jev asked outside every transaction (S15-A2): `to_send` reads what the cache does not hold, `send`
asks TypeSafe with no database, `answer` keeps what was sent and never calls."""

import uuid
from collections.abc import Callable

import pytest

from engine.recognise.types import JudgementRequest
from vextrus.platform.models import JevAnswer
from vextrus.platform.services import jev, tenancy
from vextrus.testing.jev import (
    INVENTED_SHEETS,
    STAND_IN_KINDS,
    STAND_IN_QUESTION,
    Offline,
    Recorded,
)

pytestmark = pytest.mark.django_db


def question(sheet: int = 0) -> JudgementRequest:
    return JudgementRequest(
        node="sheet_type",
        facts=INVENTED_SHEETS[sheet],
        question=STAND_IN_QUESTION,
        options=tuple(STAND_IN_KINDS),
    )


def calls(offline: Offline) -> int:
    transport = offline.transport
    assert isinstance(transport, Recorded)
    return len(transport.requests)


def test_to_send_names_only_what_the_cache_does_not_hold(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    with tenancy.acting_in(make_developer()):
        first = jev.to_send(question(0))
        assert isinstance(first, jev.Request)
        assert isinstance(jev.ask_judgement(question(0)), jev.Answer)
        assert jev.to_send(question(0)) is None, "a cached answer is never sent again"
        assert isinstance(jev.to_send(question(1)), jev.Request)
    assert calls(jev_offline) == 1, "to_send itself never calls"


def test_send_asks_typesafe_and_writes_nothing(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        request = jev.to_send(question())
    assert isinstance(request, jev.Request)

    judged = jev.send(request)

    assert isinstance(judged, jev.Judgement)
    assert not isinstance(judged, jev.Answer), "nothing cached: no row to name"
    assert calls(jev_offline) == 1
    with tenancy.acting_in(developer):
        assert not JevAnswer.objects.exists()


def test_answer_keeps_what_was_sent_and_never_calls(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        request = jev.to_send(question())
    assert isinstance(request, jev.Request)
    sent: jev.Sent = {request.cache_key: jev.send(request)}

    with tenancy.acting_in(developer):
        kept = jev.answer(question(), sent)
        again = jev.answer(question(), {})
        rows = list(JevAnswer.objects.values_list("id", "cache_key"))

    assert isinstance(kept, jev.Answer)
    assert again == kept, "the cache answers once it is kept"
    assert rows == [(kept.id, request.cache_key)]
    assert calls(jev_offline) == 1, "only `send` called TypeSafe"


def test_answer_is_unavailable_when_nothing_was_sent_for_it_and_never_calls(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    with tenancy.acting_in(make_developer()):
        missing = jev.answer(question(), {})
        rows = JevAnswer.objects.count()

    assert missing == jev.Unavailable(jev.Why.NOT_SENT)
    assert rows == 0
    assert calls(jev_offline) == 0


def test_answer_passes_on_typesafe_s_unavailable_and_caches_nothing(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        request = jev.to_send(question())
    assert isinstance(request, jev.Request)
    down = jev.Unavailable(jev.Why.TIMED_OUT)

    with tenancy.acting_in(developer):
        answered = jev.answer(question(), {request.cache_key: down})
        rows = JevAnswer.objects.count()

    assert answered == down
    assert rows == 0
    assert calls(jev_offline) == 0


def test_to_send_and_answer_refuse_outside_a_tenant() -> None:
    with pytest.raises(jev.NoTenant):
        jev.to_send(question())
    with pytest.raises(jev.NoTenant):
        jev.answer(question(), {})
