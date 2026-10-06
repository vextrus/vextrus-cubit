"""S15-E7 (#538, superseding #195): "A notes Sheet of one block insert is kept", in the Drawing Set's
sheet list the QS confirms. A structural DWG whose one layout is a titled notes sheet (S-901, its
notes drawn inside one block insert, no viewport but AutoCAD's main one; the engine acceptance's
`notes_text_block`, `engine/recognise/tests/acceptance/ts15e7/drawing.py`) is read by the real read
job (`vextrus.takeoff.tasks.read_file`); its Sheet is listed, not proposed out. Needs the toolchain:

    uv run pytest -m "needs_toolchain and needs_bwrap" -rf vextrus/takeoff/tests/acceptance/ts15e7
"""

import pytest

from engine.recognise.tests.acceptance.ts15e7 import drawing
from vextrus.drawings import services as drawings
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import (  # noqa: F401
    dumper,
    engine_readers,
)
from vextrus.takeoff.tests.acceptance.ts15e7 import plot_set
from vextrus.testing.drawings import QsProject

pytestmark = [pytest.mark.django_db, pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]


@pytest.fixture(scope="module")
def notes_dwg(tmp_path_factory: pytest.TempPathFactory) -> bytes:
    build = tmp_path_factory.mktemp("ts15e7-notes-build")
    folder = tmp_path_factory.mktemp("ts15e7-notes")
    return drawing.build_all(folder, build)["notes_text_block"].read_bytes()


def test_a_notes_sheet_of_one_block_insert_is_in_the_sheet_list_not_proposed_out(
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811
    notes_dwg: bytes,
) -> None:
    ids = plot_set.read_in_order(qs_project, {"KR-STR-NOTES.dwg": notes_dwg}, ["KR-STR-NOTES.dwg"])

    with qs_project.member.acting():
        listed = drawings.sheets(drawings.file(ids["KR-STR-NOTES.dwg"]).set_id)
    rows = [(s.number, s.proposed_exclusion) for s in listed]
    assert (drawing.NUMBER, None) in rows, f"the notes Sheet is not in the sheet list: {rows}"
