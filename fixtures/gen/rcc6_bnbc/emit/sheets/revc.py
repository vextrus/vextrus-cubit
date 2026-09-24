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

At R0-G0 the revision drew nothing and corrected nothing: the append pass and the pins alone, proved
by the corpus regenerating byte for byte. R0-G1 corrects in place (W-20..W-40, the register below)
and still appends nothing: what Rev C draws first is fenced here and drawn by a later step.
"""

from __future__ import annotations

from ..scene import APPENDED, Scene, Sheet, View
from .common import Ctx, centred_origin, frame_view

#: Members the model builds that Rev B never drew: each is drawn by this pass alone, and the `Ctx`
#: every Rev B composer reads leaves it out (`common.Ctx(fence=...)`).
DRAWN_IN_C: frozenset[str] = frozenset({
    # K6: LB1 is filed at the layout that draws it, so the stair's sixth-storey landing beam now
    # stands at ROOF, where Rev B's roof layout (S-15) never drew one — the seventh LB1 is Rev C's
    "LB1@6F",
    # K22: the pit's front wall at FDN, which no Rev B view draws (Rev C draws it on S-07 and S-23)
    "SW1-C@FDN",
})


def _register(by_correction: dict[str, str]) -> dict[str, str]:
    """handle → correction, from each correction's handles; a handle two corrections claim is refused."""
    register: dict[str, str] = {}
    for correction, handles in by_correction.items():
        for handle in handles.split():
            assert handle not in register, f"{handle} is registered to {register[handle]} and {correction}"
            register[handle] = correction
    return register


#: The Rev B records a correction rewrites in place, per file: handle → the correction's id (K1,
#: D-EGL, ...). "paper" is `rcc6-bnbc.dxf` and its R2000 twin `rcc6-bnbc.libredwg-r2000.dxf` (the
#: paper set re-saved, W-07); "frames" is `rcc6-bnbc.model.dxf`. A correction to a view's entity
#: registers its paper handle and its frames handle both. Every entry below was read record by record
#: against its Rev B body (R0-G1): same type, same layer, a new body for the named reason only.
#:
#: - K20 (W-32): S-22's two stair plans — the flight outlines, their riser lines and the flight marks
#:   placed off them — at the figured flight width 1079.5 (Rev B's model drew 1066.8);
#:   D-WELL: S-22's "WELL 279  LANDING 1219" (was WELL 304; 2 x 1079.5 + 279.4 closes the C-D bay).
#: - K23 (W-35): S-21's parapet detail at the figured 1067 (was 1066.8): the wall outline, the bar,
#:   the two bar notes placed off the height, and the height DIMENSION with its six block records
#:   (the printed "1067" does not change).
#: - D-S26 (W-27, K11): S-26's PC3 rows cut at the drawn 2" cap cover (the dims, cut lengths and
#:   masses), and the printed grand total T-BBS-TOTAL re-seeded from the new row sum.
#: - D-EGL (W-20): S-25's ground line, its E.G.L label and the two cut arrows, moved to −457.2.
#: - D-CORE (W-36): the two core rings, redrawn as legs 3 and 4 on the seven plans (S-13, S-14, S-15
#:   twice, S-19, S-20, S-21) and on S-23's core plan, whose HATCH fills the three legs.
#: - D-SW (W-37): S-23's band note, at the 3F storey the model changes thickness at.
#: - D-PIT (W-30): S-23's pit section — the base below the pit floor, the two marks naming PC5 — and
#:   its caption on the sheet.
#: - D-TANK (W-38): S-24's three tank sections, walls outside the clear span (four outlines each).
#: - D-CRANK (W-39): S-03's crank polyline and note, at 45 degrees.
#: - D-BLIND (W-40): S-08's four blinding LINEs onto the slab on grade's square edges, and their note.
CORRECTED: dict[str, dict[str, str]] = {
    "paper": _register({
        "K20": (
            "1C3F 1C40 1C41 1C42 1C43 1C44 1C45 1C46 1C47 1C48 1C4A 1C4B 1C4C 1C4D 1C4E 1C4F 1C50 "
            "1C51 1C52 1C53 1C54 1C68 1C69 1C6A 1C6B 1C6C 1C6D 1C6E 1C6F 1C70 1C72 1C73 1C74 1C75 "
            "1C76 1C77 1C78 1C79 1C7A 1C7B"
        ),
        "D-WELL": "1C9D",
        "K23": "1C29 1C2B 1C2C 1C2D 1C2E 1C33 1C36 1C38 1C39 1C3A 1C3D",
        "D-S26": (
            "1DC1 1DC2 1DC3 1DC4 1DC9 1DCA 1DCB 1DCC 1DD1 1DD2 1DD4 1DD9 1DDA 1DDC 1DE1 1DE2 1DE4 "
            "1E40"
        ),
        "D-EGL": "1D8F 1D91 1D94 1D95",
        "D-CORE": "D3A D3B EF6 EF7 108D 108E 10C2 10C3 1976 1977 1AB7 1AB8 1BE4 1BE5 1CAD 1CAE 1CAF",
        "D-SW": "1CB2",
        "D-PIT": "1CC6 1CC7 1CC8 2248",
        "D-TANK": "1CDD 1CDE 1CDF 1CE0 1CF6 1CF7 1CF8 1CF9 1D11 1D12 1D13 1D14",
        "D-CRANK": "179 17B",
        "D-BLIND": "824 825 826 827 828",
    }),
    "frames": _register({
        "K20": (
            "1F8E 1F8F 1F90 1F91 1F92 1F93 1F94 1F95 1F96 1F97 1F99 1F9A 1F9B 1F9C 1F9D 1F9E 1F9F "
            "1FA0 1FA1 1FA2 1FA3 1FB7 1FB8 1FB9 1FBA 1FBB 1FBC 1FBD 1FBE 1FBF 1FC1 1FC2 1FC3 1FC4 "
            "1FC5 1FC6 1FC7 1FC8 1FC9 1FCA"
        ),
        "D-WELL": "1FEC",
        "K23": "1F61 1F63 1F64 1F65 1F66 1F6B 1F6E 1F70 1F71 1F72 1F75",
        "D-S26": (
            "2168 2169 216A 216B 2170 2171 2172 2173 2178 2179 217B 2180 2181 2183 2188 2189 218B "
            "21E7"
        ),
        "D-EGL": "2121 2123 2126 2127",
        "D-CORE": "FAE FAF 1184 1185 1336 1337 136B 136C 1C79 1C7A 1DD4 1DD5 1F1C 1F1D 2012 2013 2014",
        "D-SW": "2017",
        "D-PIT": "200E 202B 202C 202D",
        "D-TANK": "2059 205A 205B 205C 2072 2073 2074 2075 208D 208E 208F 2090",
        "D-CRANK": "2F0 2F2",
        "D-BLIND": "A1C A1D A1E A1F A20",
    }),
}


def apply(ctx: Ctx, sheets: list[Sheet]) -> list[Sheet]:
    """Everything Rev C draws, appended to the composed Rev B sheets (`ctx` is unfenced): each area's
    own module draws on the sheets it owns (R0-G2, the design's section 6), in the sheets' order."""
    from . import revc_details, revc_found, revc_frame, revc_slabs

    by = {sheet.number: sheet for sheet in sheets}
    for area in (revc_details.front, revc_found.draw, revc_frame.draw, revc_slabs.draw, revc_details.draw):
        area(ctx, by)
    return sheets


def view_of(sheet: Sheet, title: str) -> View:
    """The one view of a sheet with this title — Rev B's or Rev C's."""
    found = [view for view in sheet.views if view.title == title]
    assert len(found) == 1, (sheet.number, title, [view.title for view in sheet.views])
    return found[0]


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
    origin: tuple[float, float] | None = None,
) -> View:
    """A view Rev C draws first: framed on its own scene's extents (it has no Rev B window to keep),
    captioned the way every view is, on its own model square after Rev B's, with its own VIEWPORT
    in the sheet's layout. `origin` frames a scene of left-set text, whose extents are its anchors
    alone, from its own left edge instead (the scene point at the window's lower-left)."""
    with sheet.paper.revision(APPENDED):
        framed = origin if origin is not None else centred_origin(scene, scale, size)
        return frame_view(sheet.paper, sheet.views, title, scene, scale, at, size, framed, unit, caption,
                          rev=APPENDED)

