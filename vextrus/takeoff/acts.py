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
ASSIGN = Act("takeoff.assign", Grant.CHANGE)
"""Put views in Takeoff Steps (#158: a view no step accounts for; the API's only, in M0)."""
CORRECT = Act("takeoff.correct", Grant.CHANGE)
"""Correct a sheet's number or title (m0-screens 6.9's `E`): it stays a Proposal."""
UNDO = Act("takeoff.undo", Grant.CHANGE)
"""Undo one's own last act on Step 1."""
DRAWING_LIST = Act("takeoff.drawing_list", Grant.CHANGE)
"""Read a pasted list or a typed range back, and set it as a Discipline's drawing list."""

# M1's acts (docs/plans/M1.md C9, C17, C19; declared by M1-00's stubs, built by M1-11a, M1-11b, M1-11c,
# M1-25 and M1-32a). Every role looks at the steps, the model and the storeys (LOOK above); only the QS
# and the Vextrus Engineer act on them.
READ = Act("takeoff.read", Grant.CHANGE)
"""Start a step's read (C5's chain run)."""
ANSWER = Act("takeoff.answer", Grant.CHANGE)
"""Answer a step's Question, by an option or a typed value."""
CLOSE = Act("takeoff.close", Grant.CHANGE)
"""Close a step, with or without Questions open, or reopen it."""
ACTIVE = Act("takeoff.active", Grant.CHANGE)
"""Report the QS's active time on a step."""
PROFILE = Act("takeoff.profile", Grant.CHANGE)
"""Confirm a Drafting Profile's conventions."""
STOREYS = Act("takeoff.storeys", Grant.CHANGE)
"""Type a storey's level, or correct the storeys a view shows."""
