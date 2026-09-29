"""Ticket 24f, F6 (session 06's ruling): "the audit log is written after the answer is printed; an
unwritable log lets an answer out unlogged. Log first; if logging fails, print nothing and exit
non-zero."

The log here opens for appending but every write fails (`/dev/full`: "No space left on device"), the
case the open-time check does not catch. Invented keys and exports only.
"""

import os
from pathlib import Path

import pytest

from tools.scorer.tests.acceptance.t24s.runs import (
    RUN_ID,
    Place,
    export_sheet,
    key_sheet,
    score_main,
)

FULL = Path("/dev/full")


def test_a_log_that_cannot_be_written_lets_no_answer_out(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys([key_sheet("Sheet A", "QZ-901", "Invented first plan", "first floor", [])])
    place.write_run([export_sheet("Sheet A", "QZ-901", "Invented first plan", "first floor", [])])
    assert FULL.exists()

    try:
        code = score_main()([RUN_ID], drop=place.drop, keys=place.keys, log=FULL, writer=os.getuid())
    except OSError:
        code = 1  # an uncaught failure is a non-zero exit too; what matters is what was printed

    output = capfd.readouterr()
    assert code != 0
    assert output.out == "", output.out
    for answer in ("pass", " / ", "sheet 1"):
        assert answer not in output.err, output.err
