"""Ticket 24: the CAD worker's memory cap is set from the measured peaks (docs/plans/M0.md, 24).

The research note records each real file's measured peak address space under the product's read job
and the cap chosen from them on a line `CAD worker cap: <bytes> bytes`; the setting holds exactly that
value, and the cap is above every measured peak with room to spare.
"""

import re
from pathlib import Path

from django.conf import settings

NOTE = Path(__file__).resolve().parents[5] / "docs" / "research" / "m0-measurements.md"


def _note() -> str:
    assert NOTE.is_file(), f"{NOTE} is missing: 24 writes the measurements there"
    return NOTE.read_text(encoding="utf-8")


def test_the_cad_worker_has_a_memory_cap() -> None:
    cap = settings.VEXTRUS_CAD_WORKER_MEMORY_BYTES
    assert isinstance(cap, int)
    assert not isinstance(cap, bool)
    assert cap > 0


def test_the_cap_is_the_one_the_measurements_chose() -> None:
    found = re.findall(r"^CAD worker cap: ([0-9]+) bytes$", _note(), flags=re.MULTILINE)
    assert len(found) == 1, "the note states the cap once, on its own line"
    assert int(found[0]) == settings.VEXTRUS_CAD_WORKER_MEMORY_BYTES


def test_the_cap_leaves_room_above_every_measured_peak() -> None:
    pattern = r"^Peak address space: ([0-9]+) bytes"
    peaks = [int(p) for p in re.findall(pattern, _note(), flags=re.MULTILINE)]
    assert len(peaks) >= 11, "one peak per Development Set file (Edison 7, the Sample Project 4)"
    assert int(max(peaks) * 1.25) <= settings.VEXTRUS_CAD_WORKER_MEMORY_BYTES
