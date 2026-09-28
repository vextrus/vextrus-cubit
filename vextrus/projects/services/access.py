"""The Projects of access that has ended and of an invitation link, by code (#75; m0-screens §4.1 and
§4.2).

"Your access to KR-01 at Shapla Homes Ltd has ended" and "…invited you as a Guest to KR-01 Kadam
Residence" name Projects of a Developer the reader no longer acts in, or not yet: `platform` gives
their ids (`/api/me`'s `ended`, the link's `project_ids`), and `projects` names them through its two
named database functions (migration 0002), which read `platform` only through its own
(`ended_access`, `invitation_by_token`) and never show a Project the Membership did not give.

    services.ended_access_codes()         # [EndedCodes(membership_id, ("KR-01",))]
    services.invitation_projects(token)   # [ProjectName("KR-01", "Kadam Residence")]

Codes come in the Projects list's order (by code, whatever its case).
"""

import uuid
from dataclasses import dataclass

from django.db import connection
from django.views.decorators.debug import sensitive_variables

from vextrus.platform.messages import invitations as invitation_codes
from vextrus.platform.services import auth, tenancy
from vextrus.projects.services.projects import code_key


@dataclass(frozen=True)
class EndedCodes:
    """The codes of the Projects one ended Membership gave."""

    membership_id: uuid.UUID
    codes: tuple[str, ...]


@dataclass(frozen=True)
class ProjectName:
    code: str
    name: str


def ended_access_codes() -> list[EndedCodes]:
    """The codes of the Projects each of the signed-in user's ended Memberships gave (those in
    `tenancy.ended_access()`), for each given chosen Projects. A Membership given every Project has
    no entry, nor has one whose Projects have all been deleted since."""
    with connection.cursor() as cursor:
        cursor.execute("select membership_id, code from public.ended_access_projects()")
        rows = cursor.fetchall()
    found: dict[uuid.UUID, list[str]] = {}
    for membership_id, code in rows:
        found.setdefault(membership_id, []).append(code)
    return [EndedCodes(held, tuple(sorted(codes, key=_by_code))) for held, codes in found.items()]


@sensitive_variables("token")
def invitation_projects(token: str) -> list[ProjectName]:
    """The Projects an invitation link gives, by code and name; none for a link to every Project.

    A link that cannot be used (used, withdrawn, expired, or never issued) is refused as the link's
    look-up refuses it, word for word, so a guessed token learns nothing here either.
    """
    parts = tenancy.invitation_token_parts(token)
    if parts is None or tenancy.invitation_by_token(token) is None:
        raise auth.Refused(invitation_codes.UNUSABLE(), status=404)
    tenant_id, token_hash = parts
    with connection.cursor() as cursor:
        cursor.execute(
            "select code, name from public.invitation_projects(%s, %s)", [tenant_id, token_hash]
        )
        rows = cursor.fetchall()
    return sorted((ProjectName(code, name) for code, name in rows), key=lambda p: _by_code(p.code))


def _by_code(code: str) -> tuple[str, str]:
    return code_key(code), code
