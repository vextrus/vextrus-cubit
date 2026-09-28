"""The Plot-pages Check's codes (ticket 19b): `engine.check.plot_pages`, the Plot against the sheets.

Worded in web/src/messages/engine/plot_pages/en.po. `page` is a page of the Discipline's PDF, counting
from 1; `reason` is why no sheet matched it, one of 18's reason keys (engine/plot/registration.py),
which the words do not show; `number` is a sheet's number as printed.

- `no_sheet`: a page of the PDF that matched no sheet of the drawings (m0-screens §5's "Page 12 of
  KR-STR-R0.pdf shows S-13, which no DWG has"; the file and the page's own number are the Question's,
  21c's, from the page it names).
- `no_page`: a sheet, in a Discipline whose PDF matched a page, that no page of it matched.
"""

from engine.messages import MessageCode

NO_SHEET = MessageCode("engine.plot_pages.no_sheet", params=("page", "reason"))
NO_PAGE = MessageCode("engine.plot_pages.no_page", params=("number",))
