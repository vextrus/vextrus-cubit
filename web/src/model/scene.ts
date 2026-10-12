/*
 * The 3D Live Model's scene (session-16 contract, C17: "The browser merges per storey"). From the
 * Elements' primitives (`GET /api/projects/{project_id}/takeoff/model/primitives`) it builds one merged
 * mesh per storey: one geometry, one material, so one draw call a storey whatever the count of Elements.
 * The state of each Element (confirmed, proposal, held) is a vertex colour, so the merge keeps one material.
 *
 *   const scene = buildScene(elements)
 *   scene.meshesByStorey['GF']        // THREE.Mesh, one per storey
 *   scene.volumeOf(id)                // m3, from the mesh's own triangles (a closed solid's signed volume)
 *   scene.boundsOf(id)                // { min, max } in the primitives' frame (x, y, z up), metres
 *   scene.isolate('GF')               // shows only that storey; null shows all
 *   scene.elementAt(mesh, faceIndex)  // the Element a ray hit
 *
 * The primitives' frame is kept: z is up, and the camera's up is z (orbit.ts). The geometry is held
 * relative to the model's centre (`origin`) so the 32-bit vertices keep their precision whatever the
 * drawing's coordinates; volumes and bounds are computed in 64-bit before that shift and returned in the
 * primitives' frame.
 *
 * A `cylinder` is drawn as a 24-sided prism (its volume is the prism's); a `sloped_prism` is not drawn
 * yet (`unsupported` counts the primitives left out).
 */
import * as THREE from 'three'

export type ElementState = 'confirmed' | 'proposal' | 'held'

type Num = string | number

export type Primitive =
  | { kind: 'prism'; polygon: Num[][]; holes?: Num[][][]; z0: Num; z1: Num }
  | { kind: 'cylinder'; centre: Num[]; radius: Num; z0: Num; z1: Num }
  | { kind: 'sloped_prism'; [field: string]: unknown }

export interface ElementPrimitives {
  element_id: string
  family: string
  storey: string
  part: string
  state: ElementState
  primitives: Primitive[]
}

export type Vec3 = [number, number, number]
export interface Bounds {
  min: Vec3
  max: Vec3
}

/** What each state looks like (screens.md ruling 6: a Proposal is opaque cyan; ruling 10: a held Element is amber). */
export const STATE_COLOURS: Record<ElementState, number> = {
  confirmed: 0x9aa3ad,
  proposal: 0x22b8cf,
  held: 0xf0a020,
}
export const SELECTED_COLOUR = 0x4f46e5

const CYLINDER_SIDES = 24

interface Range {
  elementId: string
  /** First triangle and the count, in the storey's merged geometry. */
  first: number
  triangles: number
}

export interface Scene {
  group: THREE.Group
  meshesByStorey: Record<string, THREE.Mesh>
  /** The storeys, lowest first. */
  storeys: string[]
  /** The model's centre in the primitives' frame; the geometry is held relative to it. */
  origin: Vec3
  /** All Elements' bounds, in the primitives' frame; null for no Element. */
  bounds: Bounds | null
  /** Primitives left out (a `sloped_prism`). */
  unsupported: number
  volumeOf(elementId: string): number
  boundsOf(elementId: string): Bounds
  storeyOf(elementId: string): string | undefined
  /** Every Element drawn, lowest storey first: the order the keys step through. */
  elementIds(): string[]
  isolate(storey: string | null): void
  /** The Element a ray hit: the mesh and the face it met. */
  elementAt(mesh: THREE.Object3D, faceIndex: number): string | undefined
  /** Marks one Element selected (null clears); its colour returns to its state's. */
  select(elementId: string | null): void
  dispose(): void
}

const num = (v: Num) => (typeof v === 'number' ? v : Number(v))

/** A ring's signed area (positive: counter-clockwise). */
function signedArea(ring: readonly [number, number][]): number {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]!
    const [x1, y1] = ring[(i + 1) % ring.length]!
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

const ring = (points: readonly (readonly Num[])[]): [number, number][] => points.map((p) => [num(p[0]!), num(p[1]!)])

function cylinderRing(centre: readonly Num[], radius: Num): [number, number][] {
  const [cx, cy] = [num(centre[0]!), num(centre[1]!)]
  const r = num(radius)
  return Array.from({ length: CYLINDER_SIDES }, (_, i) => {
    const a = (2 * Math.PI * i) / CYLINDER_SIDES
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number]
  })
}

/** One solid's triangles, as flat x y z triples, outward facing. */
function solidTriangles(outer: [number, number][], holes: [number, number][][], z0: number, z1: number): number[] {
  if (outer.length < 3 || !(z1 > z0)) return []
  // Outer counter-clockwise, holes clockwise: every side wall's outward is its right-hand side.
  const o = signedArea(outer) >= 0 ? outer : [...outer].reverse()
  const hs = holes.filter((h) => h.length >= 3).map((h) => (signedArea(h) <= 0 ? h : [...h].reverse()))
  const out: number[] = []
  for (const r of [o, ...hs]) {
    for (let i = 0; i < r.length; i++) {
      const [ax, ay] = r[i]!
      const [bx, by] = r[(i + 1) % r.length]!
      out.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1)
    }
  }
  const all = [...o, ...hs.flat()]
  const tris = THREE.ShapeUtils.triangulateShape(
    o.map(([x, y]) => new THREE.Vector2(x, y)),
    hs.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y))),
  )
  for (const [i, j, k] of tris) {
    const a = all[i!]!
    let [b, c] = [all[j!]!, all[k!]!]
    // Top faces up (counter-clockwise seen from above), bottom faces down.
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) [b, c] = [c, b]
    out.push(a[0], a[1], z1, b[0], b[1], z1, c[0], c[1], z1)
    out.push(a[0], a[1], z0, c[0], c[1], z0, b[0], b[1], z0)
  }
  return out
}

function elementTriangles(e: ElementPrimitives): {
  triangles: number[]
  skipped: number
} {
  const triangles: number[] = []
  let skipped = 0
  for (const p of e.primitives) {
    if (p.kind === 'prism') triangles.push(...solidTriangles(ring(p.polygon), (p.holes ?? []).map(ring), num(p.z0), num(p.z1)))
    else if (p.kind === 'cylinder') triangles.push(...solidTriangles(cylinderRing(p.centre, p.radius), [], num(p.z0), num(p.z1)))
    else skipped++
  }
  return { triangles, skipped }
}

/** A closed solid's volume from its triangles (signed tetrahedra), taken about the solid's own corner. */
function volumeOfTriangles(t: readonly number[], about: Vec3): number {
  let v = 0
  for (let i = 0; i < t.length; i += 9) {
    const ax = t[i]! - about[0],
      ay = t[i + 1]! - about[1],
      az = t[i + 2]! - about[2]
    const bx = t[i + 3]! - about[0],
      by = t[i + 4]! - about[1],
      bz = t[i + 5]! - about[2]
    const cx = t[i + 6]! - about[0],
      cy = t[i + 7]! - about[1],
      cz = t[i + 8]! - about[2]
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  }
  return v
}

function boundsOfTriangles(t: readonly number[]): Bounds {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < t.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, t[i + k]!)
      max[k] = Math.max(max[k]!, t[i + k]!)
    }
  }
  return { min, max }
}

const EMPTY_BOUNDS: Bounds = { min: [0, 0, 0], max: [0, 0, 0] }

export function buildScene(elements: readonly ElementPrimitives[]): Scene {
  interface Built {
    e: ElementPrimitives
    triangles: number[]
    volume: number
    bounds: Bounds
  }
  const built: Built[] = []
  let unsupported = 0
  for (const e of elements) {
    const { triangles, skipped } = elementTriangles(e)
    unsupported += skipped
    if (triangles.length === 0) continue
    const bounds = boundsOfTriangles(triangles)
    built.push({
      e,
      triangles,
      bounds,
      volume: volumeOfTriangles(triangles, bounds.min),
    })
  }

  const all: Bounds | null = built.length
    ? {
        min: [0, 1, 2].map((k) => Math.min(...built.map((b) => b.bounds.min[k]!))) as Vec3,
        max: [0, 1, 2].map((k) => Math.max(...built.map((b) => b.bounds.max[k]!))) as Vec3,
      }
    : null
  const origin: Vec3 = all ? [(all.min[0] + all.max[0]) / 2, (all.min[1] + all.max[1]) / 2, (all.min[2] + all.max[2]) / 2] : [0, 0, 0]

  const byStorey = new Map<string, Built[]>()
  for (const b of built) byStorey.set(b.e.storey, [...(byStorey.get(b.e.storey) ?? []), b])
  const storeys = [...byStorey.keys()].sort((a, b) => {
    const za = Math.min(...byStorey.get(a)!.map((x) => x.bounds.min[2]))
    const zb = Math.min(...byStorey.get(b)!.map((x) => x.bounds.min[2]))
    return za - zb || a.localeCompare(b)
  })

  const group = new THREE.Group()
  const meshesByStorey: Record<string, THREE.Mesh> = {}
  const ranges = new Map<string, Range[]>()
  const byElement = new Map<string, Built>()
  const colours = new Map<string, THREE.BufferAttribute>()
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  })

  for (const storey of storeys) {
    const members = byStorey.get(storey)!
    const count = members.reduce((n, m) => n + m.triangles.length / 3, 0)
    const position = new Float32Array(count * 3)
    const normal = new Float32Array(count * 3)
    const colour = new Float32Array(count * 3)
    const list: Range[] = []
    let at = 0 // vertex index
    for (const m of members) {
      const first = at / 3
      const c = new THREE.Color(STATE_COLOURS[m.e.state])
      for (let i = 0; i < m.triangles.length; i += 9) {
        const p = [0, 1, 2].map((v) => [m.triangles[i + v * 3]! - origin[0], m.triangles[i + v * 3 + 1]! - origin[1], m.triangles[i + v * 3 + 2]! - origin[2]])
        const u = new THREE.Vector3(p[1]![0]! - p[0]![0]!, p[1]![1]! - p[0]![1]!, p[1]![2]! - p[0]![2]!)
        const w = new THREE.Vector3(p[2]![0]! - p[0]![0]!, p[2]![1]! - p[0]![1]!, p[2]![2]! - p[0]![2]!)
        const n = u.cross(w).normalize()
        for (let v = 0; v < 3; v++) {
          position.set(p[v]!, at * 3)
          normal.set([n.x, n.y, n.z], at * 3)
          colour.set([c.r, c.g, c.b], at * 3)
          at++
        }
      }
      list.push({
        elementId: m.e.element_id,
        first,
        triangles: (at - first * 3) / 3,
      })
      byElement.set(m.e.element_id, m)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
    const colourAttribute = new THREE.BufferAttribute(colour, 3)
    geometry.setAttribute('color', colourAttribute)
    geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = storey
    meshesByStorey[storey] = mesh
    ranges.set(storey, list)
    colours.set(storey, colourAttribute)
    group.add(mesh)
  }

  const get = (id: string): Built => {
    const b = byElement.get(id)
    if (!b) throw new Error(`no such Element in the scene: ${id}`)
    return b
  }

  function paint(storey: string, range: Range, colour: THREE.Color) {
    const attribute = colours.get(storey)!
    for (let v = range.first * 3; v < (range.first + range.triangles) * 3; v++) attribute.setXYZ(v, colour.r, colour.g, colour.b)
    attribute.needsUpdate = true
  }

  let selected: string | null = null
  return {
    group,
    meshesByStorey,
    storeys,
    origin,
    bounds: all,
    unsupported,
    volumeOf: (id) => get(id).volume,
    boundsOf: (id) => {
      const b = byElement.get(id)?.bounds
      return b ? { min: [...b.min], max: [...b.max] } : { min: [...EMPTY_BOUNDS.min], max: [...EMPTY_BOUNDS.max] }
    },
    storeyOf: (id) => byElement.get(id)?.e.storey,
    elementIds: () => storeys.flatMap((storey) => byStorey.get(storey)!.map((b) => b.e.element_id)),
    isolate(storey) {
      for (const [name, mesh] of Object.entries(meshesByStorey)) mesh.visible = storey === null || storey === name
    },
    elementAt(mesh, faceIndex) {
      const list = ranges.get(mesh.name)
      return list?.find((r) => faceIndex >= r.first && faceIndex < r.first + r.triangles)?.elementId
    },
    select(id) {
      const repaint = (elementId: string, colour: THREE.Color) => {
        const b = byElement.get(elementId)
        if (!b) return
        const range = ranges.get(b.e.storey)!.find((r) => r.elementId === elementId)
        if (range) paint(b.e.storey, range, colour)
      }
      if (selected) repaint(selected, new THREE.Color(STATE_COLOURS[byElement.get(selected)!.e.state]))
      selected = id && byElement.has(id) ? id : null
      if (selected) repaint(selected, new THREE.Color(SELECTED_COLOUR))
    },
    dispose() {
      for (const mesh of Object.values(meshesByStorey)) mesh.geometry.dispose()
      material.dispose()
    },
  }
}
