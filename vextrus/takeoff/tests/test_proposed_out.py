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
    open_questions,
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


UNPREFIXED = [Sheet("01", "PILE LAYOUT PLAN"), Sheet("02", "COLUMN SCHEDULE")]
"""Numbers with no Discipline's prefix: in a file named for none, every sheet is of no Discipline."""
COVER_VIEW = "KEY PLAN"
"""A view drawn on the cover, so Jev is asked its kind."""


def with_a_cover(sha256: str, name: str, sheets: Sequence[Sheet]) -> ReadArtefact:
    """The invented sheets side by side, each a framed A1 at 1:50 with its number and title, and
    after them a plain rectangle of a frame's size holding lines of notes, a titled view and no
    title block."""
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
    x0, y0, x1, y1 = step1_whole.BOTTOM_RIGHT
    step1_whole._grid(d, (ox + x0 * s, y0 * s, ox + x1 * s, y1 * s))
    d.text(COVER_VIEW, (ox + x0 * s, (y0 - 12) * s, 0.0), height=6.0 * s)
    return d.artefact()


def read(
    qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: Sequence[Sheet] = NUMBERED
) -> uuid.UUID:
    monkeypatch.setattr(step1_whole, "artefact", with_a_cover)
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def rows(api: Any, project_id: uuid.UUID) -> dict[str | None, dict[str, Any]]:
    return step1_whole.progress(api, project_id)


def about_the_cover(api: Any, project_id: uuid.UUID) -> tuple[dict[str, Any], list[str]]:
    """The cover's Proposal, and the kinds of every Question about the sheets (the cover's last)."""
    cover = the(proposals(api, project_id), None)
    assert cover["proposed_exclusion"] == "cover_index"
    assert cover["decision"] is None
    asked = questions(api, project_id)
    on_cover = [
        q["kind"] for q in asked if q["subject_id"] == cover["sheet_id"] or cover["id"] in q["proposals"]
    ]
    return cover, on_cover


def test_a_proposed_out_sheet_is_listed_and_asks_no_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    read(qs_project, monkeypatch, "KR-STR-R0.dwg")
    api = api_as(qs_project.member)

    cover, on_cover = about_the_cover(api, qs_project.project_id)
    assert cover["discipline"] == "structural"
    assert on_cover == []  # with no number, it would be asked `missing`


def test_a_proposed_out_sheet_of_no_discipline_is_not_asked_its_discipline(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """A file named for no Discipline, its numbers of no prefix: every sheet is of none, and the
    numbered ones are asked which; the cover is not."""
    jev_says(jev_offline, "0.97")
    read(qs_project, monkeypatch, "KR-R0.dwg", UNPREFIXED)
    api = api_as(qs_project.member)

    cover, on_cover = about_the_cover(api, qs_project.project_id)
    assert cover["discipline"] is None
    assert on_cover == []
    kinds = [q["kind"] for q in open_questions(api, qs_project.project_id)]
    assert kinds.count("missing_discipline") == 2  # the two numbered sheets: the path is reached


def test_a_proposed_out_sheet_jev_is_unsure_of_raises_no_low_confidence_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """Jev barely sure of every sheet's kind: the numbered ones are asked it, the cover (its view
    titled, so judged) is not."""
    jev_says(jev_offline, "0.34")
    read(qs_project, monkeypatch, "KR-STR-R0.dwg")
    api = api_as(qs_project.member)

    _cover, on_cover = about_the_cover(api, qs_project.project_id)
    assert on_cover == []
    kinds = [q["kind"] for q in open_questions(api, qs_project.project_id)]
    assert kinds.count("low_confidence") == 2


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
