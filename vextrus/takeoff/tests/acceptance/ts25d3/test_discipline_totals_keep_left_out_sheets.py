"""Ticket S25-D3 (G1 walk A f-4, FL5, misleading; #322): each Discipline's n / N counts every sheet
found, the ones proposed to leave out and the ones left out among them, so the per-Discipline totals
sum to the sheets found that the toolbar's Count and the file card show.

The walk: the toolbar read "Confirmed 0 / 218" and the file cards 86, 39, 9 and 27 sheets, while the
overview's per-Discipline line summed to 213; the five missing sheets were the five "Proposed to leave
out" cover or index frames.

m0-screens 6.3, "Proposed to leave out": "Excluded sheets stay in the count with their reason".
m0-screens 6.6, the overview's per-Part line "Structural 0 / 40 settled · Architectural 0 / 28 settled"
"... so it counts every sheet". A sheet left out is settled (the ticket: "a sheet left out is settled").
With no drawing list the total is the sheets found (S24-C3: "the heading's total is the sheets found").

Fixtures: the invented Structural file of two numbered sheets and, beside them, a numberless frame of
notes the read proposes out as `cover_index` (ticket 162's `with_a_cover`, rebuilt here on 21c's
invented artefacts), read by the product's read job with t21c's readers.
"""

import uuid
from collections.abc import Callable, Sequence
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
    a_file,
    confirm,
    exclude,
    jev_says,
    progress,
    proposals,
    readers,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

NAME = "KR-STR-R0.dwg"
NUMBERED = [Sheet("S-01", "PILE LAYOUT PLAN"), Sheet("S-02", "COLUMN SCHEDULE")]
NOTES = ("GENERAL NOTES", "1. ALL DIMENSIONS ARE IN MM", "2. CONCRETE GRADE AS SCHEDULED")
COVER_VIEW = "KEY PLAN"
FOUND = 3
"""Two numbered sheets and the numberless frame proposed out: every sheet the read found."""


def with_a_cover(sha256: str, name: str, sheets: Sequence[Sheet]) -> ReadArtefact:
    """The invented sheets side by side, each a framed A1 at 1:50 with its number and title, and
    after them a plain rectangle of a frame's size holding lines of notes, a titled view and no
    title block (the read proposes it out as a cover or index, with no number)."""
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


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    monkeypatch.setattr(step1_whole, "artefact", with_a_cover)
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: NUMBERED}))
    return file_id


def the_cover(listed: Sequence[dict[str, Any]]) -> dict[str, Any]:
    cover = the(listed, None)
    assert cover["proposed_exclusion"] == "cover_index", cover
    assert cover["discipline"] == "structural", cover
    return cover


def structural(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    row: dict[str, Any] = progress(api, project_id)["structural"]
    return row


def found_in_all(api: Any, project_id: uuid.UUID) -> int:
    return sum(row["found"] for row in progress(api, project_id).values())


def counts(row: dict[str, Any]) -> str:
    return f"progress structural found {row['found']}, settled {row['confirmed']}, total {row['total']}"


def test_a_sheet_proposed_out_is_in_its_disciplines_found_before_any_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    read(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    the_cover(listed)
    assert len(listed) == FOUND

    row = structural(api, qs_project.project_id)
    assert (row["found"], row["total"], row["confirmed"]) == (FOUND, FOUND, 0), counts(row)


def test_the_disciplines_found_sum_to_the_sheets_found_the_count_and_file_card_show(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The toolbar's Count is every Proposal found; the file card is the file's `sheets_found`."""
    jev_says(jev_offline, "0.97")
    file_id = read(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    card = a_file(api, qs_project.project_id, file_id)["sheets_found"]
    listed = len(proposals(api, qs_project.project_id))
    assert (card, listed) == (FOUND, FOUND)

    summed = found_in_all(api, qs_project.project_id)
    assert summed == listed, f"progress found sums to {summed} of {listed} sheets found"


def test_leaving_the_proposed_sheet_out_settles_it_and_keeps_it_in_the_count(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The bulk "leave out" excludes the sheet for its proposed reason; it stays in the count."""
    jev_says(jev_offline, "0.97")
    read(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    cover = the_cover(proposals(api, qs_project.project_id))

    response = exclude(api, qs_project.project_id, [cover["id"]], "cover_index")
    assert response.status_code == 200, response.content

    row = structural(api, qs_project.project_id)
    assert (row["found"], row["total"], row["confirmed"]) == (FOUND, FOUND, 1), counts(row)
    summed = found_in_all(api, qs_project.project_id)
    assert summed == FOUND, f"progress found sums to {summed} of {FOUND} sheets found"


def test_an_excluded_numbered_sheet_stays_in_the_count_beside_the_left_out_one(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    read(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    cover = the_cover(listed)
    s02 = the(listed, "S-02")

    response = exclude(api, qs_project.project_id, [s02["id"]], "for_information")
    assert response.status_code == 200, response.content
    row = structural(api, qs_project.project_id)
    assert (row["found"], row["total"], row["confirmed"]) == (FOUND, FOUND, 1), counts(row)

    response = exclude(api, qs_project.project_id, [cover["id"]], "cover_index")
    assert response.status_code == 200, response.content
    row = structural(api, qs_project.project_id)
    assert (row["found"], row["total"], row["confirmed"]) == (FOUND, FOUND, 2), counts(row)
    summed = found_in_all(api, qs_project.project_id)
    assert summed == FOUND, f"progress found sums to {summed} of {FOUND} sheets found"


def test_settled_never_exceeds_the_total_and_every_sheet_settled_confirms_the_discipline(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """Each act in turn: settled is at most the total, the total is the sheets found (no drawing
    list); with every sheet confirmed or left out the Discipline reads confirmed, FOUND / FOUND."""
    jev_says(jev_offline, "0.97")
    read(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    cover = the_cover(listed)

    acts: list[Callable[[], Any]] = [
        lambda: exclude(api, qs_project.project_id, [cover["id"]], "cover_index"),
        lambda: exclude(api, qs_project.project_id, [the(listed, "S-02")["id"]], "for_information"),
        lambda: confirm(api, qs_project.project_id, [the(listed, "S-01")["id"]]),
    ]
    for settled, act in enumerate(acts, start=1):
        response = act()
        assert response.status_code == 200, response.content
        row = structural(api, qs_project.project_id)
        assert row["total"] == row["found"] == FOUND, counts(row)
        assert row["confirmed"] == settled, counts(row)
        assert row["confirmed"] <= row["total"], counts(row)

    row = structural(api, qs_project.project_id)
    assert (row["confirmed"], row["total"], row["status"]) == (FOUND, FOUND, "confirmed"), counts(row)
