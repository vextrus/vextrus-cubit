"""A printed sheet's Plot, and refusals of what is decided about a sheet or a view (ticket 14).

Worded in `web/src/messages/drawings/sheets/en.po`. The Plot's reasons are docs/design/m0-screens.md
4.6's "No Plot for this sheet" lines: `discipline` is the Discipline's name, as the Market's Library
gives it; `plot_file` the PDF's name as the QS added it.
"""

from engine.messages import MessageCode

# Why a printed sheet has no Plot ------------------------------------------------------------------

PLOT_NO_PDF = MessageCode("drawings.sheets.plot_no_pdf", params=("discipline",))
PLOT_NO_PDF_ANY = MessageCode("drawings.sheets.plot_no_pdf_any")
"""As PLOT_NO_PDF, for a sheet with no Discipline: no PDF is in the Drawing Set."""
PLOT_NO_PAGE = MessageCode("drawings.sheets.plot_no_page", params=("plot_file",))
PLOT_PDF_REFUSED = MessageCode("drawings.sheets.plot_pdf_refused")
PLOT_NO_NUMBER = MessageCode("drawings.sheets.plot_no_number")
PLOT_NOT_YET = MessageCode("drawings.sheets.plot_not_yet")
"""A PDF of its Discipline (or of none) is waiting or being read. Without a Plot recorded, a sheet's
line is worked out from its set's PDFs as they stand: one of its Discipline or of none being read,
PLOT_NOT_YET; else one read, PLOT_NO_PAGE (none of its pages matched the sheet); else one of its
Discipline that was not read, PLOT_PDF_UNREAD; else only refused ones of its Discipline,
PLOT_PDF_REFUSED; else PLOT_NO_PDF. A sheet of no Discipline counts every PDF as its own."""
PLOT_PDF_UNREAD = MessageCode("drawings.sheets.plot_pdf_unread")
"""Its Discipline's PDFs there were not read (they failed, were cancelled or are held)."""

# Refusals ----------------------------------------------------------------------------------------

OTHER_NEEDS_TEXT = MessageCode("drawings.sheets.other_needs_text")
"""Left out for "other" reasons with none given (400)."""
TEXT_ONLY_FOR_OTHER = MessageCode("drawings.sheets.text_only_for_other")
"""Words given with a reason from the list: only "other" takes words (400)."""
KIND_UNKNOWN = MessageCode("drawings.sheets.kind_unknown")
"""A sheet's or a view's kind that is not one of those offered (400)."""
TEXT_UNREADABLE = MessageCode("drawings.sheets.text_unreadable")
"""An exclusion's words holding a character that cannot be kept (a control, a lone surrogate): refused,
never cleaned behind the QS's back (400)."""
REASON_UNKNOWN = MessageCode("drawings.sheets.reason_unknown")
"""A reason to leave out that is not one of the seven (400)."""
