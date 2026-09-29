"""The read job per file (ticket 21a): what its upload and its reading say.

Worded in `web/src/messages/takeoff/read_file/en.po`. `file` is the file's name as the QS added it,
shown as its label and nothing else.
"""

from engine.messages import MessageCode

NOT_STARTED = MessageCode("takeoff.read_file.not_started", params=("file",))
"""The file could not be queued to be read, so it was not added either: the add and its read job
are one transaction, and nothing of the add is kept (503)."""
NOT_STARTED_AGAIN = MessageCode("takeoff.read_file.not_started_again", params=("file",))
"""As NOT_STARTED, for a file already in the Drawing Set with no read job (added before its job
existed): it stays, unread, and adding it again starts it (503)."""
NOT_READ_IN_FULL = MessageCode("takeoff.read_file.not_read_in_full", params=("limit",))
"""The file's sheets were looked for only in part (the file itself was read in full): the sheet
finder stopped at one of its limits, `limit`, the
name of the limit it reached (a `FileBudget.report()` key, one of `engine.recognise.sheets.LIMITS`,
each worded on its own). Never a bare "no sheets": 21b's sheet step fills it from the file's
`sheet_report`, once per limit above 0."""
