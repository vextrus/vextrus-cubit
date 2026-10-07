"""S16-B: the Priced BOQ on read and the Building's Gross Floor Area (M1.md C13, C15; the session-16
contract's boq and GFA section).

- `GET /api/projects/{project_id}/boq` -> `{strip, measured_share, sections: [{section, groups:
  [{group, items}]}], allowances}`; `GET .../boq/items/{item_code}/lines` -> `{lines: [Measurement
  Line + trace]}`;
  `PUT /api/projects/{project_id}/buildings/{building_id}/gross-floor-area {value, unit: "sft"|"m2"}`.
- C13: "`quantity` is the measured quantity only. `awaiting_answer` is separate"; "An unpriced BOQ
  Item (`RateNotEntered`) has `rate` and `amount` null ... the strip ... carry `unpriced_lines: n`";
  the strip's "`total` = measured + awaiting answer + allowance, each Element once. `per_area` is
  null ... while there is no Gross Floor Area"; the worked example "1245.37 x 512.40 = 638,127.588,
  rounded to 638,127.59;
  12.50 x 512.40 = 6,405.00"; an allowance line's `"cost_basis": "allowance"` and `"source":
  "vextrus_default"`. The ticket: "a confirmed step drops its allowance whole".
- C15: `set_gross_floor_area(building_id, value, unit)` "converts exactly".

`measure`, `working_rate` and the confirmed steps are stood in (`seams.py`).
"""

import json
import uuid
from collections.abc import Callable
from decimal import Decimal
from typing import Any

import pytest
from django.test import Client

from vextrus.boq.tests.acceptance.ts16b.seams import (
    C1,
    C2,
    CONCRETE,
    FORMWORK,
    REBAR,
    Seams,
    column_lines,
)
from vextrus.projects.services import projects
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def _building(qs_project: QsProject) -> uuid.UUID:
    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
    return building.id


def _boq(client: Client, project_id: uuid.UUID) -> dict[str, Any]:
    response = client.get(f"/api/projects/{project_id}/boq")
    assert response.status_code == 200, response.content
    body: dict[str, Any] = response.json()
    return body


def _items(body: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        item["item_code"]: item
        for section in body["sections"]
        for group in section["groups"]
        for item in group["items"]
    }


def _money(value: dict[str, Any] | None) -> Decimal:
    assert value is not None
    assert value["currency"] == "BDT"
    return Decimal(value["amount"])


def _put_gfa(
    client: Client, project_id: uuid.UUID, building_id: uuid.UUID, value: str, unit: str
) -> Any:
    return client.put(
        f"/api/projects/{project_id}/buildings/{building_id}/gross-floor-area",
        data=json.dumps({"value": value, "unit": unit}),
        content_type="application/json",
    )


def test_the_c13_example_bills_1245_37_cft_at_512_40_as_638127_59(
    qs_project: QsProject, seams: Seams
) -> None:
    seams.lines, seams.confirmed = column_lines(), frozenset({"storeys", "grid", "columns"})
    item = _items(_boq(qs_project.member.client, qs_project.project_id))[CONCRETE]
    assert item["billing_unit"] == "cft"
    assert Decimal(item["quantity"]) == Decimal("1245.37")
    assert _money(item["rate"]) == Decimal("512.40")
    assert item["amount"]["amount"] == "638127.59"
    assert item["cost_basis"] == "measured"
    assert (item["section"], item["group"]) == ("super_structure", "columns")


def test_the_held_element_is_awaiting_answer_and_never_in_quantity(
    qs_project: QsProject, seams: Seams
) -> None:
    seams.lines, seams.confirmed = column_lines(), frozenset({"storeys", "grid", "columns"})
    item = _items(_boq(qs_project.member.client, qs_project.project_id))[CONCRETE]
    assert Decimal(item["awaiting_answer"]["quantity"]) == Decimal("12.50")
    assert item["awaiting_answer"]["amount"]["amount"] == "6405.00"
    assert Decimal(item["quantity"]) == Decimal("1245.37")


def test_an_item_with_no_rate_has_rate_and_amount_null_and_is_counted_unpriced(
    qs_project: QsProject, seams: Seams
) -> None:
    seams.lines, seams.confirmed = column_lines(), frozenset({"storeys", "grid", "columns"})
    body = _boq(qs_project.member.client, qs_project.project_id)
    item = _items(body)[FORMWORK]
    assert Decimal(item["quantity"]) == Decimal("100.00")
    assert item["rate"] is None
    assert item["amount"] is None
    assert body["strip"]["unpriced_lines"] == 1


def test_rebar_items_carry_by_ratio(qs_project: QsProject, seams: Seams) -> None:
    seams.lines, seams.confirmed = column_lines(), frozenset({"storeys", "grid", "columns"})
    items = _items(_boq(qs_project.member.client, qs_project.project_id))
    assert items[REBAR]["rebar_basis"] == "by_ratio"
    assert items[CONCRETE]["rebar_basis"] is None


def test_the_strip_total_is_measured_plus_awaiting_plus_allowance(
    qs_project: QsProject, seams: Seams
) -> None:
    seams.lines, seams.confirmed = column_lines(), frozenset({"storeys", "grid", "columns"})
    strip = _boq(qs_project.member.client, qs_project.project_id)["strip"]
    # 638127.59 (concrete) + 19000.00 (Rebar, 200.00 kg x 95.00) + 0 (formwork, no rate)
    assert _money(strip["measured"]) == Decimal("657127.59")
    assert _money(strip["awaiting_answer"]) == Decimal("6405.00")
    assert _money(strip["total"]) == _money(strip["measured"]) + _money(
        strip["awaiting_answer"]
    ) + _money(strip["allowance"])


def test_with_no_gross_floor_area_there_is_no_allowance_and_no_per_area(
    qs_project: QsProject, seams: Seams
) -> None:
    seams.lines, seams.confirmed = (), frozenset()
    body = _boq(qs_project.member.client, qs_project.project_id)
    assert body["strip"]["per_area"] is None
    assert body["strip"]["gfa"] is None
    assert _money(body["strip"]["allowance"]) == 0
    assert all(_money(line["amount"]) == 0 for line in body["allowances"])


def test_after_the_gfa_each_open_step_has_its_default_allowance_and_nothing_is_measured(
    qs_project: QsProject, seams: Seams
) -> None:
    seams.lines, seams.confirmed = (), frozenset()
    client, project_id = qs_project.member.client, qs_project.project_id
    assert _put_gfa(client, project_id, _building(qs_project), "10000", "sft").status_code in (200, 204)
    body = _boq(client, project_id)
    steps = [line["step"] for line in body["allowances"]]
    assert "columns" in steps
    assert all(line["source"] == "vextrus_default" for line in body["allowances"])
    assert all(line["cost_basis"] == "allowance" for line in body["allowances"])
    assert _money(body["strip"]["allowance"]) > 0
    assert _money(body["strip"]["allowance"]) == sum(
        (_money(line["amount"]) for line in body["allowances"]), Decimal(0)
    )
    assert Decimal(body["measured_share"]) == 0
    assert body["strip"]["per_area"] is not None
    assert body["strip"]["gfa"]["basis"] == "entered"


def test_a_confirmed_columns_step_drops_its_allowance_whole(qs_project: QsProject, seams: Seams) -> None:
    client, project_id = qs_project.member.client, qs_project.project_id
    assert _put_gfa(client, project_id, _building(qs_project), "10000", "sft").status_code in (200, 204)
    seams.lines, seams.confirmed = (), frozenset({"storeys", "grid"})
    before = _boq(client, project_id)
    [columns_allowance] = [line for line in before["allowances"] if line["step"] == "columns"]
    seams.lines, seams.confirmed = column_lines(), frozenset({"storeys", "grid", "columns"})
    after = _boq(client, project_id)
    assert [line for line in after["allowances"] if line["step"] == "columns"] == []
    assert _money(after["strip"]["allowance"]) == _money(before["strip"]["allowance"]) - _money(
        columns_allowance["amount"]
    )
    assert Decimal(after["measured_share"]) > 0
    assert _money(after["strip"]["total"]) == _money(after["strip"]["measured"]) + _money(
        after["strip"]["awaiting_answer"]
    ) + _money(after["strip"]["allowance"])


def test_the_gfa_in_sft_and_in_m2_is_converted_exactly(qs_project: QsProject, seams: Seams) -> None:
    """100 m2 is 1076.391041670972... sft (1 sft = 0.09290304 m2 exactly): both entries give one BOQ."""
    seams.lines, seams.confirmed = (), frozenset()
    client, project_id, building_id = (
        qs_project.member.client,
        qs_project.project_id,
        _building(qs_project),
    )
    assert _put_gfa(client, project_id, building_id, "100", "m2").status_code in (200, 204)
    in_m2 = _boq(client, project_id)
    assert _put_gfa(client, project_id, building_id, "1076.391041670972", "sft").status_code in (
        200,
        204,
    )
    in_sft = _boq(client, project_id)
    assert in_sft["strip"] == in_m2["strip"]
    assert in_sft["allowances"] == in_m2["allowances"]
    assert _money(in_m2["strip"]["allowance"]) > 0


@pytest.mark.parametrize(
    ("value", "unit"),
    [("10000", "acre"), ("0", "sft"), ("-5", "m2"), ("ten", "sft"), ("1" + "0" * 20, "sft")],
)
def test_a_gfa_that_is_not_a_positive_area_is_refused(
    qs_project: QsProject, seams: Seams, value: str, unit: str
) -> None:
    response = _put_gfa(
        qs_project.member.client, qs_project.project_id, _building(qs_project), value, unit
    )
    assert 400 <= response.status_code < 500
    assert set(response.json()) == {"code", "params"}


def test_the_lines_of_an_item_are_its_measurement_lines_with_their_trace(
    qs_project: QsProject, seams: Seams
) -> None:
    seams.lines, seams.confirmed = column_lines(), frozenset({"storeys", "grid", "columns"})
    response = qs_project.member.client.get(
        f"/api/projects/{qs_project.project_id}/boq/items/{CONCRETE}/lines"
    )
    assert response.status_code == 200, response.content
    lines = response.json()["lines"]
    assert {str(C1), str(C2)} <= {line["element_id"] for line in lines}
    for line in lines:
        assert line["item_code"] == CONCRETE
        assert line["trace"], line
        assert {"sheet_id", "view_id", "anchor"} <= set(line["trace"][0])


def test_a_second_tenant_cannot_read_the_boq_or_set_its_gfa(
    qs_project: QsProject, seams: Seams, sign_in: Callable[..., Member]
) -> None:
    seams.lines, seams.confirmed = column_lines(), frozenset({"storeys", "grid", "columns"})
    other = sign_in(role="qs").client
    project_id, building_id = qs_project.project_id, _building(qs_project)
    assert other.get(f"/api/projects/{project_id}/boq").status_code == 404
    assert other.get(f"/api/projects/{project_id}/boq/items/{CONCRETE}/lines").status_code == 404
    assert _put_gfa(other, project_id, building_id, "10000", "sft").status_code == 404
    assert _boq(qs_project.member.client, project_id)["strip"]["gfa"] is None
