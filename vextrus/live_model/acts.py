"""`live_model`'s acts (session 16's S16-L), each with the grant it needs (07's role-to-act rule decides
who holds it; `vextrus.platform.services.auth.ROLES`): every role looks at the Live Model."""

from vextrus.platform.services.auth import Act, Grant

LOOK = Act("live_model.look", Grant.LOOK)
"""Read the Live Model: an Element in the inspector."""
