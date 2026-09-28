"""Tenancy's acts, recorded as DomainEvents that the Developer's MD sees (ticket 02).

Worded in `web/src/messages/platform/tenancy/en.po`. `actor` is the acting user's name, filled in
when the act is shown; the event itself stores only ids.
"""

from engine.messages import MessageCode

DEVELOPER_CREATED = MessageCode("platform.tenancy.developer_created", params=("actor",), event=True)
STAFF_OPENED = MessageCode("platform.tenancy.staff_opened", params=("actor",), event=True)
FIRST_MD_INVITED = MessageCode("platform.tenancy.first_md_invited", params=("actor",), event=True)
FIRST_MD_REISSUED = MessageCode("platform.tenancy.first_md_reissued", params=("actor",), event=True)
