"""The read job per file (ticket 21a): what its upload and its reading say.

Worded in `web/src/messages/takeoff/read_file/en.po`. `file` is the file's name as the QS added it,
shown as its label and nothing else.
"""

from engine.messages import MessageCode

NOT_STARTED = MessageCode("takeoff.read_file.not_started", params=("file",))
"""The file could not be queued to be read, so it was not added either: the add and its read job
are one transaction, and nothing of the add is kept (503)."""
NOT_STARTED_AGAIN = MessageCode("takeoff.read_file.not_started_again", params=("file",))
"""The same contents replaced Vextrus's missing copy of a file whose reading had failed, and its
reading could not be started again: the file stays as it was, failed; "Try again" on its row starts
it (503)."""
NOT_STARTED_WAITING = MessageCode("takeoff.read_file.not_started_waiting", params=("file",))
"""A file already in the Drawing Set, waiting with no read job (added before its job existed), whose
job could not be queued: it stays waiting, and adding it again starts it (503)."""
READING_STARTED = MessageCode("takeoff.read_file.reading_started", params=("file",))
"""Not a refusal: the same contents as a file already here, waiting with no read job; nothing was
added, and its reading has started (200, `already_here`)."""
NOT_READ_IN_FULL = MessageCode("takeoff.read_file.not_read_in_full", params=("limit",))
"""The file's sheets, or a sheet's views, were looked for only in part (the file itself was read
in full): the sheet finder or the view finder stopped at one of its limits, `limit` (one of
`engine.recognise.sheets.LIMITS`, or a view finder's limit as `views_<limit>` from
`engine.recognise.views.LIMITS`: "views_read_budget" is not the sheet finder's "read_budget"; or
21b's own: `sheet_text_unreadable`, sheets left out for words still holding raw codes, and
`render_budget`, the file's drawing time spent), each worded on its own. Never a bare "no
sheets": 21b's `sheets` step fills it from the file's `sheet_report`, once per limit above 0; the
`sheet_<n>` step of the first sheet a view or render limit cut fills it once for the file (each
sheet's `view_report` says which sheets it cut)."""
