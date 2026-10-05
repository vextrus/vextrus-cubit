"""Ticket T-249 (PR A), A4 cases 7 and 8: the proxy's snapshot (section 3, A4; the rewrite in git of
session 12's throwaway `proxy_snap.py`):

    python -m tools.proxy.snap --set <folder> --out <views.json> [--cache DIR] [--workers 2]

DWGs only (a PDF is skipped and said so); per file its sha256, per Sheet its `number`, `title`,
`location {layout, box}` (and `paper` where the finder gives it), per View its `kind`, `box` and
`title`, boxes as the export writes them; and only the read, the sheet finder and the view finder
are called: no Plot, render, database or Jev.

The finders are stand-ins a test gives (`snapshot(path, cache, *, read, find_sheets, find_views)`);
the CLI is driven with `snapshot` itself replaced by a recorder, with one worker (in this process),
so nothing reads a DWG.
"""

import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from engine.recognise.types import (
    Box,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from engine.render import buffers

from .seams import cache, snap

ROOT = Path(__file__).resolve().parents[5]
ARTEFACT = ("an invented artefact", 7)
SHEETS = [
    SheetCandidate(
        location=SheetLocation(layout="Made-up tab"),
        number=Sourced("QV-101", ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced("Made-up slab sheet", ValueSource.TITLE_BLOCK_ATTRIBUTE),
    ),
    SheetCandidate(
        location=SheetLocation(box=Box(1000.25, 0.0, 1841.125, 594.0)),
        title=Sourced("Made-up untitled frame", ValueSource.TITLE_BLOCK_TEXT),
    ),
]
VIEWS = {
    0: [
        ViewCandidate(box=Box(12.5, 40.0, 300.125, 280.0), kind=ViewKind.PLAN, title="Made-up plan"),
        ViewCandidate(box=Box(320.0, 40.0, 500.0, 200.0), kind=ViewKind.SECTION),
    ],
    1: [ViewCandidate(box=Box(1.0, 2.0, 3.5, 4.75), kind=ViewKind.DETAIL, title="Made-up knot")],
}


def value(found: Any) -> Any:
    """A Sheet field as the snapshot gives it: the value, whether sourced (`{value, source}`) or not."""
    return found.get("value") if isinstance(found, dict) else found


class Calls:
    def __init__(self) -> None:
        self.made: list[str] = []

    def read(self, path: Path) -> tuple[str, int]:
        self.made.append("read")
        return ARTEFACT

    def find_sheets(self, *args: Any, **kwargs: Any) -> list[SheetCandidate]:
        self.made.append("find_sheets")
        assert tuple(args[0]) == ARTEFACT
        return list(SHEETS)

    def find_views(self, *args: Any, **kwargs: Any) -> list[ViewCandidate]:
        self.made.append("find_views")
        assert tuple(args[0]) == ARTEFACT
        return list(VIEWS[SHEETS.index(args[1])])


def test_the_snapshot_holds_each_sheets_and_views_fields_as_the_export_writes_them(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def never(*args: Any, **kwargs: Any) -> Any:
        pytest.fail("the snapshot renders nothing")

    monkeypatch.setattr(buffers, "build", never)
    drawing = tmp_path / "qv-invented.dwg"
    drawing.write_bytes(b"AC1032 invented bytes for the snapshot")
    calls = Calls()

    found = snap().snapshot(
        drawing,
        cache().DecodeCache(tmp_path / "cache", "ef" * 32),
        read=calls.read,
        find_sheets=calls.find_sheets,
        find_views=calls.find_views,
    )

    assert found["sha256"] == hashlib.sha256(drawing.read_bytes()).hexdigest()
    first, second = found["sheets"]
    assert value(first["number"]) == "QV-101"
    assert value(first["title"]) == "Made-up slab sheet"
    assert first["location"] == {"layout": "Made-up tab", "box": None}
    assert value(second.get("number")) is None
    assert second["location"] == {"layout": None, "box": [1000.25, 0.0, 1841.125, 594.0]}
    assert [(v["kind"], v["box"], v["title"]) for v in first["views"]] == [
        ("plan", [12.5, 40.0, 300.125, 280.0], "Made-up plan"),
        ("section", [320.0, 40.0, 500.0, 200.0], None),
    ]
    assert [(v["kind"], v["box"], v["title"]) for v in second["views"]] == [
        ("detail", [1.0, 2.0, 3.5, 4.75], "Made-up knot")
    ]
    assert sorted(calls.made) == ["find_sheets", "find_views", "find_views", "read"]
    json.dumps(found, allow_nan=False)  # plain JSON, as the export


SUBPROCESS = """
import json, sys
from pathlib import Path
from engine.recognise.types import Box, SheetCandidate, SheetLocation, ViewCandidate, ViewKind
from tools.proxy.cache import DecodeCache
from tools.proxy.snap import snapshot

folder = Path(sys.argv[1])
drawing = folder / "qv-alone.dwg"
drawing.write_bytes(b"AC1032 invented bytes, alone")
sheet = SheetCandidate(location=SheetLocation(layout="Made-up tab"))
snapshot(
    drawing,
    DecodeCache(folder / "cache", "12" * 32),
    read=lambda path: ("an invented artefact",),
    find_sheets=lambda *args, **kwargs: [sheet],
    find_views=lambda *args, **kwargs: [ViewCandidate(box=Box(0, 0, 1, 1), kind=ViewKind.PLAN)],
)
loaded = sorted(
    name for name in sys.modules
    if name.split(".")[0] in {"django", "vextrus", "httpx", "psycopg", "procrastinate"}
    or name.startswith("engine.plot")
)
print(json.dumps(loaded))
"""


def test_the_snapshot_loads_no_database_jev_or_plot(tmp_path: Path) -> None:
    done = subprocess.run(
        [sys.executable, "-c", SUBPROCESS, str(tmp_path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={"PATH": "/usr/bin:/bin", "PYTHONPATH": str(ROOT)},
    )

    assert done.returncode == 0, done.stderr
    assert json.loads(done.stdout.strip().splitlines()[-1]) == []


def test_the_cli_snapshots_only_the_sets_dwgs_and_says_it_skipped_the_pdf(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    folder = tmp_path / "invented-set"
    folder.mkdir()
    for name in ("qv-one.dwg", "qv-two.dwg"):
        (folder / name).write_bytes(b"AC1032 invented bytes " + name.encode())
    (folder / "qv-plot.pdf").write_bytes(b"%PDF-1.7\ninvented\n%%EOF\n")
    seen: list[str] = []
    module = snap()

    def recorded(path: Path, decoded: Any, **finders: Any) -> dict[str, Any]:
        seen.append(Path(path).name)
        assert {"read", "find_sheets", "find_views"} <= set(finders)
        return {"sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(), "sheets": []}

    monkeypatch.setattr(module, "snapshot", recorded)
    out = tmp_path / "views.json"

    code = module.main(
        [
            "--set",
            str(folder),
            "--out",
            str(out),
            "--cache",
            str(tmp_path / "cache"),
            "--workers",
            "1",
        ]
    )

    captured = capfd.readouterr()
    said = captured.out + captured.err
    assert code == 0, said
    assert sorted(seen) == ["qv-one.dwg", "qv-two.dwg"]
    assert "skip" in said.casefold() or "qv-plot.pdf" in said, said
    assert isinstance(json.loads(out.read_text()), dict | list)
