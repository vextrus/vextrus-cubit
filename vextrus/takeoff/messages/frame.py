"""Steps 3, 4 and 6's codes (ticket S16-T2; session 16's contract): the acts' events and refusals.
Worded in `web/src/messages/takeoff/frame/en.po`.

Events (one per act, `event=True`; the payload holds ids and counts only):
- `confirmed`, `excluded`, `edited`, `unconfirmed`: the QS's act on `count` Proposals of a Step.
- `levels_typed`: storey levels typed by the QS (`count` storeys).
- `view_placed`: a view put on `count` storeys.

Refusals:
- `step_unknown`: a step key that is not Steps 3, 4 or 6 (400).
- `act_unknown`: an act that is not confirm, exclude, edit or unconfirm (400).
- `nothing_chosen`: an act naming no Proposal, nor a group holding one (400).
- `size_needed`: an edit without both sides of the section and a unit the API knows (400).
- `not_a_number`: a level or a side typed that is not a decimal number (400).
- `storey_unknown`: a storey id that is no storey of the Project (400).
- `no_building`: the Project has no Building to put the Model in (409).
"""

from engine.messages import MessageCode

CONFIRMED = MessageCode("takeoff.frame.confirmed", params=("actor", "count"), event=True)
EXCLUDED = MessageCode("takeoff.frame.excluded", params=("actor", "count"), event=True)
EDITED = MessageCode("takeoff.frame.edited", params=("actor", "count"), event=True)
UNCONFIRMED = MessageCode("takeoff.frame.unconfirmed", params=("actor", "count"), event=True)
LEVELS_TYPED = MessageCode("takeoff.frame.levels_typed", params=("actor", "count"), event=True)
VIEW_PLACED = MessageCode("takeoff.frame.view_placed", params=("actor", "count"), event=True)

STEP_UNKNOWN = MessageCode("takeoff.frame.step_unknown")
ACT_UNKNOWN = MessageCode("takeoff.frame.act_unknown")
NOTHING_CHOSEN = MessageCode("takeoff.frame.nothing_chosen")
SIZE_NEEDED = MessageCode("takeoff.frame.size_needed")
NOT_A_NUMBER = MessageCode("takeoff.frame.not_a_number")
STOREY_UNKNOWN = MessageCode("takeoff.frame.storey_unknown")
NO_BUILDING = MessageCode("takeoff.frame.no_building")
