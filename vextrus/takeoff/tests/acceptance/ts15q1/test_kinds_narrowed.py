"""S15-Q1, first half: "Sheet kinds carry words and code narrows them" (the session 15 ticket), before
Jev is asked. Where the read job asks Jev a sheet's kind, the kinds it offers are no longer every kind
of the sheet's Discipline (the 23 structural options of discovery 01 section 1, `sheets.judgement`):
code has read the title's words against the kinds' words first.

Pinned only what any narrowing by words must give: a title naming a subject ("BEAM", "COLUMN") and
no kind's whole words keeps the kinds of that subject and drops kinds of another subject. Which
generic kinds stay ("Details", "Other"), and what code does with a title naming no kind's word, are
the builder's.
"""

import json
from pathlib import Path

import pytest

from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import (
    STRUCTURAL,
    beams,
    columns,
    jev_unsure,
    read,
)
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

REPO = Path(__file__).resolve().parents[5]
CONVENTIONS = json.loads(
    (REPO / "engine" / "recognise" / "conventions" / "sheet-default.json").read_text(encoding="utf-8")
)
EVERY_STRUCTURAL_KIND = set(CONVENTIONS["sheet_kinds"]["structural"]) | set(
    CONVENTIONS["common_sheet_kinds"]
)
"""Every kind a structural sheet can be: what Jev is offered on main, whatever the title says."""

OTHER_SUBJECTS = {"pile_layout", "pile_cap_layout", "stair_details", "tank_details"}
"""Kinds of subjects neither invented title names."""


def test_a_beam_titled_sheet_offers_jev_its_beam_kinds_and_not_every_structural_kind(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The ticket: "code narrows them" before Jev: "BEAM DRAWING A" keeps "Beam layout" and "Beam
    details" and is not offered a pile, stair, tank or column kind."""
    offered = jev_unsure(jev_offline)
    [sheet] = beams([1])
    read(qs_project, monkeypatch, STRUCTURAL, [sheet])

    [options] = offered[sheet.title]

    narrowed = set(options) - OTHER_SUBJECTS - {"column_layout", "column_schedule"}
    assert set(options) != EVERY_STRUCTURAL_KIND, "offered every kind: not narrowed by code"
    assert narrowed == set(options), f"offered every kind's subject: {sorted(options)}"
    assert {"beam_layout", "beam_details"} <= set(options), sorted(options)


def test_a_column_titled_sheet_offers_jev_its_column_kinds_and_no_beam_kind(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The same narrowing on another subject: the words of the kinds decide, not one subject's rule."""
    offered = jev_unsure(jev_offline)
    [sheet] = columns([1])
    read(qs_project, monkeypatch, STRUCTURAL, [sheet])

    [options] = offered[sheet.title]

    narrowed = set(options) - OTHER_SUBJECTS - {"beam_layout", "beam_details"}
    assert set(options) != EVERY_STRUCTURAL_KIND, "offered every kind: not narrowed by code"
    assert narrowed == set(options), f"offered every kind's subject: {sorted(options)}"
    assert {"column_layout", "column_schedule"} <= set(options), sorted(options)
