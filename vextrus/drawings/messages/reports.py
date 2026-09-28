"""A file's report panel (ticket 14), in docs/design/m0-screens.md 4.5's words: the lines `drawings`
writes from what it holds. The reading's own lines come from the engine as its codes (the second
reader's `engine.decoders_agree.*`, the fonts' `engine.font_report.*`, a PDF's `engine.pdf_report.*`,
the Bangla-ANSI Check's `engine.bangla_ansi.*`), kept as they were read.

Worded in `web/src/messages/drawings/reports/en.po`. `plot_file` is a PDF's name as the QS added it;
`sheet` a sheet's number as printed and `revision` its revision mark; `page` a page's number.
"""

from engine.messages import MessageCode

# A DWG --------------------------------------------------------------------------------------------

READERS_AGREE = MessageCode("drawings.reports.readers_agree")
SHEETS_FOUND = MessageCode("drawings.reports.sheets_found", params=("sheets", "drawn", "layouts"))
"""Sheets found both laid out in the drawing and on layout tabs."""
SHEETS_FOUND_DRAWN = MessageCode("drawings.reports.sheets_found_drawn", params=("sheets",))
"""Every sheet found is laid out in the drawing (model space)."""
SHEETS_FOUND_LAYOUTS = MessageCode("drawings.reports.sheets_found_layouts", params=("sheets",))
"""Every sheet found is on a layout tab."""
EMPTY_LAYOUTS = MessageCode("drawings.reports.empty_layouts", params=("layouts",))
"""Layout tabs whose viewports show nothing: never counted as sheets."""
NO_SHEETS = MessageCode("drawings.reports.no_sheets")
PLOT_OF_DWG = MessageCode("drawings.reports.plot_of_dwg", params=("plot_file", "with_page", "sheets"))
"""One PDF plotted from this file: how many of its sheets have a page in it."""
NO_PLOT = MessageCode("drawings.reports.no_plot")

# A PDF --------------------------------------------------------------------------------------------

PAGES_MATCHED = MessageCode("drawings.reports.pages_matched", params=("matched", "pages"))
SHEET_WITHOUT_PAGE = MessageCode("drawings.reports.sheet_without_page", params=("sheet",))
SHEET_REVISION_WITHOUT_PAGE = MessageCode(
    "drawings.reports.sheet_revision_without_page", params=("sheet", "revision")
)
PAGE_SHEET_NOT_IN_DWG = MessageCode("drawings.reports.page_sheet_not_in_dwg", params=("page", "sheet"))
PAGE_TITLE_BLOCK_UNREAD = MessageCode("drawings.reports.page_title_block_unread", params=("page",))
PAGES_SAME_SHEET = MessageCode(
    "drawings.reports.pages_same_sheet", params=("first_page", "used_page", "sheet")
)
NO_DWG_FOR_PAGES = MessageCode("drawings.reports.no_dwg_for_pages")
