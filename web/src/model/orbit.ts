/*
 * The 3D view's orthographic orbit (screens.md ruling 8: "The QS's view opens orthographic"): an
 * azimuth and an elevation round a target, z up, and a zoom as the view's half height in metres. Plain
 * numbers and one `apply`, so the keys and the pointer drive the same state and it can be tested
 * without a canvas.
 */
import * as THREE from 'three'
import type { Bounds, Vec3 } from './scene'

const MIN_ELEVATION = -Math.PI / 2 + 0.05
const MAX_ELEVATION = Math.PI / 2 - 0.05

export interface OrbitState {
  azimuth: number
  elevation: number
  target: Vec3
  /** Half the view's height in metres. */
  halfHeight: number
}

/** The first view: a corner of the building from above, framed on the model's bounds. */
export function fitState(bounds: Bounds | null, origin: Vec3, aspect: number): OrbitState {
  if (!bounds)
    return {
      azimuth: -Math.PI / 4,
      elevation: Math.PI / 6,
      target: [0, 0, 0],
      halfHeight: 10,
    }
  const size = bounds.max.map((v, i) => v - bounds.min[i]!)
  const radius = Math.max(Math.hypot(size[0]!, size[1]!, size[2]!) / 2, 0.5)
  return {
    azimuth: -Math.PI / 4,
    elevation: Math.PI / 6,
    // The geometry is held relative to `origin`: the bounds' centre is where the camera looks.
    target: [(bounds.min[0] + bounds.max[0]) / 2 - origin[0], (bounds.min[1] + bounds.max[1]) / 2 - origin[1], (bounds.min[2] + bounds.max[2]) / 2 - origin[2]],
    halfHeight: radius * 1.15 * Math.max(1, 1 / Math.max(aspect, 0.1)),
  }
}

export function orbit(state: OrbitState, dAzimuth: number, dElevation: number): OrbitState {
  return {
    ...state,
    azimuth: state.azimuth + dAzimuth,
    elevation: Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, state.elevation + dElevation)),
  }
}

/** `factor` above 1 zooms out. */
export function zoom(state: OrbitState, factor: number): OrbitState {
  return {
    ...state,
    halfHeight: Math.min(2000, Math.max(0.05, state.halfHeight * factor)),
  }
}

/** Puts the camera where the state says, for a canvas of this aspect (width over height). */
export function apply(camera: THREE.OrthographicCamera, state: OrbitState, aspect: number): void {
  const [tx, ty, tz] = state.target
  const reach = state.halfHeight * 40 + 1000
  const d = new THREE.Vector3(
    Math.cos(state.elevation) * Math.cos(state.azimuth),
    Math.cos(state.elevation) * Math.sin(state.azimuth),
    Math.sin(state.elevation),
  )
  camera.up.set(0, 0, 1)
  camera.position.set(tx + d.x * reach, ty + d.y * reach, tz + d.z * reach)
  camera.left = -state.halfHeight * aspect
  camera.right = state.halfHeight * aspect
  camera.top = state.halfHeight
  camera.bottom = -state.halfHeight
  camera.near = 0.1
  camera.far = reach * 2
  camera.lookAt(tx, ty, tz)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}
