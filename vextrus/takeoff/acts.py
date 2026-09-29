"""`takeoff`'s acts (ticket 19a), each with the grant it needs (07's role-to-act rule decides who holds
it; `vextrus.platform.services.auth.ROLES`): every role looks at Step 1 (the MD and a Guest read its
Proposals, Questions, Coverage and progress), and only the QS and the Vextrus Engineer act on it
(m0-screens 6.x: "The MD reads Questions and cannot answer them")."""

from vextrus.platform.services.auth import Act, Grant

LOOK = Act("takeoff.look", Grant.LOOK)
"""Read Step 1: its Proposals, Questions, Coverage, progress and drawing lists."""
CONFIRM = Act("takeoff.confirm", Grant.CHANGE)
"""Confirm Proposals, one or in bulk, with a sheet's kind."""
EXCLUDE = Act("takeoff.exclude", Grant.CHANGE)
"""Leave a sheet out, for one of the seven reasons."""
UNDO = Act("takeoff.undo", Grant.CHANGE)
"""Undo one's own last act on Step 1."""
DRAWING_LIST = Act("takeoff.drawing_list", Grant.CHANGE)
"""Read a pasted list or a typed range back, and set it as a Discipline's drawing list."""
