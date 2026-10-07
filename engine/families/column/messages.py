"""The column reader's Question codes (ADR 0038 item 2: a code and named parameters, never prose).

`engine.column.*` belongs in `engine/messages/column.py` with its words in
`web/src/messages/engine/column/en.po`; both lie outside this ticket's files, so the code is declared
here until a ticket that owns them moves it (the session-16 PR body says so).
"""

from engine.messages import MessageCode

SIZE_NOT_READ = MessageCode("engine.column.size_not_read", params=("mark", "grid_ref"))
"""A column outline with no size label beside it: its size is asked, never guessed."""

MARK_NOT_READ = MessageCode("engine.column.mark_not_read", params=("text",))
"""An outline with a size label and no column mark beside it (a wall's or a pier's label): not
proposed as a column, asked."""

VIEW_NOT_PLACED = MessageCode("engine.column.view_not_placed", params=("view_id",))
"""A view whose paper box no model-space sheet places: its columns are not read, asked."""
