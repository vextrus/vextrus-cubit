"""The read job per file (ticket 21a): what its upload and its reading say.

Worded in `web/src/messages/takeoff/read_file/en.po`. `file` is the file's name as the QS added it,
shown as its label and nothing else.
"""

from engine.messages import MessageCode

NOT_STARTED = MessageCode("takeoff.read_file.not_started", params=("file",))
"""The file could not be queued to be read, so it was not added either: the add and its read job
are one transaction, and nothing of the add is kept (503)."""
NOT_READ_IN_FULL = MessageCode("takeoff.read_file.not_read_in_full", params=("limit",))
"""The file was read only in part: the sheet finder stopped at one of its limits, `limit`, the
name of the limit it reached (a `FileBudget.report()` key). Never a bare "no sheets": 21b's sheet
step fills it from the file's `sheet_report`."""
