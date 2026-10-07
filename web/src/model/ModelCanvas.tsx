/*
 * The 3D canvas: one orthographic view of the scene (scene.ts), orbited by the pointer or the keys,
 * zoomed by the wheel or `+` and `−`, a click picking the Element under it. The canvas is focusable and
 * shows its focus; its keys are the screen's region scope (src/ui/keys), never a listener of its own.
 *
 * If the browser cannot give WebGL the canvas stays, so picking and the keys still work on the same
 * geometry, and a line says nothing is drawn.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import * as THREE from 'three'
import { KeyRegion, LtrCanvas, useKeys } from '@/ui'
import { apply, fitState, orbit, zoom, type OrbitState } from './orbit'
import type { Scene } from './scene'

const STEP = Math.PI / 12
const DRAG_RADIANS_PER_PX = 0.008
/** A press that moves less than this many pixels is a click, not an orbit. */
const CLICK_SLOP_PX = 4

interface Handle {
  /** Changes the view's state, then draws. */
  change(next: (s: OrbitState) => OrbitState): void
  fit(): void
}

export function ModelCanvas({
  scene,
  isolated,
  selected,
  onPick,
}: {
  scene: Scene
  isolated: string | null
  selected: string | null
  onPick: (elementId: string | null) => void
}) {
  const { t } = useLingui()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handle = useRef<Handle | null>(null)
  const [drawn, setDrawn] = useState(true)
  const redraw = useRef<() => void>(() => {})
  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: THREE.WebGLRenderer | null = null
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      })
      renderer.setClearColor(0x000000, 0)
    } catch {
      queueMicrotask(() => setDrawn(false))
    }
    const world = new THREE.Scene()
    world.add(scene.group)
    world.add(new THREE.AmbientLight(0xffffff, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.8)
    sun.position.set(-3, -5, 8)
    world.add(sun)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
    const raycaster = new THREE.Raycaster()

    const aspectOf = () => {
      const r = canvas.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? r.width / r.height : 1
    }
    let state = fitState(scene.bounds, scene.origin, aspectOf())
    let frame = 0
    const draw = () => {
      frame = 0
      apply(camera, state, aspectOf())
      renderer?.render(world, camera)
      // The view's numbers, for the tests that drive it by key.
      canvas.dataset.view = [state.azimuth, state.elevation, state.halfHeight].map((n) => n.toFixed(3)).join(' ')
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }
    redraw.current = schedule
    handle.current = {
      change(next) {
        state = next(state)
        schedule()
      },
      fit() {
        state = fitState(scene.bounds, scene.origin, aspectOf())
        schedule()
      },
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) renderer?.setSize(r.width, r.height, false)
      renderer?.setPixelRatio(window.devicePixelRatio || 1)
      schedule()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const hit = (clientX: number, clientY: number): string | null => {
      const r = canvas.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      apply(camera, state, r.width / r.height)
      raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1)), camera)
      const meshes = Object.values(scene.meshesByStorey).filter((m) => m.visible)
      const first = raycaster.intersectObjects(meshes, false)[0]
      return first && first.faceIndex != null ? (scene.elementAt(first.object, first.faceIndex) ?? null) : null
    }

    let press: { x: number; y: number; moved: boolean } | null = null
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      press = { x: e.clientX, y: e.clientY, moved: false }
      canvas.setPointerCapture?.(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!press) return
      const dx = e.clientX - press.x
      const dy = e.clientY - press.y
      if (!press.moved && Math.hypot(dx, dy) < CLICK_SLOP_PX) return
      press.moved = true
      state = orbit(state, -dx * DRAG_RADIANS_PER_PX, dy * DRAG_RADIANS_PER_PX)
      press.x = e.clientX
      press.y = e.clientY
      schedule()
    }
    const up = (e: PointerEvent) => {
      const was = press
      press = null
      canvas.releasePointerCapture?.(e.pointerId)
      if (was && !was.moved) pick.current(hit(e.clientX, e.clientY))
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      state = zoom(state, e.deltaY > 0 ? 1.12 : 1 / 1.12)
      schedule()
    }
    const lost = (e: Event) => {
      e.preventDefault()
      setDrawn(false)
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('webglcontextlost', lost)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('webglcontextlost', lost)
      world.remove(scene.group)
      renderer?.dispose()
      handle.current = null
      redraw.current = () => {}
    }
  }, [scene])

  useEffect(() => {
    scene.isolate(isolated)
    scene.select(selected)
    redraw.current()
  }, [scene, isolated, selected])

  /** `]` and `[`: the next or previous Element, among the storeys shown, so the keyboard can pick too. */
  const step = (direction: 1 | -1) => {
    const shown = scene.elementIds().filter((id) => isolated === null || scene.storeyOf(id) === isolated)
    if (shown.length === 0) return
    const at = selected === null ? -1 : shown.indexOf(selected)
    const next = at === -1 ? (direction === 1 ? 0 : shown.length - 1) : (at + direction + shown.length) % shown.length
    onPick(shown[next]!)
  }
  return (
    <LtrCanvas className="size-full">
      <KeyRegion name="model" className="relative size-full">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          data-region-focus=""
          role="application"
          aria-label={t`The Live Model in 3D`}
          className="focus-inset block size-full touch-none"
        />
        {drawn ? null : (
          <p role="status" className="absolute inset-x-0 bottom-3 text-center text-sm text-ink-secondary">
            {t`This browser cannot draw the Live Model. Picking an Element and its inspector still work.`}
          </p>
        )}
        <CanvasKeys handle={handle} onClear={() => onPick(null)} onStep={step} />
      </KeyRegion>
    </LtrCanvas>
  )
}

/** The canvas's keys (m0-screens §2: arrows move what the focused thing shows). */
function CanvasKeys({ handle, onClear, onStep }: { handle: React.RefObject<Handle | null>; onClear: () => void; onStep: (direction: 1 | -1) => void }) {
  const { t } = useLingui()
  const change = useCallback((next: (s: OrbitState) => OrbitState) => handle.current?.change(next), [handle])
  useKeys([
    {
      key: '←',
      label: t`Orbit left`,
      group: 'screen',
      run: () => change((s) => orbit(s, STEP, 0)),
    },
    {
      key: '→',
      label: t`Orbit right`,
      group: 'screen',
      run: () => change((s) => orbit(s, -STEP, 0)),
    },
    {
      key: '↑',
      label: t`Tilt up`,
      group: 'screen',
      run: () => change((s) => orbit(s, 0, STEP)),
    },
    {
      key: '↓',
      label: t`Tilt down`,
      group: 'screen',
      run: () => change((s) => orbit(s, 0, -STEP)),
    },
    {
      key: '+',
      label: t`Zoom in`,
      group: 'screen',
      run: () => change((s) => zoom(s, 1 / 1.25)),
    },
    {
      key: '-',
      label: t`Zoom out`,
      group: 'screen',
      run: () => change((s) => zoom(s, 1.25)),
    },
    { key: ']', label: t`Pick the next Element`, group: 'screen', run: () => onStep(1) },
    { key: '[', label: t`Pick the previous Element`, group: 'screen', run: () => onStep(-1) },
    {
      key: '0',
      label: t`Fit the Live Model`,
      group: 'screen',
      run: () => handle.current?.fit(),
    },
    {
      key: 'Esc',
      label: t`Clear the selection`,
      group: 'screen',
      run: onClear,
    },
  ])
  return null
}
