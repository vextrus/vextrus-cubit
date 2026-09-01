"""The lane says nothing on the streams that are not its own (L-CAD-01, L-CAD-04).

`cad/` is spawned by whoever wants a drawing read, and its answer is the artifact it writes; the
process's stdout and stderr belong to the caller, which is reading something else on them. The
reader libraries this lane drives disagree by default — ezdxf logs a warning for every non-unique
handle LibreDWG's conversion carries, and `logging.lastResort` puts each one on stderr — so the
guarantee is checked where it can actually be seen: from a parent process, on a real conversion
and on a refusal, with the child's two streams read as bytes.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"
SOURCE = FIXTURE_DIR / "basic.dwg"

#: A budget for the suite's own child interpreter — not the lane's.
PROBE_TIMEOUT_SECONDS = 300.0

#: What the child prints, and the only thing its caller should ever have to read.
_CHILD = """
import json, sys, tempfile
from pathlib import Path

from vextrus_cad.dwg import DwgError, convert_dwg, geometry_tally

source = Path(sys.argv[1])
report = {}
with tempfile.TemporaryDirectory() as out:
    result = convert_dwg(source, Path(out))
    report["converted"] = result.dxf_path.is_file()
    report["refused"] = len(result.refused)

with tempfile.TemporaryDirectory() as scratch:
    unreadable = Path(scratch) / "unreadable.dxf"
    unreadable.write_text("this is not a DXF\\n", encoding="utf-8")
    try:
        geometry_tally(unreadable)
    except DwgError as error:
        report["refusal_names_the_file"] = "unreadable.dxf" in str(error)

print(json.dumps(report))
"""


def _run_child() -> subprocess.CompletedProcess[bytes]:
    with tempfile.TemporaryDirectory() as scratch:
        child = Path(scratch) / "silence_child.py"
        child.write_text(_CHILD, encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(child), str(SOURCE)],
            capture_output=True,
            check=False,
            timeout=PROBE_TIMEOUT_SECONDS,
        )


def test_a_conversion_and_a_refusal_write_nothing_to_the_callers_streams() -> None:
    completed = _run_child()

    said = completed.stderr.decode("utf-8", errors="replace")
    assert completed.returncode == 0, f"the child ended {completed.returncode}: {said}"
    assert said == "", f"the lane wrote to the caller's stderr: {said!r}"

    # stdout carries the child's own report and nothing else: one line, parseable on its own.
    spoken = completed.stdout.decode("utf-8", errors="replace")
    assert spoken.count("\n") == 1, f"the lane wrote to the caller's stdout as well: {spoken!r}"
    report = json.loads(spoken)
    assert report == {"converted": True, "refused": 0, "refusal_names_the_file": True}
