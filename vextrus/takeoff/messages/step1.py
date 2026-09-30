"""Step 1's codes (ticket 19a): its refusals, and the two Questions the seed asks that no engine code
words (21c's read job raises its own). Worded in `web/src/messages/takeoff/step1/en.po`.

- `nothing_chosen`: an act naming no sheet (400).
- `discipline_unknown`: a drawing list for a Discipline the Market does not have (400).
- `kind_not_offered`: a kind the QS chose that is not one of the sheet's Discipline's kinds (13's
  conventions), nor Jev's options for it, nor the kind read (400).
- `question_first` (21c): a sheet whose number or Discipline an open Question asks, confirmed before
  the Question is answered (409).
- `nothing_to_undo`: undo with no act of the QS's own left to undo on Step 1 (409).
- `no_number`: a Question, a sheet with no number in its title block.
- `which_kind`: a Question, what kind of sheet `number` is (the Discipline's kinds, most likely first).
"""

from engine.messages import MessageCode

NOTHING_CHOSEN = MessageCode("takeoff.step1.nothing_chosen")
DISCIPLINE_UNKNOWN = MessageCode("takeoff.step1.discipline_unknown")
NOTHING_TO_UNDO = MessageCode("takeoff.step1.nothing_to_undo")
QUESTION_FIRST = MessageCode("takeoff.step1.question_first")
KIND_NOT_OFFERED = MessageCode("takeoff.step1.kind_not_offered")

NO_NUMBER = MessageCode("takeoff.step1.no_number")
WHICH_KIND = MessageCode("takeoff.step1.which_kind", params=("number",))
