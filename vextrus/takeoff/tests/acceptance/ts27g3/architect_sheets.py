"""Ticket S27-G3's fixtures: invented Architectural sheets read by 21a's job through 21c's harness
(`t21c/step1_whole.py`: frames, title blocks and view titles drawn by the repo's test drawing; the
sheet and view finders run as they are), and each view's proposal as Step 1's API lists it.

Everything is invented (docs/sdlc.md): every title here is made of the convention words the routing
reads (slab, beam, outline, column, lintel, layout, framing, toilet, details, section, plan) and
nothing else. The convention they carry: an architect's sheet that draws the structure is named so by
its title, while its view's own title may name nothing at all.

The route is told from the titles' words (routing reads words only, `engine/recognise/views/routing.py`):
the sheet kind Jev's stand-in picks here is its first option, never relied on.
"""

import uuid
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, readers, run_job, uploaded
from vextrus.testing.drawings import QsProject

ARCHITECTURAL = "KR-ARC-R0.dwg"
WALLS_AND_ROOMS = {"walls", "rooms"}
"""Steps 11 and 12 (the seed's keys, `vextrus/seed/drawings.py`)."""
PLUMBING = "plumbing"
"""The Plumbing and sanitary Part, by its Discipline's key (`engine.recognise.views.PLUMBING_PART`)."""
DUPLICATE = "duplicate"
"""The exclusion reason "duplicate or another Discipline's copy", worded "the structural set governs"
(docs/specs/M0.md, review Q2)."""


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> uuid.UUID:
    """Upload one Architectural file of the invented sheets and run the read job on it."""
    file_id = uploaded(qs.member, qs.project_id, ARCHITECTURAL)
    run_job(qs.member, file_id, monkeypatch, readers({ARCHITECTURAL: sheets}))
    return file_id


def drawn_views(listed: list[dict[str, Any]], number: str | None) -> list[dict[str, Any]]:
    """The sheet's views as Step 1 lists them, its title block left aside (a View proposed out for
    information whatever the sheet draws)."""
    [sheet] = [p for p in listed if p["number"] == number]
    return [v for v in sheet["views"] if v["kind"] != "title_block"]
