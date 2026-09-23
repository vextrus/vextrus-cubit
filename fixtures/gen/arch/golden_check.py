"""F-ARCH golden, path 2: the rooms RE-DERIVED from the wall centrelines ± t/2 by this module's own
planar-face code, never from the authored clear polygons.

It reads, per level, only the raw authored inputs: each wall's centreline, thickness and which of
its ends meet another wall; the lift core's and the low walls' outlines; the columns; the slab
panels and beams over the storey; the openings (host wall, jamb, size, sill); the labels' anchor
points; the finish types. It never reads a room's `polygon`, `rooms` allocation of an opening, a
wall's `stops`, or an opening's `lintel` class — the poison test in cad/tests/arch/test_arch_lint.py
replaces them with objects and this path must still reproduce path 1 row for row.

The method:
  1. every wall becomes its solid band (the centreline ± t/2, run t/2 past an end that meets
     another wall so the junction closes); with the core and the low walls, the bands are the solids;
  2. every solid edge is split where it meets another, the half-edges are walked into cycles, and
     each counter-clockwise cycle whose interior no solid covers is a free face — a room or a void —
     named by the labels standing in it;
  3. a face's floor is its area less each column piece in it over 0.1 m² (the pieces are the columns
     minus every solid, by convex difference), its wall face is its boundary split where the soffit
     over it changes, and an opening deducts from the faces it is found on either side of its host;
  4. brickwork: each band is cut by the junction rule (250 over 125; one thickness mitres at a
     corner, stops at the face it abuts), less the columns and the core, and measured along its
     centreline chord under the soffit it meets.
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_EVEN, Decimal
from typing import Any

from . import model as M

D = Decimal
Pt = tuple[Decimal, Decimal]
SNAP = D("1e-6")
TOL = D("1e-7")
NUDGE = D("0.001")
PROBE = D(1)
MM2 = D(10) ** 6
MM3 = D(10) ** 9
MM = D(1000)
LIMIT = D("0.1") * MM2
Q3 = D("0.001")
RANK = {"BW250": 2, "BW125": 1}


def _q(v: Decimal) -> str:
    return str(v.quantize(Q3, rounding=ROUND_HALF_EVEN))


# ---------------------------------------------------------------------------------------------
# Path 2's own geometry
# ---------------------------------------------------------------------------------------------


def _x(o: Pt, a: Pt, b: Pt) -> Decimal:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def signed_area(poly: list[Pt]) -> Decimal:
    return sum((poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
                for i in range(len(poly))), D(0)) / 2


def dist(p: Pt, q: Pt) -> Decimal:
    return ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2).sqrt()


def contains(poly: list[Pt], p: Pt) -> bool:
    """Even-odd ray cast (a point on an edge may answer either way; callers never ask one)."""
    inside = False
    n = len(poly)
    for i in range(n):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
        if (y0 > p[1]) != (y1 > p[1]):
            xc = x0 + (p[1] - y0) * (x1 - x0) / (y1 - y0)
            if xc > p[0]:
                inside = not inside
    return inside


def halfplane(poly: list[Pt], o: Pt, n: Pt) -> list[Pt]:
    """The part of a convex polygon where (p − o)·n ≥ 0."""
    out: list[Pt] = []
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        dp = (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1]
        dq = (q[0] - o[0]) * n[0] + (q[1] - o[1]) * n[1]
        if dp >= 0:
            out.append(p)
        if (dp >= 0) != (dq >= 0):
            t = dp / (dp - dq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out if len(out) >= 3 and abs(signed_area(out)) > TOL else []


def minus(pieces: list[list[Pt]], cutter: list[Pt]) -> list[list[Pt]]:
    """Convex pieces less one convex cutter (the part outside each of its edges, in turn)."""
    c = cutter if signed_area(cutter) > 0 else list(reversed(cutter))
    out: list[list[Pt]] = []
    for piece in pieces:
        if not _overlap(piece, c):
            out.append(piece)  # a cutter that only touches the piece leaves it whole
            continue
        rest = piece
        for i in range(len(c)):
            a, b = c[i], c[(i + 1) % len(c)]
            outward = (b[1] - a[1], a[0] - b[0])  # right of a→b is outside a CCW polygon
            part = halfplane(rest, a, outward)
            if part:
                out.append(part)
            rest = halfplane(rest, a, (-outward[0], -outward[1]))
            if not rest:
                break
    return out


def _overlap(p: list[Pt], c: list[Pt]) -> bool:
    """Do two convex polygons share interior (not just an edge or a point)?"""
    inter = p if signed_area(p) > 0 else list(reversed(p))
    for i in range(len(c)):
        a, b = c[i], c[(i + 1) % len(c)]
        inter = halfplane(inter, a, (a[1] - b[1], b[0] - a[0]))
        if not inter:
            return False
    return abs(signed_area(inter)) > TOL


def atan(x: Decimal) -> Decimal:
    """arctan by halving the argument until the series converges fast."""
    k = 0
    while abs(x) > D("0.05"):
        x = x / (1 + (1 + x * x).sqrt())
        k += 1
    term, total, n = x, x, 1
    while True:
        term = -term * x * x
        n += 2
        nxt = term / n
        if abs(nxt) < D("1e-40"):
            return total * (2**k)
        total += nxt


# ---------------------------------------------------------------------------------------------
# The solids and the planar faces
# ---------------------------------------------------------------------------------------------


def unit(w: dict[str, Any]) -> tuple[Pt, Decimal]:
    (ax, ay), (bx, by) = w["a"], w["b"]
    ll = dist(w["a"], w["b"])
    return ((bx - ax) / ll, (by - ay) / ll), ll


def _rect_along(a: Pt, b: Pt, t: Decimal, ea: Decimal, eb: Decimal) -> list[Pt]:
    ll = dist(a, b)
    ux, uy = (b[0] - a[0]) / ll, (b[1] - a[1]) / ll
    h = t / 2
    a2 = (a[0] - ux * ea, a[1] - uy * ea)
    b2 = (b[0] + ux * eb, b[1] + uy * eb)
    nx, ny = -uy * h, ux * h
    return [(a2[0] - nx, a2[1] - ny), (b2[0] - nx, b2[1] - ny), (b2[0] + nx, b2[1] + ny), (a2[0] + nx, a2[1] + ny)]


def _plain(w: dict[str, Any]) -> list[Pt]:
    """The wall's band run t/2 past a meeting end — only to find what meets it."""
    h = w["t"] / 2
    return _rect_along(w["a"], w["b"], w["t"], h if w["ends"][0] == "J" else D(0), h if w["ends"][1] == "J" else D(0))


_BANDS: dict[tuple[int, str], list[Pt]] = {}


def band(w: dict[str, Any], walls: list[dict[str, Any]]) -> list[Pt]:
    """The wall's solid: its centreline ± t/2, run past an end that meets other walls by half the
    thickest of them, so a junction closes flush on the far face and never overshoots it."""
    key = (id(walls), w["id"])
    if key not in _BANDS:
        _BANDS[key] = _band(w, walls)
    return _BANDS[key]


def _band(w: dict[str, Any], walls: list[dict[str, Any]]) -> list[Pt]:
    ext = []
    for end, flag in ((w["a"], w["ends"][0]), (w["b"], w["ends"][1])):
        if flag != "J":
            ext.append(D(0))
            continue
        met = [v["t"] / 2 for v in walls if v["id"] != w["id"] and _convex_has(_plain(v), end)]
        ext.append(max(met) if met else w["t"] / 2)
    return _rect_along(w["a"], w["b"], w["t"], ext[0], ext[1])


def arc_piece(lw: dict[str, Any]) -> tuple[list[Pt], tuple[Pt, Pt]]:
    """The planter's curved end as a solid whose inner edge is the arc's CHORD (the segment between
    chord and arc is added back analytically, `segment`), and the chord itself."""
    cx, cy = lw["centre"]
    r = lw["r_in"]
    low = (cx, cy - r)
    top = (cx + (r * r - (cy - lw["y_cut"]) ** 2).sqrt(), lw["y_cut"])
    x_out = cx + lw["r_out"]
    y_out = cy - lw["r_out"]
    return [(cx, y_out), (x_out, y_out), (x_out, lw["y_cut"]), top, low], (low, top)


def segment(chord: tuple[Pt, Pt], centre: Pt, r: Decimal) -> Decimal:
    """The circular segment between a chord and its arc: r²/2 (θ − sin θ)."""
    p, q = chord
    vx, vy = p[0] - centre[0], p[1] - centre[1]
    wx, wy = q[0] - centre[0], q[1] - centre[1]
    cr = abs(vx * wy - vy * wx)
    dot = vx * wx + vy * wy
    assert dot > 0, "path 2: the planter's arc spans more than a quarter turn"
    theta = atan(cr / dot)
    return r * r / 2 * (theta - cr / (r * r))


def solids(lv: dict[str, Any]) -> tuple[list[list[Pt]], list[tuple[tuple[Pt, Pt], Pt, Decimal]]]:
    polys = [band(w, lv["walls"]) for w in lv["walls"]]
    polys += [c["poly"] for c in lv["core"]]
    arcs = []
    for lw in lv["low_walls"]:
        if lw["kind"] == "ARC":
            poly, chord = arc_piece(lw)
            polys.append(poly)
            arcs.append((chord, lw["centre"], lw["r_in"]))
        else:
            polys.append(lw["poly"])
    return polys, arcs


def _k(p: Pt) -> tuple[Decimal, Decimal]:
    return (p[0].quantize(SNAP), p[1].quantize(SNAP))


def faces(polys: list[list[Pt]]) -> list[list[Pt]]:
    """Every cycle of the arrangement of the polygons' edges, as vertex lists (CCW: bounded faces;
    CW: the outer boundaries of connected pieces, seen from outside)."""
    segs = []
    for poly in polys:
        for i in range(len(poly)):
            p, q = poly[i], poly[(i + 1) % len(poly)]
            if _k(p) != _k(q):
                segs.append((p, q))
    params: list[set[Decimal]] = [{D(0), D(1)} for _ in segs]
    boxes = [(min(p[0], q[0]), min(p[1], q[1]), max(p[0], q[0]), max(p[1], q[1])) for p, q in segs]
    order = sorted(range(len(segs)), key=lambda i: boxes[i][0])
    for oi, i in enumerate(order):
        bi = boxes[i]
        for j in order[oi + 1:]:
            bj = boxes[j]
            if bj[0] > bi[2] + TOL:
                break
            if bj[1] > bi[3] + TOL or bi[1] > bj[3] + TOL:
                continue
            _meet(segs[i], segs[j], params[i], params[j])
    verts: dict[tuple[Decimal, Decimal], Pt] = {}
    edges: set[tuple[tuple[Decimal, Decimal], tuple[Decimal, Decimal]]] = set()
    for (p, q), ts in zip(segs, params, strict=True):
        pts = [(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t) for t in sorted(ts)]
        for a, b in zip(pts, pts[1:], strict=False):
            ka, kb = _k(a), _k(b)
            if ka == kb:
                continue
            verts.setdefault(ka, a)
            verts.setdefault(kb, b)
            edges.add((ka, kb) if ka < kb else (kb, ka))
    around: dict[tuple[Decimal, Decimal], list[tuple[float, tuple[Decimal, Decimal]]]] = {}
    for ka, kb in edges:
        for u, v in ((ka, kb), (kb, ka)):
            ang = math.atan2(float(verts[v][1] - verts[u][1]), float(verts[v][0] - verts[u][0]))
            around.setdefault(u, []).append((ang, v))
    for lst in around.values():
        lst.sort()
    nbrs = {u: [v for _, v in lst] for u, lst in around.items()}
    seen: set[tuple[Any, Any]] = set()
    cycles = []
    for ka, kb in sorted(edges):
        for start in ((ka, kb), (kb, ka)):
            if start in seen:
                continue
            cyc = []
            he = start
            while he not in seen:
                seen.add(he)
                u, v = he
                cyc.append(verts[u])
                lst = nbrs[v]
                w = lst[(lst.index(u) - 1) % len(lst)]
                he = (v, w)
            cycles.append(cyc)
    return cycles


def _meet(s1: tuple[Pt, Pt], s2: tuple[Pt, Pt], t1: set[Decimal], t2: set[Decimal]) -> None:
    (p, p2), (q, q2) = s1, s2
    r = (p2[0] - p[0], p2[1] - p[1])
    s = (q2[0] - q[0], q2[1] - q[1])
    den = r[0] * s[1] - r[1] * s[0]
    qp = (q[0] - p[0], q[1] - p[1])
    rr = r[0] * r[0] + r[1] * r[1]
    ss = s[0] * s[0] + s[1] * s[1]
    if den * den <= TOL * TOL * rr * ss:
        side = qp[0] * r[1] - qp[1] * r[0]
        if side * side > TOL * TOL * rr:
            return  # parallel, apart
        for end, ts, base, d, dd in ((q, t1, p, r, rr), (q2, t1, p, r, rr), (p, t2, q, s, ss), (p2, t2, q, s, ss)):
            t = ((end[0] - base[0]) * d[0] + (end[1] - base[1]) * d[1]) / dd
            if 0 < t < 1:
                ts.add(t)
        return
    t = (qp[0] * s[1] - qp[1] * s[0]) / den
    u = (qp[0] * r[1] - qp[1] * r[0]) / den
    lo, hi = -TOL, 1 + TOL
    if lo <= t <= hi and lo <= u <= hi:
        t1.add(min(max(t, D(0)), D(1)))
        t2.add(min(max(u, D(0)), D(1)))


def _inner_point(cyc: list[Pt]) -> Pt:
    """A point just to the left of the cycle's longest edge (inside a CCW cycle, outside a CW one)."""
    best = max(range(len(cyc)), key=lambda i: dist(cyc[i], cyc[(i + 1) % len(cyc)]))
    p, q = cyc[best], cyc[(best + 1) % len(cyc)]
    ll = dist(p, q)
    return ((p[0] + q[0]) / 2 - (q[1] - p[1]) / ll * NUDGE, (p[1] + q[1]) / 2 + (q[0] - p[0]) / ll * NUDGE)


_FREE: dict[tuple[Any, ...], list[dict[str, Any]]] = {}


def free_faces(polys: list[list[Pt]]) -> list[dict[str, Any]]:
    """The bounded faces no solid covers, each with its holes. A pure function of the solids, so two
    levels with the same walls and core share one arrangement."""
    key = tuple(tuple(p) for p in polys)
    if key not in _FREE:
        _FREE[key] = _free_faces(polys)
    return _FREE[key]


def _free_faces(polys: list[list[Pt]]) -> list[dict[str, Any]]:
    cycles = faces(polys)
    ccws = [c for c in cycles if signed_area(c) > 0]
    cws = [c for c in cycles if signed_area(c) < 0]
    free = [{"outer": c, "holes": []} for c in ccws if not any(contains(s, _inner_point(c)) for s in polys)]
    for h in cws:
        p = _inner_point(h)
        hosts = [f for f in free if contains(f["outer"], p)]
        if hosts:
            min(hosts, key=lambda f: signed_area(f["outer"]))["holes"].append(h)
    return free


def face_contains(f: dict[str, Any], p: Pt) -> bool:
    return contains(f["outer"], p) and not any(contains(h, p) for h in f["holes"])


def face_area(f: dict[str, Any]) -> Decimal:
    return signed_area(f["outer"]) + sum((signed_area(h) for h in f["holes"]), D(0))


def face_edges(f: dict[str, Any]) -> list[tuple[Pt, Pt]]:
    out = []
    for cyc in [f["outer"], *f["holes"]]:
        for i in range(len(cyc)):
            out.append((cyc[i], cyc[(i + 1) % len(cyc)]))
    return out


# ---------------------------------------------------------------------------------------------
# What stands over a point
# ---------------------------------------------------------------------------------------------


def _convex_has(poly: list[Pt], p: Pt) -> bool:
    """On or inside a convex polygon of either orientation (its turn is read off one corner)."""
    n = len(poly)
    turn = next((t for t in (_x(poly[i], poly[(i + 1) % n], poly[(i + 2) % n]) for i in range(n)) if t != 0), D(1))
    sign = 1 if turn > 0 else -1
    return all(sign * _x(poly[i], poly[(i + 1) % n], p) >= -TOL for i in range(n))


def ceiling_t(lv: dict[str, Any], p: Pt) -> Decimal:
    """How far below the floor over the soffit stands at p (the finish soffit: beams inside faces)."""
    sunken = [s for s in lv["slabs_over"] if s["sunken"] and _convex_has(s["poly"], p)]
    if sunken:
        return M.SUNKEN_DROP + sunken[0]["t"]
    flat = [s for s in lv["slabs_over"] if _convex_has(s["poly"], p)]
    assert flat, f"path 2: no slab over ({p[0]}, {p[1]})"
    return flat[0]["t"]


def _beam_band(bm: dict[str, Any]) -> list[Pt]:
    return _rect_along(bm["p0"], bm["p1"], bm["b"], D(0), D(0))


def top_t(lv: dict[str, Any], p: Pt) -> Decimal:
    """How far below the floor over a wall's top stands at p: a beam's depth, else a sunken panel's
    drop wall (the 125 ring round the panel), else the slab over."""
    beams = [bm["depth"] for bm in lv["beams_over"] if _convex_has(_beam_band(bm), p)]
    if beams:
        return max(beams)
    for s in lv["slabs_over"]:
        if not s["sunken"]:
            continue
        xs = [q[0] for q in s["poly"]]
        ys = [q[1] for q in s["poly"]]
        near = min(xs) - M.T125 <= p[0] <= max(xs) + M.T125 and min(ys) - M.T125 <= p[1] <= max(ys) + M.T125
        within = min(xs) < p[0] < max(xs) and min(ys) < p[1] < max(ys)
        if near and not within:
            return M.SUNKEN_DROP
    return ceiling_t(lv, p)


def _cuts(p: Pt, q: Pt, polys: list[list[Pt]]) -> list[Decimal]:
    ts = {D(0), D(1)}
    lo_x, hi_x, lo_y, hi_y = min(p[0], q[0]), max(p[0], q[0]), min(p[1], q[1]), max(p[1], q[1])
    for poly in polys:
        if max(v[0] for v in poly) < lo_x or min(v[0] for v in poly) > hi_x or max(v[1] for v in poly) < lo_y \
                or min(v[1] for v in poly) > hi_y:
            continue
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            tt: set[Decimal] = set()
            _meet((p, q), (a, b), tt, set())
            ts |= {t for t in tt if 0 < t < 1}
    return sorted(ts)


def _zone_polys(lv: dict[str, Any], with_beams: bool) -> list[list[Pt]]:
    polys = [s["poly"] for s in lv["slabs_over"]]
    if with_beams:
        polys += [_beam_band(bm) for bm in lv["beams_over"]]
        for s in lv["slabs_over"]:
            if s["sunken"]:
                xs = [q[0] for q in s["poly"]]
                ys = [q[1] for q in s["poly"]]
                r = M.T125
                polys.append([(min(xs) - r, min(ys) - r), (max(xs) + r, min(ys) - r), (max(xs) + r, max(ys) + r),
                              (min(xs) - r, max(ys) + r)])
    return polys


# ---------------------------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------------------------


def name_faces(lv: dict[str, Any], free: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Each room / void id → the one free face its labels stand in (every free face is named)."""
    named: dict[int, str] = {}
    out: dict[str, dict[str, Any]] = {}
    for r in lv["rooms"]:
        for lab in r["labels"]:
            hits = [i for i, f in enumerate(free) if face_contains(f, lab["at"])]
            assert len(hits) == 1, f"path 2: the label {lab['text']} of {r['id']} stands in {len(hits)} free faces"
            i = hits[0]
            assert named.get(i, r["id"]) == r["id"], f"path 2: {r['id']} and {named[i]} name one face"
            named[i] = r["id"]
            out[r["id"]] = free[i]
    unnamed = [i for i in range(len(free)) if i not in named]
    assert not unnamed, f"path 2: {len(unnamed)} free face(s) no label names, e.g. {free[unnamed[0]]['outer'][:3]}"
    for lab in lv["open_labels"]:
        assert not any(face_contains(f, lab["at"]) for f in free), f"path 2: {lab['text']} is enclosed"
    return out


def allocate(lv: dict[str, Any], named: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    """Which faces each opening opens onto: probe both sides of its host wall at its centre."""
    walls = {w["id"]: w for w in lv["walls"]}
    out: dict[str, list[str]] = {}
    for o in lv["openings"]:
        w = walls[o["host"]]
        (ux, uy), _ = unit(w)
        s0, s1 = span(w, o)
        mid = (s0 + s1) / 2
        c = (w["a"][0] + ux * mid, w["a"][1] + uy * mid)
        off = w["t"] / 2 + PROBE
        sides = []
        for sgn in (1, -1):
            p = (c[0] - uy * off * sgn, c[1] + ux * off * sgn)
            hit = [rid for rid, f in named.items() if face_contains(f, p)]
            sides += hit
        out[o["id"]] = sides
    return out


def span(w: dict[str, Any], o: dict[str, Any]) -> tuple[Decimal, Decimal]:
    """Path 2's own reading of where an opening stands along its host, from the host's `a` end."""
    (ax, ay), (bx, by) = w["a"], w["b"]
    if ay == by:
        s = o["lo"] - ax if bx > ax else ax - o["lo"] - o["w"]
    elif ax == bx:
        s = o["lo"] - ay if by > ay else ay - o["lo"] - o["w"]
    else:
        s = o["lo"]
    return (s, s + o["w"])


def column_bits(lv: dict[str, Any], polys: list[list[Pt]], named: dict[str, dict[str, Any]]
                ) -> dict[str, list[tuple[str, Decimal]]]:
    """Each column less every solid, piece by piece, credited to the face its piece stands in."""
    out: dict[str, dict[str, Decimal]] = {}
    for c in lv["columns"]:
        pieces = [c["poly"] if signed_area(c["poly"]) > 0 else list(reversed(c["poly"]))]
        for s in polys:
            pieces = minus(pieces, s)
        for pc in pieces:
            a = abs(signed_area(pc))
            cx = sum((p[0] for p in pc), D(0)) / len(pc)
            cy = sum((p[1] for p in pc), D(0)) / len(pc)
            hit = [rid for rid, f in named.items() if face_contains(f, (cx, cy))]
            for rid in hit:
                out.setdefault(rid, {}).setdefault(c["id"], D(0))
                out[rid][c["id"]] += a
    return {rid: sorted(v.items()) for rid, v in out.items()}


def _pieces_with_heights(lv: dict[str, Any], f: dict[str, Any]) -> list[tuple[Decimal, Decimal]]:
    zpolys = _zone_polys(lv, with_beams=False)
    out = []
    for p, q in face_edges(f):
        ll = dist(p, q)
        nx, ny = -(q[1] - p[1]) / ll, (q[0] - p[0]) / ll
        ts = _cuts(p, q, zpolys)
        for t0, t1 in zip(ts, ts[1:], strict=False):
            tm = (t0 + t1) / 2
            m = (p[0] + (q[0] - p[0]) * tm + nx * PROBE, p[1] + (q[1] - p[1]) * tm + ny * PROBE)
            out.append((ll * (t1 - t0), lv["storey_h"] - ceiling_t(lv, m)))
    return out


def rooms(level: str, lv: dict[str, Any], world: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    polys, arcs = solids(lv)
    free = free_faces(polys)
    named = name_faces(lv, free)
    alloc = allocate(lv, named)
    bits = column_bits(lv, polys, named)
    rows = []
    for r in lv["rooms"]:
        if r["kind"] == "VOID":
            continue
        rid = r["id"]
        f = named[rid]
        gross = face_area(f)
        if r["kind"] == "VERANDAH":
            for chord, centre, rad in arcs:
                if any(_k(chord[0]) == _k(p) or _k(chord[1]) == _k(p) for p in f["outer"]):
                    gross += segment(chord, centre, rad)
            rows.append({"k": ("SURFACE", "FLOORING", level, "FLOOR", rid), "q": gross / MM2})
            continue
        ft = world["finish_types"][r["finish"]]
        big = [(cid, a) for cid, a in bits.get(rid, []) if a > LIMIT]
        floor = gross - sum((a for _, a in big), D(0))
        rows.append({"k": ("SURFACE", "FLOORING", level, "FLOOR", rid), "q": floor / MM2})
        rows.append({"k": ("SURFACE", "PLASTER", level, "CEILING", rid), "q": floor / MM2})
        rows.append({"k": ("SURFACE", "PAINT", level, "CEILING", rid), "q": floor / MM2})
        pieces = _pieces_with_heights(lv, f)
        floor_of_band = ft["dado"] if ft.get("dado") else (ft.get("skirting") or D(0))
        ops = [o for o in lv["openings"] if rid in alloc[o["id"]]]
        ded = [o for o in ops if o["w"] * o["h"] > LIMIT]
        wall = sum((ll * (h - floor_of_band) for ll, h in pieces), D(0))
        for o in ded:
            top = o["sill"] + o["h"]
            wall -= o["w"] * max(D(0), top - max(floor_of_band, o["sill"]))
        rows.append({"k": ("SURFACE", "PLASTER", level, "WALL", rid), "q": wall / MM2})
        rows.append({"k": ("SURFACE", "PAINT", level, "WALL", rid), "q": wall / MM2})
        if ft.get("dado"):
            tile = sum((ll * min(floor_of_band, h) for ll, h in pieces), D(0))
            for o in ded:
                tile -= o["w"] * max(D(0), min(floor_of_band, o["sill"] + o["h"]) - o["sill"])
            rows.append({"k": ("SURFACE", "WALL_TILE", level, "DADO", rid), "q": tile / MM2})
        if ft.get("skirting"):
            run = sum((ll for ll, _ in pieces), D(0)) - sum((o["w"] for o in ops if o["sill"] == 0), D(0))
            rows.append({"k": ("SURFACE", "SKIRTING", level, "SKIRTING", rid), "q": run / MM})
    return rows, {"named": named, "alloc": alloc, "bits": bits, "free": free}


# ---------------------------------------------------------------------------------------------
# Brickwork
# ---------------------------------------------------------------------------------------------


def _ends_at(p: Pt, w: dict[str, Any]) -> bool:
    return dist(p, w["a"]) <= TOL * 1000 or dist(p, w["b"]) <= TOL * 1000


def owned(w: dict[str, Any], lv: dict[str, Any]) -> list[list[Pt]]:
    """The band this wall owns after the junction rule, the columns and the core."""
    (ux, uy), _ = unit(w)
    pieces = [band(w, lv["walls"])]
    others = [v for v in lv["walls"] if v["id"] != w["id"]]
    for end, flag in ((w["a"], w["ends"][0]), (w["b"], w["ends"][1])):
        if flag != "J":
            continue
        away = (ux, uy) if end == w["a"] else (-ux, -uy)
        for v in others:
            vb = band(v, lv["walls"])
            if not _convex_has(vb, end):
                continue
            if RANK[v["type"]] > RANK[w["type"]]:
                pieces = minus(pieces, vb)
                continue
            if RANK[v["type"]] < RANK[w["type"]]:
                continue
            if not _ends_at(end, v):
                pieces = minus(pieces, vb)  # it abuts v, which runs through: stop at v's face
                continue
            (vx, vy), _ = unit(v)
            v_away = (vx, vy) if dist(end, v["a"]) < dist(end, v["b"]) else (-vx, -vy)
            if abs(away[0] * v_away[1] - away[1] * v_away[0]) <= TOL:
                n = away  # collinear, end to end: cut square across the joint
            else:
                n = (away[0] - v_away[0], away[1] - v_away[1])  # the mitre, on the centrelines' meeting point
            pieces = [pc for pc in (halfplane(p, end, n) for p in pieces) if pc]
    for c in lv["columns"] + lv["core"]:
        pieces = minus(pieces, c["poly"])
    return pieces


def chord(piece: list[Pt], w: dict[str, Any]) -> tuple[Decimal, Decimal] | None:
    """Where the wall's centreline runs through a convex piece, as distances from its `a` end."""
    (ux, uy), _ = unit(w)
    lo, hi = D(-10) ** 9, D(10) ** 9
    ccw_p = piece if signed_area(piece) > 0 else list(reversed(piece))
    for i in range(len(ccw_p)):
        a, b = ccw_p[i], ccw_p[(i + 1) % len(ccw_p)]
        # inside: cross(a, b, p) ≥ 0 with p = w.a + s·u → linear in s
        c0 = _x(a, b, w["a"])
        c1 = (b[0] - a[0]) * uy - (b[1] - a[1]) * ux
        if c1 == 0:
            if c0 < -TOL:
                return None
            continue
        s = -c0 / c1
        if c1 > 0:
            lo = max(lo, s)
        else:
            hi = min(hi, s)
    return (lo, hi) if hi - lo > TOL else None


def _union(spans: list[tuple[Decimal, Decimal]]) -> list[tuple[Decimal, Decimal]]:
    """Merge centreline intervals: two pieces that meet along the centreline share one chord."""
    out: list[tuple[Decimal, Decimal]] = []
    for a, b in sorted(spans):
        if out and a <= out[-1][1] + TOL:
            out[-1] = (out[-1][0], max(out[-1][1], b))
        else:
            out.append((a, b))
    return out


S25_BY_SIZE = {("3'-4\"", "4'-0\""): "L1", ("5'-0\"", "4'-0\""): "LS1", ("4'-0\"", "7'-0\""): "L2"}


def _ftin(mm: Decimal) -> str:
    inches = mm / M.IN
    assert inches == inches.to_integral_value(), f"path 2: {mm} mm is not a whole inch"
    i = int(inches)
    return f"{i // 12}'-{i % 12}\""


def s25_class(o: dict[str, Any]) -> str | None:
    """S-25's class of an opening, read from its size the way the structural engineer reads the
    architect's schedule (L1 over the 3'-4\" windows, LS1 over the 5'-0\" ones, L2 over the 4'-0\"
    door-height openings)."""
    if o["w"] / M.IN != (o["w"] / M.IN).to_integral_value():
        return None
    return S25_BY_SIZE.get((_ftin(o["w"]), _ftin(o["h"])))


def brick(level: str, lv: dict[str, Any]) -> list[dict[str, Any]]:
    zpolys = _zone_polys(lv, with_beams=True)
    total = {"BW250": D(0), "BW125": D(0)}
    for w in lv["walls"]:
        (ux, uy), _ = unit(w)
        spans: list[tuple[Decimal, Decimal, Decimal]] = []
        for ch in _union([c for c in (chord(pc, w) for pc in owned(w, lv)) if c is not None]):
            p = (w["a"][0] + ux * ch[0], w["a"][1] + uy * ch[0])
            q = (w["a"][0] + ux * ch[1], w["a"][1] + uy * ch[1])
            ts = _cuts(p, q, zpolys)
            for t0, t1 in zip(ts, ts[1:], strict=False):
                tm = (t0 + t1) / 2
                m = (p[0] + (q[0] - p[0]) * tm, p[1] + (q[1] - p[1]) * tm)
                h = lv["storey_h"] - top_t(lv, m)
                a0, a1 = ch[0] + (ch[1] - ch[0]) * t0, ch[0] + (ch[1] - ch[0]) * t1
                spans.append((a0, a1, h))
                total[w["type"]] += (a1 - a0) * w["t"] * h
        for o in (o for o in lv["openings"] if o["host"] == w["id"]):
            if o["w"] * o["h"] > LIMIT:
                total[w["type"]] -= o["w"] * o["h"] * w["t"]
            cls = s25_class(o) if w["type"] == "BW250" else None
            if cls is not None:
                lt = lv["lintels"][cls]
                s0, s1 = span(w, o)
                mid = (s0 + s1) / 2
                under = [h for a0, a1, h in spans if a1 > mid - lt["length"] / 2 and a0 < mid + lt["length"] / 2]
                assert under and o["sill"] + o["h"] + lt["depth"] <= min(under), f"path 2: lintel over {o['id']}"
                total[w["type"]] -= lt["b"] * lt["depth"] * lt["length"]
    return [
        {"k": ("BRICK_WALL", "BRICKWORK", level, kind, None), "q": total[kind] / MM3}
        for kind in ("BW125", "BW250")
        if any(w["type"] == kind for w in lv["walls"])
    ]


def openings(level: str, lv: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    marks = sorted({o["mark"] for o in lv["openings"]})
    for mark in marks:
        mine = [o for o in lv["openings"] if o["mark"] == mark]
        out.append({"k": ("OPENING", "OPENING_COUNT", level, None, mark), "q": D(len(mine))})
        out.append({"k": ("OPENING", "OPENING_AREA", level, None, mark),
                    "q": sum((o["w"] * o["h"] for o in mine), D(0)) / MM2})
    return out


def compute(world: dict[str, Any], found: dict[str, Any] | None = None) -> dict[tuple[Any, ...], str]:
    """Path 2's rows, keyed (class, kind, level, component, room-or-mark) → quantity as printed. What
    it found on each level (named faces, allocation, column pieces) is left in `found` if one is given."""
    out: dict[tuple[Any, ...], str] = {}
    for level, lv in world["levels"].items():
        rows, info = rooms(level, lv, world)
        if found is not None:
            found[level] = info
        for r in rows + brick(level, lv) + openings(level, lv):
            q = str(int(r["q"])) if r["k"][1] == "OPENING_COUNT" else _q(r["q"])
            assert r["k"] not in out, f"path 2: {r['k']} twice"
            out[r["k"]] = q
    return out


def derive(level: str, lv: dict[str, Any], world: dict[str, Any]) -> dict[str, Any]:
    """What path 2 found on one level (for the selfcheck and the drawing): named faces, allocation."""
    return rooms(level, lv, world)[1]
