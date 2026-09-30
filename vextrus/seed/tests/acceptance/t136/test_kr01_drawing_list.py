"""KR-01's Structural drawing list on S-01 (#136; m0-screens §7).

§7, "KR-01's files": KR-STR-R0.dwg carries "S-01 general notes with a legend and a drawing list naming
S-01 to S-13". §7, "KR-01 after reading" (the state 14 and 19a write as rows, and 21c's job must
reproduce): "Structural 13 found, 13 on the drawing list on S-01 | 0 / 13 settled" · "Architectural 8
found; no drawing list; …" · "Electrical 3 found; no drawing list; …"; toolbar "Confirmed 0 / 24".
#136: "the drawing-list API returns source: null, read_numbers: null, so Step 1's first open shows
'Confirm 5, leave out 1' instead of m0-screens §7's 'Confirm 16, leave out 1 ↵'".

Read through Step 1's API (19a's `drawing-list` and `progress`), and, for "on S-01", the drawing list's
row naming the sheet it was read on (`DrawingRegister.source_sheet_id`, 19a's model), since the API
does not name that sheet.
"""

import uuid

import pytest

from vextrus.platform.services import tenancy
from vextrus.seed.demo import Demo
from vextrus.takeoff.models import DrawingRegister, RegisterSource
from vextrus.testing.auth import Api

from .seeded import *  # noqa: F403 (its fixtures, which pytest finds by name)
from .seeded import get_json, step1

S01_TO_S13 = [f"S-{n:02d}" for n in range(1, 14)]


@pytest.fixture
def kr01(demo: Demo) -> uuid.UUID:
    project_id: uuid.UUID = demo["project:KR-01"]
    return project_id


@pytest.mark.django_db(databases=["default", "owner"])
def test_kr01s_structural_drawing_list_is_read_on_a_sheet_naming_s01_to_s13(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    held = get_json(nusrat, f"{step1(kr01)}/drawing-list", discipline="structural")

    assert held["source"] == "sheet"
    assert held["numbers"] == S01_TO_S13
    assert held["read_numbers"] == S01_TO_S13
    assert held["agrees"] is True
    # Read on a sheet, not given by a person.
    assert held["entered_by"] is None


@pytest.mark.django_db(databases=["default", "owner"])
def test_kr01s_structural_drawing_list_is_the_one_on_s01(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    listed = get_json(nusrat, f"{step1(kr01)}/proposals")["proposals"]
    [s01] = [p for p in listed if p["number"] == "S-01" and p["discipline"] == "structural"]

    with tenancy.acting_in(demo["developer:shapla"]):
        read_on = list(
            DrawingRegister.objects.filter(
                project_id=kr01, discipline="structural", source=RegisterSource.SHEET
            ).values_list("source_sheet_id", flat=True)
        )

    assert read_on == [uuid.UUID(s01["sheet_id"])]


@pytest.mark.django_db(databases=["default", "owner"])
def test_kr01s_step1_counts_structural_against_its_drawing_list_and_the_others_without_one(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    progress = get_json(nusrat, f"{step1(kr01)}/progress")

    rows = [
        (r["discipline"], r["confirmed"], r["found"], r["listed"], r["total"], r["lists_disagree"])
        for r in progress["disciplines"]
    ]
    assert rows == [
        ("structural", 0, 13, 13, 13, False),
        ("architectural", 0, 8, None, 8, False),
        ("electrical", 0, 3, None, 3, False),
    ]
    # Toolbar "Confirmed 0 / 24".
    assert sum(r["total"] for r in progress["disciplines"]) == 24


@pytest.mark.django_db(databases=["default", "owner"])
@pytest.mark.parametrize("discipline", ["architectural", "electrical"])
def test_kr01s_architectural_and_electrical_have_no_drawing_list(
    nusrat: Api, kr01: uuid.UUID, discipline: str
) -> None:
    held = get_json(nusrat, f"{step1(kr01)}/drawing-list", discipline=discipline)

    assert (held["source"], held["numbers"], held["read_numbers"]) == (None, [], None)
