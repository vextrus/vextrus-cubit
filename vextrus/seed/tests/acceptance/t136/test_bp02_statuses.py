"""The seed's file statuses say nothing that contradicts the file (#131; m0-screens 4.5 and §7).

#131: "(1) BP-02's BP-ARC-R0.pdf says 'Plot: 0 of 6 pages matched' while its DWG is 'Waiting to be
read'; m0-screens 4.5 words this case 'Plot: waiting for its DWG. Its pages are matched when the DWG is
read.' (2) BP-02's BP-ARC-old.dwg says 'Held, read anyway: its sheets are marked' but shows 0 sheets
found."

Pinned on every seeded project through the Drawing Set's API (`GET …/drawings/files`), by message
code: a PDF none of whose pages matched never reads "Plot: 0 of N pages matched" (4.5's "PDF before
its DWG" row is the words for it), and a held file read anyway has sheets to mark. Which file carries
which answer is the builder's; that "PDF before its DWG" and "Held, answered" stay on the seed is
pinned in `test_every_row_state.py`.
"""

from typing import Any

import pytest

from vextrus.seed.demo import Demo
from vextrus.testing.auth import Api

from .seeded import *  # noqa: F403 (its fixtures, which pytest finds by name)
from .seeded import every_seeded_file

PLOT_MATCHED = ("drawings.files.plot_matched", "drawings.files.plot_matched_lines")
HELD_READ_ANYWAY = "drawings.files.held_read_anyway"


def said(row: dict[str, Any]) -> str:
    return f"{row['project']} {row['name']}: {row['status']} (sheets found {row['sheets_found']})"


@pytest.mark.django_db(databases=["default", "owner"])
def test_no_seeded_pdf_says_none_of_its_pages_matched(demo: Demo, nusrat: Api, tanvir: Api) -> None:
    rows = every_seeded_file(demo, nusrat, tanvir)

    none_matched = [
        said(r)
        for r in rows
        if r["status"]["code"] in PLOT_MATCHED and r["status"]["params"]["matched"] == 0
    ]
    assert none_matched == []


@pytest.mark.django_db(databases=["default", "owner"])
def test_a_seeded_file_held_and_read_anyway_has_sheets_found(
    demo: Demo, nusrat: Api, tanvir: Api
) -> None:
    rows = every_seeded_file(demo, nusrat, tanvir)

    without_sheets = [
        said(r)
        for r in rows
        if r["status"]["code"] == HELD_READ_ANYWAY and not (r["sheets_found"] or 0) > 0
    ]
    assert without_sheets == []
