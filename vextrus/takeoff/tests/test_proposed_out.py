"""Ticket 162: a sheet the read proposes out (a cover, or a box of notes the cover rule takes for one)
is listed, proposed out, asks no Question and is not counted in Step 1's progress until the QS
confirms it in (on hand-built artefacts, as `acceptance/t21c` builds them)."""

import uuid
from collections.abc import Sequence
from typing import Any

import pytest

from engine.geometry.placement import chain, chain_transform
from engine.read import ReadArtefact
from engine.recognise.tests.drawing import H, W, frame_block, rectangle, value_at
from vextrus.takeoff.tests.acceptance.t21c import step1_whole
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    LABELS,
    SCALE,
    Sheet,
    confirm,
    jev_says,
    proposals,
    questions,
    readers,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

NUMBERED = [Sheet("S-01", "PILE LAYOUT PLAN"), Sheet("S-02", "COLUMN SCHEDULE")]
NOTES = ("GENERAL NOTES", "1. ALL DIMENSIONS ARE IN MM", "2. CONCRETE GRADE AS SCHEDULED")


def with_a_cover(sha256: str, name: str, sheets: Sequence[Sheet]) -> ReadArtefact:
    """The invented sheets side by side, each a framed A1 at 1:50 with its number and title, and
    after them a plain rectangle of a frame's size holding lines of notes and no title block."""
    d = step1_whole._Invented(name, sha256)
    block = frame_block(d, labels=LABELS)
    s = SCALE
    for n, sheet in enumerate(sheets):
        insert = d.insert(block, (n * 100_000.0, 0.0, 0.0), scale=(s, s, s))
        placed = chain_transform(chain(d.artefact(), [insert]))
        for cell, text in {0: sheet.title, 2: sheet.number}.items():
            if text:
                x, y, _ = placed.apply(value_at(cell))
                d.text(text, (x, y, 0.0), height=5.0 * s)
    ox = len(sheets) * 100_000.0
    d.entity("LWPOLYLINE", rectangle(ox, 0.0, ox + W * s, H * s))
    for i, line in enumerate(NOTES):
        d.text(line, (ox + 40 * s, (500 - 20 * i) * s, 0.0), height=5.0 * s)
    return d.artefact()


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str) -> uuid.UUID:
    monkeypatch.setattr(step1_whole, "artefact", with_a_cover)
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: NUMBERED}))
    return file_id


def rows(api: Any, project_id: uuid.UUID) -> dict[str | None, dict[str, Any]]:
    return step1_whole.progress(api, project_id)


@pytest.mark.parametrize("sure", ["0.97", "0.34"])
@pytest.mark.parametrize("name", ["KR-STR-R0.dwg", "KR-R0.dwg"])
def test_a_proposed_out_sheet_is_listed_and_asks_no_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline, name: str, sure: str
) -> None:
    """A file named for its Discipline or not, Jev sure or not: the cover asks nothing."""
    jev_says(jev_offline, sure)
    read(qs_project, monkeypatch, name)
    api = api_as(qs_project.member)

    cover = the(proposals(api, qs_project.project_id), None)
    assert cover["proposed_exclusion"] == "cover_index"
    assert cover["decision"] is None
    about = [
        q for q in questions(api, qs_project.project_id)
        if q["subject_id"] == cover["sheet_id"] or cover["id"] in q["proposals"]
    ]  # fmt: skip
    assert about == []


def test_a_proposed_out_sheet_is_not_counted_until_the_qs_confirms_it_in(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    read(qs_project, monkeypatch, "KR-STR-R0.dwg")
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    assert len(listed) == 3

    row = rows(api, qs_project.project_id)["structural"]
    assert (row["found"], row["total"], row["confirmed"]) == (2, 2, 0)
    assert row["open_questions"] == 0

    numbered = [p["id"] for p in listed if p["number"]]
    assert confirm(api, qs_project.project_id, numbered).status_code == 200
    row = rows(api, qs_project.project_id)["structural"]
    assert (row["found"], row["confirmed"], row["status"]) == (2, 2, "confirmed")

    cover = the(listed, None)
    response = confirm(api, qs_project.project_id, [cover["id"]], kind="cover_index")
    assert response.status_code == 200, response.content
    row = rows(api, qs_project.project_id)["structural"]
    assert (row["found"], row["confirmed"], row["total"]) == (3, 3, 3)
