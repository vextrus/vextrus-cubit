"""The Priced BOQ in the API (S16-B; M1.md C13), read on demand, never stored.

- `GET /api/projects/{project_id}/boq`: the strip, the BOQ Items by section and group, the allowance
  per open Takeoff Step and the measured share;
- `GET /api/projects/{project_id}/boq/items/{item_code}/lines`: one Item's Measurement Lines with their
  trace.
The guard answers first (signed out 401; a Project outside the Membership's scope 404). Every role
reads the BOQ.
"""

import uuid

from django.http import HttpRequest
from ninja import Router

from vextrus.boq.schemas.boq import BoqLinesOut
from vextrus.boq.schemas.priced import PricedBoqOut, lines_out
from vextrus.boq.services import priced
from vextrus.platform.http.acts import declare
from vextrus.platform.services.auth import Act, Grant

router = Router()

LOOK = Act("boq.look", Grant.LOOK)
"""Read the Priced BOQ and an Item's Measurement Lines: every role."""


@router.get("/projects/{project_id}/boq", response=PricedBoqOut)
@declare(LOOK, project="project_id")
def get_boq(request: HttpRequest, project_id: uuid.UUID) -> PricedBoqOut:
    return PricedBoqOut.from_view(priced.read(project_id))


@router.get("/projects/{project_id}/boq/items/{item_code}/lines", response=BoqLinesOut)
@declare(LOOK, project="project_id")
def get_item_lines(request: HttpRequest, project_id: uuid.UUID, item_code: str) -> BoqLinesOut:
    return lines_out(priced.item_lines(project_id, item_code))
