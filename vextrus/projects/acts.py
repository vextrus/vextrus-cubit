"""`projects`' acts (ticket 08), each with the grant it needs (07's role-to-act rule decides who holds
it; `vextrus.platform.services.auth.ROLES`)."""

from vextrus.platform.services.auth import Act, Grant

OPEN = Act("projects.open", Grant.LOOK)
"""List the Projects, or open one: every role, a Guest and the MD included."""
CREATE = Act("projects.create", Grant.CHANGE)
"""Create a Project: the QS and the Vextrus Engineer only (m0-screens 4.3: never the MD or a Guest)."""
