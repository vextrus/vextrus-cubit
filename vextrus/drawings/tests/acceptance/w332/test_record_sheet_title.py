"""Ticket T-W332's acceptance, the store (the ticket's section 3 C1 to C3; #332): the read job keeps a
title read from a Sheet's one drawing View through `drawings`, with its source "view_title", and never
over a title already there or a QS's decision.

Through the seam the ticket fixes: `vextrus.drawings.services.record_sheet_title(sheet_revision_id, *,
title: Sourced, storeys_as_stated: Sourced | None = None) -> SheetView`, acting as the Member (as
`record_kind` is). Sheets are recorded as `vextrus/drawings/tests/test_drawings_sheets.py` records
them; every title is invented.

    uv run pytest vextrus/drawings/tests/acceptance/w332
"""

import uuid
from collections.abc import Callable, Sequence

import pytest

from engine.recognise.types import Sourced, ValueSource
from vextrus.drawings import services
from vextrus.drawings.models import Sheet
from vextrus.platform.services import auth
from vextrus.testing.drawings import QsProject, add, artefact_for, drawing, sheet_candidate

pytestmark = pytest.mark.django_db

SEAM = "record_sheet_title"
"""The ticket's seam in `drawings.services` (a name until the builder writes it)."""


def record_sheet_title(
    sheet_revision_id: uuid.UUID, *, title: Sourced, storeys_as_stated: Sourced | None = None
) -> services.SheetView:
    keep: Callable[..., services.SheetView] = getattr(services, SEAM)
    return keep(sheet_revision_id, title=title, storeys_as_stated=storeys_as_stated)


def recorded(
    project: QsProject, sheets: Sequence[tuple[str | None, str | None]]
) -> list[services.SheetView]:
    """One file's printed sheets, each `(number, title)` as its title block gave them."""
    found = add(project.member, project.project_id, "KR-STR-R2.dwg", drawing()).file
    with project.member.acting():
        services.store_artefact(found.id, artefact_for(found.sha256, found.name, len(sheets)))
        candidates = [
            sheet_candidate(i, found.group, number=number, title=title, revision_mark=f"R{i}")
            for i, (number, title) in enumerate(sheets)
        ]
        printed = services.record_sheets(found.id, candidates)
        services.mark_read(found.id)
    return printed


def view_title(text: str) -> Sourced:
    return Sourced(text, ValueSource("view_title"))


def numbered_row(member_project: QsProject, sheet_id: uuid.UUID) -> tuple[str, str]:
    with member_project.member.acting():
        row = Sheet.objects.get(id=sheet_id)
        return row.title, row.storeys_as_stated


def test_a_title_from_a_view_is_kept_with_its_source_and_on_its_numbered_sheet(
    qs_project: QsProject,
) -> None:
    [untitled] = recorded(qs_project, [("ST-31", None)])
    assert untitled.title == ""

    with qs_project.member.acting():
        returned = record_sheet_title(
            untitled.id,
            title=view_title("9TH FLOOR CANOPY SLAB DETAIL"),
            storeys_as_stated=view_title("9TH FLOOR"),
        )
        read_back = services.sheet(untitled.id)

    for sheet in (returned, read_back):
        assert sheet.title == "9TH FLOOR CANOPY SLAB DETAIL"
        assert sheet.storeys_as_stated == "9TH FLOOR"
        assert sheet.sources["title"] == "view_title"
        assert sheet.sources["storeys_as_stated"] == "view_title"
        assert sheet.sources["number"] in {"title_block_attribute", "title_block_text"}
        assert sheet.number == "ST-31"
    assert numbered_row(qs_project, untitled.sheet_id) == ("9TH FLOOR CANOPY SLAB DETAIL", "9TH FLOOR")


def test_a_title_with_no_storeys_keeps_none(qs_project: QsProject) -> None:
    [untitled] = recorded(qs_project, [("ST-32", None)])

    with qs_project.member.acting():
        sheet = record_sheet_title(untitled.id, title=view_title("RIBBED SLAB LAYOUT"))

    assert (sheet.title, sheet.storeys_as_stated) == ("RIBBED SLAB LAYOUT", "")
    assert sheet.sources["title"] == "view_title"
    assert "storeys_as_stated" not in sheet.sources


def test_a_sheet_that_has_a_title_is_left_as_it_is(qs_project: QsProject) -> None:
    [titled] = recorded(qs_project, [("ST-33", "LIFT PIT DETAILS")])

    with qs_project.member.acting():
        sheet = record_sheet_title(
            titled.id, title=view_title("WATER TANK SLAB DETAIL"), storeys_as_stated=None
        )
        read_back = services.sheet(titled.id)

    for found in (sheet, read_back):
        assert found.title == "LIFT PIT DETAILS"
        assert found.sources["title"] == titled.sources["title"]
        assert found.sources["title"] != "view_title"
    assert numbered_row(qs_project, titled.sheet_id)[0] == "LIFT PIT DETAILS"


def test_a_numbered_sheet_another_revision_titled_keeps_that_title(qs_project: QsProject) -> None:
    """Two printed sheets of one number: the untitled one's own row takes the view's title, while the
    numbered Sheet keeps the title another revision's title block gave it."""
    untitled, titled = recorded(qs_project, [("ST-34", None), ("ST-34", "STAIR WAIST SLAB DETAILS")])
    assert untitled.sheet_id == titled.sheet_id
    assert numbered_row(qs_project, titled.sheet_id)[0] == "STAIR WAIST SLAB DETAILS"

    with qs_project.member.acting():
        sheet = record_sheet_title(untitled.id, title=view_title("CANOPY SLAB DETAIL"))

    assert sheet.title == "CANOPY SLAB DETAIL"
    assert sheet.sources["title"] == "view_title"
    assert numbered_row(qs_project, titled.sheet_id)[0] == "STAIR WAIST SLAB DETAILS"


@pytest.mark.parametrize("decided", ["confirmed", "excluded"])
def test_a_sheet_the_qs_decided_is_left_as_it_is_without_a_refusal(
    qs_project: QsProject, decided: str
) -> None:
    [untitled] = recorded(qs_project, [("ST-35", None)])
    with qs_project.member.acting():
        if decided == "confirmed":
            services.confirm_sheet(untitled.id, confirmation_id=uuid.uuid4())
        else:
            services.exclude(untitled.id, "superseded", confirmation_id=uuid.uuid4())

        sheet = record_sheet_title(untitled.id, title=view_title("RAMP WALL DETAIL"))
        read_back = services.sheet(untitled.id)

    for found in (sheet, read_back):
        assert found.title == ""
        assert "title" not in found.sources
        assert found.decision == decided
    assert numbered_row(qs_project, untitled.sheet_id)[0] == ""


@pytest.mark.parametrize("code", ["%%c", "\\P", "{\\fArial|b0;"])
def test_a_title_holding_a_raw_cad_code_is_refused_and_nothing_is_kept(
    qs_project: QsProject, code: str
) -> None:
    [untitled] = recorded(qs_project, [("ST-36", None)])

    with qs_project.member.acting():
        with pytest.raises(auth.Refused):
            record_sheet_title(untitled.id, title=view_title(f"CANOPY {code} DETAIL"))
        read_back = services.sheet(untitled.id)

    assert read_back.title == ""
    assert "title" not in read_back.sources
    assert numbered_row(qs_project, untitled.sheet_id)[0] == ""
