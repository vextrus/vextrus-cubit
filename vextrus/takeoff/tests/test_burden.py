"""The burden block's own rules beyond T-249's acceptance tests: its closed lists equal the product's
and the schema's, a Question or sheet of a Discipline the Market does not name sits in "none", and a
gap Question on no file counts once for its Discipline. Invented sheets only."""

import json
from pathlib import Path
from typing import Any

import pytest

from engine.recognise.types import ExclusionReason
from vextrus.takeoff.models import QuestionKind
from vextrus.takeoff.services import burden
from vextrus.takeoff.tests.acceptance.s13_249a.world import (
    Drawn,
    ask,
    plan,
    read_file,
    rows,
)
from vextrus.takeoff.tests.acceptance.s13_249a.world import burden as block_of
from vextrus.testing.drawings import QsProject

SCHEMA = json.loads((Path(__file__).resolve().parents[3] / "engine" / "export.schema.json").read_text())
ROW = SCHEMA["$defs"]["burden_row"]


@pytest.fixture(autouse=True)
def typesafe_down(jev_down: Any) -> None:
    jev_down("timeout")


def test_the_schemas_kinds_are_the_products_question_kinds() -> None:
    listed = ROW["properties"]["questions_open"]["propertyNames"]["enum"]
    assert listed == [kind.value for kind in QuestionKind] == list(burden.KINDS)


def test_the_schemas_reasons_are_the_engines_exclusion_reasons() -> None:
    listed = ROW["properties"]["proposed_out_by_reason"]["propertyNames"]["enum"]
    assert listed == [reason.value for reason in ExclusionReason] == list(burden.REASONS)


def test_the_schemas_row_keys_are_the_rows() -> None:
    made = burden._row()
    assert sorted(ROW["required"]) == sorted(made) == sorted(ROW["properties"])
    assert sorted(ROW["properties"]["conflicts"]["required"]) == sorted(made["conflicts"])


@pytest.mark.django_db
def test_a_question_of_a_discipline_the_market_does_not_name_is_counted_under_none(
    qs_project: QsProject,
) -> None:
    """A sheet's Discipline is always the Market's (the product refuses any other); a Question's is
    free text, so one the Market does not name sits in the row "none" and its word never shows."""
    read = read_file(
        qs_project,
        "INV-ODD-03.dwg",
        [Drawn("S-301", "Made-up odd plan", "structural", views=(plan("ground"),))],
    )
    message: Any = {"code": "takeoff.proposals.which_kind", "params": {"sheet": "", "named": ""}}
    ask(qs_project, "low_confidence", message, [read.sheets[0]], discipline="qx_trade")

    found = rows(block_of(qs_project, [read]))

    assert set(found) == {"structural", "none"}
    assert (found["none"]["sheets"], found["none"]["machine_doubt"]) == (0, 1)
    assert found["structural"]["machine_doubt"] == 0
    assert "qx_trade" not in json.dumps(found)


@pytest.mark.django_db
def test_a_gap_question_on_no_file_counts_once_for_its_discipline(qs_project: QsProject) -> None:
    read = read_file(
        qs_project,
        "INV-STR-09.dwg",
        [Drawn("S-901", "Made-up pad plan", "structural", views=(plan("ground"),))],
    )
    for after, before in (("S-902", "S-905"), ("S-905", "S-909")):
        message: Any = {
            "code": "engine.register_check.gap",
            "params": {"after": after, "before": before, "missing": 1, "discipline": "structural"},
        }
        ask(qs_project, "check", message, [], discipline="structural", check_code="register")

    row = rows(block_of(qs_project, [read]))["structural"]

    assert (row["gap_questions"], row["gap_files"], row["counted_toward_cap"]) == (2, 1, 1)


@pytest.mark.django_db
def test_an_answered_question_is_not_counted(qs_project: QsProject) -> None:
    from django.utils import timezone

    from vextrus.takeoff.models import Question, QuestionStatus

    read = read_file(
        qs_project,
        "INV-STR-10.dwg",
        [Drawn("S-911", "Made-up cap plan", "structural", views=(plan("ground"),))],
    )
    message: Any = {"code": "takeoff.proposals.which_kind", "params": {"sheet": "", "named": ""}}
    asked = ask(qs_project, "low_confidence", message, [read.sheets[0]], discipline="structural")
    with qs_project.member.acting():
        Question.objects.filter(id=asked).update(
            status=QuestionStatus.ANSWERED, answer={"key": "keep_open"}, answered_at=timezone.now()
        )

    row = rows(block_of(qs_project, [read]))["structural"]

    assert sum(row["questions_open"].values()) == 0
    assert row["machine_doubt"] == 0
