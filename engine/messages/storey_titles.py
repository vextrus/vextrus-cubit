"""The storey-titles Check's codes (ticket 19b): `engine.check.storey_titles`, the storeys a sheet's
title names against the storeys its plans' titles name.

Worded in web/src/messages/engine/storey_titles/en.po. `sheet` names the sheet: its number as printed
when `named` is `number`, else its title as drawn (`named` is `title`). `stated` is the title's storey
words as drawn (13's `storeys_as_stated`); `not_drawn` counts the storeys the title names that no plan
on the sheet names, `not_named` the storeys its plans name that the title does not.

- `differ`: the title and the plans disagree (at least one of the two counts is not 0).
- `differs`: Step 1's Question over one Discipline's disagreeing sheets (T-W318; one per Discipline,
  not one per sheet): `discipline` its key, `count` how many of its undecided sheets disagree, and
  `sheet`, `named`, `stated`, `not_drawn`, `not_named` the first of them's, as `differ` gives them.
"""

from engine.messages import MessageCode

DIFFER = MessageCode(
    "engine.storey_titles.differ", params=("sheet", "named", "stated", "not_drawn", "not_named")
)

DIFFERS = MessageCode(
    "engine.storey_titles.differs",
    params=("discipline", "count", "sheet", "named", "stated", "not_drawn", "not_named"),
)
