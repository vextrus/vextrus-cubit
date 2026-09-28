"""Projects' codes (ticket 08): the act of creating one, and why a create is refused.

Worded in `web/src/messages/projects/projects/en.po`. No word here names a Building: M0 never shows
one (docs/design/m0-screens.md §1.10).
"""

from engine.messages import MessageCode

CREATED = MessageCode("projects.projects.created", params=("actor",), event=True)
"""A Project was created (with its Site and Building, unseen). `actor`: the acting user's name,
filled in when the act is shown; the event stores only ids."""

NAME_MISSING = MessageCode("projects.projects.name_missing")
CODE_MISSING = MessageCode("projects.projects.code_missing")
CODE_TAKEN = MessageCode("projects.projects.code_taken", params=("code", "name"))
"""`code`: the code asked for; `name`: the name of the Project that already has it."""
TOO_LONG = MessageCode("projects.projects.too_long", params=("limit",))
"""`limit`: the most characters the field holds."""
UNIT_SYSTEM_NOT_OFFERED = MessageCode("projects.projects.unit_system_not_offered")
SCOPED_MEMBER_CANNOT_CREATE = MessageCode("projects.projects.scoped_member_cannot_create")
"""A member given chosen Projects cannot create one: they could not open it."""
NOT_FOUND = MessageCode("projects.projects.not_found")
"""No such Project, another Developer's, or one outside the member's Projects: never told apart."""
