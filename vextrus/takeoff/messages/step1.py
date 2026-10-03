"""Step 1's codes (ticket 19a): its refusals, and the two Questions the seed asks that no engine code
words (21c's read job raises its own). Worded in `web/src/messages/takeoff/step1/en.po`.

- `nothing_chosen`: an act naming no sheet (400).
- `discipline_unknown`: a drawing list for a Discipline the Market does not have (400).
- `kind_not_offered`: a kind the QS chose that is not one of the sheet's Discipline's kinds (13's
  conventions), nor Jev's options for it, nor the kind read (400).
- `question_first` (21c): sheets a Question holds, confirmed before it is answered (409; the
  Question open, or withdrawn by the sheet's exclusion that still stands): how many sheets
  (`count`), the first one (`sheet`, `named` as `takeoff.proposals` names a sheet), what its
  Question asks (`asks`: `number` or `discipline`; `held` when, in an act of more than one sheet, an
  open Question of another kind holds the sheet: a conflict, a low confidence, a held file's) and
  which Question it is (`question`: its id, one the Questions list returns; for the screen to open
  it, not worded).
- `one_source` (166): a confirm of more than one sheet naming sheets with one source (no open
  Question holds them, nor are they a held file's sheets; m0-screens 6.4: only agreeing sheets join
  the bulk act, the others are confirmed one by one), refused whole (409): how many (`count`),
  their ids (`sheets`, each as `takeoff.proposals` gives a Proposal's `id`), the first one
  (`sheet`, `named` as `question_first`).
- `held_file` (166): as `one_source`, for sheets of a held file the QS chose to read anyway (no
  open Question holds them; they never agree, m0-screens 6.4), with the same params.
- `nothing_to_undo`: undo with no act of the QS's own left to undo on Step 1 (409).
- `no_number`: a Question, a sheet with no number in its title block.
- `which_kind`: a Question, what kind of sheet `number` is (the Discipline's kinds, most likely first).
"""

from engine.messages import MessageCode

NOTHING_CHOSEN = MessageCode("takeoff.step1.nothing_chosen")
DISCIPLINE_UNKNOWN = MessageCode("takeoff.step1.discipline_unknown")
NOTHING_TO_UNDO = MessageCode("takeoff.step1.nothing_to_undo")
QUESTION_FIRST = MessageCode(
    "takeoff.step1.question_first", params=("count", "asks", "sheet", "named", "question")
)
ONE_SOURCE = MessageCode("takeoff.step1.one_source", params=("count", "sheets", "sheet", "named"))
HELD_FILE = MessageCode("takeoff.step1.held_file", params=("count", "sheets", "sheet", "named"))
KIND_NOT_OFFERED = MessageCode("takeoff.step1.kind_not_offered")

NO_NUMBER = MessageCode("takeoff.step1.no_number")
WHICH_KIND = MessageCode("takeoff.step1.which_kind", params=("number",))
