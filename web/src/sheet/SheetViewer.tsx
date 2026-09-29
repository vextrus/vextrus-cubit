/*
 * One sheet on the canvas (m0-screens 4.6): drawn by WebGL inside `LtrCanvas` (never mirrored), opened
 * fitted to the working view box its caller passes, else the whole paper; zoomed with + − and the
 * wheel, panned with a left or middle drag, fitted again with F (the whole sheet) and Shift F (the
 * view it opened with). Its label and its Fit button reach the frame's toolbar through the slots.
 * In M0 it is Step 1's canvas, which 22 mounts; paging across sheets is 22's.
 *
 *   <SheetViewer buffer={buffer} label="S-04" workingView={{ x0: 20, y0: 30, x1: 400, y1: 280 }} />
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Maximize } from 'lucide-react'
import { SlotFill } from '@/app/slots'
import { Button, DrawingText, ErrorBar, KeyCombo, KeyRegion, LtrCanvas, isolateLtr, useKeys } from '@/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip'
import { decodeSheet, usedExtents, type DecodedSheet } from './decode'
import { SheetRenderer } from './gl'
import { BAR_PX, LEGEND_PX, VIEW_MARGIN, ZOOM_STEP, fitBox, fitPaper, panBy, zoomAbout, type PaperBox, type Stage, type ViewTransform } from './view'

export interface SheetViewerProps {
  /** The sheet's render buffer, as the engine wrote it (engine/render/buffers.py). */
  buffer: ArrayBuffer
  /** The sheet's number as drawn ("S-04"): the toolbar's label and the error's subject. */
  label: string
  /** The box the sheet opens fitted to, in paper mm (Step 1: the sheet's main view); else the paper. */
  workingView?: PaperBox | null
  /** Try again: the caller fetches the buffer again. Without it, the viewer decodes it again. */
  onRetry?: () => void
}

const TOOLTIP_KBD = '[&_kbd]:border-ink-secondary [&_kbd]:bg-inverse [&_kbd]:text-ink-inverse'

/** Text shorter than this on screen, in CSS px, draws as a grey bar (4.6). */
const GREEK_BELOW_PX = 6

export function SheetViewer({ buffer, label, workingView = null, onRetry }: SheetViewerProps) {
  const [attempt, setAttempt] = useState(0)
  const [drawFailed, setDrawFailed] = useState(false)
  const sheet = useMemo<DecodedSheet | null>(() => {
    void attempt
    try {
      return decodeSheet(buffer)
    } catch {
      return null
    }
  }, [buffer, attempt])
  const retry = useCallback(() => {
    setDrawFailed(false)
    if (onRetry) onRetry()
    else setAttempt((a) => a + 1)
  }, [onRetry])

  return (
    <>
      <SlotFill slot="toolbar.start" order={0}>
        <DrawingText text={label} kind="sheet-number" truncate={false} className="text-sm font-semibold" />
      </SlotFill>
      <KeyRegion name="canvas" className="absolute inset-0">
        {sheet && !drawFailed ? (
          <SheetCanvas key={attempt} sheet={sheet} label={label} workingView={workingView} onFail={() => setDrawFailed(true)} />
        ) : (
          <div className="flex h-full items-start justify-center p-4">
            <ErrorBar
              className="w-full max-w-xl"
              action={
                <Button size="md" onClick={retry}>
                  <Trans>Try again</Trans>
                </Button>
              }
            >
              <Trans><DrawingText text={label} kind="sheet-number" truncate={false} /> could not be drawn. The other sheets are not affected.</Trans>
            </ErrorBar>
          </div>
        )}
      </KeyRegion>
    </>
  )
}

function greekInk(el: Element): number {
  const hex = getComputedStyle(el).getPropertyValue('--canvas-dim-greek').trim()
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return 0.3
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((c) => parseInt(c, 16) / 255)
  return 1 - (0.299 * r! + 0.587 * g! + 0.114 * b!)
}

function SheetCanvas({ sheet, label, workingView, onFail }: { sheet: DecodedSheet; label: string; workingView: PaperBox | null; onFail: () => void }) {
  const { t } = useLingui()
  const sheetNumber = isolateLtr(label)
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<SheetRenderer | null>(null)
  const view = useRef<ViewTransform | null>(null)
  /** Until the viewer is moved, a resize fits again. */
  const moved = useRef(false)
  const frame = useRef(0)
  const failed = useRef(onFail)
  useLayoutEffect(() => {
    failed.current = onFail
  })
  const used = useMemo(() => usedExtents(sheet), [sheet])

  const stage = useCallback((): Stage | null => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null
    const dpr = window.devicePixelRatio || 1
    return { width: canvas.width, height: canvas.height, top: LEGEND_PX * dpr, bottom: BAR_PX * dpr }
  }, [])

  const draw = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const r = renderer.current
      const v = view.current
      if (!r || !v || !areaRef.current) return
      try {
        r.draw(sheet, v, { greekBelowPx: GREEK_BELOW_PX * (window.devicePixelRatio || 1), greekInk: greekInk(areaRef.current) })
      } catch {
        failed.current()
      }
    })
  }, [sheet])

  const setView = useCallback(
    (next: ViewTransform, byUser = true) => {
      view.current = next
      if (byUser) moved.current = true
      draw()
    },
    [draw],
  )

  const fits = useCallback(() => {
    const s = stage()
    if (!s) return null
    const whole = fitPaper(sheet.paper, used, s)
    return { whole, working: workingView ? fitBox(workingView, s, VIEW_MARGIN) : whole }
  }, [stage, sheet, used, workingView])

  // The renderer, and the canvas sized to its box in device pixels.
  useEffect(() => {
    const canvas = canvasRef.current
    const area = areaRef.current
    if (!canvas || !area) return
    try {
      renderer.current = new SheetRenderer(canvas)
    } catch {
      failed.current()
      return
    }
    const onLost = (event: Event) => event.preventDefault()
    const onRestored = () => {
      renderer.current = new SheetRenderer(canvas)
      draw()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.round(area.clientWidth * dpr))
      const height = Math.max(1, Math.round(area.clientHeight * dpr))
      if (canvas.width === width && canvas.height === height && view.current) return
      const before = { width: canvas.width, height: canvas.height }
      canvas.width = width
      canvas.height = height
      const f = fits()
      if (!f) return
      if (!view.current || !moved.current) {
        setView(f.working, false)
      } else {
        // Keep the middle of the view in the middle.
        setView(panBy(view.current, (width - before.width) / 2, (height - before.height) / 2), true)
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(area)
    resize()
    draw() // a remount keeps its view (refs survive) and must draw it on the new renderer
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [draw, fits, setView])

  const zoomCentre = useCallback(
    (factor: number) => {
      const v = view.current
      const canvas = canvasRef.current
      if (v && canvas) setView(zoomAbout(v, factor, canvas.width / 2, canvas.height / 2))
    },
    [setView],
  )
  const fitWhole = useCallback(() => {
    const f = fits()
    if (f) setView(f.whole)
  }, [fits, setView])
  const fitWorking = useCallback(() => {
    const f = fits()
    if (f) setView(f.working)
  }, [fits, setView])

  const fitLabel = t`Fit the whole sheet`
  const workingLabel = t`Back to the working view`
  useKeys([
    { key: '+', label: t`Zoom in`, group: 'sheet', run: () => zoomCentre(ZOOM_STEP) },
    { key: '-', label: t`Zoom out`, group: 'sheet', run: () => zoomCentre(1 / ZOOM_STEP) },
    { key: 'F', label: fitLabel, group: 'sheet', run: fitWhole },
    { key: 'Shift F', label: workingLabel, group: 'sheet', run: fitWorking },
  ])

  // The wheel zooms about the pointer: a listener that may prevent the page's scroll.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const onWheel = (event: WheelEvent) => {
      const v = view.current
      if (!v) return
      event.preventDefault()
      const dpr = window.devicePixelRatio || 1
      const box = area.getBoundingClientRect()
      const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 400 : 1
      const factor = Math.exp(Math.max(-400, Math.min(400, -event.deltaY * lines)) * 0.002)
      setView(zoomAbout(v, factor, (event.clientX - box.left) * dpr, (event.clientY - box.top) * dpr))
    }
    area.addEventListener('wheel', onWheel, { passive: false })
    return () => area.removeEventListener('wheel', onWheel)
  }, [setView])

  // A drag with the left or middle button pans.
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    if (event.button === 1) event.preventDefault() // no autoscroll
    areaRef.current?.focus({ preventScroll: true })
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // A pointer the browser does not track (a synthetic one) pans without capture.
    }
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const v = view.current
    if (!d || d.id !== event.pointerId || !v) return
    const dpr = window.devicePixelRatio || 1
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    drag.current = { ...d, x: event.clientX, y: event.clientY }
    if (dx || dy) setView(panBy(v, dx * dpr, dy * dpr))
  }
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null
  }

  return (
    <>
      <SlotFill slot="toolbar.end" order={20}>
        {/* IconButton's look, with 4.6's two-key tooltip: "Fit the whole sheet  F · Back to the working view  Shift F". */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t`Fit`}
              aria-keyshortcuts="F Shift+F"
              onClick={fitWhole}
              className="inline-flex size-control items-center justify-center rounded-md text-ink-secondary transition-colors duration-(--motion-state) hover:bg-hover hover:text-foreground [&_svg]:size-4"
            >
              <Maximize strokeWidth={1.5} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-none whitespace-nowrap">
            {fitLabel}
            <KeyCombo combo="F" className={TOOLTIP_KBD} />
            <span aria-hidden>·</span>
            {workingLabel}
            <KeyCombo combo="Shift F" className={TOOLTIP_KBD} />
          </TooltipContent>
        </Tooltip>
      </SlotFill>
      <LtrCanvas className="h-full w-full">
        <div
          ref={areaRef}
          tabIndex={0}
          role="group"
          aria-label={t`Sheet ${sheetNumber}`}
          className="focus-inset absolute inset-0 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onMouseDown={(event) => {
            if (event.button === 1) event.preventDefault()
          }}
        >
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        </div>
      </LtrCanvas>
    </>
  )
}
