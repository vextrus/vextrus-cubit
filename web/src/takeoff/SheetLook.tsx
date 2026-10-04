/*
 * Step 1's sheet look (m0-screens 6.14, 4.6 "The Plot", 6.13 "No Plot, and why"): Paper or CAD-dark
 * and As read, Plot or Compare, kept while paging (the orchestrator's ruling, session 11: CAD-dark is a
 * screen setting; Plot and Compare stay, and a sheet with no Plot shows As read with its no-Plot note).
 * The Plot is 14's: the sheet's `/plot` (its PDF, page and transform), the PDF's bytes once per file,
 * the page drawn by pdf.js only when Plot or Compare is first chosen.
 *
 *   const look = useSheetLook(projectId, sheet)
 *   <>{look.switches}<SheetViewer … {...look.viewer} /></>
 */
import { useState, type ReactNode } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'
import { useFormat } from '@/format'
import { machineText, type MachineMessage } from '@/format/machine'
import { LookSwitches, drawPlotPage, readPlotTransform, type SheetLayer, type SheetPlot } from '@/sheet'
import { DrawingText } from '@/ui'
import { retry, type ProposalOut } from './data'

/** A PDF's bytes, fetched once and shared by every sheet plotted from it. */
function pdfQuery(projectId: string, fileId: string) {
  return queryOptions({
    queryKey: ['drawing-pdf', projectId, fileId],
    queryFn: async () =>
      unwrap(
        api.GET('/api/projects/{project_id}/drawings/files/{file_id}/pdf', {
          params: { path: { project_id: projectId, file_id: fileId } },
          parseAs: 'arrayBuffer',
        }),
      ) as Promise<ArrayBuffer>,
    staleTime: Infinity,
    retry,
  })
}

/** A sheet with no Plot whose reason did not come (never expected: 14 always sends one). */
const NO_PLOT = msg`No Plot for this sheet.`

export interface SheetLook {
  /** The toolbar's switches, mounted with the sheet. */
  switches: ReactNode
  /** The viewer's look props. */
  viewer: { dark: boolean; layer: SheetLayer; plot: SheetPlot | null; notes: ReactNode; status: ReactNode }
}

export function useSheetLook(projectId: string, sheet: ProposalOut): SheetLook {
  const { i18n } = useLingui()
  const f = useFormat()
  const queryClient = useQueryClient()
  const [dark, setDark] = useState(false)
  const [layer, setLayer] = useState<SheetLayer>('read')
  // The sheet on which P (or a click on a disabled segment) raised the no-Plot note: paging lowers it.
  const [raised, setRaised] = useState<string | null>(null)

  const has = !!sheet.plot_file && !!sheet.plot_page
  const shown: SheetLayer = has ? layer : 'read'
  const none = (sheet.plot_none ?? null) as MachineMessage | null
  const why = has ? null : none ? machineText(none, f, i18n) : i18n._(NO_PLOT)

  const plot = useQuery({
    queryKey: ['sheet-plot', projectId, sheet.sheet_id],
    enabled: has && shown !== 'read',
    // A drawn page is large: dropped as soon as no sheet shows it (the PDF's bytes stay cached).
    gcTime: 0,
    staleTime: Infinity,
    retry,
    queryFn: async (): Promise<SheetPlot> => {
      const answer = await unwrap(
        api.GET('/api/projects/{project_id}/drawings/sheets/{sheet_id}/plot', { params: { path: { project_id: projectId, sheet_id: sheet.sheet_id } } }),
      )
      const transform = readPlotTransform(answer.transform)
      if (!answer.file_id || !answer.page || !transform) throw new Error('no Plot')
      const bytes = await queryClient.fetchQuery(pdfQuery(projectId, answer.file_id))
      return { picture: await drawPlotPage(bytes, answer.page), transform }
    },
  })

  const choose = (next: SheetLayer) => {
    setLayer(next)
    if (next !== 'read' && plot.isError) void plot.refetch()
  }

  let notes: ReactNode = null
  if (!has && (raised === sheet.id || layer !== 'read')) notes = why
  else if (shown !== 'read' && plot.isError) notes = <Trans>The Plot could not be drawn, so the sheet is shown as read. Choose Plot or Compare to try again.</Trans>
  else if (shown === 'plot') notes = <PlotNote sheet={sheet} />
  else if (shown === 'compare')
    notes = dark ? <Trans>Compare: what was read in orange over the Plot</Trans> : <Trans>Compare: what was read in red over the Plot</Trans>
  const loading = shown !== 'read' && plot.isFetching && !plot.data

  return {
    switches: (
      <LookSwitches layer={shown} onLayer={choose} dark={dark} onDark={setDark} noPlot={why} onNoPlot={() => setRaised(sheet.id)} loading={loading} />
    ),
    viewer: { dark, layer: shown, plot: plot.data ?? null, notes, status: loading ? <Trans>Loading the Plot…</Trans> : null },
  }
}

/** "Plot: NT-STR-R1.pdf page 18, registered to 0.3 mm" (6.14). */
function PlotNote({ sheet }: { sheet: ProposalOut }) {
  const f = useFormat()
  const file = <DrawingText kind="file-name" text={sheet.plot_file ?? ''} truncate={false} />
  const page = f.integer(sheet.plot_page ?? 0)
  const residual = sheet.plot_residual ? f.quantity(sheet.plot_residual, 1) : null
  return residual ? (
    <Trans>
      Plot: {file} page {page}, registered to {residual} mm
    </Trans>
  ) : (
    <Trans>
      Plot: {file} page {page}
    </Trans>
  )
}
