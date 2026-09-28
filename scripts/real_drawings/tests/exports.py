"""Invented exports in the engine's export shape (06b's `engine/export.schema.json`; a copy is in
fixtures/), for the diff's fine-grained tests: made-up sheets, never anything from a real Drawing Set.
test_diff checks that every document built here conforms to that schema. The harness's own exports
are in fixtures/ too."""

from typing import Any

JSON = dict[str, Any]

SHA_A = "a" * 64
SHA_B = "b" * 64
SHA_PDF = "c" * 64


def export(*files: JSON, **lists: list[JSON]) -> JSON:
    return {
        "version": 1,
        "run": {
            "id": "invented",
            "commit": None,
            "code_hash": None,
            "started_at": "2026-01-01T00:00:00Z",
            "seconds": 1.0,
        },
        "stages": {},
        "files": list(files),
        "set_stages": {},
        "plot": lists.get("plot", []),
        "conflicts": lists.get("conflicts", []),
        "continuations": lists.get("continuations", []),
        "checks": lists.get("checks", []),
    }


def dwg(sha: str = SHA_A, *sheets: JSON, **values: Any) -> JSON:
    return {
        "path": f"invented-{sha[:4]}.dwg",
        "name": f"invented-{sha[:4]}.dwg",
        "sha256": sha,
        "format": "dwg",
        "read_format": None,
        "discipline_default": None,
        "group": "building-1",
        "conventions_applied": None,
        "process": process(1.5, 1000),
        "stages": {},
        "decoders_agree": True,
        "entity_counts": {"LINE": 10, "MTEXT": 4},
        "font_report": {"missing": 0},
        "pdf_report": None,
        "bangla_ansi": {"texts": 0},
        "pages": None,
        "sheets": list(sheets),
    } | values


def pdf(sha: str = SHA_PDF, pages: int = 4) -> JSON:
    return dwg(
        sha,
        path=f"invented-{sha[:4]}.pdf",
        name=f"invented-{sha[:4]}.pdf",
        format="pdf",
        decoders_agree=None,
        entity_counts=None,
        font_report=None,
        pdf_report={"pages": pages},
        bangla_ansi=None,
        pages=pages,
    )


def process(seconds: float, peak_rss_kib: int) -> JSON:
    return {
        "status": "ok",
        "exit_code": 0,
        "signal": None,
        "seconds": seconds,
        "cpu_seconds": seconds,
        "peak_rss_kib": peak_rss_kib,
        "left_behind": 0,
        "left_running": False,
        "log_tail": None,
    }


def sourced(value: str, source: str = "title_block_text") -> JSON:
    return {"value": value, "source": source}


def sheet(layout: str | None = None, box: list[float] | None = None, **values: Any) -> JSON:
    return {
        "location": {"layout": layout, "box": box},
        "number": sourced("X-101"),
        "title": sourced("Invented floor plan", "title_block_attribute"),
        "discipline": sourced("structural", "file"),
        "revision_mark": sourced("R0", "file_name"),
        "issue_date": sourced("2026-01-01"),
        "storeys_as_stated": sourced("ground floor"),
        "exclusion": None,
        "group": "building-1",
        "anchors": [],
        "views": [],
        "register": [],
        "render_f1": None,
    } | values


def view(box: list[float], **values: Any) -> JSON:
    return {
        "box": box,
        "kind": "plan",
        "title": "Invented view",
        "not_to_scale": False,
        "stated_scale": "1:100",
        "storeys_as_stated": "ground floor",
        "storeys": ["ground"],
        "storeys_meaning": "at_floor_level",
        "subject": "slab",
        "layer": "top",
        "steps": ["slabs"],
        "part": None,
        "exclusion": None,
        "coverage": "assigned",
        "anchors": [],
    } | values


def row(box: list[float], **values: Any) -> JSON:
    return {
        "row_box": box,
        "number": "X-101",
        "title": "Invented floor plan",
        "revision_mark": "R0",
        "anchors": [],
    } | values


def ref(file: int, sheet: int, **inner: int) -> JSON:
    """A position: `{file, sheet}`, with `view` or `register` for what sits in the sheet."""
    return {"file": file, "sheet": sheet, **inner}


def page(file: int, number: int) -> JSON:
    return {"file": file, "page": number}


def match(on: JSON, to: JSON | None, **values: Any) -> JSON:
    return {
        "page": on,
        "sheet": to,
        "reason": None if to else "no_sheet_matched",
        "residual": 0.4 if to else None,
        "transform": None,
    } | values


def check(
    code: str,
    subject: JSON | None,
    outcome: str = "passed",
    finding: str | None = None,
    params: dict[str, str | int] | None = None,
) -> JSON:
    found = {"code": finding, "params": params or {}} if finding else None
    return {"code": code, "outcome": outcome, "subject": subject, "finding": found}
