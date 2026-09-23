"""F-ARCH golden, path 1: room by room from the AUTHORED clear polygons, wall by wall from the
authored centrelines and end rules (L-QTY-06: never from the drawing, never from the product's
methods). Imports the model only (cad/tests/arch/test_arch_lint.py).

Rows (schema 2 plus `room`): {class, kind, level, component, quantity, unit, formula, members} and,
per kind:
  SURFACE × FLOORING      m²  component FLOOR    per room
  SURFACE × PLASTER       m²  component WALL | CEILING
  SURFACE × PAINT         m²  component WALL | CEILING
  SURFACE × WALL_TILE     m²  component DADO     (kitchens and toilets)
  SURFACE × SKIRTING      m   component SKIRTING (dry rooms)
  BRICK_WALL × BRICKWORK  m³  component BW250 | BW125, per level
  OPENING × OPENING_COUNT nr  per mark per level
  OPENING × OPENING_AREA  m²  per mark per level
The conventions are model.CONVENTIONS (and DECISIONS.md A-14 … A-19).
"""

from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal
from typing import Any

from . import model as M

D = Decimal
Q3 = D("0.001")
MM2 = D(10) ** 6
MM3 = D(10) ** 9
MM = D(1000)
THRESHOLD = D("0.1") * MM2  # 0.1 m², strictly greater deducts (L-MEA-02)
ENGAGED = D(50)  # a column within 50 mm of a wall face is engaged with it (A-14)
PROBE = D(1)
EPS = D("1e-9")

PI = M.S.PI

Pt = tuple[Decimal, Decimal]


def q3(v: Decimal) -> str:
    return str(v.quantize(Q3, rounding=ROUND_HALF_EVEN))


# ---------------------------------------------------------------------------------------------
# Path 1's own geometry
# ---------------------------------------------------------------------------------------------


def area(poly: list[Pt]) -> Decimal:
    s = D(0)
    for i, (x0, y0) in enumerate(poly):
        x1, y1 = poly[(i + 1) % len(poly)]
        s += x0 * y1 - x1 * y0
    return s / 2


def length(p: Pt, q: Pt) -> Decimal:
    return ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2).sqrt()


def cross(o: Pt, a: Pt, b: Pt) -> Decimal:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def ccw(poly: list[Pt]) -> list[Pt]:
    return poly if area(poly) > 0 else list(reversed(poly))


def inside_convex(p: Pt, poly: list[Pt]) -> bool:
    """Strictly-or-on inside a convex polygon (either orientation)."""
    poly = ccw(poly)
    return all(cross(poly[i], poly[(i + 1) % len(poly)], p) >= -EPS for i in range(len(poly)))


def clip(subject: list[Pt], clipper: list[Pt]) -> list[Pt]:
    """Sutherland–Hodgman: the part of `subject` inside the CONVEX `clipper`."""
    out = list(subject)
    c = ccw(clipper)
    for i in range(len(c)):
        a, b = c[i], c[(i + 1) % len(c)]
        inp, out = out, []
        if not inp:
            break
        for j in range(len(inp)):
            p, q = inp[j], inp[(j + 1) % len(inp)]
            pin, qin = cross(a, b, p) >= 0, cross(a, b, q) >= 0
            if pin:
                out.append(p)
            if pin != qin:
                t = cross(a, b, p) / (cross(a, b, p) - cross(a, b, q))
                out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def seg_dist(p: Pt, a: Pt, b: Pt) -> Decimal:
    dx, dy = b[0] - a[0], b[1] - a[1]
    ll = dx * dx + dy * dy
    t = D(0) if ll == 0 else max(D(0), min(D(1), ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / ll))
    return length(p, (a[0] + dx * t, a[1] + dy * t))


def split_points(p: Pt, q: Pt, polys: list[list[Pt]]) -> list[Decimal]:
    """Parameters in (0, 1) where segment p→q crosses an edge of any polygon."""
    ts = {D(0), D(1)}
    rx, ry = q[0] - p[0], q[1] - p[1]
    for poly in polys:
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            sx, sy = b[0] - a[0], b[1] - a[1]
            den = rx * sy - ry * sx
            if den == 0:
                continue
            t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / den
            u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / den
            if EPS < t < 1 - EPS and -EPS <= u <= 1 + EPS:
                ts.add(t)
    return sorted(ts)


# ---------------------------------------------------------------------------------------------
# Heights: what stands over a point (L-MEA-06's clear height, read off the structure; A-18)
# ---------------------------------------------------------------------------------------------


def finish_zones(lv: dict[str, Any]) -> list[tuple[list[Pt], Decimal]]:
    """The soffits a room's walls rise to: sunken toilet panels first (their soffit SUNKEN_DROP +
    t below the floor over), then every other slab panel. Beams stand inside the face (A-18)."""
    zones = []
    for p in lv["slabs_over"]:
        if p["sunken"]:
            zones.append((p["poly"], M.SUNKEN_DROP + p["t"]))
    for p in lv["slabs_over"]:
        if not p["sunken"]:
            zones.append((p["poly"], p["t"]))
    return zones


def _beam_rect(bm: dict[str, Any]) -> list[Pt]:
    (ax, ay), (bx, by) = bm["p0"], bm["p1"]
    ll = length((ax, ay), (bx, by))
    nx, ny = -(by - ay) / ll * bm["b"] / 2, (bx - ax) / ll * bm["b"] / 2
    return [(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)]


def brick_zones(lv: dict[str, Any]) -> list[tuple[list[Pt], Decimal]]:
    """What a wall's top meets: a beam (its depth), a sunken panel's drop-wall ring (SUNKEN_DROP
    below the floor over), or a slab panel (its thickness) — in that order (A-10)."""
    # where two beams overlap (at a junction) the deeper one stands over the wall
    zones = [(_beam_rect(bm), bm["depth"]) for bm in sorted(lv["beams_over"], key=lambda b: -b["depth"])]
    for p in lv["slabs_over"]:
        if p["sunken"]:
            xs = [x for x, _ in p["poly"]]
            ys = [y for _, y in p["poly"]]
            x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
            r = M.T125
            for ring in (
                [(x0 - r, y0 - r), (x1 + r, y0 - r), (x1 + r, y0), (x0 - r, y0)],
                [(x0 - r, y1), (x1 + r, y1), (x1 + r, y1 + r), (x0 - r, y1 + r)],
                [(x0 - r, y0), (x0, y0), (x0, y1), (x0 - r, y1)],
                [(x1, y0), (x1 + r, y0), (x1 + r, y1), (x1, y1)],
            ):
                zones.append((ring, M.SUNKEN_DROP))
    for p in lv["slabs_over"]:
        zones.append((p["poly"], M.SUNKEN_DROP + p["t"] if p["sunken"] else p["t"]))
    return zones


def zone_t(p: Pt, zones: list[tuple[list[Pt], Decimal]], what: str) -> Decimal:
    for poly, t in zones:
        if inside_convex(p, poly):
            return t
    raise AssertionError(f"path 1: nothing stands over {what} at ({p[0]}, {p[1]})")


# ---------------------------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------------------------


def _edges_with_heights(poly: list[Pt], lv: dict[str, Any], rid: str) -> list[tuple[Decimal, Decimal]]:
    """(length, clear height) of every piece of the room's boundary, split where the soffit over it
    changes, the height read just inside the room."""
    zones = finish_zones(lv)
    polys = [z for z, _ in zones]
    out = []
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        ll = length(p, q)
        if ll == 0:
            continue
        nx, ny = -(q[1] - p[1]) / ll, (q[0] - p[0]) / ll  # left = inward for a CCW polygon
        ts = split_points(p, q, polys)
        for t0, t1 in zip(ts, ts[1:], strict=False):
            tm = (t0 + t1) / 2
            m = (p[0] + (q[0] - p[0]) * tm + nx * PROBE, p[1] + (q[1] - p[1]) * tm + ny * PROBE)
            out.append((ll * (t1 - t0), lv["storey_h"] - zone_t(m, zones, f"{rid}'s wall")))
    return out


def column_pieces(poly: list[Pt], lv: dict[str, Any], rid: str) -> list[tuple[str, Decimal]]:
    """Each column's plan area inside the room (clipped by the column, a convex polygon)."""
    out = []
    for c in lv["columns"]:
        piece = clip(poly, c["poly"])
        a = abs(area(piece)) if len(piece) >= 3 else D(0)
        if a <= EPS:
            continue
        if a >= abs(area(c["poly"])) - EPS:  # wholly inside: it must stand within ENGAGED of a face
            gap = min(seg_dist(v, poly[i], poly[(i + 1) % len(poly)]) for v in c["poly"] for i in range(len(poly)))
            assert gap <= ENGAGED, f"path 1: column {c['id']} stands free in {rid} ({gap} mm off every face)"
        out.append((c["id"], a))
    return out


def _band(ftype: dict[str, Any]) -> Decimal:
    """Where the plastered band starts: the top of the skirting or of the dado (A-18)."""
    return ftype["dado"] if ftype.get("dado") else (ftype.get("skirting") or D(0))


def room_rows(level: str, lv: dict[str, Any], world: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r in lv["rooms"]:
        if r["kind"] == "VOID":
            continue
        ft = world["finish_types"][r["finish"]]
        rid = r["id"]
        if r["kind"] == "VERANDAH":
            floor = _verandah_area(r)
            rows.append(_row(level, "FLOORING", "FLOOR", rid, floor / MM2, "m2",
                             "verandah floor: to the wall's outer face, the planter's inner face and the divider; "
                             "the curved end analytic (A-15)", [rid]))
            continue
        poly = r["polygon"]
        assert area(poly) > 0, f"path 1: {rid}'s authored polygon is not counter-clockwise"
        gross = area(poly)
        pieces = column_pieces(poly, lv, rid)
        deducted = [(cid, a) for cid, a in pieces if a > THRESHOLD]
        floor = gross - sum((a for _, a in deducted), D(0))
        members = [rid, *[cid for cid, _ in deducted]]
        rows.append(_row(level, "FLOORING", "FLOOR", rid, floor / MM2, "m2",
                         "clear polygon area − column pieces > 0.1 m²", members,
                         retained=[(cid, a / MM2) for cid, a in pieces if a <= THRESHOLD]))
        for kind in ("PLASTER", "PAINT"):
            rows.append(_row(level, kind, "CEILING", rid, floor / MM2, "m2", "ceiling = floor (slab soffit)", members))
        edges = _edges_with_heights(poly, lv, rid)
        band = _band(ft)
        ops = [o for o in lv["openings"] if rid in o["rooms"]]
        for o in ops:
            top = o["sill"] + o["h"]
            assert top <= min(h for _, h in edges), f"path 1: {o['id']} rises above {rid}'s ceiling"
        big = [o for o in ops if o["w"] * o["h"] > THRESHOLD]
        small = [o for o in ops if o["w"] * o["h"] <= THRESHOLD]
        plaster_gross = sum((ll * (h - band) for ll, h in edges), D(0))
        plaster_ded = sum((o["w"] * max(D(0), o["sill"] + o["h"] - max(band, o["sill"])) for o in big), D(0))
        wall = plaster_gross - plaster_ded
        op_members = [rid, *sorted(o["id"] for o in big)]
        retained = [(o["id"], o["w"] * o["h"] / MM2) for o in small]
        for kind in ("PLASTER", "PAINT"):
            rows.append(_row(level, kind, "WALL", rid, wall / MM2, "m2",
                             "Σ edge × (clear height − band floor) − openings > 0.1 m² (their overlap with the band)",
                             op_members, retained=retained))
        if ft.get("dado"):
            tile_gross = sum((ll * min(band, h) for ll, h in edges), D(0))
            tile_ded = sum((o["w"] * max(D(0), min(band, o["sill"] + o["h"]) - o["sill"]) for o in big), D(0))
            rows.append(_row(level, "WALL_TILE", "DADO", rid, (tile_gross - tile_ded) / MM2, "m2",
                             "Σ edge × dado height − openings > 0.1 m² (their overlap with the dado)", op_members,
                             retained=retained))
        if ft.get("skirting"):
            perim = sum((ll for ll, _ in edges), D(0))
            doors = sum((o["w"] for o in ops if o["sill"] == 0), D(0))
            rows.append(_row(level, "SKIRTING", "SKIRTING", rid, (perim - doors) / MM, "m",
                             "room perimeter − widths of openings at floor level",
                             [rid, *sorted(o["id"] for o in ops if o["sill"] == 0)]))
    return rows


def asin(x: Decimal) -> Decimal:
    """arcsin by its Taylor series (|x| small here; exact to the context's precision)."""
    assert abs(x) < D("0.5")
    term, total, n = x, x, 0
    while True:
        n += 1
        term = term * x * x * (2 * n - 1) * (2 * n - 1) / ((2 * n) * (2 * n + 1))
        if abs(term) < D("1e-40"):
            return total + term
        total += term


def _verandah_area(r: dict[str, Any]) -> Decimal:
    if r.get("polygon"):
        return area(r["polygon"])
    arc = r["arc"]
    cx, cy = arc["centre"]
    rad = arc["r"]
    a = cy - arc["y1"]  # how far the wall face stands below the circle's centre (it is on grid A)
    assert cy == 0 and arc["y0"] == cy - rad
    rect = (cx - arc["x0"]) * (arc["y1"] - arc["y0"])
    # the quarter disc below the wall face: ∫_a^r √(r² − u²) du
    w = (rad * rad - a * a).sqrt()
    quarter = rad * rad / 2 * (PI / 2 - asin(a / rad)) - a * w / 2
    return rect + quarter


# ---------------------------------------------------------------------------------------------
# Brickwork, wall by wall
# ---------------------------------------------------------------------------------------------


def _line_hit(p: Pt, u: Pt, a: Pt, b: Pt) -> Decimal | None:
    """Parameter s along p + s·u where it meets the infinite line a→b, or None when parallel."""
    sx, sy = b[0] - a[0], b[1] - a[1]
    den = u[0] * sy - u[1] * sx
    if den == 0:
        return None
    return ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / den


def _face_stop(w: dict[str, Any], at_a: bool, other: dict[str, Any], u: Pt) -> Decimal:
    """Where this wall's centreline meets the near face of the wall it abuts."""
    (ax, ay), (bx, by) = other["a"], other["b"]
    ll = length(other["a"], other["b"])
    nx, ny = -(by - ay) / ll * other["t"] / 2, (bx - ax) / ll * other["t"] / 2
    hits = [
        _line_hit(w["a"], u, (ax + nx, ay + ny), (bx + nx, by + ny)),
        _line_hit(w["a"], u, (ax - nx, ay - ny), (bx - nx, by - ny)),
    ]
    hits = [h for h in hits if h is not None]
    assert hits, f"path 1: {w['id']} runs parallel to {other['id']}, which it is said to abut"
    return min(hits) if not at_a else max(hits)


def _covered(w: dict[str, Any], u: Pt, poly: list[Pt]) -> tuple[Decimal, Decimal] | None:
    """The interval of the wall's centreline a convex obstruction stands over (a line meets a
    convex polygon in one interval), or None."""
    ll = length(w["a"], w["b"])
    ts = split_points(w["a"], w["b"], [poly])
    hit = [
        (t0 * ll, t1 * ll)
        for t0, t1 in zip(ts, ts[1:], strict=False)
        if t1 - t0 > EPS
        and inside_convex((w["a"][0] + u[0] * (t0 + t1) / 2 * ll, w["a"][1] + u[1] * (t0 + t1) / 2 * ll), poly)
    ]
    if not hit:
        return None
    return (min(a for a, _ in hit), max(b for _, b in hit))


def _subtract(intervals: list[tuple[Decimal, Decimal]], cut: tuple[Decimal, Decimal]) -> list[tuple[Decimal, Decimal]]:
    out = []
    for a, b in intervals:
        if cut[1] <= a or cut[0] >= b:
            out.append((a, b))
            continue
        if cut[0] > a:
            out.append((a, cut[0]))
        if cut[1] < b:
            out.append((cut[1], b))
    return [(a, b) for a, b in out if b - a > EPS]


def _lintel_class(o: dict[str, Any], world: dict[str, Any]) -> str | None:
    return world["s25_class"].get(o["mark"])


def wall_rows(level: str, lv: dict[str, Any], world: dict[str, Any]) -> list[dict[str, Any]]:
    by_id = {w["id"]: w for w in lv["walls"]}
    zones = brick_zones(lv)
    zpolys = [z for z, _ in zones]
    vol: dict[str, Decimal] = {"BW250": D(0), "BW125": D(0)}
    members: dict[str, list[str]] = {"BW250": [], "BW125": []}
    retained: dict[str, list[tuple[str, Decimal]]] = {"BW250": [], "BW125": []}
    for w in lv["walls"]:
        ll = length(w["a"], w["b"])
        u = ((w["b"][0] - w["a"][0]) / ll, (w["b"][1] - w["a"][1]) / ll)
        s0 = D(0) if w["stops"][0][0] == "pt" else _face_stop(w, True, by_id[w["stops"][0][1]], u)
        s1 = ll if w["stops"][1][0] == "pt" else _face_stop(w, False, by_id[w["stops"][1][1]], u)
        clear = [(s0, s1)]
        for obstruction in [c["poly"] for c in lv["columns"]] + [c["poly"] for c in lv["core"]]:
            cov = _covered(w, u, obstruction)
            if cov is not None and cov[1] > cov[0]:
                clear = _subtract(clear, cov)
        v = D(0)
        tops: list[tuple[Decimal, Decimal, Decimal]] = []
        for c0, c1 in clear:
            p = (w["a"][0] + u[0] * c0, w["a"][1] + u[1] * c0)
            q = (w["a"][0] + u[0] * c1, w["a"][1] + u[1] * c1)
            ts = split_points(p, q, zpolys)
            for t0, t1 in zip(ts, ts[1:], strict=False):
                tm = (t0 + t1) / 2
                m = (p[0] + (q[0] - p[0]) * tm, p[1] + (q[1] - p[1]) * tm)
                h = lv["storey_h"] - zone_t(m, zones, f"wall {w['id']}")
                seg = (c1 - c0) * (t1 - t0)
                v += seg * w["t"] * h
                tops.append((c0 + (c1 - c0) * t0, c0 + (c1 - c0) * t1, h))
        for o in [o for o in lv["openings"] if o["host"] == w["id"]]:
            lo, hi = op_interval(w, o)
            assert any(a - EPS <= lo and hi <= b + EPS for a, b in clear), (
                f"path 1: opening {o['id']} does not stand in clear brickwork of {w['id']}")
            if o["w"] * o["h"] > THRESHOLD:
                v -= o["w"] * o["h"] * w["t"]
                members[w["type"]].append(o["id"])
            else:
                retained[w["type"]].append((o["id"], o["w"] * o["h"] * w["t"] / MM3))
            cls = _lintel_class(o, world) if w["type"] == "BW250" else None
            if cls:
                lt = lv["lintels"][cls]
                assert lt["b"] == w["t"], f"path 1: S-25's {cls} is {lt['b']} wide, the wall {w['t']}"
                mid = (lo + hi) / 2
                l0, l1 = mid - lt["length"] / 2, mid + lt["length"] / 2
                assert any(a - EPS <= l0 and l1 <= b + EPS for a, b in clear), (
                    f"path 1: S-25's {cls} over {o['id']} bears outside {w['id']}'s brickwork")
                over = min(h for a, b, h in tops if b > l0 and a < l1)
                assert o["sill"] + o["h"] + lt["depth"] <= over, f"path 1: the lintel over {o['id']} meets the soffit"
                v -= lt["b"] * lt["depth"] * lt["length"]
                members[w["type"]].append(f"{cls}:{o['id']}")
        vol[w["type"]] += v
        members[w["type"]].append(w["id"])
    rows = []
    for kind in ("BW125", "BW250"):
        if not members[kind]:
            continue
        rows.append(_row(level, "BRICKWORK", kind, None, vol[kind] / MM3, "m3",
                         "Σ walls: clear length × t × height to the soffit over the centreline − openings > 0.1 m² "
                         "× t − S-25 lintels embedded (b × D × length)",
                         sorted(members[kind]), cls="BRICK_WALL", retained=retained[kind]))
    return rows


def op_interval(w: dict[str, Any], o: dict[str, Any]) -> tuple[Decimal, Decimal]:
    """The opening's span along its host's centreline, measured from the host's `a` end. On a wall
    running along x (or y) the opening is placed by plan coordinate; on the chamfer, from `a`."""
    (ax, ay), (bx, by) = w["a"], w["b"]
    if ay == by:
        return (o["lo"] - ax, o["lo"] + o["w"] - ax) if bx > ax else (ax - o["lo"] - o["w"], ax - o["lo"])
    if ax == bx:
        return (o["lo"] - ay, o["lo"] + o["w"] - ay) if by > ay else (ay - o["lo"] - o["w"], ay - o["lo"])
    return (o["lo"], o["lo"] + o["w"])


def opening_rows(level: str, lv: dict[str, Any]) -> list[dict[str, Any]]:
    by_mark: dict[str, list[dict[str, Any]]] = {}
    for o in lv["openings"]:
        by_mark.setdefault(o["mark"], []).append(o)
    rows = []
    for mark in sorted(by_mark):
        ops = by_mark[mark]
        ids = sorted(o["id"] for o in ops)
        rows.append(_row(level, "OPENING_COUNT", None, None, D(len(ops)), "nr",
                         "openings placed on the plan, per mark", ids, cls="OPENING", mark=mark))
        a = sum((o["w"] * o["h"] for o in ops), D(0))
        rows.append(_row(level, "OPENING_AREA", None, None, a / MM2, "m2", "Σ w × h per mark", ids, cls="OPENING",
                         mark=mark))
    return rows


def _row(level: str, kind: str, component: str | None, room: str | None, qty: Decimal, unit: str,
         formula: str, members: list[str], *, cls: str = "SURFACE", mark: str | None = None,
         retained: list[tuple[str, Decimal]] | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {"class": cls, "kind": kind, "level": level}
    if component is not None:
        row["component"] = component
    if room is not None:
        row["room"] = room
    if mark is not None:
        row["mark"] = mark
    row["quantity"] = str(int(qty)) if unit == "nr" else q3(qty)
    row["unit"] = unit
    row["formula"] = formula
    row["members"] = members
    if retained:
        row["retained"] = [{"id": i, "quantity": q3(v)} for i, v in retained]
    return row


def _sort_key(r: dict[str, Any]) -> tuple[Any, ...]:
    order = {"SURFACE": 0, "BRICK_WALL": 1, "OPENING": 2}
    return (order[r["class"]], r["kind"], M.LEVELS.index(r["level"]), r.get("room", ""), r.get("component", ""),
            r.get("mark", ""))


def compute(world: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for level, lv in world["levels"].items():
        rows += room_rows(level, lv, world)
        rows += wall_rows(level, lv, world)
        rows += opening_rows(level, lv)
    return sorted(rows, key=_sort_key)
