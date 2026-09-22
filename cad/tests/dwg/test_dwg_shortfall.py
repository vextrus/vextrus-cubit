"""A class the conversion lost reaches the artifact, named per space and per class (L-CAD-04).

`reconcile` already refuses a class on a sheet and returns it as data; `cad/tests/dwg/
test_dwg_reconcile.py` grades that rule on tallies written by hand. What is graded here is the rest
of the road: a real conversion whose census counts more of one class than the conversion carried,
the loss carried onto the artifact's own counters where R-TO-001 keeps what the extraction lost and
where, and the artifact still parsing through the mirror.

The shortfall is minted rather than hoped for: `fixtures/basic.dwg` converts cleanly, so the census
pass is replayed from `dwgread`'s own JSON with one class counted once more than the drawing holds.
That is the honest way to stage the disagreement — the geometry pass is the real one, the census is
the real one plus a record, and the rule under test is what the two passes do when they differ.

The suite derives everything from `Path(__file__)` and never imports `corpus`: under pytest's
prepend import mode this directory is the only one on `sys.path` for these modules.
"""

from __future__ import annotations

import copy
import json
import shutil
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from vextrus_cad import ingest_dxf, parse_entity_graph, report
from vextrus_cad.dwg import SHORTFALL, Toolchain, convert_dwg, losses_by_space

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"
BASIC = FIXTURE_DIR / "basic.dwg"

#: A budget for this suite's own subprocesses — not the lane's.
BUDGET = 60.0

#: How many extra of one class the replayed census counts. More than one, so a count that is a count
#: and not a flag is what the artifact has to carry.
EXTRA = 3

#: The class the census is doctored to over-count: `basic.dwg` draws two of them in model space.
LOST_CLASS = "LINE"


def _program(directory: Path, name: str, body: str) -> str:
    path = directory / name
    path.write_text(body)
    path.chmod(path.stat().st_mode | stat.S_IEXEC)
    return str(path)


def _real_census(tmp_path: Path) -> dict[str, Any]:
    """`dwgread -O JSON` over the fixture, as the census pass itself asks for it."""
    if shutil.which("dwgread") is None:
        pytest.skip("dwgread is not on PATH; checkup's libredwg probe owns that")
    census = tmp_path / "census.json"
    subprocess.run(
        ["dwgread", "-O", "JSON", "-o", str(census), str(BASIC)],
        check=False,
        capture_output=True,
        timeout=BUDGET,
    )
    assert census.stat().st_size > 0, "dwgread wrote no census to replay"
    return json.loads(census.read_text(encoding="utf-8", errors="replace"))


def _over_counted(document: dict[str, Any], dxftype: str, extra: int) -> dict[str, Any]:
    """The same census with `extra` more of `dxftype`, each a record of its own with its own handle.

    A drawing whose entities the conversion drops is the thing being staged, and this is that file's
    other half: the census saw them, the DXF does not hold them.
    """
    doctored = copy.deepcopy(document)
    objects = doctored["OBJECTS"]
    original = next(
        record for record in objects if isinstance(record, dict) and record.get("entity") == dxftype
    )
    for index in range(extra):
        copied = copy.deepcopy(original)
        handle = copied.get("handle")
        if isinstance(handle, list) and handle:
            handle[-1] = 0xF00000 + index
        objects.append(copied)
    return doctored


def _replaying_census(tmp_path: Path, document: dict[str, Any]) -> str:
    """A census program that writes this document wherever the pass asks it to."""
    replayed = tmp_path / "replayed-census.json"
    replayed.write_text(json.dumps(document), encoding="utf-8")
    return _program(
        tmp_path,
        "census.py",
        f"#!{sys.executable}\nimport sys\nfrom pathlib import Path\n"
        "argv = sys.argv[1:]\n"
        f"Path(argv[argv.index('-o') + 1]).write_bytes(Path({str(replayed)!r}).read_bytes())\n",
    )


def test_a_class_the_conversion_lost_is_named_on_the_artifacts_counters(tmp_path: Path) -> None:
    """Per space and per class, in the artifact — not only in a refusal nobody downstream reads."""
    census = _replaying_census(tmp_path, _over_counted(_real_census(tmp_path), LOST_CLASS, EXTRA))
    result = convert_dwg(BASIC, tmp_path / "out", toolchain=Toolchain(census, "dwg2dxf", BUDGET))

    short = [entry for entry in result.refused if entry.dxftype == LOST_CLASS]
    assert len(short) == 1, [entry.message() for entry in result.refused]
    entry = short[0]
    assert entry.space == "model"
    assert entry.reason == SHORTFALL
    assert entry.lost == EXTRA, entry.message()
    # The class of loss is named from a table both halves read (report.py's closed note codes).
    assert entry.note_code() in report.NOTE_CODES
    assert entry.note_code() == report.CONVERSION_SHORTFALL

    losses = losses_by_space(result.refused)
    assert losses["model"][LOST_CLASS] == EXTRA

    artifact = ingest_dxf(result.dxf_path, report.Report(), losses)
    rows = {row["space"]: row for row in artifact["counters"]}
    assert rows["model"]["conversion_losses"] == {LOST_CLASS: EXTRA}
    # The artifact is the hand-off (L-CAD-05): a loss it carries in a shape the mirror refuses would
    # be no hand-off at all.
    parse_entity_graph(artifact)


def test_a_conversion_that_reconciled_cleanly_writes_the_artifact_it_always_wrote(
    tmp_path: Path,
) -> None:
    """No loss, no key: a clean conversion's artifact is the one it was before this rule existed."""
    result = convert_dwg(BASIC, tmp_path / "out")
    assert result.refused == (), [entry.message() for entry in result.refused]
    assert losses_by_space(result.refused) == {}

    artifact = ingest_dxf(result.dxf_path, report.Report(), losses_by_space(result.refused))
    assert artifact["counters"], "the conversion's artifact carries no counters at all"
    assert all("conversion_losses" not in row for row in artifact["counters"])
    assert artifact == ingest_dxf(result.dxf_path)
