"""The read job's Questions and the answer's refusals (ticket 21c). Worded in
`web/src/messages/takeoff/proposals/en.po`.

A sheet is named by `sheet` with `named`: `number` (its number), `title` (it has none: its title,
quoted) or `none` (neither: "this sheet").

- `which_discipline`: a Question, which Discipline the sheet belongs to (it has none: #102).
- `which_kind`: a Question, what kind of sheet it is (Jev is unsure; the kinds most likely first).
- `lists_disagree`: a Question, the drawing list read on the sheet and the one the QS gave (`source`:
  `pasted` or `typed`) differ.
- `boundary_storey`: a Question, whether the range `range` on the sheet (its storeys as the drawing
  states them) includes its top storey, where a range of the same kind on `next_sheet` (with
  `next_named`) starts; the storey by `level` (`floor` and `basement` with their `number`, `ground`,
  `lower_ground`, `mezzanine`, `podium`, `roof`, else `other`), `storey` its key (never worded).
- `option_not_offered`: an answer naming an option the Question does not offer (400).
- `answered_already`: an answer to a Question already answered or withdrawn (409).
- `number_needed`: "Type a number" answered with no number (400).
"""

from engine.messages import MessageCode

WHICH_DISCIPLINE = MessageCode("takeoff.proposals.which_discipline", params=("sheet", "named"))
WHICH_KIND = MessageCode("takeoff.proposals.which_kind", params=("sheet", "named"))
LISTS_DISAGREE = MessageCode("takeoff.proposals.lists_disagree", params=("sheet", "named", "source"))
BOUNDARY_STOREY = MessageCode(
    "takeoff.proposals.boundary_storey",
    params=("sheet", "named", "range", "next_sheet", "next_named", "level", "number", "storey"),
)
OPTION_NOT_OFFERED = MessageCode("takeoff.proposals.option_not_offered")
ANSWERED_ALREADY = MessageCode("takeoff.proposals.answered_already")
NUMBER_NEEDED = MessageCode("takeoff.proposals.number_needed")
