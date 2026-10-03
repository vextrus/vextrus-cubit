"""Ticket 158's fixtures (#158, "every Structural view accounted, so Structural can reach confirmed"):
invented Structural sheets read by 21a's job through 21c's harness (`t21c/step1_whole.py`: frames,
title blocks and view titles drawn by 13's test drawing; the sheet and view finders run as they are),
and Step 1's API as the web calls it.

Everything is invented (docs/sdlc.md): no title here is read from a real drawing. The walk that found
B3 (session 07, ticket 26) saw Structural sections, schedules and details whose own titles name no
subject ("SECTION 1-1") on sheets whose titles do ("BEAM DETAILS"); those are the rows below.

Names chosen by the acceptance writer where no authority gives one (the builder meets them; the report
lists each):
- `POST {step1}/assign` with `{"proposals": [<a view's Proposal id>], "steps": [<Takeoff Step key>]}`
  puts a view in one or more Takeoff Steps (the Library's keys, `vextrus/takeoff/library.py`); 200
  with the act (`Step1ActOut`).
- Its refusals: another Developer's Project or view, 404 `platform.auth.not_found`; the MD or a Guest,
  403 `platform.auth.not_allowed` (07's guard, as every Step 1 act); a key that is no Takeoff Step,
  400 `takeoff.step1.step_unknown`; a view the QS has excluded, 409 `takeoff.step1.view_excluded`.
- `GET {step1}/progress`: each Discipline's row carries `outstanding`, the list of what keeps it from
  `confirmed`, each `{code, params}`; unaccounted views are `takeoff.step1.views_unaccounted` with
  `{"count": n}`; an empty list once nothing does.
"""

import uuid
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    readers,
    run_job,
    step1,
    uploaded,
)
from vextrus.testing.drawings import QsProject

STRUCTURAL = "KR-STR-R0.dwg"

ASSIGN = "assign"
STEP_UNKNOWN = "takeoff.step1.step_unknown"
VIEW_EXCLUDED = "takeoff.step1.view_excluded"
VIEWS_UNACCOUNTED = "takeoff.step1.views_unaccounted"

NO_SUBJECT = Sheet("S-01", "TYPICAL DETAILS", ("SECTION 9-9",))
"""A Structural sheet whose title and whose view's title name no subject (the engine's 14 subject
words, `engine/recognise/conventions/view-default.json`): nothing can tell its view's Step, so the QS
puts it in one."""
NO_SUBJECT_KIND = "details"
"""Its sheet's kind, as the QS confirms it (Structural's `details`, sheet-default.json)."""


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> uuid.UUID:
    """Upload one Structural file of the invented sheets and run the read job on it."""
    file_id = uploaded(qs.member, qs.project_id, STRUCTURAL)
    run_job(qs.member, file_id, monkeypatch, readers({STRUCTURAL: sheets}))
    return file_id


def assign(api: Any, project_id: uuid.UUID, ids: list[str], steps: list[str]) -> Any:
    return api.post(f"{step1(project_id)}/{ASSIGN}", {"proposals": ids, "steps": steps})
