/*
 * The 3D scene's own geometry (scene.ts, orbit.ts): volumes and bounds of solids the acceptance fixture
 * does not draw (a hole, a concave outline, a clockwise outline, a cylinder, far-off coordinates), the
 * face-to-Element map a pick uses, the selected colour and the orbit's limits.
 */
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { fitState, orbit, zoom } from './orbit'
import { buildScene, SELECTED_COLOUR, STATE_COLOURS, type ElementPrimitives, type Primitive } from './scene'

const el = (id: string, storey: string, primitives: Primitive[], state: ElementPrimitives['state'] = 'confirmed'): ElementPrimitives => ({
  element_id: id,
  family: 'column',
  storey,
  part: 'column',
  state,
  primitives,
})
const rect = (x: number, y: number, w: number, h: number): [number, number][] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]
const prism = (polygon: [number, number][], z0: number, z1: number, holes?: [number, number][][]): Primitive => ({
  kind: 'prism',
  polygon,
  z0,
  z1,
  ...(holes ? { holes } : {}),
})

describe('volumes', () => {
  it('takes a hole out of a prism', () => {
    const s = buildScene([el('a', 'GF', [prism(rect(0, 0, 4, 3), 0, 2, [rect(1, 1, 1, 1)])])])
    expect(s.volumeOf('a')).toBeCloseTo((12 - 1) * 2, 9)
  })

  it('reads a concave outline whichever way it is wound', () => {
    const l: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 1],
      [1, 1],
      [1, 3],
      [0, 3],
    ] // area 4 + 2
    const ccw = buildScene([el('a', 'GF', [prism(l, 0, 3)])])
    const cw = buildScene([el('a', 'GF', [prism([...l].reverse(), 0, 3)])])
    expect(ccw.volumeOf('a')).toBeCloseTo(18, 9)
    expect(cw.volumeOf('a')).toBeCloseTo(18, 9)
  })

  it('adds the solids of one Element', () => {
    const s = buildScene([el('a', 'GF', [prism(rect(0, 0, 1, 1), 0, 1), prism(rect(5, 5, 2, 1), 0, 3)])])
    expect(s.volumeOf('a')).toBeCloseTo(7, 9)
  })

  it('draws a cylinder as a 24-sided prism', () => {
    const s = buildScene([
      el('a', 'GF', [
        {
          kind: 'cylinder',
          centre: ['1', '1'],
          radius: '0.5',
          z0: '0',
          z1: '2',
        },
      ]),
    ])
    const polygonArea = (24 / 2) * 0.25 * Math.sin((2 * Math.PI) / 24)
    expect(s.volumeOf('a')).toBeCloseTo(polygonArea * 2, 9)
    expect(s.boundsOf('a').max[2]).toBe(2)
  })

  it('keeps its precision far from the origin (a drawing in survey coordinates)', () => {
    const s = buildScene([el('a', 'GF', [prism(rect(5e6, 9e6, 0.254, 0.508), 0, 2.921)])])
    expect(Math.abs(s.volumeOf('a') - 0.254 * 0.508 * 2.921)).toBeLessThanOrEqual(1e-6)
    expect(s.boundsOf('a').min[0]).toBe(5e6)
    // The 32-bit vertices are held about the model's centre, so they stay small.
    const position = s.meshesByStorey['GF']!.geometry.getAttribute('position')
    expect(Math.abs(position.getX(0))).toBeLessThan(1)
  })

  it('counts a primitive it cannot draw, and draws the rest', () => {
    const s = buildScene([el('a', 'GF', [prism(rect(0, 0, 1, 1), 0, 1), { kind: 'sloped_prism' }])])
    expect(s.unsupported).toBe(1)
    expect(s.volumeOf('a')).toBeCloseTo(1, 9)
  })
})

describe('the scene', () => {
  const two = [
    el('a', 'GF', [prism(rect(0, 0, 1, 1), 0, 3)]),
    el('b', 'GF', [prism(rect(4, 0, 1, 1), 0, 3)], 'proposal'),
    el('c', '1F', [prism(rect(0, 0, 1, 1), 3, 6)], 'held'),
  ]

  it('orders the storeys from the lowest', () => {
    expect(buildScene([...two].reverse()).storeys).toEqual(['GF', '1F'])
  })

  it('says which Element a face belongs to', () => {
    const s = buildScene(two)
    const gf = s.meshesByStorey['GF']!
    const faces = gf.geometry.getAttribute('position').count / 3
    const owners = Array.from({ length: faces }, (_, i) => s.elementAt(gf, i))
    expect(new Set(owners)).toEqual(new Set(['a', 'b']))
    expect(owners.filter((o) => o === 'a')).toHaveLength(owners.filter((o) => o === 'b').length)
    expect(s.elementAt(gf, faces)).toBeUndefined()
  })

  it('faces every triangle outward (a ray from outside hits the Element)', () => {
    const s = buildScene([el('a', 'GF', [prism(rect(0, 0, 4, 3), 0, 2, [rect(1, 1, 1, 1)])])])
    const mesh = s.meshesByStorey['GF']!
    const normal = mesh.geometry.getAttribute('normal')
    const position = mesh.geometry.getAttribute('position')
    const centre = new THREE.Vector3(2 - s.origin[0], 1.5 - s.origin[1], 1 - s.origin[2])
    for (let i = 0; i < position.count; i += 3) {
      const c = new THREE.Vector3().fromBufferAttribute(position, i)
      const n = new THREE.Vector3().fromBufferAttribute(normal, i)
      // Outward from the solid's middle, except the walls of the hole, which face into it.
      const inHole =
        c.x + s.origin[0] >= 1 - 1e-9 && c.x + s.origin[0] <= 2 + 1e-9 && c.y + s.origin[1] >= 1 - 1e-9 && c.y + s.origin[1] <= 2 + 1e-9 && n.z === 0
      if (!inHole) expect(n.dot(c.clone().sub(centre))).toBeGreaterThan(0)
    }
  })

  it('paints the selected Element and gives its state colour back', () => {
    const s = buildScene(two)
    const colour = (storey: string, v: number) =>
      '#' + new THREE.Color().fromBufferAttribute(s.meshesByStorey[storey]!.geometry.getAttribute('color') as THREE.BufferAttribute, v).getHexString()
    const hex = (n: number) => '#' + new THREE.Color(n).getHexString()
    expect(colour('GF', 0)).toBe(hex(STATE_COLOURS.confirmed))
    s.select('a')
    expect(colour('GF', 0)).toBe(hex(SELECTED_COLOUR))
    s.select('b')
    expect(colour('GF', 0)).toBe(hex(STATE_COLOURS.confirmed))
    s.select(null)
    const last = s.meshesByStorey['GF']!.geometry.getAttribute('position').count - 1
    expect(colour('GF', last)).toBe(hex(STATE_COLOURS.proposal))
  })

  it('has no storeys for no Elements', () => {
    const s = buildScene([])
    expect(s.storeys).toEqual([])
    expect(s.bounds).toBeNull()
  })
})

describe('the orbit', () => {
  it('stops short of straight up and straight down', () => {
    const s = fitState(null, [0, 0, 0], 1.6)
    expect(orbit(s, 0, 10).elevation).toBeLessThan(Math.PI / 2)
    expect(orbit(s, 0, -10).elevation).toBeGreaterThan(-Math.PI / 2)
  })

  it('zooms within limits and frames the bounds', () => {
    const s = fitState({ min: [0, 0, 0], max: [10, 10, 10] }, [5, 5, 5], 1.5)
    expect(s.target).toEqual([0, 0, 0])
    expect(zoom(s, 1e9).halfHeight).toBeLessThanOrEqual(2000)
    expect(zoom(s, 1e-9).halfHeight).toBeGreaterThanOrEqual(0.05)
    expect(s.halfHeight).toBeGreaterThan(Math.hypot(10, 10, 10) / 2)
  })
})
