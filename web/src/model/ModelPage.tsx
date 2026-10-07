/*
 * The Live Model in 3D (`/p/$code/model`; session-16 contract, W2): an orthographic view of every
 * Element's solids merged one draw call a storey, orbited by the pointer or the arrow keys; a storey's
 * control isolates it; a pick opens the inspector with the Element's IFC class, classification and
 * Trace. A confirmed Element is grey, a Proposal cyan, a held one amber (screens.md rulings 6 and 10).
 *
 * Not built here: dashed Proposal edges, a Foundations toggle, cut faces by material, the question
 * marker (screens.md rulings 9–11), the Trace's flight to the sheet, and sloped primitives.
 */
import { useEffect, useMemo, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Box } from 'lucide-react'
import { LoadProblem, usePageTitle } from '@/auth'
import { Empty, Skeleton, cn } from '@/ui'
import { primitivesQuery, storeysQuery } from './data'
import { ModelCanvas } from './ModelCanvas'
import { ModelInspector } from './ModelInspector'
import { STATE_COLOURS, buildScene, type ElementState, type Scene } from './scene'

const projectRoute = getRouteApi('/_app/p/$code')

const chip = cn('inline-flex h-control items-center rounded-md border border-border-strong px-2.5 text-sm focus-visible:z-10')

function StoreyControls({ names, isolated, onIsolate }: { names: string[]; isolated: string | null; onIsolate: (storey: string | null) => void }) {
  const { t } = useLingui()
  return (
    <div role="group" aria-label={t`Storeys`} className="flex items-center gap-1.5">
      <button
        type="button"
        aria-pressed={isolated === null}
        onClick={() => onIsolate(null)}
        className={cn(chip, isolated === null ? 'bg-selected font-semibold' : 'hover:bg-hover')}
      >
        <Trans>All storeys</Trans>
      </button>
      {names.map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={isolated === name}
          onClick={() => onIsolate(isolated === name ? null : name)}
          className={cn(chip, 'num', isolated === name ? 'bg-selected font-semibold' : 'hover:bg-hover')}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

function Legend() {
  const { t } = useLingui()
  const items: [ElementState, string][] = [
    ['confirmed', t`Confirmed`],
    ['proposal', t`Proposal`],
    ['held', t`Held by a Question`],
  ]
  return (
    <ul aria-label={t`What the colours mean`} className="flex items-center gap-3 text-xs text-ink-secondary">
      {items.map(([state, label]) => (
        <li key={state} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-xs"
            style={{
              background: `#${STATE_COLOURS[state].toString(16).padStart(6, '0')}`,
            }}
          />
          {label}
        </li>
      ))}
    </ul>
  )
}

function Loaded({ projectId, scene, storeyNames }: { projectId: string; scene: Scene; storeyNames: string[] }) {
  const { t } = useLingui()
  const [isolated, setIsolated] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => () => scene.dispose(), [scene])
  return (
    <div className="flex min-h-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col">
        <div
          data-region="toolbar"
          role="toolbar"
          aria-label={t`The 3D view’s tools`}
          className="focus-inset flex h-toolbar shrink-0 items-center gap-4 overflow-hidden border-b border-border bg-chrome px-2"
        >
          <StoreyControls names={storeyNames} isolated={isolated} onIsolate={setIsolated} />
          <span className="flex-1" />
          <Legend />
        </div>
        <div data-region="canvas" data-canvas-area="" className="focus-inset relative min-h-0 flex-1 overflow-hidden bg-background">
          <ModelCanvas scene={scene} isolated={isolated} selected={selected} onPick={setSelected} />
        </div>
      </main>
      <ModelInspector projectId={projectId} elementId={selected} />
    </div>
  )
}

export function ModelPage() {
  const { t } = useLingui()
  const project = projectRoute.useLoaderData()
  usePageTitle(t`Live Model`)
  const primitives = useQuery(primitivesQuery(project.id))
  const storeys = useQuery(storeysQuery(project.id))
  const scene = useMemo(() => (primitives.data ? buildScene(primitives.data) : null), [primitives.data])
  // The storeys' order from the Takeoff, then any the model draws that it does not name; the top storey first.
  const storeyNames = useMemo(() => {
    if (!scene) return []
    const named = (storeys.data ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.name)
      .filter((n) => scene.storeys.includes(n))
    return [...named, ...scene.storeys.filter((n) => !named.includes(n))].reverse()
  }, [scene, storeys.data])

  if (primitives.error) return <LoadProblem error={primitives.error} onRetry={() => void primitives.refetch()} className="m-6" />
  if (!scene) return <Skeleton rows={8} className="m-6" status={<Trans>Opening the Live Model…</Trans>} />
  if (scene.storeys.length === 0)
    return (
      <Empty glyph={<Box />} className="m-6">
        <Trans>The Live Model has no elements yet. Confirm a Takeoff Step and its elements appear here.</Trans>
      </Empty>
    )
  return <Loaded key={project.id} projectId={project.id} scene={scene} storeyNames={storeyNames} />
}
