"""Coverage's codes (ticket 19b): `engine.check.coverage`, no view unaccounted (ADR 0027).

Worded in web/src/messages/engine/coverage/en.po, after m0-screens 6.11's "Unaccounted" list ("S-20
8th floor beam layout"). `sheet` names the view's sheet: its number as printed when `named` is
`number`, its title as drawn when `named` is `title`, and nothing (an empty text) when `named` is
`none`, a sheet with neither. `view` is the view's title as drawn; `kind` its kind (one of the ten,
engine.recognise.types.ViewKind) when it has no title.

- `unaccounted`: a view with a title, proposed to no Takeoff Step, no Discipline Part and no exclusion.
- `unaccounted_untitled`: the same, for a view with no title, named by its kind.
"""

from engine.messages import MessageCode

UNACCOUNTED = MessageCode("engine.coverage.unaccounted", params=("sheet", "named", "view"))
UNACCOUNTED_UNTITLED = MessageCode(
    "engine.coverage.unaccounted_untitled", params=("sheet", "named", "kind")
)
