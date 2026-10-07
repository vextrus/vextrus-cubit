"""`rates`' acts (ticket S16-RT), each with the grant it needs (07's role-to-act rule decides who
holds it; `vextrus.platform.services.auth.ROLES`): every role reads the prices and the Rate Analyses,
and only the QS and the Vextrus Engineer edit a price (C12: "Who edits")."""

from vextrus.platform.services.auth import Act, Grant

LOOK = Act("rates.look", Grant.LOOK)
"""Read the Market Prices and the Rate Analyses."""
EDIT_PRICE = Act("rates.edit_price", Grant.CHANGE)
"""Set a Market Price: the event names who."""
