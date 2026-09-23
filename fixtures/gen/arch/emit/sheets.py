"""The four tranche-1 sheets of F-ARCH, composed once as scenes (A-02, A-04, A-20).

  A-01  GROUND FLOOR PLAN, with its door & window schedule beside it
  A-02  TYPICAL FLOOR PLAN (1ST TO 6TH), with its door & window schedule (quantity per floor)
  A-03  ROOM FINISH SCHEDULE, FLOOR TILE LEGEND & WALL TYPES
  A-04  SECTION A-A (the level stack and the clear heights)

Every plan is painted from the authored model: the wall faces are the boundaries path 2's planar
faces find (so the drawing and the golden stand on one geometry), cut at every opening and stopped
at every column; columns and the lift core are drawn as their own hatched outlines; the rooms are
implied by the walls, never drawn as polylines (a rug is the one closed outline in a room). Every
printed number comes out of the model; the registered traps are drawn where traps.json says.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any

from .. import golden_check as G
from .. import model as M
from .blocks import Scene, door_name, f

D = Decimal
HERE = Path(__file__).resolve().parents[1]
PAPER_MM = {"A1": (841.0, 594.0), "A2": (594.0, 420.0)}
BORDER = 10.0
STRIP = 70.0

IDENTITY = {
    "firm": "ANKUR ARCHITECTS & PLANNERS",
    "firm_address": "HOUSE 12, ROAD 3, BLOCK B, BANANI, DHAKA-1213",
    "client": "M/S. PADMA HOMES LTD.",
    "project": "PROPOSED G+6 STORIED RESIDENTIAL BUILDING",
    "site": "PLOT 23, ROAD 7, BLOCK C, BASHUNDHARA R/A, DHAKA",
    "date": "22 SEP 2026",
    "drawn": "R.K.",
    "checked": "S.A.",
    "job": "AAP-2026-117",
}

#: The office's layers (A-20: many, some misspelt or duplicated — readers must not key on names).
LAYERS = {
    "A-WALL": 7, "WALL 10in": 7, "wall-5": 7, "A-LOW-WALL": 8, "A-COLS": 1, "A-COLS-HATCH": 1, "A-RCC": 9,
    "A-RCC-HATCH": 9, "A-DOOR": 3, "A-GLAZ": 4, "A-TAG": 2, "A-GRID": 8, "A-GRID-TEXT": 2, "DIMENSION": 3,
    "DIMENSON": 3, "A-ROOM-NAME": 2, "A-ANNO-NOTE": 7, "A-FURN": 6, "A-STAIR": 5, "A-HIDDEN": 8, "A-TITLE": 7,
    "A-SCHED": 7, "A-SCHED-TEXT": 2, "A-SECT": 7, "A-LEVEL": 2, "SK": 7,
}


@dataclass
class View:
    caption: str
    scene: Scene
    scale: int
    at: tuple[float, float]
    size: tuple[float, float]
    expect: str
    model_offset: tuple[float, float] = (0.0, 0.0)
    origin: tuple[float, float] = (0.0, 0.0)


@dataclass
class Sheet:
    number: str
    title: str
    size: str
    paper: Scene
    views: list[View] = field(default_factory=list)
    traps: list[str] = field(default_factory=list)

    @property
    def layout_name(self) -> str:
        return f"{self.number} {self.title}".replace("&", "AND")


def traps() -> dict[str, dict[str, Any]]:
    return {t["id"]: t for t in json.loads((HERE / "traps.json").read_text(encoding="utf-8"))["traps"]}


def ftin(mm: Any) -> str:
    """Feet-inches to the nearest inch, as the architect writes a size (zero feet shown)."""
    inches = int((D(mm) / M.IN).quantize(D(1)))
    return f"{inches // 12}'-{inches % 12}\""


def level_text(mm: Any) -> str:
    v = D(mm)
    sign = "(+)" if v >= 0 else "(-)"
    return f"{sign}{ftin(abs(v))}"


# ---------------------------------------------------------------------------------------------
# The plan: wall faces from the planar faces, cut at openings, stopped at columns
# ---------------------------------------------------------------------------------------------


def wall_edges(lv: dict[str, Any]) -> list[tuple[Any, Any, str]]:
    """Every boundary between a free face (a room, a void or outside) and a wall band, tagged with
    the wall it belongs to. Core and low-wall boundaries are drawn as their own outlines."""
    polys, _ = G.solids(lv)
    owners = [w["id"] for w in lv["walls"]] + ["CORE"] * len(lv["core"]) + ["LOW"] * (len(polys) - len(lv["walls"])
                                                                                      - len(lv["core"]))
    out = []
    for cyc in G.faces(polys):
        if any(G.contains(s, G._inner_point(cyc)) for s in polys):
            continue  # a face inside the walls
        for i in range(len(cyc)):
            p, q = cyc[i], cyc[(i + 1) % len(cyc)]
            ll = G.dist(p, q)
            mid = ((p[0] + q[0]) / 2 + (q[1] - p[1]) / ll * G.NUDGE, (p[1] + q[1]) / 2 - (q[0] - p[0]) / ll * G.NUDGE)
            owner = next((owners[k] for k, s in enumerate(polys) if G.contains(s, mid)), None)
            if owner not in (None, "CORE", "LOW"):
                out.append((p, q, owner))
    return out


def _cut(p: Any, q: Any, cuts: list[tuple[Decimal, Decimal]]) -> list[tuple[Any, Any]]:
    """The pieces of p→q outside the parameter intervals `cuts` (0..1 along the segment)."""
    pieces = [(D(0), D(1))]
    for a, b in cuts:
        nxt = []
        for s, e in pieces:
            if b <= s or a >= e:
                nxt.append((s, e))
                continue
            if a > s:
                nxt.append((s, a))
            if b < e:
                nxt.append((b, e))
        pieces = nxt
    return [((p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s), (p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e))
            for s, e in pieces if e - s > D("1e-9")]


def _param(p: Any, q: Any, x: Any) -> Decimal:
    ll2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2
    return ((x[0] - p[0]) * (q[0] - p[0]) + (x[1] - p[1]) * (q[1] - p[1])) / ll2


def _column_cuts(p: Any, q: Any, cols: list[list[Any]]) -> list[tuple[Decimal, Decimal]]:
    out = []
    for poly in cols:
        ts = sorted({D(0), D(1), *[t for t in _crossings(p, q, poly)]})
        for a, b in zip(ts, ts[1:], strict=False):
            m = ((a + b) / 2)
            pt = (p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m)
            if G._convex_has(poly, pt):
                out.append((a, b))
    return out


def _crossings(p: Any, q: Any, poly: list[Any]) -> list[Decimal]:
    ts: set[Decimal] = set()
    for i in range(len(poly)):
        t1: set[Decimal] = set()
        G._meet((p, q), (poly[i], poly[(i + 1) % len(poly)]), t1, set())
        ts |= {t for t in t1 if 0 < t < 1}
    return sorted(ts)


def _axis(w: dict[str, Any]) -> tuple[tuple[Decimal, Decimal], tuple[Decimal, Decimal]]:
    (ux, uy), _ = G.unit(w)
    return (ux, uy), (-uy, ux)


def _at(w: dict[str, Any], s: Decimal, n: Decimal) -> tuple[Decimal, Decimal]:
    (ux, uy), (nx, ny) = _axis(w)
    return (w["a"][0] + ux * s + nx * n, w["a"][1] + uy * s + ny * n)


def _ang(w: dict[str, Any]) -> float:
    (ux, uy), _ = _axis(w)
    return math.degrees(math.atan2(float(uy), float(ux)))


def plan(world: dict[str, Any], level: str, sheet: str, tr: dict[str, dict[str, Any]]) -> Scene:
    lv = world["levels"][level]
    s = Scene()
    walls = {w["id"]: w for w in lv["walls"]}
    named = G.derive(level, lv, world)["named"]
    _grid(s, level)
    # the walls: face lines cut at the openings and stopped at the columns
    spans: dict[str, list[tuple[Decimal, Decimal]]] = {}
    for o in lv["openings"]:
        spans.setdefault(o["host"], []).append(G.span(walls[o["host"]], o))
    cols = [c["poly"] for c in lv["columns"]]
    edges = wall_edges(lv)
    first_on_1 = True
    for p, q, wid in edges:
        w = walls[wid]
        (ux, uy), _ = _axis(w)
        ll = G.dist(p, q)
        parallel = abs((q[0] - p[0]) / ll * uy - (q[1] - p[1]) / ll * ux) < D("1e-9")
        cuts = []
        if parallel:
            for s0, s1 in spans.get(wid, []):
                sp = (p[0] - w["a"][0]) * ux + (p[1] - w["a"][1]) * uy
                sq = (q[0] - w["a"][0]) * ux + (q[1] - w["a"][1]) * uy
                a, b = (s0 - sp) / (sq - sp), (s1 - sp) / (sq - sp)
                cuts.append((min(a, b), max(a, b)))
        cuts += _column_cuts(p, q, cols)
        layer = "WALL 10in" if w["type"] == "BW250" else "wall-5"
        if w["id"] in ("E", "CH", "1", "A", "6"):
            layer = "A-WALL"
        for a, b in _cut(p, q, cuts):
            if level == "GF" and wid == "gGn" and max(a[0], b[0]) > M.X6 - D(200):
                # T-UNCLOSED-WALL: the guard room's rear wall stops 60 mm short of its east wall
                x_stop = M.X6 - M.T125 / 2 - D(60)
                if min(a[0], b[0]) >= x_stop:
                    continue
                a, b = (min(a[0], b[0]), a[1]), (x_stop, b[1])
                s.line(a, b, layer, trap="T-UNCLOSED-WALL")
                continue
            s.line(a, b, layer)
            if wid == "1" and first_on_1 and level != "GF" and a[0] > 0:
                s.line(a, b, layer, trap="T-DOUBLE-LINE")  # the same face drawn twice, stacked
                first_on_1 = False
    # openings: jambs, glass, leaves, tags
    for o in lv["openings"]:
        _opening(s, lv, walls[o["host"]], o, named, tr)
    for ar in lv["archways"]:
        x = ar["at"]
        for dx in (-ar["t"] / 2, ar["t"] / 2):
            s.line((x + dx, ar["lo"]), (x + dx, ar["hi"]), "A-HIDDEN", linetype="DASHED",
                   trap="T-ARCHWAY" if dx < 0 and x == M.X2 else None)
    # columns and the core, hatched
    for i, c in enumerate(lv["columns"]):
        s.poly(c["poly"], "A-COLS", trap="T-COLUMN-HATCH" if i == 0 else None)
        s.hatch([c["poly"]], "A-COLS-HATCH")
    for c in lv["core"]:
        s.poly(c["poly"], "A-RCC", trap="T-CORE-RING-250" if c["id"].startswith("SW1-3") and level != "GF" else None)
        s.hatch([c["poly"]], "A-RCC-HATCH", solid=False, pattern="ANSI31", scale=20.0)
    _low_walls(s, lv)
    _rooms(s, lv, tr, level)
    _furniture(s, level)
    _stair_and_lift(s, lv)
    if level == "GF":
        _ramp(s)
        for lab in lv["open_labels"]:
            s.mtext(lab["text"], lab["at"], 220, "A-ROOM-NAME", family="room_label")
        s.text(f"PLINTH LEVEL {level_text(0)}", (M.X1, M.YA - D(2600)), 180, "A-LEVEL", family="level")
    else:
        s.text(f"LEVEL {level_text(M.S.ELEV['1F'])} TO {level_text(M.S.ELEV['6F'])}", (M.X1, M.YA - D(2600)), 180,
               "A-LEVEL", family="level")
    return s


def _grid(s: Scene, level: str) -> None:
    xs = [(k, M.S.X[k]) for k in M.S.XN]
    ys = [(k, M.S.Y[k]) for k in M.S.YL]
    x0, x1 = xs[0][1] - D(2400), xs[-1][1] + D(2400)
    y0, y1 = ys[0][1] - D(3600), ys[-1][1] + D(2400)
    for k, x in xs:
        s.line((x, y0), (x, y1), "A-GRID", linetype="CENTER")
        for yy in (y0 - D(400), y1 + D(400)):
            s.circle((x, yy), 400, "A-GRID")
            s.text(k, (x, yy), 350, "A-GRID-TEXT", align="MIDDLE_CENTER", family="grid")
    for k, y in ys:
        s.line((x0, y), (x1, y), "A-GRID", linetype="CENTER")
        for xx in (x0 - D(400), x1 + D(400)):
            s.circle((xx, y), 400, "A-GRID")
            s.text(k, (xx, y), 350, "A-GRID-TEXT", align="MIDDLE_CENTER", family="grid")
    top = y1 + D(1400)
    for (_, a), (_, b) in zip(xs, xs[1:], strict=False):
        s.dim((a, y1), (b, y1), (a, top), 0.0, ftin(b - a), 220.0, "DIMENSION", family="dimension")
    left = x0 - D(1400)
    for (_, a), (_, b) in zip(ys, ys[1:], strict=False):
        s.dim((x0, a), (x0, b), (left, a), 90.0, ftin(b - a), 220.0, "DIMENSON", family="dimension")


def _opening(s: Scene, lv: dict[str, Any], w: dict[str, Any], o: dict[str, Any], named: dict[str, Any],
             tr: dict[str, dict[str, Any]]) -> None:
    s0, s1 = G.span(w, o)
    h = w["t"] / 2
    for sj in (s0, s1):
        s.line(_at(w, sj, -h), _at(w, sj, h), "A-DOOR" if o["sill"] == 0 else "A-GLAZ")
    side = _side(lv, w, o, named)
    mark = o["mark"]
    if mark in ("W1", "W2", "V1", "V2"):
        offs = (-h / 3, D(0), h / 3) if mark in ("W1", "W2") else (-h / 3, h / 3)
        for n in offs:
            s.line(_at(w, s0, n), _at(w, s1, n), "A-GLAZ")
    elif o["leaf"] == "SLIDING":
        half = (s1 - s0) * D("0.55")
        s.line(_at(w, s0, -h / 4), _at(w, s0 + half, -h / 4), "A-DOOR")
        s.line(_at(w, s1 - half, h / 4), _at(w, s1, h / 4), "A-DOOR")
    else:
        east = o["hand"] == "R"
        hinge_s = s1 if east else s0
        hinge = _at(w, hinge_s, h * side)
        if o["id"] == "D2-9":
            # T-EXPLODED-DOOR: the study door drawn as its leaf and swing, no block
            (ux, uy), (nx, ny) = _axis(w)
            dirx = -1 if east else 1
            leaf_end = (hinge[0] + nx * side * o["w"], hinge[1] + ny * side * o["w"])
            s.line(hinge, leaf_end, "A-DOOR", trap="T-EXPLODED-DOOR")
            a_leaf = round(math.degrees(math.atan2(float(ny * side), float(nx * side)))) % 360
            a_wall = round(math.degrees(math.atan2(float(uy * dirx), float(ux * dirx)))) % 360
            start, end = (a_wall, a_leaf) if (a_leaf - a_wall) % 360 == 90 else (a_leaf, a_wall)
            s.arc(hinge, o["w"], float(start), float(end), "A-DOOR")
        else:
            trap = "T-MIRRORED-DOOR" if o["id"] == "D2-4" else None
            s.insert(door_name(o["w"]), hinge, "A-DOOR", rotation=_ang(w), xscale=-1.0 if east else 1.0,
                     yscale=float(side), trap=trap)
    # the circled tag, unhyphenated, on the side it opens onto (or inside for a window)
    mid = (s0 + s1) / 2
    at = _at(w, mid, (h + D(450)) * side)
    s.circle(at, 190, "A-TAG")
    trap = {"V2-1": "T-LOUVRE-BELOW-THRESHOLD", "D2-3": "T-MARK-SPELLING"}.get(o["id"])
    s.text(mark, at, 150, "A-TAG", align="MIDDLE_CENTER", family="mark", trap=trap)


def _side(lv: dict[str, Any], w: dict[str, Any], o: dict[str, Any], named: dict[str, Any]) -> int:
    """Which side of the host the leaf swings into (+1 left of a→b, −1 right): into a toilet, a
    bedroom, a kitchen, the study, the stair, else into the flat; a window's tag stands inside."""
    s0, s1 = G.span(w, o)
    mid = (s0 + s1) / 2
    off = w["t"] / 2 + D(1)
    def room_at(sign: int) -> str | None:
        p = _at(w, mid, off * sign)
        return next((rid for rid, fc in named.items() if G.face_contains(fc, p)), None)
    left, right = room_at(1), room_at(-1)
    prefer = ("TOILET", "BED", "KITCHEN", "STUDY", "STAIR", "F.LIVING", "GUARD", "DRIVER", "METER", "LOBBY")
    for word in prefer:
        if left and word in left:
            return 1
        if right and word in right:
            return -1
    return 1 if left is not None else -1


def _low_walls(s: Scene, lv: dict[str, Any]) -> None:
    for lw in lv["low_walls"]:
        if lw["kind"] == "RECT":
            s.poly(lw["poly"], "A-LOW-WALL")
            continue
        cx, cy = lw["centre"]
        for r in (lw["r_in"], lw["r_out"]):
            end = math.degrees(math.asin(float((lw["y_cut"] - cy) / r)))
            s.arc((cx, cy), r, 270.0, 360.0 + end, "A-LOW-WALL")


def _rooms(s: Scene, lv: dict[str, Any], tr: dict[str, dict[str, Any]], level: str) -> None:
    by_room = {t.get("room"): t["id"] for t in tr.values() if t.get("room")}
    for r in lv["rooms"]:
        for lab in r["labels"]:
            if "stated" in lab:
                w, ll = lab["stated"]
                raw = f"{lab['text']}\\P{ftin(w)} x {ftin(ll)}"
            else:
                raw = lab["text"]
            trap = by_room.get(r["id"])
            if trap == "T-UNCLOSED-WALL":
                trap = None
            at = lab["at"]
            if trap == "T-LABEL-OUTSIDE":
                out_at = (M.X2 - D(700), at[1] + D(250))
                s.mtext(raw, out_at, 180, "A-ROOM-NAME", family="room_label", trap=trap)
                s.leader([(out_at[0] - D(600), out_at[1]), at], "A-ROOM-NAME")
                continue
            if trap == "T-ROOM-SIZE-NOMINAL" and not lab.get("nominal"):
                trap = None
            s.mtext(raw, at, 180, "A-ROOM-NAME", family="room_label", trap=trap)


def _furniture(s: Scene, level: str) -> None:
    if level == "GF":
        return
    s.insert("FURN-BED", (7400, 14200), "A-FURN", trap="T-FURNITURE")
    s.insert("FURN-BED", (M.mx(D(7400)), 14200), "A-FURN", xscale=-1.0)
    s.insert("FURN-SOFA", (7400, 900), "A-FURN")
    s.insert("FURN-DINING", (2300, 3500), "A-FURN")
    s.rect(6200, 1700, 8600, 3300, "A-FURN")  # the rug: the one closed outline standing in a room


def _stair_and_lift(s: Scene, lv: dict[str, Any]) -> None:
    cf = M.core_faces("1F" if lv["group"] == "TYP" else "GF")
    x0, x1 = M.X2 + M.T250 / 2, cf["w0"]
    y0, y1 = M.YC + M.T250 / 2, M.YD - M.T250 / 2
    mid = (y0 + y1) / 2
    s.line((x0 + D(1219.2), mid), (x1 - D(1048), mid), "A-STAIR")
    tread = D(250)
    x = x0 + D(1219.2)
    while x <= x1 - D(1048):
        s.line((x, y0), (x, y1), "A-STAIR")
        x += tread
    s.text("UP", (x0 + D(1500), mid - D(400)), 160, "A-STAIR", family="note")
    lx0, lx1 = cf["w1"], cf["e0"]
    ly0, ly1 = M.YC + M.T125 / 2, cf["n0"]
    s.line((lx0, ly0), (lx1, ly1), "A-ANNO-NOTE")
    s.line((lx0, ly1), (lx1, ly0), "A-ANNO-NOTE")
    for x, y in M.DUCTS if lv["group"] == "TYP" else ():
        s.line((x, y), (x + M.DUCT_SIZE[0], y + M.DUCT_SIZE[1]), "A-ANNO-NOTE")
        s.line((x, y + M.DUCT_SIZE[1]), (x + M.DUCT_SIZE[0], y), "A-ANNO-NOTE")


def _ramp(s: Scene) -> None:
    r = M.S.RAMP
    s.rect(r["x0"], r["y0"], r["x1"], r["y1"], "A-ANNO-NOTE")
    s.line(((r["x0"] + r["x1"]) / 2, r["y0"] + D(300)), ((r["x0"] + r["x1"]) / 2, r["y1"] - D(300)), "A-ANNO-NOTE")
    s.text("RAMP UP 1:8", ((r["x0"] + r["x1"]) / 2 + D(200), (r["y0"] + r["y1"]) / 2), 180, "A-ANNO-NOTE", family="note")


# ---------------------------------------------------------------------------------------------
# Schedules (drawn at 1:50 in model space: a LINE grid and one MTEXT per cell)
# ---------------------------------------------------------------------------------------------

ROW = D(520)
TXT = D(120)


def _table(s: Scene, x: Decimal, y: Decimal, widths: list[Decimal], rows: list[list[Any]], layer: str = "A-SCHED",
           row: Decimal = ROW) -> Decimal:
    """A LINE grid with one MTEXT per cell, wrapped to its cell (a cell is text or (text, family,
    trap)); returns the y under the last row."""
    total = sum(widths, D(0))
    for r in range(len(rows) + 1):
        s.line((x, y - row * r), (x + total, y - row * r), layer)
    cx = x
    for wd in [*widths, D(0)]:
        s.line((cx, y), (cx, y - row * len(rows)), layer)
        cx += wd
    for r, cells in enumerate(rows):
        cx = x
        for cell, wd in zip(cells, widths, strict=True):
            text, family, trap = (cell, "schedule_cell", None) if isinstance(cell, str) else [*cell, None][:3]
            if text:
                s.mtext(text, (cx + wd / 2, y - row * r - row / 2), TXT, "A-SCHED-TEXT", width=wd - D(100),
                        family=family, trap=trap)
            cx += wd
    return y - row * len(rows)


def door_window_schedule(world: dict[str, Any], group: str) -> Scene:
    s = Scene()
    level = "GF" if group == "GF" else "1F"
    lv = world["levels"][level]
    placed: dict[str, int] = {}
    for o in lv["openings"]:
        placed[o["mark"]] = placed.get(o["mark"], 0) + 1
    y = D(0)
    title = "DOOR & WINDOW SCHEDULE (GROUND FLOOR)" if group == "GF" else "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)"
    s.text(title, (0, y + D(400)), 180, "A-SCHED-TEXT", family="caption")
    widths = [D(700), D(1500), D(1900), D(1500)]
    for heading, groups in (("DOOR", "DOOR"), ("WINDOW & VENTILATOR", "WINDOW")):
        types: dict[str, list[str]] = {}
        for mark, spec in world["marks"].items():
            if spec["group"] == groups and mark in placed:
                types.setdefault(spec["type"], []).append(mark)
        s.text(heading, (0, y - D(250)), 150, "A-SCHED-TEXT", family="caption")
        y -= D(500)
        for typ in types:
            rows: list[list[Any]] = [["SL.", typ, "SIZE (W x H)", "QUANTITY"]]
            for i, mark in enumerate(sorted(types[typ]), start=1):
                spec = world["marks"][mark]
                printed = world["printed_nos_override"].get(f"{group}:{mark}", placed[mark])
                trap = "T-OPENING-NOS" if printed != placed[mark] else None
                size = f"{_size(spec['w'])}\\PX {_size(spec['h'])}"
                nos = f"{printed:02d} {'NO' if printed == 1 else 'NOS'}"
                rows.append([f"{i:02d}.", M.schedule_spelling(mark), size, (nos, "count", trap)])
            y = _table(s, D(0), y, widths, rows) - D(250)
    if group != "GF":
        s.text("NOTE: QUANTITY PER FLOOR.", (0, y - D(150)), 130, "A-SCHED-TEXT", family="note")
    return s


def _size(mm: Decimal) -> str:
    inches = mm / M.IN
    if inches == inches.to_integral_value():
        return ftin(mm)
    return f"{mm.normalize():f}"


def finish_schedule(world: dict[str, Any]) -> Scene:
    s = Scene()
    s.text("ROOM FINISH SCHEDULE", (0, D(400)), 180, "A-SCHED-TEXT", family="caption")
    widths = [D(2600), D(2800), D(1400), D(3400), D(3000), D(3000)]
    rows: list[list[Any]] = [["ROOM", "FLOOR", "SKIRTING", "WALL", "DADO", "CEILING"]]
    for ftp in world["finish_types"].values():
        rows.append([
            ftp["rooms"],
            ftp["floor"],
            f"{ftin(ftp['skirting'])} HIGH" if ftp.get("skirting") else "-",
            ftp["wall"] or "-",
            ftp.get("dado_spec", "-"),
            ftp["ceiling"] or "-",
        ])
    y = _table(s, D(0), D(0), widths, rows, row=D(900))
    s.text("NOTES: 1. CEILING HEIGHTS AS SECTION A-A (CLEAR, FFL TO SLAB SOFFIT).", (0, y - D(300)), 120,
           "A-SCHED-TEXT", family="note")
    s.text("2. PLASTER AND PAINT ABOVE THE SKIRTING OR THE DADO.", (0, y - D(550)), 120, "A-SCHED-TEXT",
           family="note")
    return s


def tile_legend(world: dict[str, Any]) -> Scene:
    """The Edison-style floor legend: a swatch, the rooms it applies to, a code, the size written
    NN'' X NN'' (double single-quote as the inch mark), and a colour."""
    s = Scene()
    s.text("FLOOR TILE LEGEND", (0, D(400)), 180, "A-SCHED-TEXT", family="caption")
    widths = [D(900), D(3000), D(1200), D(1300), D(1300)]
    rows: list[list[Any]] = [["", "APPLIED TO", "CODE", "SIZE", "COLOUR"]]
    legend = [
        ("LIVING, DINING, F.LIVING, BED, STUDY", "HT-601", "24'' X 24''", "IVORY"),
        ("KITCHEN, TOILET, VERANDAH", "CT-305", "12'' X 12''", "GREY"),
        ("LIFT LOBBY", "GR-602", "24'' X 24''", "BLACK"),
        ("GUARD, DRIVER, METER", "CT-301", "12'' X 12''", "BEIGE"),
    ]
    for rooms, code, size, colour in legend:
        rows.append(["", rooms, code, size, colour])
    _table(s, D(0), D(0), widths, rows)
    for i in range(len(legend)):
        yy = -ROW * (i + 1)
        pts = [(D(150), yy - D(420)), (D(750), yy - D(420)), (D(750), yy - D(100)), (D(150), yy - D(100))]
        s.hatch([pts], "A-SCHED", solid=False, pattern="ANSI37", scale=5.0 + i)
    return s


def wall_types(world: dict[str, Any], tr: dict[str, dict[str, Any]]) -> Scene:
    s = Scene()
    s.text("WALL TYPES", (0, D(400)), 180, "A-SCHED-TEXT", family="caption", trap="T-WALL-TYPES-CAPTION")
    widths = [D(1000), D(1600), D(5200), D(4400)]
    rows: list[list[Any]] = [["MARK", "THICKNESS", "DESCRIPTION", "WHERE"]]
    for wt in world["wall_types"]:
        t = wt["t"]
        thick = f"{int(t)} (0'-{int((t / M.IN).quantize(D(1)))}\")" if t is not None else "SEE STR."
        rows.append([wt["mark"], thick, wt["spec"], wt["where"]])
    _table(s, D(0), D(0), widths, rows, row=D(900))
    return s


# ---------------------------------------------------------------------------------------------
# Section A-A: the level stack and the clear heights
# ---------------------------------------------------------------------------------------------


def section(world: dict[str, Any]) -> Scene:
    s = Scene()
    ys = M.YA - M.S.BALCONY["depth"], M.YE
    x0, x1 = ys[0] - D(1500), ys[1] + D(1500)
    elev = M.S.ELEV
    s.line((x0, M.EGL), (x1, M.EGL), "A-SECT", linetype="DASHED")
    s.text(f"E.G.L. {level_text(M.EGL)}", (x1 + D(300), M.EGL), 180, "A-LEVEL", family="level")
    names = {"GF": "GROUND FLOOR", "1F": "1ST FLOOR", "2F": "2ND FLOOR", "3F": "3RD FLOOR", "4F": "4TH FLOOR",
             "5F": "5TH FLOOR", "6F": "6TH FLOOR", "ROOF": "ROOF"}
    for lvl in ("GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF"):
        z = elev[lvl]
        t = D(125)
        if lvl != "GF":
            s.rect(M.YA if lvl == "ROOF" else ys[0], z - t, M.YE, z, "A-SECT")
        else:
            s.line((ys[0], z), (M.YE, z), "A-SECT")
        s.mtext(f"{names[lvl]}\\PFFL {level_text(z)}", (x1 + D(1400), z), 180, "A-LEVEL", attach="MIDDLE_LEFT",
                family="level")
    for lvl in M.LEVELS:
        z0, z1 = elev[lvl], elev[M.above(lvl)]
        clear = z1 - z0 - D(125)
        s.mtext(f"CLEAR HT. {ftin(clear)} ({clear.normalize():f})", ((M.YA + M.YE) / 2, (z0 + z1) / 2), 170,
                "A-ANNO-NOTE", family="height", fact={"level": lvl, "clear_mm": str(clear)})
        if lvl != "GF":
            for wall_y in (M.YA, M.YE):
                s.rect(wall_y - M.T250 / 2, z0, wall_y + M.T250 / 2, z1 - D(600), "A-SECT")
    low = world["levels"]["1F"]["storey_h"] - M.SUNKEN_DROP - D(125)
    s.mtext(f"UNDER SUNKEN TOILET SLABS (1ST TO 5TH): CLEAR HT. {ftin(low)} ({low.normalize():f})\\P"
            f"UNDER 150 THK. SLAB PANELS (GRID 2-3 & 4-5 / B-C): CLEAR HT. {ftin(D(3048) - D(150))} (2898)",
            (x0, elev["GF"] - D(2200)), 150, "A-ANNO-NOTE", attach="TOP_LEFT", family="height")
    return s


# ---------------------------------------------------------------------------------------------
# The sheets
# ---------------------------------------------------------------------------------------------


def _frame(number: str, title: str, size: str) -> Scene:
    w, h = PAPER_MM[size]
    p = Scene()
    p.rect(BORDER, BORDER, w - BORDER, h - BORDER, "A-TITLE")
    sx = w - BORDER - STRIP
    p.line((sx, BORDER), (sx, h - BORDER), "A-TITLE")
    y = h - BORDER - 8
    for text, hh in ((IDENTITY["firm"], 3.2), (IDENTITY["firm_address"], 1.8)):
        p.text(text, (sx + 3, y), hh, "A-TITLE", family="title")
        y -= hh + 4
    p.line((sx, y), (w - BORDER, y), "A-TITLE")
    y -= 7
    for label, value in (("CLIENT", IDENTITY["client"]), ("PROJECT", IDENTITY["project"]), ("SITE", IDENTITY["site"])):
        p.text(label, (sx + 3, y), 1.8, "A-TITLE", family="title")
        p.mtext(value, (sx + 3, y - 3), 2.2, "A-TITLE", attach="TOP_LEFT", width=STRIP - 6, family="title")
        y -= 16
    p.line((sx, 70), (w - BORDER, 70), "A-TITLE")
    p.text("SHEET TITLE", (sx + 3, 64), 1.8, "A-TITLE", family="title")
    p.text(f"{number}  {title}", (sx + 3, 56), 2.0, "A-TITLE", family="title")
    for i, (label, value) in enumerate((("SCALE", "AS SHOWN"), ("DATE", IDENTITY["date"]), ("DRAWN", IDENTITY["drawn"]),
                                        ("CHECKED", IDENTITY["checked"]), ("JOB NO.", IDENTITY["job"]),
                                        ("REV.", "0"))):
        p.text(f"{label}: {value}", (sx + 3, 44 - i * 5), 2.0, "A-TITLE", family="title")
    return p


MARGIN = 8.0  #: paper millimetres between a view's content and its window's edge


def fit(scene: Scene, scale: int) -> tuple[float, float]:
    """The paper size of a window that shows the whole scene at 1:scale with a margin all round."""
    x0, y0, x1, y1 = scene.bbox()
    return (round((x1 - x0) / scale + 2 * MARGIN, 1), round((y1 - y0) / scale + 2 * MARGIN, 1))


def _view(p: Scene, v: View) -> View:
    """Frame a 1:1 scene into its window, centred; the window's title is written on the paper under
    it (the product reads a window's title there, L-CAD-06)."""
    x0, y0, x1, y1 = v.scene.bbox()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    v.origin = (cx - v.size[0] * v.scale / 2, cy - v.size[1] * v.scale / 2)
    assert (x1 - x0) / v.scale <= v.size[0] and (y1 - y0) / v.scale <= v.size[1], (
        f"{v.caption}: the view does not fit its window at 1:{v.scale}")
    # set 2 mm in from the frame's edge, as a draughtsman letters it — a title standing exactly on the
    # edge is a float's width from falling outside the frame it names
    p.text(f"{v.caption}  SCALE 1:{v.scale}", (v.at[0] + 2.0, v.at[1] - 6.0), 4.0, "A-TITLE", family="caption")
    return v


def _place(sheet: Sheet, caption: str, scene: Scene, scale: int, at: tuple[float, float], expect: str) -> None:
    sheet.views.append(_view(sheet.paper, View(caption, scene, scale, at, fit(scene, scale), expect)))


def compose(world: dict[str, Any]) -> list[Sheet]:
    tr = traps()
    sheets = []
    for number, level, group, title in (("A-01", "GF", "GF", "GROUND FLOOR PLAN"),
                                        ("A-02", "1F", "TYP", "TYPICAL FLOOR PLAN (1ST TO 6TH)")):
        sheet = Sheet(number, title, "A1", _frame(number, title, "A1"),
                      traps=sorted(t for t, v in tr.items() if v["sheet"] == number))
        body = plan(world, level, number, tr)
        _place(sheet, title, body, 100, (30.0, 570.0 - fit(body, 100)[1]), "LAYOUT_PLAN")
        sched = door_window_schedule(world, group)
        pw = sheet.views[0].size[0]
        caption = f"DOOR & WINDOW SCHEDULE ({'GROUND FLOOR' if group == 'GF' else '1ST TO 6TH FLOOR'})"
        top = sheet.views[0].at[1] + sheet.views[0].size[1]
        _place(sheet, caption, sched, 50, (30.0 + pw + 30.0, top - fit(sched, 50)[1]), "SCHEDULE")
        sheet.paper.insert("NORTH", (30.0 + pw - 15.0, top - 15.0), "A-TITLE")
        sheets.append(sheet)
    a03_title = "ROOM FINISH SCHEDULE & WALL TYPES"
    a03 = Sheet("A-03", a03_title, "A1", _frame("A-03", a03_title, "A1"),
                traps=sorted(t for t, v in tr.items() if v["sheet"] == "A-03"))
    finish, legend, types = finish_schedule(world), tile_legend(world), wall_types(world, tr)
    y = 575.0 - fit(finish, 50)[1]
    _place(a03, "ROOM FINISH SCHEDULE", finish, 50, (30.0, y), "SCHEDULE")
    y -= 20.0 + fit(legend, 50)[1]
    _place(a03, "FLOOR TILE LEGEND", legend, 50, (30.0, y), "LEGEND_NOTES")
    y -= 20.0 + fit(types, 50)[1]
    _place(a03, "WALL TYPES", types, 50, (30.0, y), "SCHEDULE")
    sheets.append(a03)
    a04 = Sheet("A-04", "SECTION A-A", "A2", _frame("A-04", "SECTION A-A", "A2"))
    sect = section(world)
    _place(a04, "SECTION A-A", sect, 100, (40.0, 400.0 - fit(sect, 100)[1]), "MEMBER_SECTION")
    sheets.append(a04)
    return sheets


def door_widths(world: dict[str, Any]) -> list[Decimal]:
    return sorted({spec["w"] for spec in world["marks"].values() if spec["leaf"] == "HINGED"})


__all__ = ["LAYERS", "PAPER_MM", "Sheet", "View", "compose", "door_widths", "f"]
