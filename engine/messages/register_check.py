"""The drawing-list Check's codes (ticket 19b): `engine.check.register`, and its `parse` refusals.

Worded in web/src/messages/engine/register_check/en.po (13's `engine/messages/register.py` holds the
codes of reading a list on a sheet). A number is as the list or the sheet prints it; a count is an
integer; a line counts from 1.

The Check's findings (m0-screens §5 and 6.7; `not_found` raises a Question, 21c's, the others are
states):
- `not_found`: a number on the drawing list that no sheet of the set carries (its Discipline's).
- `not_listed`: a sheet whose number the drawing list does not name.
- `gap`: with no drawing list, the numbering skips: no sheet between `after` and `before`, the two
  numbers either side of the gap as their sheets print them, and `missing` numbers in between;
  `discipline` is the Discipline's key, which 19a words through the Library's name. A state (the
  sheets have one source) in the Check's run; Step 1 asks a Discipline's gaps as one `gaps` Question.
- `gaps` (#229): every `gap` of one Discipline, asked as one Question by Step 1 (the owner's ruling,
  "all of one Discipline's gaps are asked as one Question"): `discipline` is its key, `gaps` a list of
  `{after, before, missing}`, one per gap in the Check's order. Its answers are `gap`'s, for every gap;
  while it is open it holds only the sheets either side of each gap.
- `not_listed` is a state too, "Proposal, one source", unless 21c writes options for it.

`parse`'s refusals, for the drawing-list dialog (m0-screens 6.10; 19a's): the text is too long
(`limit` characters), it holds too many entries (`limit`), no line reads as a sheet line, or a range
line (`line`) runs backwards, mixes two kinds of number, holds more than `limit` numbers, or is joined
by a hyphen, which cannot tell a range from one sheet's number.
"""

from engine.messages import MessageCode

NOT_FOUND = MessageCode("engine.register_check.not_found", params=("number",))
NOT_LISTED = MessageCode("engine.register_check.not_listed", params=("number",))
GAP = MessageCode("engine.register_check.gap", params=("after", "before", "missing", "discipline"))
GAPS = MessageCode("engine.register_check.gaps", params=("discipline", "gaps"))

TEXT_TOO_LONG = MessageCode("engine.register_check.text_too_long", params=("limit",))
TOO_MANY = MessageCode("engine.register_check.too_many", params=("limit",))
NOTHING_FOUND = MessageCode("engine.register_check.nothing_found")
RANGE_BACKWARDS = MessageCode("engine.register_check.range_backwards", params=("line", "first", "last"))
RANGE_MIXED = MessageCode("engine.register_check.range_mixed", params=("line", "first", "last"))
RANGE_TOO_LONG = MessageCode(
    "engine.register_check.range_too_long", params=("line", "first", "last", "limit")
)
RANGE_HYPHEN = MessageCode("engine.register_check.range_hyphen", params=("line", "first", "last"))
