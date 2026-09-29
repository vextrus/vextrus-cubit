/*
 * The sheet viewer's harness (/dev/sheet/:id; development builds only, as /dev/specimen): ticket 16's
 * viewer on its own, before 22 mounts it in Step 1. `:id` names a committed fixture
 * (`tiny-sheet`, `lineweight-ramp`: engine/render/fixtures/, invented drawings) or a buffer written
 * locally by `python -m engine.render <file.dwg> --out .private/work/sheets --sheets N` (13's sheets;
 * real drawings stay under .private/, which Vite serves to 127.0.0.1 only in development).
 * The previous and next links walk every sheet the harness knows, in name order.
 */
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react'
import { SlotOutlet, SlotsProvider } from '@/app/slots'
import { activateLanguage, currentLanguage } from '@/i18n/activate'
import { addCatalogue, englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { SheetViewer } from '@/sheet'
import { Empty, ErrorBar, KeyScope, KeysOverlay, Skeleton, buttonVariants, cn, isolateLtr, useKeys } from '@/ui'
import tinySheetUrl from '../../../../engine/render/fixtures/tiny-sheet.bin?url'
import rampUrl from '../../../../engine/render/fixtures/lineweight-ramp.bin?url'
import { messages as devMessages } from '../locales/en.po'

addCatalogue('dev', { messages: devMessages })
if (currentLanguage().code === ENGLISH.code) activateLanguage(ENGLISH, englishMessages())

const local = import.meta.glob<string>('../../../../.private/work/sheets/*.bin', { query: '?url', import: 'default' })

/** Every sheet the harness can open, by name: the fixtures, then the local buffers. */
export const HARNESS_SHEETS: Record<string, () => Promise<string>> = {
  'lineweight-ramp': () => Promise.resolve(rampUrl),
  'tiny-sheet': () => Promise.resolve(tinySheetUrl),
  ...Object.fromEntries(Object.entries(local).map(([path, load]) => [path.replace(/^.*\//, '').replace(/\.bin$/, ''), load])),
}

/** The ? overlay, as the frame has it, so a walk of the harness can read the sheet's keys. */
function Keys() {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState<Element | null>(null)
  useKeys([
    {
      key: '?',
      label: t`Show the keys`,
      group: 'global',
      run: () => {
        setFrom(document.activeElement)
        setOpen(true)
      },
    },
  ])
  return <KeysOverlay open={open} onOpenChange={setOpen} from={from} />
}

type Loaded = { id: string; buffer: ArrayBuffer } | { id: string; failed: true }

export function SheetHarness({ id }: { id: string }) {
  const { t } = useLingui()
  const names = Object.keys(HARNESS_SHEETS).sort()
  const at = names.indexOf(id)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const load = HARNESS_SHEETS[id]
    if (!load) return
    let live = true
    load()
      .then((url) => fetch(url))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(
        (buffer) => live && setLoaded({ id, buffer }),
        () => live && setLoaded({ id, failed: true }),
      )
    return () => {
      live = false
    }
  }, [id, attempt])

  const current = loaded?.id === id ? loaded : null
  const name = isolateLtr(id) // a file name: notation
  const step = (k: number) => names[at + k]
  const previous = step(-1)
  const next = step(1)
  const link = cn(buttonVariants({ variant: 'ghost' }), 'size-control px-0')

  return (
    <SlotsProvider>
      <KeyScope level="screen" name="sheet-harness">
        <Keys />
        <div data-sheet-harness="" className="flex h-dvh flex-col bg-background">
          <div data-region="toolbar" className="flex h-toolbar shrink-0 items-center gap-2 border-b border-border bg-chrome px-2">
            {previous ? (
              <Link to="/dev/sheet/$id" params={{ id: previous }} aria-label={t`Previous sheet`} className={link}>
                <ChevronLeft aria-hidden size={16} className="rtl:-scale-x-100" />
              </Link>
            ) : null}
            {next ? (
              <Link to="/dev/sheet/$id" params={{ id: next }} aria-label={t`Next sheet`} className={link}>
                <ChevronRight aria-hidden size={16} className="rtl:-scale-x-100" />
              </Link>
            ) : null}
            <SlotOutlet name="toolbar.start" className="flex-1 gap-2" />
            <SlotOutlet name="toolbar.end" className="gap-2" />
          </div>
          <div data-region="canvas" className="relative min-h-0 flex-1 overflow-hidden">
            {at < 0 ? (
              <div className="flex h-full items-center justify-center">
                <Empty glyph={<FileQuestion />}>
                  <Trans>
                    The harness has no sheet named “{name}”. Open tiny-sheet or lineweight-ramp, or add a sheet with python
                    -m engine.render.
                  </Trans>
                </Empty>
              </div>
            ) : current === null ? (
              <Skeleton className="p-8" status={t`Opening ${name}…`} />
            ) : 'failed' in current ? (
              <div className="p-4">
                <ErrorBar
                  action={
                    <button type="button" className={buttonVariants()} onClick={() => setAttempt((a) => a + 1)}>
                      <Trans>Try again</Trans>
                    </button>
                  }
                >
                  <Trans>The harness could not load “{name}”. Try again, or write the sheet again with python -m engine.render.</Trans>
                </ErrorBar>
              </div>
            ) : (
              <SheetViewer key={id} buffer={current.buffer} label={id} />
            )}
          </div>
          <footer data-region="status-bar" className="flex h-statusbar shrink-0 items-center gap-4 border-t border-border bg-chrome px-3 text-2xs text-ink-secondary">
            <SlotOutlet name="status.start" className="gap-4" />
          </footer>
        </div>
      </KeyScope>
    </SlotsProvider>
  )
}
