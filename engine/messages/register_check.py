"""The drawing-list Check's codes (ticket 19b): `engine.check.register`, and its `parse` refusals.

Worded in web/src/messages/engine/register_check/en.po (13's `engine/messages/register.py` holds the
codes of reading a list on a sheet). A number is as the list or the sheet prints it; a count is an
integer; a line counts from 1.

The Check's findings (each raises a Question, 21c's; m0-screens §5 and 6.7):
- `not_found`: a number on the drawing list that no sheet of the set carries (its Discipline's).
- `not_listed`: a sheet whose number the drawing list does not name.
- `gap`: with no drawing list, the numbering skips: no sheet between `after` and `before`, the two
  numbers either side of the gap as their sheets print them, and `missing` numbers in between.

`parse`'s refusals, for the drawing-list dialog (m0-screens 6.10; 19a's): the text is too long
(`limit` characters), it holds too many entries (`limit`), no line reads as a sheet line, or a range
line (`line`) runs backwards, mixes two kinds of number, holds more than `limit` numbers, or is joined
by a hyphen, which cannot tell a range from one sheet's number.
"""

from engine.messages import MessageCode

NOT_FOUND = MessageCode("engine.register_check.not_found", params=("number",))
NOT_LISTED = MessageCode("engine.register_check.not_listed", params=("number",))
GAP = MessageCode("engine.register_check.gap", params=("after", "before", "missing"))

TEXT_TOO_LONG = MessageCode("engine.register_check.text_too_long", params=("limit",))
TOO_MANY = MessageCode("engine.register_check.too_many", params=("limit",))
NOTHING_FOUND = MessageCode("engine.register_check.nothing_found")
RANGE_BACKWARDS = MessageCode("engine.register_check.range_backwards", params=("line", "first", "last"))
RANGE_MIXED = MessageCode("engine.register_check.range_mixed", params=("line", "first", "last"))
RANGE_TOO_LONG = MessageCode(
    "engine.register_check.range_too_long", params=("line", "first", "last", "limit")
)
RANGE_HYPHEN = MessageCode("engine.register_check.range_hyphen", params=("line", "first", "last"))
