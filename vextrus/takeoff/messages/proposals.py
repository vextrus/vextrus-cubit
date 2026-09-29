"""The read job's Questions and the answer's refusals (ticket 21c). Worded in
`web/src/messages/takeoff/proposals/en.po`.

- `which_discipline`: a Question, which Discipline the sheet `sheet` belongs to (it has none: #102).
- `lists_disagree`: a Question, the drawing list read on `sheet` and the one the QS gave (`source`:
  `pasted` or `typed`) differ.
- `boundary_storey`: a Question, whether the range `range` on `sheet` (its storeys as the drawing
  states them) includes its top storey, where a range of the same kind on `next_sheet` starts.
- `option_not_offered`: an answer naming an option the Question does not offer (400).
- `answered_already`: an answer to a Question already answered or withdrawn (409).
- `number_needed`: "Type a number" answered with no number (400).
"""

from engine.messages import MessageCode

WHICH_DISCIPLINE = MessageCode("takeoff.proposals.which_discipline", params=("sheet",))
LISTS_DISAGREE = MessageCode("takeoff.proposals.lists_disagree", params=("sheet", "source"))
BOUNDARY_STOREY = MessageCode(
    "takeoff.proposals.boundary_storey", params=("sheet", "range", "next_sheet")
)
OPTION_NOT_OFFERED = MessageCode("takeoff.proposals.option_not_offered")
ANSWERED_ALREADY = MessageCode("takeoff.proposals.answered_already")
NUMBER_NEEDED = MessageCode("takeoff.proposals.number_needed")
