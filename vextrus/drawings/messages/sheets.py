"""A printed sheet's Plot, and refusals of what is decided about a sheet or a view (ticket 14).

Worded in `web/src/messages/drawings/sheets/en.po`. The Plot's reasons are docs/design/m0-screens.md
4.6's "No Plot for this sheet" lines: `discipline` is the Discipline's name, as the Market's Library
gives it; `plot_file` the PDF's name as the QS added it.
"""

from engine.messages import MessageCode

# Why a printed sheet has no Plot ------------------------------------------------------------------

PLOT_NO_PDF = MessageCode("drawings.sheets.plot_no_pdf", params=("discipline",))
PLOT_NO_PAGE = MessageCode("drawings.sheets.plot_no_page", params=("plot_file",))
PLOT_PDF_REFUSED = MessageCode("drawings.sheets.plot_pdf_refused")
PLOT_NO_NUMBER = MessageCode("drawings.sheets.plot_no_number")
PLOT_NOT_YET = MessageCode("drawings.sheets.plot_not_yet")
"""Its Plot is not matched yet: its PDF is still being read, or not yet added."""

# Refusals ----------------------------------------------------------------------------------------

OTHER_NEEDS_TEXT = MessageCode("drawings.sheets.other_needs_text")
"""Left out for "other" reasons with none given (400)."""
TEXT_ONLY_FOR_OTHER = MessageCode("drawings.sheets.text_only_for_other")
"""Words given with a reason from the list: only "other" takes words (400)."""
KIND_UNKNOWN = MessageCode("drawings.sheets.kind_unknown")
"""A kind that is not one of the kinds offered (400)."""
