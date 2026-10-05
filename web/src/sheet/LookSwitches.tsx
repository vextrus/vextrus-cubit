/*
 * The sheet's look in the toolbar (m0-screens 4.6 and 6.14): the segmented "As read | Plot | Compare"
 * (`P` cycles it) and the icon-only CAD-dark toggle (`D`), before Fit. With no Plot for the sheet,
 * Plot and Compare are disabled with the reason as their tooltip, and `P` or a click on them calls
 * `onNoPlot` (the caller shows "No Plot for this sheet: …" top-left, 6.13). Mounted in sheet mode only,
 * so in list mode `D` and `P` do nothing.
 *
 *   <LookSwitches layer={layer} onLayer={setLayer} dark={dark} onDark={setDark} noPlot={why} onNoPlot={raise} loading={false} />
 */
import { useLingui } from '@lingui/react/macro'
import { Contrast, Loader2 } from 'lucide-react'
import { SlotFill } from '@/app/slots'
import { IconButton, cn, useKeys } from '@/ui'
import type { SheetLayer } from './SheetViewer'

const ITEM = cn(
  'inline-flex h-control items-center gap-1 px-2.5 text-sm whitespace-nowrap text-ink-secondary hover:bg-hover',
  'aria-pressed:bg-paper aria-pressed:font-medium aria-pressed:text-foreground',
  'aria-disabled:cursor-not-allowed aria-disabled:text-ink-disabled aria-disabled:hover:bg-transparent',
)

const NEXT: Record<SheetLayer, SheetLayer> = { read: 'plot', plot: 'compare', compare: 'read' }

export function LookSwitches({
  layer,
  onLayer,
  dark,
  onDark,
  noPlot,
  onNoPlot,
  loading,
}: {
  layer: SheetLayer
  onLayer: (layer: SheetLayer) => void
  dark: boolean
  onDark: (dark: boolean) => void
  /** Why the sheet has no Plot, in words (the disabled segments' tooltip); null when it has one. */
  noPlot: string | null
  onNoPlot: () => void
  /** The Plot is being fetched and drawn: the chosen segment spins. */
  loading: boolean
}) {
  const { t } = useLingui()
  const cycle = () => {
    if (noPlot !== null) onNoPlot()
    else onLayer(NEXT[layer])
  }
  useKeys([
    { key: 'D', label: t`Paper or CAD-dark`, group: 'sheet', run: () => onDark(!dark) },
    { key: 'P', label: t`As read, then Plot, then Compare`, group: 'sheet', run: cycle },
  ])
  const options: [SheetLayer, string][] = [
    ['read', t`As read`],
    ['plot', t`Plot`],
    ['compare', t`Compare`],
  ]
  return (
    <SlotFill slot="toolbar.end" order={10}>
      {/* Pressed buttons at the toolbar's control height, as Step 1's List | Sheet (one line, §8 item 6). */}
      <div role="group" aria-label={t`What the sheet shows`} className="inline-flex overflow-hidden rounded-md bg-chrome-sunken ring-1 ring-border-strong">
        {options.map(([value, words]) => {
          const off = value !== 'read' && noPlot !== null
          return (
            <button
              key={value}
              type="button"
              aria-pressed={layer === value}
              aria-disabled={off || undefined}
              aria-keyshortcuts="P"
              title={off ? noPlot : undefined}
              onClick={() => (off ? onNoPlot() : onLayer(value))}
              className={ITEM}
            >
              {words}
              {loading && layer === value ? <Loader2 aria-hidden strokeWidth={1.5} className="size-3 animate-spin motion-reduce:animate-none" /> : null}
            </button>
          )
        })}
      </div>
      <IconButton label={t`CAD-dark`} combo="D" aria-keyshortcuts="D" pressed={dark} onClick={() => onDark(!dark)}>
        <Contrast strokeWidth={1.5} />
      </IconButton>
    </SlotFill>
  )
}
