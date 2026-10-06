"""Ticket S15-S1's helpers (its tests import them by name): every seeded Project as its Developer's QS
sees it on the API, the job's Questions and sheets there, and whether a sheet's views are drawn.

The seed is read only at the boundary it feeds (the Drawing Set's files, Step 1, the Market's
Disciplines and a sheet's render), on ticket 136's demo seed, so these hold however the seed is made
(by the read job each run, or a template database).
"""

import json
import uuid
from collections import Counter
from dataclasses import dataclass
from typing import Any

from django.db import connection

from vextrus.platform.services import tenancy
from vextrus.seed.demo import Demo
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import open_questions, proposals, questions
from vextrus.takeoff.tests.acceptance.t182.test_seeded_sheets_are_drawn import (
    drawn_inside,
    others_of,
    render,
)
from vextrus.testing.auth import Api

WHICH_DISCIPLINE = "takeoff.proposals.which_discipline"
"""The read job's missing-Discipline Question (21c; `takeoff.messages.proposals.WHICH_DISCIPLINE`)."""
MISSING_DISCIPLINE = "missing_discipline"
"""Its kind, as Step 1's API lists it."""
KEEP_OPEN = "keep_open"
"""The last option of every Question (m0-screens §5)."""
GENERAL = "general"
"""The Market's General Discipline's key (m0-screens 1.1 and 4.5; #159)."""
QS = {"shapla": "nusrat@shapla-homes.example", "meghna": "tanvir@meghna.example"}
"""Each seeded Developer with Projects and its QS (m0-screens §7)."""


@dataclass(frozen=True)
class Seeded:
    """One seeded Project as its Developer's QS sees it."""

    code: str
    project_id: uuid.UUID
    developer: str
    api: Api


def seeded_projects(demo: Demo, nusrat: Api, tanvir: Api) -> list[Seeded]:
    """Every Project the seed made (`project:<code>`), with the QS of the Developer it is of: the one
    whose Step 1 answers 200 (the other Developer's is "not found")."""
    apis = {"shapla": nusrat, "meghna": tanvir}
    found = []
    for key, value in demo.items():
        if not key.startswith("project:"):
            continue
        project_id = uuid.UUID(str(value))
        for developer, api in apis.items():
            if api.get(f"/api/projects/{project_id}/takeoff/step1/questions").status_code == 200:
                found.append(Seeded(key.removeprefix("project:"), project_id, developer, api))
                break
    assert found, "the demo seed made no Project its QSs can open"
    return found


def disciplines(seeded: Seeded) -> list[dict[str, Any]]:
    """The Market's Disciplines in its order (`GET .../drawings/disciplines`: `{key, labels}`)."""
    response = seeded.api.get(f"/api/projects/{seeded.project_id}/drawings/disciplines")
    assert response.status_code == 200, response.content
    listed: list[dict[str, Any]] = response.json()
    return listed


def files(seeded: Seeded) -> dict[str, dict[str, Any]]:
    """The Drawing Set's files (4.5's table), by id."""
    response = seeded.api.get(f"/api/projects/{seeded.project_id}/drawings/files")
    assert response.status_code == 200, response.content
    return {row["id"]: row for row in response.json()["files"]}


def asked_which_discipline(demo: Demo, nusrat: Api, tanvir: Api) -> list[tuple[Seeded, dict[str, Any]]]:
    """Every open missing-Discipline Question on the seed, with its Project; at least one (#223)."""
    asked = [
        (seeded, q)
        for seeded in seeded_projects(demo, nusrat, tanvir)
        for q in open_questions(seeded.api, seeded.project_id, MISSING_DISCIPLINE)
    ]
    assert asked, "no seeded Project has an open missing-Discipline Question (#223)"
    return asked


def general_sheets(demo: Demo, nusrat: Api, tanvir: Api) -> list[tuple[Seeded, dict[str, Any]]]:
    """Every seeded sheet whose Discipline is General, with its Project; at least one (#223)."""
    found = [
        (seeded, p)
        for seeded in seeded_projects(demo, nusrat, tanvir)
        for p in proposals(seeded.api, seeded.project_id)
        if p["discipline"] == GENERAL
    ]
    assert found, "no seeded sheet's Discipline is General (#223)"
    return found


def the_sheet(seeded: Seeded, sheet_id: str) -> dict[str, Any]:
    """A sheet's Proposal in its Project's Step 1, by the sheet's id."""
    [sheet] = [p for p in proposals(seeded.api, seeded.project_id) if p["sheet_id"] == sheet_id]
    return sheet


def read_steps(demo: Demo, seeded: Seeded, file_id: str) -> set[str]:
    """The steps the read job kept for the file (21a's StepStore, as t182 reads them)."""
    with tenancy.acting_in(demo[f"developer:{seeded.developer}"]), connection.cursor() as cursor:
        cursor.execute("select step from drawings_readstep where file_id = %s", [file_id])
        return {step for (step,) in cursor.fetchall()}


def named(sheet: dict[str, Any]) -> dict[str, str]:
    """How a Question's words name a sheet (21c): its number, else its title, else neither."""
    if sheet["number"]:
        return {"sheet": sheet["number"], "named": "number"}
    if sheet["title"].strip():
        return {"sheet": sheet["title"], "named": "title"}
    return {"sheet": "", "named": "none"}


def line(q: dict[str, Any]) -> tuple[str, str, str]:
    """A Question as the Answered list words it: its kind, code and params (t182's twin)."""
    return (q["kind"], q["code"], json.dumps(q["params"], sort_keys=True))


def twins(seeded: Seeded) -> list[tuple[str, str, str]]:
    """The Questions of the Project asked twice: one kind, code and params on two Questions."""
    counted = Counter(line(q) for q in questions(seeded.api, seeded.project_id))
    return [k for k, n in counted.items() if n > 1]


def empty_views(seeded: Seeded, sheet: dict[str, Any]) -> list[tuple[str, str]]:
    """The sheet's views with nothing drawn inside their boxes on its render (t182's measure, #150)."""
    drawn = render(seeded.api, seeded.project_id, sheet["sheet_id"])
    return [
        (view["kind"], view["title"])
        for view in sheet["views"]
        if drawn_inside(drawn, view, others_of(sheet, view)) == 0
    ]
