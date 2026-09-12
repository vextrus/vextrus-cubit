"""Check 5b — every view fits its window: the scene's bbox, scaled by 1/scale and anchored at
`world_origin`, lies inside `paper_size` (a 2 mm paper tolerance for text overhang). A strip that
runs off the window is a printed value nobody can read — a silent under on paper."""

from __future__ import annotations

from typing import Any

TOL_MM = 2.0


def overflow(view: Any) -> tuple[float, float, float, float] | None:
    x0, y0, x1, y1 = view.scene.bbox()
    ox, oy = view.world_origin
    k = 1.0 / view.scale
    left, bottom = (x0 - ox) * k, (y0 - oy) * k
    right, top = (x1 - ox) * k, (y1 - oy) * k
    w, h = view.paper_size
    over = (
        max(0.0, -left - TOL_MM),
        max(0.0, -bottom - TOL_MM),
        max(0.0, right - w - TOL_MM),
        max(0.0, top - h - TOL_MM),
    )
    return over if any(over) else None


def check(sheets: list[Any]) -> dict[str, Any]:
    bad = []
    for sheet in sheets:
        for view in sheet.views:
            o = overflow(view)
            if o:
                bad.append((sheet.number, view.title, view.scale, tuple(round(v, 1) for v in o)))
        # paper items inside the paper
        w, h = __import__("fixtures.gen.rcc6_bnbc.emit.scene", fromlist=["PAPER_MM"]).PAPER_MM[sheet.size]
        x0, y0, x1, y1 = sheet.paper.bbox()
        if x0 < -TOL_MM or y0 < -TOL_MM or x1 > w + TOL_MM or y1 > h + TOL_MM:
            bad.append((sheet.number, "paper", (round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1))))
    assert not bad, f"check 5b (view fits its window; mm over left/bottom/right/top): {bad}"
    return {"views": sum(len(s.views) for s in sheets)}
