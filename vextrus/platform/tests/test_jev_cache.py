"""`ask` through the tenant's answer cache (ticket 15; ADR 0011 item 5; story 85): an answer asked
again is the cached row, never a second call; one tenant's answer never serves another; nothing is
cached when Jev is unavailable, and nothing is left when the caller's transaction rolls back."""

import json
import logging
import uuid
from collections.abc import Callable
from decimal import Decimal
from typing import Any

import httpx
import pytest
from django.db import connections

from engine.recognise.types import JudgementRequest
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import JevAnswer
from vextrus.platform.services import jev, tenancy
from vextrus.testing.jev import (
    DOWN,
    INVENTED_SHEETS,
    STAND_IN_KINDS,
    STAND_IN_QUESTION,
    WAYS,
    Offline,
    Recorded,
)

SHEET = INVENTED_SHEETS[0]


def asked(facts: jev.Facts = SHEET) -> jev.Answer | jev.Unavailable:
    return jev.ask("sheet_type", facts, STAND_IN_QUESTION, STAND_IN_KINDS)


def key_of(facts: jev.Facts) -> str:
    request = jev.prepare("sheet_type", facts, STAND_IN_QUESTION, STAND_IN_KINDS)
    assert isinstance(request, jev.Request)
    return request.cache_key


def calls(offline: Offline) -> int:
    transport = offline.transport
    assert isinstance(transport, Recorded)
    return len(transport.requests)


def cached(developer: uuid.UUID) -> list[JevAnswer]:
    """The answers cached in the developer, read in its tenant on the test's own connection (the
    owner's connection cannot see what the test's transaction has not committed)."""
    with tenancy.acting_in(developer):
        return list(JevAnswer.objects.all())


def committed() -> list[tuple[Any, ...]]:
    """Every answer committed, in any tenant, read as the owner (for tests that commit)."""
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute("select tenant_id, cache_key from platform_jevanswer")
        return list(cursor.fetchall())


@pytest.mark.django_db
def test_an_answer_is_asked_once_then_read_from_the_cache(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        first = asked()
        again = asked()

    assert isinstance(first, jev.Answer)
    assert again == first
    assert calls(jev_offline) == 1
    assert [row.id for row in cached(developer)] == [first.id]


@pytest.mark.django_db
def test_the_cached_row_holds_the_answer_as_decimals_and_decimal_strings(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        answer = asked(INVENTED_SHEETS[5])
        row = JevAnswer.objects.get(tenant_id=developer)

    assert isinstance(answer, jev.Answer)
    assert (row.node, row.model_version, row.choice) == ("sheet_type", "jev-1.13.0", "slab_layout")
    assert row.confidence == Decimal("0.3700")
    assert answer.confidence == Decimal("0.3700")
    assert row.options == list(STAND_IN_KINDS)
    assert row.probabilities["slab_layout"] == "0.43"
    assert row.probabilities["cover_index"] == "0"
    assert all(isinstance(p, str) for p in row.probabilities.values())
    assert answer.ranked()[:3] == ("slab_layout", "beam_layout", "other")
    assert row.cache_key == key_of(INVENTED_SHEETS[5])


@pytest.mark.django_db
def test_a_vanishing_probability_is_stored_in_a_few_characters(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    # Found by the refuter (round 0): 1e-999999999 was taken, then written out as a billion-digit
    # string that PostgreSQL refused inside the caller's transaction.
    body = (
        b'{"model":"jev-1.13.0","answers":{"sheet_type":{"type":"choice","choice":"beam_layout",'
        b'"confidence":0.97,"probabilities":{"beam_layout":0.99999999,"floor_plan":1e-999999999}}}}'
    )
    jev_offline.use(httpx.MockTransport(lambda request: httpx.Response(200, content=body)))
    with tenancy.acting_in(make_developer()):
        answer = jev.ask("sheet_type", SHEET, STAND_IN_QUESTION, ("beam_layout", "floor_plan"))
        row = JevAnswer.objects.get()

    assert isinstance(answer, jev.Answer)
    assert row.probabilities == {"beam_layout": "1", "floor_plan": "0"}
    assert answer.probabilities == (("beam_layout", Decimal(1)), ("floor_plan", Decimal(0)))


@pytest.mark.django_db
def test_one_tenant_s_answer_never_serves_another(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    a, b = make_developer("A"), make_developer("B")
    with tenancy.acting_in(a):
        in_a = asked()
    with tenancy.acting_in(b):
        in_b = asked()
        seen_by_b = list(JevAnswer.objects.values_list("tenant_id", flat=True))

    assert isinstance(in_a, jev.Answer)
    assert isinstance(in_b, jev.Answer)
    assert in_a.id != in_b.id
    assert calls(jev_offline) == 2
    assert seen_by_b == [b]


@pytest.mark.django_db
def test_asking_outside_a_tenant_raises_before_any_call_or_write(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    developer = make_developer()
    with pytest.raises(jev.NoTenant):
        asked()
    with tenancy.acting_in(None), pytest.raises(jev.NoTenant):
        asked()
    with pytest.raises(jev.NoTenant):
        jev.tally()

    assert calls(jev_offline) == 0
    assert cached(developer) == []


@pytest.mark.django_db
@pytest.mark.parametrize("way", WAYS)
def test_nothing_is_cached_when_typesafe_is_down(
    way: str, make_developer: Callable[..., uuid.UUID], jev_down: Callable[[str], None]
) -> None:
    developer = make_developer()
    jev_down(way)
    with tenancy.acting_in(developer):
        answer = asked()

    assert answer == jev.Unavailable(DOWN[way])
    assert cached(developer) == []


@pytest.mark.django_db
def test_a_failure_is_asked_again_once_typesafe_is_back(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    developer = make_developer()
    jev_offline.use(httpx.MockTransport(lambda request: httpx.Response(529)))
    with tenancy.acting_in(developer):
        assert asked() == jev.Unavailable(jev.Why.BUSY)
    jev_offline.use(Recorded())
    with tenancy.acting_in(developer):
        answer = asked()

    assert isinstance(answer, jev.Answer)
    assert [row.id for row in cached(developer)] == [answer.id]


@pytest.mark.django_db
def test_with_no_key_nothing_is_sent_and_nothing_cached(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    developer = make_developer()
    transport = Recorded()
    jev_offline.use(transport, key=lambda: None)
    with tenancy.acting_in(developer):
        assert asked() == jev.Unavailable(jev.Why.NO_KEY)

    assert transport.requests == []
    assert cached(developer) == []


@pytest.mark.django_db
def test_the_key_sent_is_in_no_row(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    sentinel = "sentinel-key-3c59dc048e8850243be8079a5c74d079"
    developer = make_developer()
    transport = Recorded()
    jev_offline.use(transport, key=lambda: sentinel)
    with tenancy.acting_in(developer):
        answer = asked()
        rows = list(JevAnswer.objects.values())

    assert isinstance(answer, jev.Answer)
    assert transport.requests[0].headers["authorization"] == f"Bearer {sentinel}"
    assert len(rows) == 1
    assert sentinel not in json.dumps(rows, default=str)


@pytest.mark.django_db
def test_a_request_too_large_is_neither_sent_nor_cached(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        assert asked({**SHEET, "title": "A" * 1_000_000}) == jev.Unavailable(jev.Why.TOO_LARGE)
        assert asked({**SHEET, "view_titles": ["BEAM LAYOUT PLAN"] * 10_000}) == jev.Unavailable(
            jev.Why.TOO_LARGE
        )

    assert calls(jev_offline) == 0
    assert cached(developer) == []


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_a_rolled_back_step_leaves_no_row(make_developer: Callable[..., uuid.UUID]) -> None:
    developer = make_developer()

    def a_step_that_fails_after_asking() -> None:
        with tenancy.acting_in(developer):
            assert isinstance(asked(), jev.Answer)
            raise RuntimeError("the step failed after asking")

    with pytest.raises(RuntimeError, match="the step failed"):
        a_step_that_fails_after_asking()

    assert committed() == []
    with tenancy.acting_in(developer):
        kept = asked()
    assert isinstance(kept, jev.Answer)
    assert committed() == [(developer, key_of(SHEET))]


@pytest.mark.django_db
def test_an_answer_written_meanwhile_stands_and_no_second_row_is_made(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline, monkeypatch: pytest.MonkeyPatch
) -> None:
    developer = make_developer()
    request = jev.prepare("sheet_type", SHEET, STAND_IN_QUESTION, STAND_IN_KINDS)
    assert isinstance(request, jev.Request)
    send = jev_offline.client.send

    def another_step_wrote_first(sent: jev.Request) -> jev.Judgement | jev.Unavailable:
        judged = send(sent)
        JevAnswer.objects.create(
            tenant_id=developer,
            cache_key=sent.cache_key,
            node="sheet_type",
            model_version="jev-1.13.0",
            options=list(sent.options),
            choice="column_layout",
            confidence=Decimal("0.5"),
            probabilities={
                option: "0.5" if option == "column_layout" else "0" for option in sent.options
            },
        )
        return judged

    monkeypatch.setattr(jev_offline.client, "send", another_step_wrote_first)
    with tenancy.acting_in(developer):
        answer = asked()
        rows = list(JevAnswer.objects.filter(tenant_id=developer))

    assert isinstance(answer, jev.Answer)
    assert answer.choice == "column_layout"  # the first writer's; Jev's beam_layout was not written
    assert [row.id for row in rows] == [answer.id]


@pytest.mark.django_db
def test_the_engine_s_judgement_request_is_asked_in_one_line(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    sent: list[httpx.Request] = []

    def answer(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        body = {
            "model": "jev-1.13.0",
            "answers": {
                "sheet_type": {
                    "type": "choice",
                    "choice": "beam_layout",
                    "confidence": 0.97,
                    "probabilities": {"beam_layout": 0.98, "column_layout": 0.02},
                }
            },
        }
        return httpx.Response(200, json=body)

    jev_offline.use(httpx.MockTransport(answer))
    request = JudgementRequest(
        node="sheet_type",
        facts={
            "title": "BEAM LAYOUT",
            "discipline": "structural",
            "view_titles": '["BEAM LAYOUT PLAN"]',
        },
        question="A stand-in question, not 13's",
        options=("beam_layout", "column_layout"),
    )
    with tenancy.acting_in(make_developer()):
        judged = jev.ask_judgement(request)

    assert isinstance(judged, jev.Answer)
    assert judged.choice == "beam_layout"
    [request_sent] = sent
    assert json.loads(request_sent.content)["state"]["view_titles"] == ["BEAM LAYOUT PLAN"]


# The review of round 1: 13's head emitted `number` and `view_title_1…12`, and `ask_judgement`
# raised out of the job step. A question the node does not take is the caller's mistake: logged, and
# answered Unavailable, so the step still ends and the QS picks.
NOT_THE_NODE_S = {
    "13's facts before the ruling": {
        "discipline": "structural",
        "title": "BEAM LAYOUT",
        "number": "S-07",
        "view_title_1": "BEAM LAYOUT PLAN",
        "view_title_2": "SECTION 1-1",
    },
    "a fact missing": {"title": "BEAM LAYOUT", "discipline": "structural"},
    "an undeclared fact beside the three": {
        "title": "B",
        "discipline": "structural",
        "view_titles": "[]",
        "storeys": "1st",
    },
    "view titles not a JSON array": {
        "title": "B",
        "discipline": "structural",
        "view_titles": "BEAM LAYOUT PLAN",
    },
}


@pytest.mark.django_db
@pytest.mark.parametrize("facts", NOT_THE_NODE_S.values(), ids=NOT_THE_NODE_S.keys())
def test_a_question_the_node_does_not_take_is_unavailable_logged_and_never_raised(
    facts: dict[str, str],
    make_developer: Callable[..., uuid.UUID],
    jev_offline: Offline,
    caplog: pytest.LogCaptureFixture,
) -> None:
    developer = make_developer()
    request = JudgementRequest(
        node="sheet_type",
        facts=facts,
        question="A stand-in question, not 13's",
        options=("beam_layout", "column_layout"),
    )
    with tenancy.acting_in(developer):
        answer = jev.ask_judgement(request)

    assert answer == jev.Unavailable(jev.Why.BAD_QUESTION)
    assert calls(jev_offline) == 0
    assert cached(developer) == []
    [error] = [record for record in caplog.records if record.levelno == logging.ERROR]
    assert "sheet_type" in error.getMessage()
    assert "the caller's mistake" in error.getMessage()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("node", "question", "options"),
    [
        ("storey", STAND_IN_QUESTION, ("beam_layout", "other")),
        ("sheet_type", "", ("beam_layout", "other")),
        ("sheet_type", STAND_IN_QUESTION, ("Beam Layout", "other")),
        ("sheet_type", STAND_IN_QUESTION, ("beam_layout",)),
    ],
)
def test_a_bad_node_question_or_options_is_unavailable_never_raised(
    node: str,
    question: str,
    options: tuple[str, ...],
    make_developer: Callable[..., uuid.UUID],
    jev_offline: Offline,
) -> None:
    with tenancy.acting_in(make_developer()):
        answer = jev.ask(node, SHEET, question, options)

    assert answer == jev.Unavailable(jev.Why.BAD_QUESTION)
    assert calls(jev_offline) == 0


@pytest.mark.django_db
def test_the_three_facts_13_gives_are_asked(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    sent: list[httpx.Request] = []

    def answer(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(
            200,
            json={
                "model": "jev-1.13.0",
                "answers": {
                    "sheet_type": {
                        "type": "choice",
                        "choice": "general_notes",
                        "confidence": 0.9,
                        "probabilities": {"general_notes": 0.95, "beam_layout": 0.05},
                    }
                },
            },
        )

    jev_offline.use(httpx.MockTransport(answer))
    request = JudgementRequest(
        node="sheet_type",
        facts={"title": "GENERAL NOTES", "discipline": "structural", "view_titles": "[]"},
        question="A stand-in question, not 13's",
        options=("general_notes", "beam_layout"),
    )
    with tenancy.acting_in(make_developer()):
        judged = jev.ask_judgement(request)

    assert isinstance(judged, jev.Answer)
    [request_sent] = sent
    assert json.loads(request_sent.content)["state"] == {
        "title": "GENERAL NOTES",
        "discipline": "structural",
        "view_titles": [],
    }


@pytest.mark.django_db
def test_the_propose_threshold_is_the_node_s_setting(
    make_developer: Callable[..., uuid.UUID], settings: Any
) -> None:
    with tenancy.acting_in(make_developer()):
        sure, unsure = asked(INVENTED_SHEETS[0]), asked(INVENTED_SHEETS[5])
    assert isinstance(sure, jev.Answer)
    assert isinstance(unsure, jev.Answer)

    assert (jev.SHEET_TYPE.proposes(sure), jev.SHEET_TYPE.proposes(unsure)) == (True, False)
    settings.VEXTRUS_JEV_SHEET_TYPE_PROPOSE_AT = Decimal("0.37")
    assert jev.SHEET_TYPE.proposes(unsure)
    other = jev.Judgement(
        "another_node", "jev-1.13.0", "a", Decimal(1), (("a", Decimal(1)), ("b", Decimal(0)))
    )
    with pytest.raises(ValueError, match="not sheet_type's"):
        jev.SHEET_TYPE.proposes(other)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("written", "read"),
    [("0.8999496", "0.8999"), ("0.89995", "0.8999"), ("0.89999999", "0.8999"), ("0.9", "0.9000")],
)
def test_a_confidence_is_read_once_to_four_places_rounding_down_so_judge_and_ask_agree(
    written: str, read: str, make_developer: Callable[..., uuid.UUID], jev_offline: Offline
) -> None:
    # Found by the refuter (round 2): read to six places, then stored to four, 0.8999496 became
    # 0.9000 and proposed through `ask` while `judge` on the same answer did not.
    body = (
        '{"model":"jev-1.13.0","answers":{"sheet_type":{"type":"choice","choice":"beam_layout",'
        f'"confidence":{written},"probabilities":{{"beam_layout":0.95,"floor_plan":0.05}}}}}}}}'
    ).encode()
    options = ("beam_layout", "floor_plan")
    jev_offline.use(httpx.MockTransport(lambda request: httpx.Response(200, content=body)))

    judged = jev_offline.client.judge("sheet_type", SHEET, STAND_IN_QUESTION, options)
    with tenancy.acting_in(make_developer()):
        asked_now = jev.ask("sheet_type", SHEET, STAND_IN_QUESTION, options)
        asked_again = jev.ask("sheet_type", SHEET, STAND_IN_QUESTION, options)

    assert isinstance(judged, jev.Judgement)
    assert isinstance(asked_now, jev.Answer)
    assert isinstance(asked_again, jev.Answer)
    assert judged.confidence == asked_now.confidence == asked_again.confidence == Decimal(read)
    proposes = {jev.SHEET_TYPE.proposes(answer) for answer in (judged, asked_now, asked_again)}
    assert proposes == {Decimal(written) >= Decimal("0.90")}
