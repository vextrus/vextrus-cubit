"""S18-Q1's fixtures (the rebuild of S15-Q1 on the re-read rule): a structural set read file by file,
the QS moving a file's Discipline away and back, and the kind Question's card read as the web reads it.

The authority: the M1 plan's re-read rule for Questions (docs/plans/M1.md, C9, "What a second read
does": "Questions are kept by `question_key` ... One raised again keeps its id and its answer; an open
one not raised again is withdrawn"), which the session 18 ruling applies to the grouped kind Question:
its membership and its words are recomputed on read, never stored, so a sheet's file moving between
Disciplines, and back, cannot leave them stale. Review round 3 of PR #566 found seven holes with that
one root; each test of this ticket's `test_moved_*.py` pins one at Step 1's API.

Everything is invented (kinds_set's beam sheets and stand-in Jev); nothing leaves the machine.
"""

import re
import uuid
from collections.abc import Mapping, Sequence
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    english,
    proposals,
    questions,
    readers,
    run_job,
    step1,
    uploaded,
)
from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import WHICH_KIND
from vextrus.testing.drawings import QsProject

GROUP_CHANGED = "takeoff.proposals.group_changed"
AWAY = "architectural"
HOME = "structural"


def read_file(
    qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: Sequence[Sheet]
) -> uuid.UUID:
    """Upload the file, run its read job (21a's, as kinds_set's `read`), and answer its id."""
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def move(api: Any, project_id: uuid.UUID, file_id: uuid.UUID, discipline: str) -> None:
    """The QS sets the file's Discipline (the drawings files API, as the web sends it)."""
    moved = api.send(
        "put",
        f"/api/projects/{project_id}/drawings/files/{file_id}/discipline",
        {"discipline": discipline},
    )
    assert moved.status_code == 200, moved.content


def structural_kind_questions(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    """The open Questions asking structural sheets' kinds (a kind asked in another Discipline aside)."""
    return [
        q
        for q in questions(api, project_id)
        if q["status"] == "open" and q["code"] == WHICH_KIND and q["discipline"] == HOME
    ]


def the_structural_kind_question(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    """The one open structural kind Question; the message names how many there are when not one."""
    asked = structural_kind_questions(api, project_id)
    held = [len(q["proposals"]) for q in asked]
    assert len(asked) == 1, f"not one structural kind Question: {len(asked)}, holding {held}"
    return asked[0]


def holding(api: Any, project_id: uuid.UUID, proposal_id: str) -> list[dict[str, Any]]:
    """The open structural kind Questions that hold the Proposal."""
    return [q for q in structural_kind_questions(api, project_id) if proposal_id in q["proposals"]]


def answer_seen(
    api: Any, project_id: uuid.UUID, question_id: str, option: str, held: Sequence[str]
) -> Any:
    """The answer as the web sends it (`web/src/takeoff/data.ts`): with the sheets the card listed."""
    return api.post(
        f"{step1(project_id)}/questions/{question_id}/answer", {"option": option, "held": list(held)}
    )


def by_number(api: Any, project_id: uuid.UUID) -> dict[str, dict[str, Any]]:
    """Each listed sheet's Proposal, by its number (the sets here number every sheet once)."""
    return {p["number"]: p for p in proposals(api, project_id)}


# The words as the web shows them: the code's English, its ICU arguments filled ---------------------


def words(code: str, params: Mapping[str, Any]) -> str:
    """The English the web shows for the code with these params (`web/src/messages/**/en.po`): plain,
    `select`, `plural` and `selectordinal` arguments (English plural rules) and `#` filled."""
    text = english(code)
    assert text is not None, f"no English for {code}"
    filled, end = _fill(text, 0, params, None)
    assert end == len(text), f"unbalanced braces in {code}'s English"
    return filled


_ARGUMENT = re.compile(r"\s*(\w+)\s*(?:,\s*(\w+)\s*)?(,|\})")
_KEY = re.compile(r"\s*(=\d+|\w+)\s*\{")


def _fill(text: str, i: int, params: Mapping[str, Any], number: Any) -> tuple[str, int]:
    """The text from `i` to its closing brace (or the end), filled; and where it stopped."""
    out: list[str] = []
    while i < len(text):
        c = text[i]
        if c == "}":
            return "".join(out), i
        if c == "#" and number is not None:
            out.append(str(number))
            i += 1
        elif c == "{":
            filled, i = _argument(text, i + 1, params, number)
            out.append(filled)
        else:
            out.append(c)
            i += 1
    return "".join(out), i


def _argument(text: str, i: int, params: Mapping[str, Any], number: Any) -> tuple[str, int]:
    found = _ARGUMENT.match(text, i)
    assert found is not None, f"an argument not read at {text[i : i + 30]!r}"
    name, kind, after = found.groups()
    value = params.get(name)
    if after == "}":
        return ("" if value is None else str(value)), found.end()
    i = found.end()
    if kind not in ("select", "plural", "selectordinal"):  # number, date: the value as it is
        close = text.index("}", i)
        return str(value), close + 1
    branches: dict[str, str] = {}
    while True:
        key = _KEY.match(text, i)
        if key is None:
            close = text.index("}", i)
            break
        inner, end = _fill(text, key.end(), params, value if kind != "select" else number)
        branches[key.group(1)] = inner
        i = end + 1
    if kind == "select":
        chosen = branches.get(str(value), branches.get("other", ""))
    else:
        assert value is not None, f"no {name} for its {kind}"
        n = int(value)
        category = _ordinal(n) if kind == "selectordinal" else ("one" if n == 1 else "other")
        chosen = branches.get(f"={n}", branches.get(category, branches.get("other", "")))
    return chosen, close + 1


def _ordinal(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return "one"
    if n % 10 == 2 and n % 100 != 12:
        return "two"
    if n % 10 == 3 and n % 100 != 13:
        return "few"
    return "other"
