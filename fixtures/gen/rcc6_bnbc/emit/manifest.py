"""The manifest — what was written, by what, and under which budget (E-fixture §3.9).

`compose()` returns the document `fixtures/rcc6-bnbc/manifest.json` carries. It pins two things a
reader cannot recover from the bytes alone: the sha256 of every file in the corpus, and the sha256
of every module of the generator that minted it, so a corpus that drifted from its generator is a
test failure rather than a surprise. Everything else here is a record of what the emitters chose —
the sheet roster with its paper sizes and scales, the dpi and quality each raster variant actually
used, what each PDF variant and the DWG lost, and the report every validate check handed back.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from . import plan
from .scene import PAPER_MM, Sheet

#: The generator's own files, as the manifest names them (relative to the package).
MODULE_SUFFIXES = (".py", ".json")
SKIP_DIRECTORIES = ("__pycache__",)


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def module_hashes(package_root: Path) -> dict[str, str]:
    """Every .py and .json under the generator, by path relative to it, sorted."""
    out: dict[str, str] = {}
    for path in sorted(package_root.rglob("*")):
        if not path.is_file() or path.suffix not in MODULE_SUFFIXES:
            continue
        if any(part in SKIP_DIRECTORIES for part in path.relative_to(package_root).parts):
            continue
        out[path.relative_to(package_root).as_posix()] = sha256(path.read_bytes())
    return out


def output_hashes(written: dict[str, bytes]) -> dict[str, str]:
    return {name: sha256(written[name]) for name in sorted(written)}


def sheet_rows(sheets: list[Sheet]) -> list[dict[str, Any]]:
    """The roster a reader needs to find a sheet: its paper, its layout and its views' scales."""
    rows = []
    for sheet in sheets:
        width, height = PAPER_MM[sheet.size]
        rows.append(
            {
                "number": sheet.number,
                "title": sheet.title,
                "size": sheet.size,
                "page_mm": [width, height],
                "scales": sheet.scales,
                "layout_name": sheet.layout_name,
                "revision": sheet.revision,
                "traps": plan.traps_on(sheet.number),
                "views": [{"title": view.title, "scale": view.scale, "unit": view.unit} for view in sheet.views],
            }
        )
    return rows


def size_budget(written: dict[str, bytes]) -> dict[str, Any]:
    """The W-02 caps and what this corpus actually spends against them."""
    budget = dict(plan.RASTER["budget_mb"])
    mb = 1024 * 1024
    total = sum(len(payload) for payload in written.values())
    rasters = sum(len(payload) for name, payload in written.items() if name.startswith("raster/"))
    largest = max(((len(payload), name) for name, payload in written.items()), default=(0, ""))
    return {
        "caps_mb": budget,
        "corpus_mb": round(total / mb, 3),
        "rasters_mb": round(rasters / mb, 3),
        "largest_file": {"name": largest[1], "mb": round(largest[0] / mb, 3)},
        "files": len(written),
        "test": "cad/tests/rcc6_bnbc/test_rcc6_bnbc_size.py",
    }


def compose(
    *,
    package_root: Path,
    conventions: Any,
    sheets: list[Sheet],
    written: dict[str, bytes],
    selfcheck_report: dict[str, Any],
    validate_report: dict[str, Any],
    pdf_reports: dict[str, dict[str, Any]],
    dwg_report: dict[str, Any],
    raster_report: dict[str, Any],
    wave: str,
) -> dict[str, Any]:
    """The whole manifest document, in the order a reader reads it."""
    return {
        "fixture": plan.FIXTURE,
        "schema": 2,
        "generator": {
            "path": "fixtures/gen/rcc6_bnbc/",
            "modules": module_hashes(package_root),
        },
        "conventions": conventions,
        "identity": dict(plan.IDENTITY),
        "sheets": sheet_rows(sheets),
        "pdf": {
            name: {**report, "losses": report.get("losses", [])} for name, report in sorted(pdf_reports.items())
        },
        "dwg": dwg_report,
        "raster": raster_report,
        "outputs": output_hashes(written),
        "selfcheck": selfcheck_report,
        "validate": validate_report,
        "regenerable": {
            "model.json": "a plain-data dump of model.build() for readers without Python; "
            "`python -m fixtures.gen.rcc6_bnbc` rewrites it byte for byte (not a source)",
            "rcc6-bnbc.dwg": "minted by LibreDWG, which is not byte-stable; judged by its census, "
            "never by its bytes (W-04)",
            "rcc6-bnbc.model.dwg": "the same",
        },
        "size_budget": size_budget(written),
        "wave": wave,
    }
