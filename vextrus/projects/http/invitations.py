"""The Projects an invitation link gives, by code and name, before joining (#75; m0-screens §4.2:
"Kamal Uddin invited you as a Guest to KR-01 Kadam Residence…"). The link's look-up
(`POST /api/invitations/look-up`, platform's) carries them as ids; this names them.

    POST /api/invitations/look-up/projects {"token": "…"}
      →  [{"code": "KR-01", "name": "Kadam Residence"}]

Public and held to the CSRF token, like the look-up; a link that cannot be used is refused as the
look-up refuses it, byte for byte.
"""

from django.http import HttpRequest
from ninja import Router, Schema

from vextrus.platform.http.acts import Refusal, public
from vextrus.platform.http.auth import TokenIn
from vextrus.projects import services

router = Router()


class InvitationProjectOut(Schema):
    code: str
    name: str


@router.post(
    "/invitations/look-up/projects",
    auth=None,
    response={200: list[InvitationProjectOut], 404: Refusal},
)
@public
def invitation_projects(request: HttpRequest, payload: TokenIn) -> list[InvitationProjectOut]:
    """The Projects the link gives, by code; none for a link to every Project."""
    return [
        InvitationProjectOut(code=project.code, name=project.name)
        for project in services.invitation_projects(payload.token)
    ]
