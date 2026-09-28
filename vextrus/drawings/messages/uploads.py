"""What adding a file answers (ticket 14), in docs/design/m0-screens.md 4.5's toast words.

Worded in `web/src/messages/drawings/uploads/en.po`. `file` is the file's name as the QS added it,
shown as its label and nothing else; `added_date` an instant in UTC.

A file is known by its contents, never by its name or the type the browser says it is: its first
bytes say whether it is a DWG, a PDF or a zip. Adding the same contents again adds nothing, unless
Vextrus's own copy of them is missing or damaged, when the new copy replaces it.
"""

from engine.messages import MessageCode

# Answers to an add that is not refused ------------------------------------------------------------

ALREADY_HERE = MessageCode(
    "drawings.uploads.already_here", params=("file", "added_date", "actor", "vextrus")
)
"""The same contents are in the Drawing Set already, under the same name: when and by whom they
were added (not a refusal: nothing was added, and the existing row is the answer). `vextrus`:
`yes` when a Vextrus Engineer added it, else `no`."""
ALREADY_HERE_AS = MessageCode(
    "drawings.uploads.already_here_as",
    params=("file", "existing_file", "added_date", "actor", "vextrus"),
)
"""As ALREADY_HERE, the contents added before under another name, `existing_file`."""
SAME_NAME_KEPT = MessageCode("drawings.uploads.same_name_kept")
"""Added, beside a file of the same name with other contents: both are kept."""
REPLACED = MessageCode("drawings.uploads.replaced", params=("file",))
"""The same contents again, while Vextrus's copy was missing or damaged: the copy is replaced."""
REPLACED_READING = MessageCode("drawings.uploads.replaced_reading", params=("file",))
"""As REPLACED, and the file's reading, which had stopped, starts again."""

# Refusals: nothing is kept -------------------------------------------------------------------------

NOT_A_DRAWING = MessageCode("drawings.uploads.not_a_drawing", params=("file",))
"""Not a DWG or a PDF by its first bytes (an empty file among them) (415)."""
ZIP = MessageCode("drawings.uploads.zip", params=("file",))
"""A zip (415)."""
TOO_LARGE = MessageCode("drawings.uploads.too_large", params=("file", "megabytes"))
"""Larger than the limit, `megabytes` (413)."""
TOO_LARGE_UNNAMED = MessageCode("drawings.uploads.too_large_unnamed", params=("megabytes",))
"""As TOO_LARGE, before a name is known (the request says it is larger than any one file may be)."""
NO_NAME = MessageCode("drawings.uploads.no_name")
"""A file whose name, cleaned to a label, is nothing (400)."""
ONE_AT_A_TIME = MessageCode("drawings.uploads.one_at_a_time")
"""More than one file sent in one request (400): the web sends each file on its own."""
STOPPED = MessageCode("drawings.uploads.stopped")
"""No whole file arrived: the connection dropped before the end of it (400)."""
MALFORMED = MessageCode("drawings.uploads.malformed")
"""The body was no well-formed upload (a part's headers too long, too many fields) (400)."""
