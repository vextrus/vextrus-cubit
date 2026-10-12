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
line is worked out from its set's PDFs as they stand: one of its Discipline or of none waiting or
being read, PLOT_NOT_YET; else one read with no match kept for the sheet, PLOT_NOT_MATCHED (never a
match that ran: 157); else one of its
Discipline that was not read, PLOT_PDF_UNREAD; else only refused ones of its Discipline,
PLOT_PDF_REFUSED; else PLOT_NO_PDF. PLOT_NO_PAGE is only a match that ran and found no page
(`PlotNone.NO_PAGE`, kept by the job). A sheet of no Discipline counts every PDF as its own."""
PLOT_NOT_MATCHED = MessageCode("drawings.sheets.plot_not_matched", params=("plot_file",))
"""A PDF of its Discipline (or of none) is read, and no match of it against the sheet is kept: the
read job matches in the transaction that marks a file read (157), so this is a set read before that,
or a PDF that could not be read again when the sheet's DWG was. `plot_file` is the first such PDF
(its own Discipline's first, then first added)."""
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
DECIDED_ALREADY = MessageCode("drawings.sheets.decided_already")
NUMBER_UNREADABLE = MessageCode("drawings.sheets.number_unreadable")
"""A typed number holding a character a title block cannot print (a control, a lone surrogate, a bidi
control: 400). The other causes have their own words: empty, too long, more than one line, a drawing
code (review 3 of #680)."""
NUMBER_EMPTY = MessageCode("drawings.sheets.number_empty")
NUMBER_TOO_LONG = MessageCode("drawings.sheets.number_too_long", params=("limit",))
NUMBER_MANY_LINES = MessageCode("drawings.sheets.number_many_lines")
NUMBER_DRAWING_CODE = MessageCode("drawings.sheets.number_drawing_code")
TITLE_EMPTY = MessageCode("drawings.sheets.title_empty")
TITLE_TOO_LONG = MessageCode("drawings.sheets.title_too_long", params=("limit",))
TITLE_MANY_LINES = MessageCode("drawings.sheets.title_many_lines")
TITLE_DRAWING_CODE = MessageCode("drawings.sheets.title_drawing_code")
TITLE_UNREADABLE = MessageCode("drawings.sheets.title_unreadable")
"""A typed title holding a character a title block cannot print (400); its other causes have their
own words, as the number's."""

# A plan view's storeys, typed (S24-B2; m0-screens 6.9) -------------------------------------------------

STOREYS_EMPTY = MessageCode("drawings.sheets.storeys_empty")
STOREYS_TOO_LONG = MessageCode("drawings.sheets.storeys_too_long", params=("limit",))
STOREYS_MANY_LINES = MessageCode("drawings.sheets.storeys_many_lines")
STOREYS_DRAWING_CODE = MessageCode("drawings.sheets.storeys_drawing_code")
STOREYS_UNREADABLE = MessageCode("drawings.sheets.storeys_unreadable")
STOREYS_NOT_A_STOREY = MessageCode("drawings.sheets.storeys_not_a_storey", params=("word",))
"""A typed storey list holding a word that names no storey (400); `word` is that item as typed."""
STOREYS_RANGE = MessageCode("drawings.sheets.storeys_range", params=("word",))
"""A typed storey list holding a range ("2nd to 6th") or an open end ("to the top"): each storey is
listed (400); `word` is that item as typed."""
STOREYS_TOO_MANY = MessageCode("drawings.sheets.storeys_too_many", params=("limit",))
STOREYS_MEANING_UNKNOWN = MessageCode("drawings.sheets.storeys_meaning_unknown")
"""A meaning that is not one of the two a correction picks, "at floor level" or "floor to floor" (400)."""
STOREYS_VIEW_UNKNOWN = MessageCode("drawings.sheets.storeys_view_unknown")
"""A view that is not one of the corrected sheet's (400)."""
STOREYS_NOT_A_PLAN = MessageCode("drawings.sheets.storeys_not_a_plan")
"""A view that is not a plan has no storeys to correct (400)."""
STOREYS_VIEW_TWICE = MessageCode("drawings.sheets.storeys_view_twice")
"""One view named twice in a correction (400)."""
