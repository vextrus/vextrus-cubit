"""Ticket T-249 (PR A), A1: the export's burden block (section 3, A1). The posting run cannot see the
burden today: `export()` writes sheets, views, Plot, conflicts, continuations and checks, but no
Question and no agreement, so a PR that doubles the Questions per Discipline shows 0/0/0.

The block is `{"version": 1, "disciplines": {<Discipline key or "none">: {sheets, sheets_counted,
bulk_confirmable, one_source, held, questions_open: {<kind>: n}, conflicts: {same_number, same_title,
same_storey}, gap_questions, gap_files, machine_doubt, counted_toward_cap, plan_sheets_no_storey,
proposed_out, proposed_out_by_reason: {<reason>: n}}}}`, counts only, every leaf an int >= 0. Its
counts equal what `step1.proposals` and `step1.questions` give for the same Project (the walk's own
rules: bulk-confirmable is `agrees and not held`, one source is `not agrees`).

Invented sheets only (see `world`).
"""

import json
from typing import Any

import pytest

from engine.recognise.types import ExclusionReason
from vextrus.takeoff.services import step1
from vextrus.testing.drawings import QsProject

from .world import (
    CONFLICT_KEYS,
    KINDS,
    NONE,
    REASONS,
    ROW_KEYS,
    Drawn,
    burden,
    detail,
    expected_from_step1,
    gap,
    leaves,
    low_confidence,
    nonzero,
    plan,
    read_file,
    rows,
    same_number,
    same_title,
    the_market_disciplines,
)


@pytest.fixture(autouse=True)
def typesafe_down(jev_down: Any) -> None:
    """Nothing here asks Jev; TypeSafe is down all the same, as in the check's sandbox."""
    jev_down("timeout")


def _list(qs: QsProject, discipline: str, numbers: list[str]) -> None:
    with qs.member.acting():
        step1.set_list(qs.project_id, discipline, "\n".join(numbers), actor_name=qs.member.user.name)


@pytest.mark.django_db
def test_the_block_is_present_with_a_row_per_discipline_and_every_key(qs_project: QsProject) -> None:
    structural = read_file(
        qs_project,
        "INV-STR-07.dwg",
        [
            Drawn("S-611", "Made-up raft outline", "structural", views=(plan("ground"),)),
            Drawn("S-612", "Made-up wall layout", "structural", views=(plan("ground"),)),
        ],
    )
    architectural = read_file(
        qs_project,
        "INV-ARC-07.dwg",
        [Drawn("A-611", "Made-up facade study", "architectural", views=(detail(),))],
    )

    block = burden(qs_project, [structural, architectural])

    assert block["version"] == 1
    found = rows(block)
    assert {"structural", "architectural"} <= set(found)
    for key in ("structural", "architectural"):
        assert set(found[key]) == ROW_KEYS, key
        assert set(found[key]["conflicts"]) == CONFLICT_KEYS, key
    assert found["structural"]["sheets"] == 2
    assert found["architectural"]["sheets"] == 1


@pytest.mark.django_db
def test_the_counts_equal_the_products_own_step1_answers(qs_project: QsProject) -> None:
    """One sheet agreeing, one with one source, one held, one in an open low_confidence Question."""
    good = read_file(
        qs_project,
        "INV-STR-21.dwg",
        [
            Drawn("S-721", "Made-up pile cap layout", "structural", views=(plan("ground"),)),
            Drawn("S-722", "Made-up column schedule", "structural", views=(detail(),)),
            Drawn("S-799", "Made-up lintel notes", "structural", views=(detail(),)),
        ],
    )
    held = read_file(
        qs_project,
        "INV-STR-22.dwg",
        [Drawn("S-723", "Made-up stair section", "structural", views=(detail(),))],
        held=True,
    )
    other = read_file(
        qs_project,
        "INV-ARC-21.dwg",
        [
            Drawn("A-721", "Made-up kitchen plan", "architectural", views=(plan("ground"),)),
            Drawn("A-722", "Made-up door schedule", "architectural", views=(detail(),)),
        ],
    )
    _list(qs_project, "structural", ["S-721", "S-722", "S-723"])  # S-799 is not on it: one source
    low_confidence(qs_project, good.sheets[1])
    low_confidence(qs_project, other.sheets[0])

    block = burden(qs_project, [good, held, other])
    expected = expected_from_step1(qs_project)

    with qs_project.member.acting():
        proposals = step1.proposals(qs_project.project_id)
    assert any(p.agrees and not p.held for p in proposals), "the fixture has a sheet that agrees"
    assert any(p.held for p in proposals), "the fixture has a held sheet"
    assert any(not p.agrees and not p.held for p in proposals), "the fixture has a one-source sheet"
    found = rows(block)
    for discipline, want in expected.items():
        row = found[discipline]
        assert row["sheets"] == want["sheets"], discipline
        assert row["bulk_confirmable"] == want["bulk_confirmable"], discipline
        assert row["one_source"] == want["one_source"], discipline
        assert row["held"] == want["held"], discipline
        assert nonzero(row["questions_open"]) == dict(want["questions_open"]), discipline
    assert set(found) == set(expected)


@pytest.mark.django_db
def test_numbering_gaps_count_once_per_file_toward_the_cap(qs_project: QsProject) -> None:
    first = read_file(
        qs_project,
        "INV-STR-31.dwg",
        [
            Drawn("S-831", "Made-up grade beam plan", "structural", views=(plan("ground"),)),
            Drawn("S-834", "Made-up slab strip plan", "structural", views=(plan("ground"),)),
            Drawn("S-838", "Made-up roof beam plan", "structural", views=(plan("ground"),)),
        ],
    )
    second = read_file(
        qs_project,
        "INV-STR-32.dwg",
        [Drawn("S-845", "Made-up water tank plan", "structural", views=(plan("ground"),))],
    )
    gap(qs_project, first.sheets[0], "S-829", "S-831")
    gap(qs_project, first.sheets[1], "S-831", "S-834")
    gap(qs_project, first.sheets[2], "S-834", "S-838", code="gaps")  # t229: all of a Discipline's gaps

    row = rows(burden(qs_project, [first, second]))["structural"]
    assert (row["gap_questions"], row["gap_files"]) == (3, 1)
    assert row["machine_doubt"] == 0
    assert row["counted_toward_cap"] == 1

    gap(qs_project, second.sheets[0], "S-838", "S-845")

    row = rows(burden(qs_project, [first, second]))["structural"]
    assert (row["gap_questions"], row["gap_files"]) == (4, 2)
    assert row["counted_toward_cap"] == row["machine_doubt"] + row["gap_files"] == 2


@pytest.mark.django_db
def test_conflicts_are_reported_by_code_outside_the_cap(qs_project: QsProject) -> None:
    read = read_file(
        qs_project,
        "INV-ARC-41.dwg",
        [
            Drawn("A-941", "Made-up lobby plan", "architectural", views=(plan("ground"),)),
            Drawn("A-941", "Made-up lobby plan copy", "architectural", views=(plan("ground"),)),
            Drawn("A-944", "Made-up terrace plan", "architectural", views=(plan("ground"),)),
            Drawn("A-947", "Made-up terrace plan", "architectural", views=(plan("ground"),)),
            Drawn("A-949", "Made-up window details", "architectural", views=(detail(),)),
        ],
    )
    same_number(qs_project, read.sheets[0:2])
    same_title(qs_project, read.sheets[2:4])
    low_confidence(qs_project, read.sheets[4])
    low_confidence(qs_project, read.sheets[2])

    row = rows(burden(qs_project, [read]))["architectural"]

    assert row["conflicts"] == {"same_number": 1, "same_title": 1, "same_storey": 0}
    assert row["machine_doubt"] == 2
    assert row["counted_toward_cap"] == 2
    assert nonzero(row["questions_open"]) == {"conflict": 2, "low_confidence": 2}


@pytest.mark.django_db
def test_plan_sheets_with_no_storey_stated_are_counted(qs_project: QsProject) -> None:
    read = read_file(
        qs_project,
        "INV-STR-51.dwg",
        [
            Drawn("S-551", "Made-up footing plan", "structural", views=(plan(),)),  # counts
            Drawn("S-552", "Made-up podium plan", "structural", "Invented mezzanine", views=(plan(),)),
            Drawn(
                "S-553", "Made-up hook details", "structural", views=(detail(), detail("Made-up lap"))
            ),
            Drawn("S-554", "Made-up deck plan", "structural", views=(plan("ground"),)),
        ],
    )

    row = rows(burden(qs_project, [read]))["structural"]

    assert row["plan_sheets_no_storey"] == 1


@pytest.mark.django_db
def test_a_sheet_proposed_out_is_counted_by_its_reason_and_not_toward_the_sheets(
    qs_project: QsProject,
) -> None:
    read = read_file(
        qs_project,
        "INV-ARC-61.dwg",
        [
            Drawn(
                None,
                "Made-up presentation sheet",
                "architectural",
                exclusion=ExclusionReason.FOR_INFORMATION,
            ),
            Drawn("A-661", "Made-up attic plan", "architectural", views=(plan("ground"),)),
            Drawn("A-662", "Made-up eave section", "architectural", views=(detail(),)),
        ],
    )

    row = rows(burden(qs_project, [read]))["architectural"]

    assert row["proposed_out"] == 1
    assert nonzero(row["proposed_out_by_reason"]) == {ExclusionReason.FOR_INFORMATION.value: 1}
    assert row["sheets"] == 3
    assert row["sheets_counted"] == 2


MARKERS = ("XV-MARK-71", "XV-MARK-72", "Qx marker title nine", "Qx marker title ten", "QX-LAYOUT-ALPHA")


@pytest.mark.django_db
def test_the_block_holds_counts_only_and_no_drawing_text(qs_project: QsProject) -> None:
    """The leak test: titles, numbers, layout names and storeys carry markers; none reaches the
    block, every leaf is an int >= 0 and every key is from the closed lists or a Discipline key."""
    read = read_file(
        qs_project,
        "INV-STR-71.dwg",
        [
            Drawn(
                "XV-MARK-71",
                "Qx marker title nine",
                "structural",
                "Qx marker storey",
                layout="QX-LAYOUT-ALPHA",
                views=(plan(title="Qx marker view"),),
            ),
            Drawn(
                "XV-MARK-72",
                "Qx marker title ten",
                "structural",
                views=(detail("Qx marker detail"),),
            ),
            Drawn(None, "Qx marker cover", None, exclusion=ExclusionReason.COVER_INDEX),
        ],
    )
    low_confidence(qs_project, read.sheets[0])
    same_title(qs_project, read.sheets[0:2])
    gap(qs_project, read.sheets[1], "XV-MARK-70", "XV-MARK-72")

    block = burden(qs_project, [read])

    text = json.dumps(block)
    for marker in (*MARKERS, "Qx marker", "INV-STR-71"):
        assert marker not in text
    for where, value in leaves(block):
        assert type(value) is int, where
        assert value >= 0, where
    allowed = the_market_disciplines(qs_project) | {NONE}
    for discipline, row in rows(block).items():
        assert discipline in allowed
        assert set(row) == ROW_KEYS
        assert set(row["questions_open"]) <= KINDS
        assert set(row["conflicts"]) == CONFLICT_KEYS
        assert set(row["proposed_out_by_reason"]) <= REASONS
