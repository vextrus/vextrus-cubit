"""Rev C of F-RCC6-BNBC (R0, "Regenerate and draw all"): what the revision draws that Rev B did not,
and the register of the Rev B records it corrects in place (W-19, W-19a).

The set was issued as Rev B, and the product keys on Rev B's handles (the trap registry, the notation
corpus, the model recordings, the journeys). Handles are minted in creation order, so Rev C is drawn
without moving one:

- **Rev B is composed exactly as issued.** Every other composer in this package draws Rev B: each
  view on the window Rev B issued it in (`revb_windows.json`, `Paper.view`), from a `Ctx` that never
  shows it a member Rev C draws first (`DRAWN_IN_C`, the fence).
- **This pass appends, after every Rev B sheet is composed** (`apply`). Items on a Rev B scene are
  drawn inside `scene.revision(APPENDED)`; a new view is `add_view`'s, framed on its own scene. It
  never calls a Rev B composer. The DXF writers create everything it appends after every Rev B
  record (`emit/dxf.py`).
- **A value correction is made in place,** by the composer that draws the entity: the same type,
  the same layer, the same position in its scene — so the same handle, with a new body. Each
  corrected handle is registered in `CORRECTED`, per file, with the id of the correction that moves
  it, and `validate/revision.py` holds the changed set to the register both ways. A VIEWPORT is never
  corrected (the windows are pinned), nor is a table or a dictionary.

At R0-G0 the revision draws nothing and corrects nothing: the append pass and the pins alone, proved
by the corpus regenerating byte for byte.
"""

from __future__ import annotations

from ..scene import APPENDED, Scene, Sheet, View
from .common import Ctx, centred_origin, frame_view

#: Members the model builds that Rev B never drew: each is drawn by this pass alone, and the `Ctx`
#: every Rev B composer reads leaves it out (`common.Ctx(fence=...)`).
DRAWN_IN_C: frozenset[str] = frozenset()

#: The Rev B records a correction rewrites in place, per file: handle → the correction's id (K1,
#: D-EGL, ...). "paper" is `rcc6-bnbc.dxf` and its R2000 twin `rcc6-bnbc.libredwg-r2000.dxf` (the
#: paper set re-saved, W-07); "frames" is `rcc6-bnbc.model.dxf`. A correction to a view's entity
#: registers its paper handle and its frames handle both.
CORRECTED: dict[str, dict[str, str]] = {"paper": {}, "frames": {}}


def apply(ctx: Ctx, sheets: list[Sheet]) -> list[Sheet]:
    """Everything Rev C draws, appended to the composed Rev B sheets (`ctx` is unfenced)."""
    del ctx
    return sheets


def add_view(
    sheet: Sheet,
    title: str,
    scene: Scene,
    scale: int,
    at: tuple[float, float],
    size: tuple[float, float],
    *,
    unit: str = "mm",
    caption: str | None = None,
) -> View:
    """A view Rev C draws first: framed on its own scene's extents (it has no Rev B window to keep),
    captioned the way every view is, on its own model square after Rev B's, with its own VIEWPORT
    in the sheet's layout."""
    with sheet.paper.revision(APPENDED):
        return frame_view(sheet.paper, sheet.views, title, scene, scale, at, size,
                          centred_origin(scene, scale, size), unit, caption, rev=APPENDED)

