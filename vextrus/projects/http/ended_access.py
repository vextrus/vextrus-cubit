"""The codes of the Projects an ended Membership gave, for the "Access ended" page (#75; m0-screens
§4.1: "Your access to KR-01 at Shapla Homes Ltd has ended…"). `/api/me`'s `ended` carries each
Membership's Projects as ids; this names them, since `platform` resolves no Project.

    GET /api/ended-access/projects  →  [{"membership_id": "…", "codes": ["KR-01"]}]
"""

import uuid

from django.http import HttpRequest
from ninja import Router, Schema

from vextrus.platform.http.acts import declare
from vextrus.platform.services import auth
from vextrus.projects import services

router = Router()


class EndedCodesOut(Schema):
    membership_id: uuid.UUID
    """One of `/api/me`'s `ended`."""
    codes: list[str]
    """Its Projects' codes, by code."""


@router.get("/ended-access/projects", response=list[EndedCodesOut])
@declare(auth.ACCOUNT)
def ended_access_projects(request: HttpRequest) -> list[EndedCodesOut]:
    """The codes of the Projects each ended Membership given chosen Projects gave. One given every
    Project has no entry; nor has one whose Projects have all been deleted since."""
    return [
        EndedCodesOut(membership_id=held.membership_id, codes=list(held.codes))
        for held in services.ended_access_codes()
    ]
