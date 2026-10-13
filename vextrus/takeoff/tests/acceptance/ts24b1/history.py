"""S24-B1's shared helpers: a sheet's "Who did what" through the API, on the demo seed's KR-01.

m0-screens 6.6 item 5: "Who did what: every act on the sheet, oldest first, each "what" over "name,
role, time" with the initials chip". The acts are the event log's (S22-FL10, `vextrus/takeoff/messages/
step1.py`): `takeoff.step1.confirmed`, `confirmed_back_in`, `excluded`, `corrected`, `answered`,
`undone`.

Names chosen by the acceptance writer where no authority gives one (the builder meets them):
- `GET /api/projects/{project_id}/takeoff/step1/proposals/{proposal_id}/history` answers
  `{"acts": [...]}`, the sheet's acts oldest first, each `{"code", "actor", "actor_role", "at", ...}`:
  `code` the event's code, `actor` the person's name, `actor_role` their role key ("qs",
  "vextrus_engineer", as `decided_by_role`), `at` an ISO time. An excluded act carries `reason` (one
  of the seven keys); a confirmed act `sheets` (how many it decided); a corrected act `changes`:
  `{"number"?: {"old", "new", "old_source"}, "title"?: {...}}`, `old_source` where the old value was
  read (as `number_source`, `title_source`). Any other entry (a leading "proposed", say) is the
  builder's and these tests read past it.
- every role that reads Step 1 reads it (the MD, a Guest); another Developer's person and an id of no
  Proposal of the Project get the one 404.
- the correction act is S22-FL8's (PR #706): `POST {step1}/correct` with `{"proposal", "number"?,
  "title"?}`; undo is `POST {step1}/undo` with `{}`.
"""

import uuid
from typing import Any

from vextrus.testing.auth import Api

from ..t19a.step1 import step1

CONFIRMED = "takeoff.step1.confirmed"
CONFIRMED_BACK_IN = "takeoff.step1.confirmed_back_in"
EXCLUDED = "takeoff.step1.excluded"
CORRECTED = "takeoff.step1.corrected"
ANSWERED = "takeoff.step1.answered"
UNDONE = "takeoff.step1.undone"
ACTS = frozenset({CONFIRMED, CONFIRMED_BACK_IN, EXCLUDED, CORRECTED, ANSWERED, UNDONE})

ARIF = "arif@vextrus.example"
"""Arif Rahman, the seed's Vextrus Engineer in Shapla Homes."""


def history_response(api: Api, project: uuid.UUID, proposal_id: str) -> Any:
    return api.get(f"{step1(project)}/proposals/{proposal_id}/history")


def history(api: Api, project: uuid.UUID, proposal_id: str) -> list[dict[str, Any]]:
    """The sheet's acts, oldest first (only the event log's act codes)."""
    response = history_response(api, project, proposal_id)
    kind = response.get("Content-Type", "")
    found = (response.status_code, kind.startswith("application/json"))
    assert found == (200, True), f"no history route: {response.status_code} {kind}"
    acts: list[dict[str, Any]] = response.json()["acts"]
    return [a for a in acts if a["code"] in ACTS]


def codes(acts: list[dict[str, Any]]) -> list[str]:
    return [a["code"] for a in acts]


def correct(api: Api, project: uuid.UUID, body: dict[str, Any]) -> Any:
    response = api.post(f"{step1(project)}/correct", body)
    kind = response.get("Content-Type", "")
    found = (response.status_code, kind.startswith("application/json"))
    assert found == (200, True), f"no correct route: {response.status_code} {kind}"
    return response


def act(api: Api, project: uuid.UUID, path: str, body: dict[str, Any]) -> None:
    response = api.post(f"{step1(project)}/{path}", body)
    assert response.status_code == 200, response.content
