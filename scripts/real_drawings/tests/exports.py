"""Invented exports for the check's tests: made-up sheets, never anything from a real Drawing Set."""

from typing import Any

JSON = dict[str, Any]

SHA_A = "a" * 64
SHA_B = "b" * 64
SHA_PDF = "c" * 64


def export(*files: JSON, **lists: list[JSON]) -> JSON:
    return {
        "run_id": "invented",
        "commit": "0" * 40,
        "code_hash": "1" * 64,
        "files": list(files),
        "checks": lists.get("checks", []),
        "conflicts": lists.get("conflicts", []),
        "continuations": lists.get("continuations", []),
    }


def dwg(sha: str = SHA_A, *sheets: JSON, **values: Any) -> JSON:
    return {
        "sha256": sha,
        "name": "invented.dwg",
        "format": "dwg",
        "decoders_agree": True,
        "entity_counts": {"LINE": 10, "MTEXT": 4},
        "read_seconds": 1.5,
        "peak_rss": 1_000_000,
        "font_report": {"missing": 0},
        "pdf_report": {},
        "bangla_ansi": 0,
        "sheets": list(sheets),
        "plot_matches": [],
    } | values


def pdf(sha: str = SHA_PDF, *matches: JSON) -> JSON:
    return dwg(sha, format="pdf", name="invented.pdf", plot_matches=list(matches))


def sheet(id: str, layout: str | None = None, box: list[float] | None = None, **values: Any) -> JSON:
    return {
        "id": id,
        "layout": layout,
        "frame_box": box,
        "number": "X-101",
        "title": "Invented floor plan",
        "discipline": "structural",
        "revision_mark": "R0",
        "revision_mark_source": "title_block",
        "issue_date": "2026-01-01",
        "storeys": ["ground"],
        "storeys_meaning": "explicit",
        "render_f1": None,
        "views": [],
        "register": [],
    } | values


def view(id: str, box: list[float], **values: Any) -> JSON:
    return {
        "id": id,
        "box": box,
        "title": "Invented view",
        "kind": "plan",
        "not_to_scale": False,
        "stated_scale": "1:100",
        "storeys": ["ground"],
        "storeys_meaning": "explicit",
        "subject": "slab",
        "layer": "top",
        "proposed_steps": ["slabs"],
        "part": None,
        "exclusion_reason": None,
        "coverage": "assigned",
    } | values


def row(box: list[float], **values: Any) -> JSON:
    return {
        "row_box": box,
        "number": "X-101",
        "title": "Invented floor plan",
        "revision_mark": "R0",
    } | values
