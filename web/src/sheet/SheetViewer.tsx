/*
 * One sheet on the canvas (m0-screens 4.6): drawn by WebGL inside `LtrCanvas` (never mirrored), opened
 * fitted to the working view box its caller passes, else the whole paper; zoomed with + − and the
 * wheel, panned with a left or middle drag, fitted again with F (the whole sheet) and Shift F (the
 * view it opened with). Its label and its Fit button reach the frame's toolbar through the slots.
 * In M0 it is Step 1's canvas, which 22 mounts; paging across sheets is 22's.
 *
 *   <SheetViewer buffer={buffer} label="S-04" workingView={{ x0: 20, y0: 30, x1: 400, y1: 280 }} />
 *
 * Step 1 (22) also passes the sheet's view outlines with their tags (§6.5), the view selected (the
 * canvas flies to it, padded to about 3×, and fits back to the working view when none is), and the
 * legend above the drawing.
 *
 * The look (4.6, 6.14): Paper or CAD-dark (`dark`), and As read, Plot or Compare (`layer`) over the
 * sheet's Plot page when its caller has one drawn (`plot`, from `drawPlotPage`); while it has none
 * the read drawing shows. The caller's toolbar switches are `LookSwitches`.
 *
 *   <SheetViewer buffer={buffer} label="S-04" dark layer="compare" plot={{ picture, transform }} notes={…} />
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Maximize } from 'lucide-react'
import { SlotFill } from '@/app/slots'
import { Button, DrawingText, ErrorBar, KeyCombo, KeyRegion, LtrCanvas, cn, useKeys } from '@/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip'
import { decodeSheet, usedExtents, type DecodedSheet } from './decode'
import { SheetRenderer, type Palette } from './gl'
import { plotMatrix, type PlotPicture, type PlotTransform } from './plot'
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
  /** The views' outlines, each with its tag above its top-left corner (§6.5); a click selects one. */
  outlines?: readonly SheetOutline[]
  /** The outline selected: the canvas flies to it; back to none, it fits the working view again. */
  selected?: string | null
  onSelect?: (id: string) => void
  /** The pointer's place on the paper, in mm (null: it left the canvas); the caller finds the view under it. */
  onCursor?: (paper: { x: number; y: number } | null) => void
  /** Hides the outlines and their tags (Step 1's O); on by default. */
  showOutlines?: boolean
  /** Each change flies to the selected view again, as the first selecting did (Step 1's Z). */
  zoomToken?: number
  /** The legend above the drawing, in the strip the fit keeps clear (4.6). */
  legend?: ReactNode
  /** The label in the toolbar (default); off where the caller puts its own there (Step 1's sheet button). */
  labelInToolbar?: boolean
  /** CAD-dark: the #101318 ground and AutoCAD's colours; else Paper (4.6). */
  dark?: boolean
  /**
   * As read (default), Plot or Compare (4.6, "The Plot"). Until `plot` comes, Plot shows the read
   * drawing, and Compare what was read in its colour over nothing.
   */
  layer?: SheetLayer
  /** The sheet's Plot page, drawn, and its registration. */
  plot?: SheetPlot | null
  /** Notes top-left under the legend ("Plot: … page 18, registered to 0.3 mm"; "No Plot for this sheet: …"). */
  notes?: ReactNode
  /** A line top-right ("Loading the Plot…"). */
  status?: ReactNode
}

export type SheetLayer = 'read' | 'plot' | 'compare'

export interface SheetPlot {
  picture: PlotPicture
  transform: PlotTransform
}

/** A view's outline on the sheet: paper mm from its lower-left corner, as the engine records a view. */
export interface SheetOutline {
  id: string
  box: PaperBox
  /** "Plan, 1:100", "Detail, not to scale". */
  tag: string
  tone: 'proposal' | 'assigned' | 'question' | 'excluded'
}

const OUTLINE_TONE: Record<SheetOutline['tone'], string> = {
  proposal: cn('border-proposal text-proposal'),
  assigned: cn('border-confirmed text-confirmed'),
  question: cn('border-question text-question border-dashed'),
  excluded: cn('border-excluded text-excluded'),
}

const TOOLTIP_KBD = '[&_kbd]:border-ink-secondary [&_kbd]:bg-inverse [&_kbd]:text-ink-inverse'

/** CAD-dark's ground (4.6); the canvas draws it, so it is a colour, not a token. */
const CAD_DARK_HEX = '#101318'

/** Text shorter than this on screen, in CSS px, draws as a grey bar (4.6). */
const GREEK_BELOW_PX = 6

export function SheetViewer({
  buffer,
  label,
  workingView = null,
  onRetry,
  outlines,
  selected = null,
  onSelect,
  onCursor,
  showOutlines = true,
  zoomToken = 0,
  legend,
  labelInToolbar = true,
  dark = false,
  layer = 'read',
  plot = null,
  notes,
  status,
}: SheetViewerProps) {
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
      {labelInToolbar ? (
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
            onCursor={onCursor}
            showOutlines={showOutlines}
            zoomToken={zoomToken}
            legend={legend}
            dark={dark}
            layer={plot || layer === 'compare' ? layer : 'read'}
            plot={plot}
            notes={notes}
            status={status}
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
  onCursor,
  showOutlines,
  zoomToken,
  legend,
  dark,
  layer,
  plot,
  notes,
  status,
}: {
  sheet: DecodedSheet
  label: string
  workingView: PaperBox | null
  focus: boolean
  onFail: () => void
  outlines?: readonly SheetOutline[]
  selected: string | null
  onCursor?: (paper: { x: number; y: number } | null) => void
  showOutlines: boolean
  zoomToken: number
  onSelect?: (id: string) => void
  legend?: ReactNode
  dark: boolean
  layer: SheetLayer
  plot: SheetPlot | null
  notes?: ReactNode
  status?: ReactNode
}) {
  const { t } = useLingui()
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const plotRef = useRef<HTMLCanvasElement>(null)
  // The look, read by the frame drawn next (a change redraws; it never makes a new renderer).
  const palette: Palette = layer === 'compare' ? (dark ? 'compare-dark' : 'compare') : dark ? 'dark' : 'paper'
  const look = useRef({ palette, layer, plot, dark })
  useLayoutEffect(() => {
    look.current = { palette, layer, plot, dark }
  })
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

  const paint = useCallback(() => {
    const r = renderer.current
    const v = view.current
    if (!r || !v || !areaRef.current) return
    const now = look.current
    if (plotRef.current) drawPlot(plotRef.current, v, now.layer === 'read' ? null : now.plot, now.dark, now.layer === 'compare')
    try {
      r.draw(sheet, v, { greekBelowPx: GREEK_BELOW_PX * (window.devicePixelRatio || 1), greekInk: greekInk(areaRef.current), palette: now.palette })
    } catch {
      failed.current()
    }
  }, [sheet])

  /** Drawn on the next frame, so a drag's many moves make one draw. */
  const draw = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(paint)
  }, [paint])

  /** Drawn at once: a key or button has moved the view, and the picture must not lag the key (a frame
   * that a loaded machine delays showed the old view after the key, #142). */
  const drawNow = useCallback(() => {
    cancelAnimationFrame(frame.current)
    paint()
  }, [paint])

  // A new look is drawn at once.
  useEffect(() => {
    draw()
  }, [draw, palette, layer, plot, dark])

  // The view as last drawn, for the outlines laid over the canvas (only while there are any).
  const [shown, setShown] = useState<ViewTransform | null>(null)
  const hasOutlines = !!outlines && outlines.length > 0
  const setView = useCallback(
    (next: ViewTransform, byUser = true, now = false) => {
      view.current = next
      if (byUser) moved.current = true
      if (hasOutlines) setShown(next)
      if (now) drawNow()
      else draw()
    },
    [draw, drawNow, hasOutlines],
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
      if (plotRef.current) {
        plotRef.current.width = width
        plotRef.current.height = height
      }
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
      if (v && canvas) setView(zoomAbout(v, factor, canvas.width / 2, canvas.height / 2), true, true)
    },
    [setView],
  )
  const fitWhole = useCallback(() => {
    const f = fits()
    if (f) setView(f.whole, true, true)
  }, [fits, setView])
  const fitWorking = useCallback(() => {
    const f = fits()
    if (f) setView(f.working, true, true)
  }, [fits, setView])

  // Fly to the view selected, padded to about 3× (screens.md sheet ruling 1); none again: the working view.
  // The flight moves the view as a pan would (an outside change the canvas follows, not React state).
  const flyTo = useCallback(
    (id: string) => {
      const s = stage()
      const outline = outlines?.find((o) => o.id === id)
      if (!s || !outline) return
      const { x0, y0, x1, y1 } = outline.box
      const w = x1 - x0
      const h = y1 - y0
      setView(fitBox({ x0: x0 - w, y0: y0 - h, x1: x1 + w, y1: y1 + h }, s, 0))
    },
    [stage, outlines, setView],
  )
  const flown = useRef<string | null>(null)
  useEffect(() => {
    const s = stage()
    const was = flown.current
    flown.current = selected
    if (!s || selected === was) return
    if (selected && outlines?.some((o) => o.id === selected)) flyTo(selected) // eslint-disable-line react-hooks/set-state-in-effect -- the canvas follows the view chosen outside it
    else if (was) fitWorking()
  }, [selected, outlines, stage, flyTo, fitWorking])
  // Z (Step 1): the same landing again, from wherever the canvas was moved to.
  const zoomed = useRef(zoomToken)
  useEffect(() => {
    if (zoomed.current === zoomToken) return
    zoomed.current = zoomToken
    if (selected) flyTo(selected) // eslint-disable-line react-hooks/set-state-in-effect -- as above
  }, [zoomToken, selected, flyTo])

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
    const dpr = window.devicePixelRatio || 1
    if (v && onCursor && areaRef.current) {
      const box = areaRef.current.getBoundingClientRect()
      onCursor({ x: ((event.clientX - box.left) * dpr - v.x) / v.scale, y: (v.y - (event.clientY - box.top) * dpr) / v.scale })
    }
    if (!d || d.id !== event.pointerId || !v) return
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
          onPointerLeave={() => onCursor?.(null)}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onMouseDown={(event) => {
            if (event.button === 1) event.preventDefault()
          }}
        >
          {/* The drawing above the Plot (z 1; the outlines after it, z 1, above both). Compare lays what was
              read over the Plot: red on white multiplies, orange on black screens. */}
          <canvas
            ref={canvasRef}
            aria-hidden
            className={cn('absolute inset-0 z-[1] h-full w-full', layer === 'plot' && 'invisible', layer === 'compare' && (dark ? 'mix-blend-screen' : 'mix-blend-multiply'))}
          />
          <canvas ref={plotRef} aria-hidden data-plot="" className={cn('absolute inset-0 z-0 h-full w-full', layer === 'read' && 'invisible')} />
          {hasOutlines && showOutlines && shown ? <Outlines outlines={outlines} view={shown} selected={selected} onSelect={onSelect} dark={dark} /> : null}
          {legend || notes ? (
            <div className="pointer-events-none absolute start-3 top-2 z-[2] flex flex-col items-start gap-1 text-xs">
              {legend ? <div className="rounded-md bg-paper/90 px-2 py-1 text-ink-secondary">{legend}</div> : null}
              {notes ? (
                <div role="status" className="max-w-xl rounded-md bg-paper/95 px-2 py-1 text-foreground shadow-1">
                  {notes}
                </div>
              ) : null}
            </div>
          ) : null}
          {status ? <div className="pointer-events-none absolute end-3 top-2 z-[2] rounded-md bg-paper/90 px-2 py-1 text-xs text-ink-secondary">{status}</div> : null}
          {/* The focus ring above the drawing: the canvas would cover the region's own inset outline. */}
          <div
            aria-hidden
            data-focus-ring=""
            className="pointer-events-none absolute inset-0 z-[3] group-focus-visible:outline-2 group-focus-visible:-outline-offset-2 group-focus-visible:outline-ring group-focus-visible:outline-solid"
          />
        </div>
      </LtrCanvas>
    </>
  )
}

/**
 * The Plot page on its own canvas beneath the drawing, registered to the view: on Paper as printed;
 * on CAD-dark inverted, its white paper the #101318 ground (4.6, "Compare").
 */
function drawPlot(canvas: HTMLCanvasElement, view: ViewTransform, plot: SheetPlot | null, dark: boolean, compare: boolean) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!plot) {
    // Compare before its Plot comes: what was read over a bare ground (its page to follow).
    if (compare) {
      ctx.fillStyle = dark ? CAD_DARK_HEX : '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    return
  }
  const { image } = plot.picture
  // On CAD-dark the ground fills the whole canvas, around the page too (design gate walk 1, M2).
  if (dark) {
    ctx.fillStyle = CAD_DARK_HEX
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.setTransform(...plotMatrix(view, plot.transform, plot.picture))
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0)
  if (dark) {
    ctx.globalCompositeOperation = 'difference'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, image.width, image.height)
    ctx.globalCompositeOperation = 'lighten'
    ctx.fillStyle = CAD_DARK_HEX
    ctx.fillRect(0, 0, image.width, image.height)
    ctx.globalCompositeOperation = 'source-over'
  }
}

/** The views' outlines over the drawing, 2 px outside each view, with its tag above the top-left corner. */
function Outlines({
  outlines,
  view,
  selected,
  onSelect,
  dark,
}: {
  outlines: readonly SheetOutline[]
  view: ViewTransform
  selected: string | null
  onSelect?: (id: string) => void
  dark: boolean
}) {
  const dpr = window.devicePixelRatio || 1
  return (
    <>
      {outlines.map((o) => {
        const start = (view.x + o.box.x0 * view.scale) / dpr - 2
        const top = (view.y - o.box.y1 * view.scale) / dpr - 2
        const width = ((o.box.x1 - o.box.x0) * view.scale) / dpr + 4
        const height = ((o.box.y1 - o.box.y0) * view.scale) / dpr + 4
        return (
          <button
            key={o.id}
            type="button"
            tabIndex={-1}
            aria-label={o.tag}
            aria-pressed={selected === o.id}
            data-outline={o.id}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onSelect?.(o.id)}
            className={cn('absolute z-[1] rounded-[1px] border', OUTLINE_TONE[o.tone], selected === o.id ? 'border-2' : 'border-[1px]')}
            style={{ insetInlineStart: start, insetBlockStart: top, inlineSize: width, blockSize: height }}
          >
            {/* On CAD-dark the tag sits on paper, where its tone reads at 4.5:1 or more (design gate walk 1, M3). */}
            <span
              data-tag=""
              className={cn('pointer-events-none absolute -top-4 start-0 whitespace-nowrap text-2xs leading-none', dark && 'rounded-xs bg-paper px-0.5 py-px')}
            >
              {o.tag}
            </span>
          </button>
        )
      })}
    </>
  )
}
