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
import { Button, DrawingText, ErrorBar, KeyCombo, KeyRegion, LtrCanvas, cn, useKeys } from '@/ui'
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
  /** The sheet's views, outlined with their tags (m0-screens 4.6, 6.5); boxes in drawing units. */
  outlines?: readonly SheetOutline[]
  /** The selected view's key: the canvas flies to it (padded about 3×); none fits back. */
  selected?: string | null
  /** A click on an outline. */
  onSelect?: (key: string) => void
  /** Whether the label goes to the toolbar (a caller with its own label button says no). */
  toolbarLabel?: boolean
}

/** A view on the sheet: its box in drawing units (x0, y0, x1, y1), its tag ("Plan, 1:100"). */
export interface SheetOutline {
  key: string
  box: readonly [number, number, number, number]
  tag: string
  /** Held by an open Question: drawn in the Question's amber. */
  question?: boolean
  excluded?: boolean
}

const TOOLTIP_KBD = '[&_kbd]:border-ink-secondary [&_kbd]:bg-inverse [&_kbd]:text-ink-inverse'

/** Text shorter than this on screen, in CSS px, draws as a grey bar (4.6). */
const GREEK_BELOW_PX = 6

export function SheetViewer({ buffer, label, workingView = null, onRetry, outlines = [], selected = null, onSelect, toolbarLabel = true }: SheetViewerProps) {
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
  // After Try again, the drawn sheet takes focus back from the button that has gone (not the page).
  const [focusOnDraw, setFocusOnDraw] = useState(false)
  const retry = useCallback(() => {
    setFocusOnDraw(true)
    setDrawFailed(false)
    if (onRetry) onRetry()
    else setAttempt((a) => a + 1)
  }, [onRetry])

  return (
    <>
      {toolbarLabel ? (
        <SlotFill slot="toolbar.start" order={0}>
          <DrawingText text={label} kind="sheet-number" truncate={false} className="text-sm font-semibold" />
        </SlotFill>
      ) : null}
      <KeyRegion name="canvas" className="absolute inset-0">
        {sheet && !drawFailed ? (
          <SheetCanvas
            key={attempt}
            sheet={sheet}
            label={label}
            workingView={workingView}
            focus={focusOnDraw}
            onFail={() => setDrawFailed(true)}
            outlines={outlines}
            selected={selected}
            onSelect={onSelect}
          />
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

function SheetCanvas({
  sheet,
  label,
  workingView,
  focus,
  onFail,
  outlines,
  selected,
  onSelect,
}: {
  sheet: DecodedSheet
  label: string
  workingView: PaperBox | null
  focus: boolean
  onFail: () => void
  outlines: readonly SheetOutline[]
  selected: string | null
  onSelect?: (key: string) => void
}) {
  const { t } = useLingui()
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
  // Focus is taken once, on the first draw after Try again; a later redraw (a new working view, a
  // resize) never takes it back from where the user put it (#115).
  const focusOnce = useRef(focus)
  const used = useMemo(() => usedExtents(sheet), [sheet])

  const stage = useCallback((): Stage | null => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null
    const dpr = window.devicePixelRatio || 1
    return { width: canvas.width, height: canvas.height, top: LEGEND_PX * dpr, bottom: BAR_PX * dpr }
  }, [])

  // The outlines follow the view: a copy of it, taken as each frame is drawn, redraws them.
  const [shown, setShown] = useState<ViewTransform | null>(null)
  const draw = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const r = renderer.current
      const v = view.current
      if (v) setShown(v)
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
    if (focusOnce.current) {
      focusOnce.current = false
      area.focus({ preventScroll: true })
    }
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

  // A selected view: the canvas flies to it, padded about 3× (screens.md sheet ruling 1); none fits back.
  const toPaperBox = useCallback(
    (box: readonly [number, number, number, number]): PaperBox => {
      const p = sheet.paper
      const [x0, y0, x1, y1] = box
      return { x0: (x0 - p.originX) * p.mmPerUnit, y0: (y0 - p.originY) * p.mmPerUnit, x1: (x1 - p.originX) * p.mmPerUnit, y1: (y1 - p.originY) * p.mmPerUnit }
    },
    [sheet],
  )
  const flown = useRef<string | null>(null)
  useEffect(() => {
    const s = stage()
    if (!s || selected === flown.current) return
    const target = selected ? outlines.find((o) => o.key === selected) : undefined
    flown.current = selected
    if (target) {
      const b = toPaperBox(target.box)
      const w = b.x1 - b.x0
      const h = b.y1 - b.y0
      setView(fitBox({ x0: b.x0 - w, y0: b.y0 - h, x1: b.x1 + w, y1: b.y1 + h }, s, 0))
    } else {
      const f = fits()
      if (f) setView(f.working)
    }
  }, [selected, outlines, stage, fits, setView, toPaperBox])

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
          aria-label={t`Sheet ${label}`}
          className="group absolute inset-0 cursor-grab outline-none touch-none overflow-hidden select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onMouseDown={(event) => {
            if (event.button === 1) event.preventDefault()
          }}
        >
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
          {shown && outlines.length > 0 ? <Outlines outlines={outlines} view={shown} toPaperBox={toPaperBox} selected={selected} onSelect={onSelect} /> : null}
          {/* The focus ring above the drawing: the canvas would cover the region's own inset outline. */}
          <div
            aria-hidden
            data-focus-ring=""
            className="pointer-events-none absolute inset-0 group-focus-visible:outline-2 group-focus-visible:-outline-offset-2 group-focus-visible:outline-ring group-focus-visible:outline-solid"
          />
        </div>
      </LtrCanvas>
    </>
  )
}

/** The views' outlines over the drawing, each with its tag above its top-left corner (4.6, 6.5). */
function Outlines({
  outlines,
  view,
  toPaperBox,
  selected,
  onSelect,
}: {
  outlines: readonly SheetOutline[]
  view: ViewTransform
  toPaperBox: (box: readonly [number, number, number, number]) => PaperBox
  selected: string | null
  onSelect?: (key: string) => void
}) {
  const dpr = window.devicePixelRatio || 1
  return (
    <div data-outlines="" className="pointer-events-none absolute inset-0">
      {outlines.map((o) => {
        const b = toPaperBox(o.box)
        const left = (view.x + Math.min(b.x0, b.x1) * view.scale) / dpr
        const top = (view.y - Math.max(b.y0, b.y1) * view.scale) / dpr
        const width = (Math.abs(b.x1 - b.x0) * view.scale) / dpr
        const height = (Math.abs(b.y1 - b.y0) * view.scale) / dpr
        const chosen = o.key === selected
        return (
          <div
            key={o.key}
            data-outline={o.key}
            data-selected={chosen ? '' : undefined}
            onPointerDown={(event) => {
              if (!onSelect) return
              event.stopPropagation()
              onSelect(o.key)
            }}
            style={{ insetInlineStart: left, insetBlockStart: top, inlineSize: width, blockSize: height }}
            className={cn(
              'absolute rounded-xs border',
              onSelect && 'pointer-events-auto cursor-pointer',
              o.question ? 'border-dashed border-question' : o.excluded ? 'border-dashed border-muted-foreground' : 'border-proposal',
              chosen && 'border-2',
            )}
          >
            <span className={cn('absolute bottom-full start-0 mb-0.5 whitespace-nowrap rounded-xs bg-popover px-1 text-2xs leading-4', o.question ? 'text-question' : 'text-ink-secondary', chosen && 'font-semibold')}>
              {o.tag}
            </span>
          </div>
        )
      })}
    </div>
  )
}
