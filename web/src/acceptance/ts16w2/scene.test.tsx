/*
 * S16-W2: the 3D Live Model view's scene, through the seam this ticket names: `web/src/model/scene.ts`
 * exporting `buildScene(elements)` over C17's primitives (docs/plans/M1.md C17: "The browser merges per
 * storey with a per-element state texture. A CI test compares the browser's volumes and bounds with
 * `live_model.services.primitives` per element"). The ticket's finish line: "volumes and bounds equal
 * primitives; one draw call per storey".
 *
 *   const scene = buildScene(elements)
 *   scene.meshesByStorey            // { [storey]: THREE.Mesh }, one per storey
 *   scene.volumeOf(elementId)       // m3, number
 *   scene.boundsOf(elementId)       // { min: [x, y, z], max: [x, y, z] } in the primitives' frame (z up)
 *   scene.isolate(storey | null)    // shows only that storey; null shows all
 */
import { describe, expect, it } from 'vitest'
import { buildScene } from '@/model/scene'
import { C1_GF, EXPECTED, PRIMITIVES } from './model.fixture'

const TOL = 1e-6

describe('volumes and bounds equal the primitives (C17)', () => {
  it("gives each Element the volume of its prism, b × d × h, to 1e-6 m3", () => {
    const scene = buildScene(PRIMITIVES)
    for (const [id, want] of Object.entries(EXPECTED)) {
      expect(Math.abs(scene.volumeOf(id) - want.volume), `volume of ${id}: ${scene.volumeOf(id)} against ${want.volume}`).toBeLessThanOrEqual(TOL)
    }
  })

  it("gives C11's worked example column 0.376902 m3 (0.254 × 0.508 × 2.921)", () => {
    const scene = buildScene(PRIMITIVES)
    expect(Number(scene.volumeOf(C1_GF).toFixed(6))).toBe(0.376902)
  })

  it("gives each Element the bounds of its prism, in the primitives' frame, to 1e-6 m", () => {
    const scene = buildScene(PRIMITIVES)
    for (const [id, want] of Object.entries(EXPECTED)) {
      const got = scene.boundsOf(id)
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(got.min[i]! - want.min[i]!), `min[${i}] of ${id}`).toBeLessThanOrEqual(TOL)
        expect(Math.abs(got.max[i]! - want.max[i]!), `max[${i}] of ${id}`).toBeLessThanOrEqual(TOL)
      }
    }
  })
})

describe('one draw call per storey (C17: "merges per storey")', () => {
  it('builds exactly one mesh per storey, keyed by the storey', () => {
    const scene = buildScene(PRIMITIVES)
    expect(Object.keys(scene.meshesByStorey).sort()).toEqual(['1F', 'GF'])
  })

  it('draws each storey in one call: one mesh, one material, at most one geometry group', () => {
    const scene = buildScene(PRIMITIVES)
    for (const [storey, mesh] of Object.entries(scene.meshesByStorey)) {
      expect(mesh.isMesh, `${storey} is a mesh`).toBe(true)
      expect(Array.isArray(mesh.material), `${storey} has one material`).toBe(false)
      expect(mesh.geometry.groups.length, `${storey}'s geometry groups`).toBeLessThanOrEqual(1)
    }
  })
})

describe('storey isolate', () => {
  it('isolating a storey hides the others, and clearing it shows all', () => {
    const scene = buildScene(PRIMITIVES)
    scene.isolate('GF')
    expect(scene.meshesByStorey['GF']!.visible).toBe(true)
    expect(scene.meshesByStorey['1F']!.visible).toBe(false)
    scene.isolate(null)
    expect(scene.meshesByStorey['GF']!.visible).toBe(true)
    expect(scene.meshesByStorey['1F']!.visible).toBe(true)
  })
})
