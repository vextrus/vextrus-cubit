"""The conflicts' codes (ticket 19b): what `engine.recognise.conflicts` found, one code per kind.

A Conflict's words are the code `engine.conflicts.<kind>` with its evidence as the params, worded in
web/src/messages/engine/conflicts/en.po. The evidence holds only what the candidates share: each
candidate carries its own revision mark, date and file, and 21c's Question names them. A number or
a title is drawing text, as the first candidate prints it; the rest are counts and keys.

- `same_number`: sheets of one Discipline with one number. `number`, `copies` (2 or more).
- `same_title`: sheets of one Discipline with one title whose numbers do not all run on. `title`,
  `sheets` (2 or more; a run of consecutive numbers among them counts each of its sheets).
- `same_storey`: plan views drawing one subject and layer on one storey, on different sheets, worded
  as m0-screens §5's "S-14 and S-15 both draw the 5th floor slab, bottom layer": `first` and `second`
  are the first two sheets, by their numbers as printed or else their titles (`first_named` and
  `second_named`: `number` or `title`); `plan` and `other` are the titles, as drawn, of the first
  and the second sheet's plans (they state the storey and what is drawn); `titled` is `same` (the two
  titles alike: `plan` only), `differ` (both) or `none` (either plan untitled: both empty); `layer`
  is `top`, `bottom` or `none`; `views` how many (2 or more).
  `discipline`, `subject` and `storey` are keys (the Discipline's, the conventions' subject, 13's
  storey) for 21c, never shown as they are.
"""

from engine.messages import MessageCode

SAME_NUMBER = MessageCode("engine.conflicts.same_number", params=("number", "copies"))
SAME_TITLE = MessageCode("engine.conflicts.same_title", params=("title", "sheets"))
SAME_STOREY = MessageCode(
    "engine.conflicts.same_storey",
    params=(
        "first", "first_named", "second", "second_named", "plan", "other", "titled", "layer", "views",
        "discipline", "subject", "storey",
    ),
)  # fmt: skip
