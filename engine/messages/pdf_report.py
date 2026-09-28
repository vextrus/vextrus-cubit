"""The PDF upload report's codes (ticket 12): what `engine.read.pdf` says about a PDF, for a QS.

Worded in web/src/messages/engine/pdf_report/en.po, after m0-screens 4.5 ("The report panel for a
PDF"). The report's sections, in order: made by, pages, lettering, layers, pictures, fonts, extras,
refused. `producer` is the program the PDF names as its maker, as it names it; a page is its number,
counting from 1; a percent is a whole number.
"""

from engine.messages import MessageCode

# Made by: the producer the PDF names, or its creator when it names no producer.
MADE_BY_AUTOCAD = MessageCode("engine.pdf_report.made_by_autocad")
MADE_BY_OTHER = MessageCode("engine.pdf_report.made_by_other", params=("producer",))
MADE_BY_UNKNOWN = MessageCode("engine.pdf_report.made_by_unknown")

# Pages: how many, and how many are turned (`/Rotate`), which the reader turns back.
PAGES = MessageCode("engine.pdf_report.pages", params=("pages", "turned"))
PAGE_UNREADABLE = MessageCode("engine.pdf_report.page_unreadable", params=("page",))

# Lettering: whether AutoCAD's lettering reached the PDF as text (the rule: engine/read/pdf).
LETTERING_KEPT = MessageCode("engine.pdf_report.lettering_kept")
LETTERING_PARTLY = MessageCode("engine.pdf_report.lettering_partly", params=("pages", "of"))
LETTERING_LINES = MessageCode("engine.pdf_report.lettering_lines", params=("pages",))
# No page carries SHX comments or hidden text, yet some carry real text: AutoCAD's own lettering,
# if the drawings use it, is lines there, and the PDF cannot say whether they do.
LETTERING_UNCONFIRMED = MessageCode("engine.pdf_report.lettering_unconfirmed", params=("pages",))
UNMAPPED_TEXT = MessageCode("engine.pdf_report.unmapped_text", params=("chars",))

# Layers: the drawing's layers, as named in the pages' resources.
LAYERS_KEPT = MessageCode("engine.pdf_report.layers_kept", params=("layers",))
LAYERS_FLATTENED = MessageCode("engine.pdf_report.layers_flattened")

# Pictures: raster images and the share of a page they cover.
NO_PICTURES = MessageCode("engine.pdf_report.no_pictures")
PICTURES = MessageCode("engine.pdf_report.pictures", params=("pages", "percent"))
MOSTLY_PICTURE = MessageCode("engine.pdf_report.mostly_picture", params=("page", "percent"))
SCAN_PAGE = MessageCode("engine.pdf_report.scan_page", params=("page",))

# Fonts: the fonts the pages' text is set in.
FONTS_NOT_EMBEDDED = MessageCode("engine.pdf_report.fonts_not_embedded", params=("fonts",))
FONTS_DRAWN = MessageCode("engine.pdf_report.fonts_drawn", params=("fonts",))
FONTS_UNREADABLE = MessageCode("engine.pdf_report.fonts_unreadable", params=("fonts",))

# Extras: scripts, launch actions, links, actions naming another file and attached files, counted
# together; none is ever run or opened.
EXTRAS_IGNORED = MessageCode("engine.pdf_report.extras_ignored", params=("count",))

# Refused: every page is a scan.
SCAN = MessageCode("engine.pdf_report.scan")

# A PDF that could not be read at all (raised as the file's finding, `engine.read.ReadError`).
LOCKED = MessageCode("engine.pdf_report.locked")
UNREADABLE = MessageCode("engine.pdf_report.unreadable")
TOO_MANY_PAGES = MessageCode("engine.pdf_report.too_many_pages", params=("limit",))
LIMIT_REACHED = MessageCode("engine.pdf_report.limit_reached", params=("limit",))
