"""`rates`' acts (docs/plans/M1.md C12; declared by M1-00's stubs, built by M1-14), each with the grant
it needs (07's role-to-act rule decides who holds it; `vextrus.platform.services.auth.ROLES`): every
role reads Market Prices and Rate Analyses; the QS and the Vextrus Engineer edit them (story 116)."""

from vextrus.platform.services.auth import Act, Grant

LOOK = Act("rates.look", Grant.LOOK)
"""Read the Project's Market Prices and a BOQ Item's Rate Analysis."""
EDIT = Act("rates.edit", Grant.CHANGE)
"""Enter or change a Market Price."""
