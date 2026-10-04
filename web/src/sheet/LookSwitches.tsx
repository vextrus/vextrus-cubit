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
import { IconButton, Segmented, useKeys } from '@/ui'
import type { SheetLayer } from './SheetViewer'

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
    { key: 'D', label: t`Paper ⇄ CAD-dark`, group: 'sheet', run: () => onDark(!dark) },
    { key: 'P', label: t`As read → Plot → Compare`, group: 'sheet', run: cycle },
  ])
  const spin = (value: SheetLayer) => (loading && layer === value ? <Loader2 aria-hidden strokeWidth={1.5} className="size-3 animate-spin motion-reduce:animate-none" /> : null)
  return (
    <SlotFill slot="toolbar.end" order={10}>
      <Segmented<SheetLayer>
        label={t`What the sheet shows`}
        value={layer}
        onChange={onLayer}
        onRefused={onNoPlot}
        options={[
          { value: 'read', label: t`As read` },
          { value: 'plot', label: <>{t`Plot`}{spin('plot')}</>, disabled: noPlot !== null, title: noPlot ?? undefined },
          { value: 'compare', label: <>{t`Compare`}{spin('compare')}</>, disabled: noPlot !== null, title: noPlot ?? undefined },
        ]}
      />
      <IconButton label={t`CAD-dark`} combo="D" pressed={dark} onClick={() => onDark(!dark)}>
        <Contrast strokeWidth={1.5} />
      </IconButton>
    </SlotFill>
  )
}
