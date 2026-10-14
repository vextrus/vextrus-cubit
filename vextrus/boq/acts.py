"""`boq`'s acts (docs/plans/M1.md C13; declared by M1-00's stubs, built by M1-15a and M1-15b), each with
the grant it needs (07's role-to-act rule decides who holds it; `vextrus.platform.services.auth.ROLES`):
every role reads the Priced BOQ, its lines and its previews."""

from vextrus.platform.services.auth import Act, Grant

LOOK = Act("boq.look", Grant.LOOK)
"""Read the Priced BOQ, a BOQ Item's Measurement Lines and a preview."""
