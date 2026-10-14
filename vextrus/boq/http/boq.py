"""The Priced BOQ in the API (docs/plans/M1.md C13; under `/api/projects/{project_id}/`).

Stubs of the contract freeze (M1-00): each route has its contract's reply, sits behind 07's guard,
and then answers 501 `platform.stubs.not_built`. M1-15a and M1-15b replace them whole.
"""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Query, Router

from vextrus.boq import acts
from vextrus.boq.schemas.boq import BoqLineOut, BoqOut, BoqPreviewLineOut
from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.http.stubs import not_built

router = Router()

_PREFIX = "/projects/{project_id}/boq"


@router.get(_PREFIX, response={200: BoqOut, 501: Refusal})
@declare(acts.LOOK, project="project_id")
def get_boq(request: HttpRequest, project_id: uuid.UUID) -> HttpResponse:
    """The Priced BOQ; its first read pins the Rule Set (C11)."""
    return not_built()


@router.get(f"{_PREFIX}/items/{{item_code}}/lines", response={200: list[BoqLineOut], 501: Refusal})
@declare(acts.LOOK, project="project_id")
def list_lines(request: HttpRequest, project_id: uuid.UUID, item_code: str) -> HttpResponse:
    """A BOQ Item's Measurement Lines in its Billing Unit."""
    return not_built()


@router.get(f"{_PREFIX}/preview", response={200: list[BoqPreviewLineOut], 501: Refusal})
@declare(acts.LOOK, project="project_id")
def preview(
    request: HttpRequest, project_id: uuid.UUID, proposal_ids: Query[list[uuid.UUID]]
) -> HttpResponse:
    """The Measurement Lines the Proposals named would make (M1-15b)."""
    return not_built()
