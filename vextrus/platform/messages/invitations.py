"""Invitations' and Memberships' codes (ticket 07): the acts on who may open a Developer's data,
recorded as DomainEvents the MD sees, and why such an act was refused.

Worded in `web/src/messages/platform/invitations/en.po`. An event's `actor` is the acting user's
name and its `subject` the person the act was about (their name, or the invited email), both filled
in when the act is shown (`services.activity`); the event itself stores only ids.
"""

from engine.messages import MessageCode

# The acts (DomainEvents) --------------------------------------------------------------------------

INVITED = MessageCode("platform.invitations.invited", params=("actor", "subject"), event=True)
LINK_REISSUED = MessageCode(
    "platform.invitations.link_reissued", params=("actor", "subject"), event=True
)
WITHDRAWN = MessageCode("platform.invitations.withdrawn", params=("actor", "subject"), event=True)
ACCEPTED = MessageCode("platform.invitations.accepted", params=("actor", "subject"), event=True)
REVOKED = MessageCode("platform.invitations.revoked", params=("actor", "subject"), event=True)
RENEWED = MessageCode("platform.invitations.renewed", params=("actor", "subject"), event=True)
PROJECTS_SET = MessageCode("platform.invitations.projects_set", params=("actor", "subject"), event=True)

# Refusals ----------------------------------------------------------------------------------------

ROLE_NOT_YOURS = MessageCode("platform.invitations.role_not_yours", params=("role",))
"""The inviter may not give this role (a QS invites only a Vextrus Engineer)."""
PROJECTS_NOT_YOURS = MessageCode("platform.invitations.projects_not_yours")
"""The inviter chose all Projects, or a Project, beyond those they may open."""
CHOOSE_A_PROJECT = MessageCode("platform.invitations.choose_a_project")
END_IN_PAST = MessageCode("platform.invitations.end_in_past")
INVALID_EMAIL = MessageCode("platform.invitations.invalid_email")
ALREADY_MEMBER = MessageCode("platform.invitations.already_member", params=("email",))
ALREADY_INVITED = MessageCode("platform.invitations.already_invited", params=("email",))
ACCESS_ENDED = MessageCode("platform.invitations.access_ended", params=("email",))
"""The person's access ended without being revoked: renew it instead of inviting again."""
NOT_YOURSELF = MessageCode("platform.invitations.not_yourself")
NOT_YOURS_TO_CHANGE = MessageCode("platform.invitations.not_yours_to_change")
"""A QS may renew, revoke or withdraw only a Vextrus Engineer's access they invited."""
ALREADY_ENDED = MessageCode("platform.invitations.already_ended")
NO_END_DATE = MessageCode("platform.invitations.no_end_date")
"""Only access with an end date is renewed."""
UNUSABLE = MessageCode("platform.invitations.unusable")
"""The link was used, withdrawn or expired, or never existed; never says which."""
WRONG_ACCOUNT = MessageCode("platform.invitations.wrong_account", params=("email",))
"""Signed in as someone other than the invited email."""
ENGINEER_NOT_STAFF = MessageCode("platform.invitations.engineer_not_staff")
"""A Vextrus Engineer's invitation is accepted only with an account of Vextrus's staff (the owner's
ruling, 28 Sep 2026)."""
SIGN_IN_FIRST = MessageCode("platform.invitations.sign_in_first", params=("email",))
"""The invited email has an account: sign in with it to accept."""
NAME_REQUIRED = MessageCode("platform.invitations.name_required")
