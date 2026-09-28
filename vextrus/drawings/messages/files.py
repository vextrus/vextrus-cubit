"""A file's status and the acts on files (ticket 14), in docs/design/m0-screens.md 4.5's words.

Worded in `web/src/messages/drawings/files/en.po`. A file's row is worded from these codes, never from
a job's (`platform.jobs.*`): `services.drawing_files` reads the file's own columns, and its read
job's state over them while it has one (`jobs.state`), so a job that crashed still reads "Could not
be read".

Parameters follow the web's naming (web/src/format/machine.tsx): `actor` a person's name as it was at
the act; a name ending `_date` an instant in UTC, shown in the Market's time zone; `file` a file's
name as the QS added it; `sheet` a sheet's number as printed; every other number a count.
"""

from engine.messages import MessageCode

# The Status cell, a row per state of 4.5's table ---------------------------------------------------

WAITING = MessageCode("drawings.files.waiting", params=("ahead",))
"""Waiting to be read; `ahead`: how many of the Developer's own files are read before it (0: next)."""

OPENING_FILE = MessageCode("drawings.files.opening_file")
READING_DRAWING = MessageCode("drawings.files.reading_drawing")
"""Also the words for a step these codes do not know."""
SECOND_READER = MessageCode("drawings.files.second_reader")
FINDING_SHEETS = MessageCode("drawings.files.finding_sheets")
READING_SHEET = MessageCode("drawings.files.reading_sheet", params=("position", "total"))
READING_SHEET_LEFT = MessageCode(
    "drawings.files.reading_sheet_left", params=("position", "total", "minutes")
)
"""Once 3 sheets are read: the minutes left at the rate so far, rounded up."""
FINISHING = MessageCode("drawings.files.finishing")
OPENING_PDF = MessageCode("drawings.files.opening_pdf")
READING_PAGE = MessageCode("drawings.files.reading_page", params=("position", "total"))
READING_PAGE_LEFT = MessageCode(
    "drawings.files.reading_page_left", params=("position", "total", "minutes")
)
MATCHING_PAGES = MessageCode("drawings.files.matching_pages")
STOPPING = MessageCode("drawings.files.stopping")
CANCELLED = MessageCode("drawings.files.cancelled", params=("actor", "vextrus", "cancelled_date"))
"""`vextrus`: `yes` when a Vextrus Engineer cancelled it (shown "(Vextrus)", m0-screens 1.4), else
`no`."""
CANCELLED_UNNAMED = MessageCode("drawings.files.cancelled_unnamed")
"""Its read job was cancelled some other way than by a person on this page (no name to give)."""
RETRYING = MessageCode("drawings.files.retrying", params=("attempt", "tries"))
FAILED = MessageCode("drawings.files.failed", params=("tries",))
"""Its reading ended without reading it: the job failed (a crash too), or the file was read by one
reader only (its finding, engine.decoders_agree's `not_installed` and the like, says why)."""
OLD_VERSION = MessageCode("drawings.files.old_version")
"""Saved by an AutoCAD older than the reader reads: the row's words, and the file's finding."""
READ = MessageCode("drawings.files.read")
READ_BANGLA = MessageCode("drawings.files.read_bangla")
"""Read, with the Bangla-ANSI Check's flag (M0's one flag)."""
HELD = MessageCode("drawings.files.held")
HELD_READ_ANYWAY = MessageCode("drawings.files.held_read_anyway")
AWAIT_RESAVED = MessageCode("drawings.files.await_resaved")
SENT_TO_VEXTRUS = MessageCode("drawings.files.sent_to_vextrus")
PLOT_MATCHED = MessageCode("drawings.files.plot_matched", params=("matched", "pages"))
PLOT_MATCHED_LINES = MessageCode("drawings.files.plot_matched_lines", params=("matched", "pages"))
"""As PLOT_MATCHED, when its lettering is drawn as lines on some page."""
PLOT_WAITING = MessageCode("drawings.files.plot_waiting")
"""A PDF read, but none of its pages matched a sheet yet: its DWG is not read."""
REFUSED_SCAN = MessageCode("drawings.files.refused_scan")

SUMMARY = MessageCode(
    "drawings.files.summary", params=("files", "sheets", "reading", "failed", "held", "refused")
)
"""The page's one-line summary: the files; the sheets in the sheet list (of read files, and held
files read anyway); the files waiting or being read; those that could not be read (failed, or
saved by an old AutoCAD); held; refused."""

# The acts, in the event log -----------------------------------------------------------------------

ADDED = MessageCode("drawings.files.added", params=("actor",), event=True)
READ_CANCELLED = MessageCode("drawings.files.read_cancelled", params=("actor",), event=True)
READ_RESTARTED = MessageCode("drawings.files.read_restarted", params=("actor",), event=True)
DISCIPLINE_CHANGED = MessageCode("drawings.files.discipline_changed", params=("actor",), event=True)

# Refusals ----------------------------------------------------------------------------------------

NOT_STOPPED = MessageCode("drawings.files.not_stopped")
"""Read again or Try again on a file waiting, being read or read (409): most often a second click
after the first started it again. A file saved by an old AutoCAD is refused with OLD_VERSION."""
DISCIPLINE_UNKNOWN = MessageCode("drawings.files.discipline_unknown")
"""A Discipline this Market does not have (400)."""
DISCIPLINE_SHEET_DECIDED = MessageCode("drawings.files.discipline_sheet_decided", params=("sheet",))
"""A sheet of the file is confirmed or left out in Step 1, so its Discipline stays (409)."""
DISCIPLINE_SHEET_TAKEN = MessageCode(
    "drawings.files.discipline_sheet_taken", params=("sheet", "discipline")
)
"""The chosen Discipline (its name, as the Market's Library gives it) already has a sheet with this
number (409)."""
DISCIPLINE_UNNUMBERED_DECIDED = MessageCode("drawings.files.discipline_unnumbered_decided")
"""As DISCIPLINE_SHEET_DECIDED, for a sheet with no number."""
