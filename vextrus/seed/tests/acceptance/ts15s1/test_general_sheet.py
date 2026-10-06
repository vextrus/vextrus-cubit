"""Ticket S15-S1 (#533), #223: "no sheet reads General ... Add to `seed_demo` ... one General sheet",
so the General Discipline's words can be walked (m0-screens 1.1: "General (a file of general notes in
its own numbered series ...)"; #159); with #150 for it: "draw each seeded sheet's views with plausible
content inside their boxes".

Which Project holds it is the seed's to choose (KR-01's counts are m0-screens §7's, pinned by t182 and
T-236): every seeded Project is looked at, as its Developer's QS sees it on the API.
"""

import pytest

from vextrus.seed.demo import Demo
from vextrus.seed.tests.acceptance.t136.seeded import *  # noqa: F403 (its fixtures, found by name)
from vextrus.testing.auth import Api

from .walked import GENERAL, disciplines, empty_views, files, general_sheets

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def test_a_seeded_sheet_reads_general(demo: Demo, nusrat: Api, tanvir: Api) -> None:
    """The sheet's Discipline is the Market's General, named "General"; its file's Discipline is too."""
    for seeded, sheet in general_sheets(demo, nusrat, tanvir):
        [general] = [d for d in disciplines(seeded) if d["key"] == GENERAL]
        assert general["labels"]["en"] == "General"
        assert files(seeded)[str(sheet["file_id"])]["discipline"] == GENERAL, sheet["file_name"]


def test_the_general_sheet_is_drawn_inside_its_view_boxes(demo: Demo, nusrat: Api, tanvir: Api) -> None:
    """#150 for the General sheet: it has views, and none of their boxes is empty."""
    for seeded, sheet in general_sheets(demo, nusrat, tanvir):
        assert sheet["views"], (seeded.code, sheet["number"])
        assert empty_views(seeded, sheet) == [], (seeded.code, sheet["number"])
