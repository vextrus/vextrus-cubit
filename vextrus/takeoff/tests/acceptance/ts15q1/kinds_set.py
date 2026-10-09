"""Ticket S15-Q1's fixtures (its tests import them by name): invented structural sets whose sheets'
kinds Jev is unsure of, read by 21a's read job through 21c's helpers, and a stand-in Jev.

The authority: the session 15 ticket S15-Q1, "Sheet kinds carry words and code narrows them; a
Question groups the Sheets it asks about, one answer confirms them all and one undo reverts it", and
its finish check, "Questions per Discipline <= 3" (the owner's Q5 limit, which G1 judges on the real
sets). Everything here is invented: titles that name a subject (beam, column) and no kind's whole
words, so code can narrow the kinds and Jev still has two to choose between.

Jev is a stand-in transport (nothing leaves the machine). It answers by the subject word in the
sheet's title: the two kinds given, close (0.40 and 0.35, a lead of 0.05, under #228's 0.15), when
it is offered them; the rest of what it is offered shares what is left. It records every list of
kinds it was offered, by title.
"""

import json
from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any

import httpx
import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    proposals,
    questions,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

WHICH_KIND = "takeoff.proposals.which_kind"
STRUCTURAL = "KR-STR-R0.dwg"
STRUCTURAL_TOO = "KR-STR-R1.dwg"

CLOSE: Mapping[str, tuple[str, str]] = {
    "BEAM": ("beam_layout", "beam_details"),
    "COLUMN": ("column_layout", "column_schedule"),
}
"""By the subject word in a title: Jev's first and second kinds, close (0.40, 0.35)."""
TOP, SECOND = Decimal("0.40"), Decimal("0.35")


def beams(numbers: Sequence[int]) -> list[Sheet]:
    """Beam sheets S-<n>, each titled by its own letter (no two titles alike: no continuation)."""
    return [Sheet(f"S-{n:02d}", f"BEAM DRAWING {chr(64 + n)}", (f"BEAM B{n}",)) for n in numbers]


def columns(numbers: Sequence[int]) -> list[Sheet]:
    return [Sheet(f"S-{n:02d}", f"COLUMN DRAWING {chr(64 + n)}", (f"COLUMN C{n}",)) for n in numbers]


def jev_unsure(offline: Offline) -> dict[str, list[list[str]]]:
    """Jev answers every sheet as `CLOSE` says; what it was offered, per title, each time asked."""
    offered: dict[str, list[list[str]]] = {}

    def answer_it(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        title = body["state"]["title"]
        top, second = next((pair for word, pair in CLOSE.items() if word in title), ("", ""))
        answers = {}
        for node, asked in body["questions"].items():
            options = list(asked["criteria"])
            offered.setdefault(title, []).append(options)
            ranked = [k for k in (top, second) if k in options]
            ranked += [o for o in options if o not in ranked]
            given = [TOP, SECOND][: len(ranked)]
            rest = (Decimal(1) - sum(given, Decimal(0))) / max(len(ranked) - len(given), 1)
            probabilities = {o: float(rest) for o in ranked[len(given) :]}
            probabilities |= {o: float(p) for o, p in zip(ranked, given, strict=False)}
            answers[node] = {
                "type": "choice",
                "choice": ranked[0],
                "confidence": float(probabilities[ranked[0]]),
                "probabilities": probabilities,
            }
        return httpx.Response(200, json={"model": body["model"], "answers": answers})

    offline.use(httpx.MockTransport(answer_it))
    return offered


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: Sequence[Sheet]) -> None:
    """Upload the file and run its read job, as 21b's and 21c's tests do."""
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))


def open_in(api: Any, project_id: Any, discipline: str) -> list[dict[str, Any]]:
    """Every open Question of the Discipline, whatever its kind."""
    return [
        q for q in questions(api, project_id) if q["status"] == "open" and q["discipline"] == discipline
    ]


def kind_questions(api: Any, project_id: Any) -> list[dict[str, Any]]:
    """The open Questions asking sheets' kinds."""
    return [q for q in questions(api, project_id) if q["status"] == "open" and q["code"] == WHICH_KIND]


def the_one_kind_question(api: Any, project_id: Any) -> dict[str, Any]:
    """The one open kind Question; the message names how many there are when not one."""
    asked = kind_questions(api, project_id)
    held = [len(q["proposals"]) for q in asked]
    assert len(asked) == 1, f"not one kind Question for the group: {len(asked)}, holding {held}"
    return asked[0]


def ids_of(api: Any, project_id: Any) -> dict[str, str]:
    """Each listed sheet's Proposal id, by its number."""
    return {p["number"]: p["id"] for p in proposals(api, project_id)}
