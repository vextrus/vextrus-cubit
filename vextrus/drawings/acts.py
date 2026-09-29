"""`drawings`' acts (ticket 14), each with the grant it needs (07's role-to-act rule decides who holds
it; `vextrus.platform.services.auth.ROLES`): every role looks, and only the QS and the Vextrus
Engineer change a Drawing Set (m0-screens 4.5, "MD or Guest": no drop strip, no Cancel or Read again,
no Discipline select)."""

from vextrus.platform.services.auth import Act, Grant

LOOK = Act("drawings.look", Grant.LOOK)
"""List a Drawing Set's files and read their status and reports, a sheet's render and Plot."""
UPLOAD = Act("drawings.upload", Grant.CHANGE)
"""Add a file (21a's upload operation declares it)."""
CANCEL = Act("drawings.cancel", Grant.CHANGE)
RESTART = Act("drawings.restart", Grant.CHANGE)
SET_DISCIPLINE = Act("drawings.set_discipline", Grant.CHANGE)
