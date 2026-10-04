"""Ticket 21c, the seed (docs/plans/M0.md, 21c: "the seed's KR-01 rows replaced by the real job over its
synthetic files, with a test that §7's counts hold"; m0-screens §7: "From 21c the seed's files, made
by the committed fixture generators ..., go through the product's real upload and read job instead of
14's, 19a's and 21a's rows, and 21c's test asserts that the job produces this section's counts
exactly: sheets per Discipline, views by status, Questions by kind, the bulk act").

§7's "KR-01 after reading" table, as the API shows it to Nusrat Jahan. Reading KR-01's DWGs needs the
toolchain, so this file is marked; the counts on the seeded rows alone are 19a's tests.
"""

import uuid
from collections import Counter
from typing import Any

import pytest
from django.db import connection

from vextrus.platform.services import tenancy
from vextrus.testing.auth import Api

from ..t19a.step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from ..t21c.step1_whole import coverage, open_questions, progress, proposals

pytestmark = [
    pytest.mark.django_db(databases=["default", "owner"]),
    pytest.mark.needs_toolchain,
    pytest.mark.needs_bwrap,
]

DWGS = ("KR-STR-R0.dwg", "KR-ARC-R0.dwg", "KR-ELE-R0.dwg")
Demo = dict[str, Any]
"""The seed's ids by name (`vextrus.seed.demo.Demo`; `takeoff` may not import the seed)."""


def by_discipline(listed: list[dict[str, Any]]) -> Counter[str | None]:
    return Counter(p["discipline"] for p in listed)


def read_by_the_job(demo: Demo) -> None:
    for name in DWGS:
        file_id: uuid.UUID = demo[f"file:KR-01:{name}"]
        with tenancy.acting_in(demo["developer:shapla"]), connection.cursor() as cursor:
            cursor.execute("select step from drawings_readstep where file_id = %s", [file_id])
            steps = {step for (step,) in cursor.fetchall()}
        assert "sheets" in steps, f"{name} was not read by the read job: its steps are {steps}"


@pytest.fixture
def by_the_job(demo: Demo) -> None:
    """The premise of each count: KR-01's rows are the read job's, not 14's and 19a's."""
    read_by_the_job(demo)


def test_kr_01s_dwgs_were_read_by_the_products_read_job(demo: Demo) -> None:
    read_by_the_job(demo)


def test_the_job_finds_24_sheets_structural_13_architectural_8_electrical_3(
    nusrat: Api, kr01: uuid.UUID, by_the_job: None
) -> None:
    listed = proposals(nusrat, kr01)

    assert by_discipline(listed) == {"structural": 13, "architectural": 8, "electrical": 3}
    assert all(p["id"] != p["sheet_id"] for p in listed)
    rows = progress(nusrat, kr01)
    assert [(k, rows[k]["found"]) for k in rows] == [
        ("structural", 13),
        ("architectural", 8),
        ("electrical", 3),
    ]


def test_the_job_asks_the_five_questions_in_queue_order(
    nusrat: Api, kr01: uuid.UUID, by_the_job: None
) -> None:
    asked = open_questions(nusrat, kr01)

    assert [q["kind"] for q in asked] == [
        "file_misread",
        "conflict",
        "missing",
        "low_confidence",
        "check",
    ]
    [s07] = [q for q in asked if q["kind"] == "conflict"]
    assert s07["params"]["number"] == "S-07"
    [s13] = [q for q in asked if q["kind"] == "check"]
    assert s13["params"] == {"number": "S-13"}


def test_the_jobs_coverage_is_70_views_68_proposed_2_unaccounted(
    nusrat: Api, kr01: uuid.UUID, by_the_job: None
) -> None:
    shown = coverage(nusrat, kr01)

    counts = ("views", "assigned", "excluded", "proposed", "unaccounted", "used")
    assert {k: shown[k] for k in counts} == {
        "views": 70, "assigned": 0, "excluded": 0, "proposed": 68, "unaccounted": 2, "used": 0,
    }  # fmt: skip


def test_the_bulk_act_holds_17_that_agree_and_the_electrical_sheets_have_one_source(
    nusrat: Api, kr01: uuid.UUID, by_the_job: None
) -> None:
    """§7: "17 agree: Structural 11 (S-01 to S-12 but the two S-07s), Architectural 6 (A-01 to A-04,
    A-06, A-07); 'Confirm 16, leave out 1', A-07 left out 'for information'"; "One source: 3"."""
    listed = proposals(nusrat, kr01)

    agreeing = [p for p in listed if p["agrees"]]

    assert by_discipline(agreeing) == {"structural": 11, "architectural": 6}
    assert sorted(p["number"] for p in agreeing if p["discipline"] == "architectural") == [
        "A-01", "A-02", "A-03", "A-04", "A-06", "A-07",
    ]  # fmt: skip
    assert [p["number"] for p in agreeing if p["proposed_exclusion"]] == ["A-07"]
    assert [p["proposed_exclusion"] for p in listed if p["number"] == "A-07"] == ["cover_index"]
    one_source = [p for p in listed if p["discipline"] == "electrical" and not p["agrees"]]
    assert sorted(p["number"] for p in one_source) == ["E-01", "E-02", "E-03"]
