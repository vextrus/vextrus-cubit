"""S24-A5's review (#703, round 3): the set's Plot is a function of its read PDFs' pages and its
listed sheets alone. The same set read in each of the six orders of its three files ends with the
same page used for each sheet.

DWG A lists S-01, S-02 and S-05; DWG B lists S-04. The Plot's pages read, every page's lettering
kept as text: S-01; S-02; S-05 large (a mark referring to it); S-04; S-05 small (its own page). With
every file read, page 4 holds S-04 alone, so page 3's place (S-02 to S-04) does not hold S-05 and
page 5's does: page 5 is S-05's Plot, whichever file was read last (on 361e1550, reading B after
the Plot left S-05 on page 3).
"""

from itertools import permutations

import pytest

from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from vextrus.drawings import services
from vextrus.takeoff.services.read_propose import plot
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db

LISTS = {"KR-STR-A.dwg": ["S-01", "S-02", "S-05"], "KR-STR-B.dwg": ["S-04"]}


@pytest.fixture(autouse=True)
def _reader_unsandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


def _plot() -> bytes:
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}

    def named(number: str, size: float = 10) -> Page:
        return Page(content=text(60, 60, number, size=size), fonts=fonts)

    pages = [named("S-01"), named("S-02"), named("S-05", 14), named("S-04"), named("S-05", 4)]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


@pytest.mark.parametrize("order", list(permutations(["KR-STR-PLOT.pdf", *LISTS])))
def test_every_read_order_ends_with_the_same_pages_used(
    qs_project: QsProject, order: tuple[str, ...]
) -> None:
    member = qs_project.member
    ids = {}
    for name in order:
        if name.endswith(".pdf"):
            ids[name] = add(member, qs_project.project_id, name, _plot()).file.id
            run_inline(
                read_file.read_file,
                tenant_id=member.developer_id,
                user_id=member.user.pk,
                abort_reason=lambda: None,
                file_id=ids[name],
            )
        else:
            ids[name] = add(member, qs_project.project_id, name, drawing()).file.id
            read_dwg(member, ids[name], LISTS[name])
            with member.acting():
                plot.match(ids[name])  # the DWG's `finishing` step's match

    with member.acting():
        used = {
            s.number: s.plot.page for s in services.sheets(services.file(ids["KR-STR-PLOT.pdf"]).set_id)
        }
    assert used == {"S-01": 1, "S-02": 2, "S-04": 4, "S-05": 5}, (order, used)
