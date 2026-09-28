"""The conflicts' codes (ticket 19b): what `engine.recognise.conflicts` found, one code per kind.

A Conflict's words are the code `engine.conflicts.<kind>` with its evidence as the params, worded in
web/src/messages/engine/conflicts/en.po. The evidence holds only what the candidates share: each
candidate carries its own revision mark, date and file, and 21c's Question names them. A number or
a title is drawing text, as the first candidate prints it; the rest are counts and keys.

- `same_number`: sheets of one Discipline with one number. `number`, `copies` (2 or more).
- `same_title`: sheets of one Discipline with one title whose numbers do not all run on. `title`,
  `sheets` (2 or more; a run of consecutive numbers among them counts each of its sheets).
- `same_storey`: plan views drawing one subject and layer on one storey, on different sheets.
  `discipline`, `subject` and `storey` are keys (the Discipline's, the conventions' subject, 13's
  storey) for 21c to word through the product's names, never shown as they are; `layer` is `top`,
  `bottom` or `none`; `views` (2 or more).
"""

from engine.messages import MessageCode

SAME_NUMBER = MessageCode("engine.conflicts.same_number", params=("number", "copies"))
SAME_TITLE = MessageCode("engine.conflicts.same_title", params=("title", "sheets"))
SAME_STOREY = MessageCode(
    "engine.conflicts.same_storey", params=("discipline", "subject", "layer", "storey", "views")
)
