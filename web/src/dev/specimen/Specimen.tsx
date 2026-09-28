/*
 * The specimen route (/dev/specimen; development builds only): every piece in src/ui/ on invented
 * data, where the design gate judges ticket 01b's pieces (docs/design/m0-screens.md §8). Add
 * `?lang=en-XB` for the test-only pseudo right-to-left language: the chrome mirrors, the canvas
 * and every notation stay left to right.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Crosshair, Download, Layers, MoreHorizontal, Moon, Search, Square } from 'lucide-react'
import { activateLanguage, currentLanguage, useLanguage } from '@/i18n/activate'
import { addCatalogue, englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { PSEUDO_RTL_CODE } from '@/i18n/pseudo-tag'
import * as Glyph from '@/ui/glyphs'
import {
  AccessChip,
  Button,
  Count,
  DrawingText,
  Empty,
  ErrorBar,
  IconButton,
  KeyCombo,
  KeyRegion,
  KeyScope,
  KeysOverlay,
  List,
  LtrCanvas,
  NarrowNotice,
  PhoneNotice,
  ProgressLine,
  ReadOnlyChip,
  Segmented,
  Skeleton,
  StatusMark,
  useKeys,
  useToast,
} from '@/ui'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/ui/primitives/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/primitives/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip'
import { messages as specimenMessages } from '../locales/en.po'
import * as Data from './specimen.fixture'

addCatalogue('dev', { messages: specimenMessages })
if (currentLanguage().code === ENGLISH.code) activateLanguage(ENGLISH, englishMessages())

export const PSEUDO = PSEUDO_RTL_CODE

/** Switches between English and the test-only pseudo right-to-left language; true once active. */
function useSpecimenLanguage(lang: string | undefined): boolean {
  const language = useLanguage()
  useEffect(() => {
    let live = true
    if (lang === PSEUDO) {
      void import('@/i18n/pseudo').then((m) => {
        if (live) m.activatePseudoRtl()
      })
    } else {
      activateLanguage(ENGLISH, englishMessages())
    }
    return () => {
      live = false
    }
  }, [lang])
  return language.code === (lang === PSEUDO ? PSEUDO : ENGLISH.code)
}

function Section({ id, title, children, note }: { id: string; title: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 border-t border-border-strong pt-5 pb-8">
      <h2 id={`${id}-title`} className="text-xl">
        {title}
      </h2>
      {note ? <p className="mt-1 max-w-[80ch] text-sm text-ink-secondary">{note}</p> : null}
      <div className="mt-4 flex flex-col gap-5">{children}</div>
    </section>
  )
}

function Row({ label, children, top }: { label: ReactNode; children: ReactNode; top?: boolean }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-start gap-4">
      <div className="pt-1 text-xs font-semibold text-ink-secondary">{label}</div>
      <div className={`flex min-w-0 flex-wrap gap-3 ${top ? 'items-start' : 'items-center'}`}>{children}</div>
    </div>
  )
}

function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-paper p-4 ${className ?? ''}`}>{children}</div>
}

function Swatch({ token, children }: { token: string; children: ReactNode }) {
  return (
    <div className="w-[132px]">
      <div className="h-10 rounded-md border border-border" style={{ background: `var(${token})` }} />
      <div className="mt-1 text-xs font-medium">{children}</div>
      <div className="text-2xs text-muted-foreground">
        <bdi dir="ltr">{token}</bdi>
      </div>
    </div>
  )
}

function TokensSection() {
  return (
    <Section id="tokens" title={<Trans>Tokens</Trans>} note={<Trans>Paper is content, graphite is chrome, one indigo accent; copper once a screen.</Trans>}>
      <Row top label={<Trans>Surfaces and ink</Trans>}>
        <Swatch token="--background">
          <Trans>The table under the paper</Trans>
        </Swatch>
        <Swatch token="--chrome">
          <Trans>Bars, rail, inspector</Trans>
        </Swatch>
        <Swatch token="--paper">
          <Trans>Sheet, grid, tiles</Trans>
        </Swatch>
        <Swatch token="--foreground">
          <Trans>Text</Trans>
        </Swatch>
        <Swatch token="--muted-foreground">
          <Trans>Secondary text</Trans>
        </Swatch>
      </Row>
      <Row top label={<Trans>Accent and commit</Trans>}>
        <Swatch token="--primary">
          <Trans>Act, focus, selection</Trans>
        </Swatch>
        <Swatch token="--selected">
          <Trans>Selected row</Trans>
        </Swatch>
        <Swatch token="--commit">
          <Trans>The one bulk Confirm</Trans>
        </Swatch>
      </Row>
      <Row top label={<Trans>Status</Trans>}>
        <Swatch token="--status-proposal">
          <Trans>Proposal</Trans>
        </Swatch>
        <Swatch token="--status-confirmed">
          <Trans>Confirmed</Trans>
        </Swatch>
        <Swatch token="--status-question">
          <Trans>Question</Trans>
        </Swatch>
        <Swatch token="--status-excluded">
          <Trans>Excluded</Trans>
        </Swatch>
      </Row>
      <Row label={<Trans>Type: Archivo</Trans>}>
        <div className="flex flex-col gap-1">
          <span className="text-xl">
            <Trans>Page title, once a screen</Trans>
          </span>
          <span className="text-md font-semibold">
            <Trans>Section title</Trans>
          </span>
          <span className="text-sm">
            <Trans>Body, grid cells and controls at 13 px</Trans>
          </span>
          <span className="text-xs text-muted-foreground">
            <Trans>Captions and legends at 12 px</Trans>
          </span>
          <span className="num text-sm">
            <bdi dir="ltr">0123456789 · 1,184 / 1,412</bdi>
          </span>
        </div>
      </Row>
    </Section>
  )
}

function GlyphCell({ children, name }: { children: ReactNode; name: ReactNode }) {
  return (
    <div className="flex w-[104px] flex-col items-center gap-1.5 rounded-md border border-border bg-paper px-2 py-3 text-ink-secondary">
      {children}
      <span className="text-center text-2xs text-muted-foreground">{name}</span>
    </div>
  )
}

function GlyphsSection() {
  const { t } = useLingui()
  const steps: [keyof typeof Glyph.STEP_GLYPHS, string][] = [
    ['sheets', t`Sheets`],
    ['notes', t`Notes`],
    ['level', t`Levels`],
    ['grid', t`Grid`],
    ['foundation', t`Foundations`],
    ['column', t`Columns`],
    ['beam', t`Beams`],
    ['slab', t`Slabs`],
    ['stair', t`Stairs`],
    ['tank', t`Tanks`],
    ['wall', t`Walls`],
    ['room', t`Rooms`],
    ['roof', t`Roof`],
    ['site', t`Site`],
  ]
  return (
    <Section id="glyphs" title={<Trans>Glyphs</Trans>} note={<Trans>Drawn on Lucide’s 24-unit grid with a 1.5 stroke. A glyph never stands alone: a word beside it, or an accessible name.</Trans>}>
      <Row top label={<Trans>Takeoff Steps</Trans>}>
        {steps.map(([key, name]) => {
          const G = Glyph.STEP_GLYPHS[key]
          return (
            <GlyphCell key={key} name={name}>
              <G size={20} />
            </GlyphCell>
          )
        })}
      </Row>
      <Row top label={<Trans>Status, Cost Basis, Rebar Basis</Trans>}>
        <GlyphCell name={<Trans>Proposal</Trans>}>
          <Glyph.ProposalGlyph size={20} className="text-proposal" />
        </GlyphCell>
        <GlyphCell name={<Trans>Confirmed</Trans>}>
          <Glyph.ConfirmedGlyph size={20} className="text-confirmed" />
        </GlyphCell>
        <GlyphCell name={<Trans>Question</Trans>}>
          <Glyph.QuestionGlyph size={20} className="text-question" />
        </GlyphCell>
        <GlyphCell name={<Trans>Over Target Cost</Trans>}>
          <Glyph.OverTargetGlyph size={20} className="text-over-target" />
        </GlyphCell>
        <GlyphCell name={<Trans>Excluded</Trans>}>
          <Glyph.ExcludedGlyph size={20} className="text-excluded" />
        </GlyphCell>
        <GlyphCell name={<Trans>measured</Trans>}>
          <Glyph.MeasuredGlyph size={20} className="text-basis" />
        </GlyphCell>
        <GlyphCell name={<Trans>allowance</Trans>}>
          <Glyph.AllowanceGlyph size={20} className="text-basis" />
        </GlyphCell>
        <GlyphCell name={<Trans>by ratio</Trans>}>
          <Glyph.RebarRatioGlyph size={20} className="text-basis" />
        </GlyphCell>
        <GlyphCell name={<Trans>from the drawing</Trans>}>
          <Glyph.RebarDrawingGlyph size={20} className="text-basis" />
        </GlyphCell>
        <GlyphCell name={<Trans>from the drawing + rules</Trans>}>
          <Glyph.RebarDrawingRulesGlyph size={20} className="text-basis" />
        </GlyphCell>
        <GlyphCell name={<Trans>Trace</Trans>}>
          <Glyph.TraceGlyph size={20} className="text-ink-link" />
        </GlyphCell>
        <GlyphCell name={<Trans>Brand</Trans>}>
          <Glyph.BrandMark size={32} />
        </GlyphCell>
      </Row>
    </Section>
  )
}

function MarksSection() {
  return (
    <Section id="marks" title={<Trans>StatusMark, Count and Kbd</Trans>}>
      <Row label={<Trans>StatusMark</Trans>}>
        <StatusMark status="proposal" />
        <StatusMark status="confirmed" />
        <StatusMark status="question" questionId="Q3" />
        <StatusMark status="excluded" />
      </Row>
      <Row label={<Trans>Compact, with tooltip</Trans>}>
        <StatusMark status="proposal" compact />
        <StatusMark status="confirmed" compact />
        <StatusMark status="question" compact />
        <StatusMark status="excluded" compact />
      </Row>
      <Row label={<Trans>Count</Trans>}>
        <Count n={86} N={89} label={<Trans>columns placed</Trans>} />
        <Count n={1184} N={1412} />
        <Count n={12} N={null} label={<Trans>sheets, no drawing list</Trans>} />
      </Row>
      <Row label={<Trans>Kbd</Trans>}>
        <KeyCombo combo="Ctrl K" />
        <KeyCombo combo="Enter" />
        <KeyCombo combo="Esc" />
        <KeyCombo combo="1" />
        <KeyCombo combo="Shift F6" />
        <KeyCombo combo="PageDown" />
        <KeyCombo combo="?" />
      </Row>
    </Section>
  )
}

function ControlsSection() {
  const { t } = useLingui()
  const [mode, setMode] = useState<'list' | 'sheet'>('list')
  const [view, setView] = useState<'read' | 'plot' | 'compare'>('read')
  const [dark, setDark] = useState(false)
  return (
    <Section id="controls" title={<Trans>Buttons and switches</Trans>}>
      <Row label={<Trans>Button</Trans>}>
        <Button variant="primary">
          <Trans>Answer</Trans>
        </Button>
        <Button>
          <Trans>Review one by one</Trans>
        </Button>
        <Button variant="ghost">
          <Trans>Ask later</Trans>
        </Button>
        <Button variant="commit" size="lg">
          <Trans>Confirm 14</Trans> <KeyCombo combo="Enter" className="[&_kbd]:border-transparent [&_kbd]:bg-commit-hover [&_kbd]:text-commit-foreground" />
        </Button>
        <Button variant="destructive">
          <Trans>End access</Trans>
        </Button>
        <Button disabled>
          <Trans>Confirm</Trans>
        </Button>
        <Button variant="primary" saving>
          <Trans>Saving…</Trans>
        </Button>
      </Row>
      <Row label={<Trans>Tools, icon only</Trans>}>
        <IconButton label={t`CAD-dark`} combo="D" pressed={dark} onClick={() => setDark((d) => !d)}>
          <Moon />
        </IconButton>
        <IconButton label={t`Fit the whole sheet`} combo="F">
          <Square />
        </IconButton>
        <IconButton label={t`Zoom to view`} combo="Z">
          <Crosshair />
        </IconButton>
        <IconButton label={t`Outlines`} combo="O">
          <Layers />
        </IconButton>
        <IconButton label={t`More`}>
          <MoreHorizontal />
        </IconButton>
      </Row>
      <Row label={<Trans>Segmented</Trans>}>
        <Segmented
          label={t`List or sheet`}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'list', label: t`List` },
            { value: 'sheet', label: t`Sheet` },
          ]}
        />
        <Segmented
          label={t`How the sheet is drawn`}
          value={view}
          onChange={setView}
          options={[
            { value: 'read', label: t`As read` },
            { value: 'plot', label: t`Plot` },
            { value: 'compare', label: t`Compare` },
          ]}
        />
      </Row>
    </Section>
  )
}

function DrawingTextSection() {
  const number = <DrawingText kind="sheet-number" text="S-04" />
  const mark = <DrawingText kind="revision" text="R2" />
  return (
    <Section
      id="drawing-text"
      title={<Trans>DrawingText</Trans>}
      note={<Trans>Sheet numbers, marks and file names are isolated left to right; titles in their own direction. Cut with an ellipsis, the whole text in the tooltip.</Trans>}
    >
      <Row label={<Trans>Notation</Trans>}>
        <DrawingText kind="sheet-number" text="S-04" />
        <DrawingText kind="revision" text="R0" />
        <DrawingText kind="mark" text="C2" />
        <DrawingText kind="grid" text="A-3" />
        <DrawingText kind="file-name" text={Data.FILE_NAME} />
      </Row>
      <Row label={<Trans>Titles</Trans>}>
        <DrawingText kind="title" text={Data.SHEETS[3]!.title} />
        <DrawingText kind="title" text={Data.TITLE_OTHER_SCRIPT} />
      </Row>
      <Row label={<Trans>Cut to 180 px</Trans>}>
        <span className="block w-[180px]">
          <DrawingText kind="title" text={Data.SHEETS[6]!.title} />
        </span>
      </Row>
      <Row label={<Trans>In a sentence</Trans>}>
        <p className="text-sm">
          <Trans>
            Sheet {number} is at revision {mark}; confirm it before the next one.
          </Trans>
        </p>
      </Row>
    </Section>
  )
}

function CanvasSketch() {
  // Inside LtrCanvas: physical positions are allowed and the drawing is never mirrored.
  const w = 520
  const h = 240
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} fill="var(--canvas-ground)" stroke="var(--border-strong)" />
      {Data.GRID_X.map((label, i) => {
        const x = 80 + i * 120
        return (
          <g key={label}>
            <line x1={x} y1={36} x2={x} y2={h - 20} stroke="var(--canvas-grid-line)" strokeDasharray="8 3 2 3" strokeWidth={0.6} />
            <circle cx={x} cy={22} r={11} fill="none" stroke="var(--canvas-ink)" strokeWidth={0.8} />
            <text x={x} y={26} textAnchor="middle" fontSize={11} fill="var(--canvas-ink)">
              {label}
            </text>
          </g>
        )
      })}
      {Data.GRID_Y.map((label, j) => {
        const y = 70 + j * 60
        return (
          <g key={label}>
            <line x1={36} y1={y} x2={w - 20} y2={y} stroke="var(--canvas-grid-line)" strokeDasharray="8 3 2 3" strokeWidth={0.6} />
            <circle cx={22} cy={y} r={11} fill="none" stroke="var(--canvas-ink)" strokeWidth={0.8} />
            <text x={22} y={y + 4} textAnchor="middle" fontSize={11} fill="var(--canvas-ink)">
              {label}
            </text>
          </g>
        )
      })}
      {Data.GRID_X.flatMap((_, i) =>
        Data.GRID_Y.map((__, j) => (
          <rect key={`${i}-${j}`} x={80 + i * 120 - 6} y={70 + j * 60 - 8} width={12} height={16} fill="var(--canvas-ink)" />
        )),
      )}
      <rect x={200 - 9} y={130 - 11} width={18} height={22} fill="none" stroke="var(--canvas-proposal)" strokeWidth={1.5} strokeDasharray="4 3" />
      <rect x={80 - 9} y={70 - 11} width={18} height={22} fill="none" stroke="var(--canvas-confirmed)" strokeWidth={1.5} />
      <path d={Glyph.cloudPath(420 - 16, 190 - 16, 32, 32, 9)} fill="none" stroke="var(--canvas-question)" strokeWidth={1.5} />
      <text x={w - 12} y={h - 8} textAnchor="end" fontSize={10} fill="var(--canvas-ink-muted)">
        1:100
      </text>
    </svg>
  )
}

function CanvasSection() {
  return (
    <Section id="canvas" title={<Trans>LtrCanvas</Trans>} note={<Trans>The sheet canvas mounts inside it: fixed left to right and never mirrored, while the chrome around it mirrors.</Trans>}>
      <KeyRegion name="canvas" tabIndex={0} className="inline-block w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
        <CanvasKeys />
        <div className="flex items-center gap-2 border border-b-0 border-border bg-chrome px-2 py-1 text-xs text-ink-secondary">
          <Trans>Chrome above the canvas: it runs from the start edge.</Trans>
        </div>
        <LtrCanvas data-specimen-canvas="" className="border border-border">
          <CanvasSketch />
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-md bg-paper/90 px-2 py-1 text-2xs shadow-1">
            <StatusMark status="proposal" />
            <StatusMark status="confirmed" />
            <StatusMark status="question" />
          </div>
        </LtrCanvas>
      </KeyRegion>
    </Section>
  )
}

function CanvasKeys() {
  const { t } = useLingui()
  const toast = useToast()
  useKeys([{ key: 'F', label: t`Fit the whole sheet`, group: 'sheet', run: () => toast.show({ message: t`Fitted the whole sheet.` }) }])
  return null
}

function ListSection() {
  const { t } = useLingui()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(['S-03']))
  const [focused, setFocused] = useState<string | null>('S-04')
  return (
    <Section id="list" title={<Trans>List</Trans>} note={<Trans>28 px rows; ↑ ↓ Home End move the focused row. This list opts in to selection by Space, Shift ↑ ↓ and Shift-click.</Trans>}>
      <Tile className="w-full max-w-[760px] p-0">
        <div className="flex h-row items-center gap-2 border-b border-border-strong bg-band px-2 text-xs font-semibold text-ink-secondary">
          <span className="w-[72px]">
            <Trans>Sheet</Trans>
          </span>
          <span className="flex-1">
            <Trans>Title</Trans>
          </span>
          <span className="w-[48px]">
            <Trans>Rev.</Trans>
          </span>
          <span className="w-[120px]">
            <Trans>Views</Trans>
          </span>
          <span className="w-[120px]">
            <Trans>Status</Trans>
          </span>
        </div>
        <List
          label={t`Sheets`}
          items={Data.SHEETS}
          getKey={(s) => s.number}
          focusedKey={focused}
          onFocusedKeyChange={setFocused}
          selectable
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          renderItem={(s) => (
            <>
              <span className="w-[72px] font-medium">
                <DrawingText kind="sheet-number" text={s.number} />
              </span>
              <span className="min-w-0 flex-1">
                <DrawingText kind="title" text={s.title} />
              </span>
              <span className="w-[48px] text-ink-secondary">
                <DrawingText kind="revision" text={s.revision} />
              </span>
              <span className="w-[120px]">
                <Count n={s.views[0]} N={s.views[1]} />
              </span>
              <span className="w-[120px]">
                <StatusMark status={s.status} questionId={s.questionId} />
              </span>
            </>
          )}
        />
      </Tile>
    </Section>
  )
}

function StatesSection() {
  const toast = useToast()
  const { t } = useLingui()
  return (
    <Section id="states" title={<Trans>Empty, loading, progress, error and toast</Trans>}>
      <div className="grid grid-cols-2 gap-4">
        <Tile>
          <Empty
            glyph={<Glyph.BeamGlyph />}
            action={
              <Button>
                <Trans>Back to Step 1</Trans>
              </Button>
            }
          >
            <Trans>Step 7, Beams, is not open yet. It will read the sheets you confirm in Step 1.</Trans>
          </Empty>
        </Tile>
        <Tile>
          <Skeleton status={<Trans>Opening Kadam Residence…</Trans>} rows={5} />
        </Tile>
        <Tile className="flex flex-col gap-4">
          <ProgressLine value={12 / 38}>
            <Trans>Reading KR-STR-R0.dwg, sheet 12 of 38</Trans>
          </ProgressLine>
          <ProgressLine>
            <Trans>Checking the file</Trans>
          </ProgressLine>
        </Tile>
        <Tile className="flex flex-col gap-3 p-0">
          <ErrorBar
            action={
              <Button variant="ghost">
                <Trans>Try again</Trans>
              </Button>
            }
          >
            <Trans>Vextrus can't be reached. Check your connection; this page keeps trying.</Trans>
          </ErrorBar>
          <div className="flex gap-2 p-4 pt-1">
            <Button onClick={() => toast.show({ message: t`Confirmed 14 columns.`, onUndo: () => toast.show({ message: t`Undone.` }) })}>
              <Trans>Show a toast with Undo</Trans>
            </Button>
            <Button onClick={() => toast.show({ message: t`Excluded S-110: superseded.` })}>
              <Trans>Show a toast</Trans>
            </Button>
          </div>
        </Tile>
      </div>
    </Section>
  )
}

function AccessSection() {
  return (
    <Section id="access" title={<Trans>ReadOnlyChip and AccessChip</Trans>}>
      <Row label={<Trans>Read only</Trans>}>
        <ReadOnlyChip role="md" />
        <ReadOnlyChip role="guest" />
      </Row>
      <Row label={<Trans>Vextrus Engineer</Trans>}>
        <AccessChip vextrus developer={Data.DEVELOPER} projects="all" until={Data.UNTIL} daysLeft={28} />
        <AccessChip vextrus developer={Data.DEVELOPER} projects={Data.PROJECTS_ONE} until={Data.UNTIL} daysLeft={28} />
        <AccessChip vextrus developer={Data.DEVELOPER} projects="all" until={Data.UNTIL} daysLeft={2} />
      </Row>
      <Row label={<Trans>Guest and members</Trans>}>
        <AccessChip vextrus={false} developer={Data.DEVELOPER} projects={Data.PROJECTS_ONE} until={Data.UNTIL} daysLeft={28} />
        <AccessChip vextrus={false} developer={Data.DEVELOPER} projects={Data.PROJECTS_TWO} until={null} daysLeft={null} />
        <AccessChip vextrus={false} developer={Data.DEVELOPER} projects={Data.PROJECTS_MANY} until={Data.UNTIL} daysLeft={28} />
        <AccessChip vextrus={false} developer={Data.DEVELOPER} projects="all" until={Data.UNTIL} daysLeft={1} />
      </Row>
    </Section>
  )
}

function NoticesSection() {
  return (
    <Section id="notices" title={<Trans>PhoneNotice and NarrowNotice</Trans>} note={<Trans>Under 640 px the phone notice replaces every screen after sign-in; from 640 to 1279 px the narrow notice sits above the page. Shown here in frames.</Trans>}>
      <div className="flex items-start gap-6">
        <div className="h-[520px] w-[390px] overflow-hidden rounded-lg border border-border-strong shadow-1">
          <PhoneNotice onSignOut={() => {}} className="h-full" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-border-strong">
          <NarrowNotice />
          <div className="h-[120px] bg-background" />
        </div>
      </div>
    </Section>
  )
}

function PrimitivesSection() {
  return (
    <Section id="primitives" title={<Trans>Dialog, Popover, Menu, Tabs, Tooltip and Command</Trans>} note={<Trans>shadcn primitives on the tokens. Every close goes through the key map’s Esc.</Trans>}>
      <Row label={<Trans>Layers</Trans>}>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Trans>Open a dialog</Trans>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <Trans>Invite a Guest</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>A Guest may look at the projects you choose, until the date you set.</Trans>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost">
                <Trans>Cancel</Trans>
              </Button>
              <Button variant="primary">
                <Trans>Invite</Trans>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Popover>
          <PopoverTrigger asChild>
            <Button>
              <Trans>Open a popover</Trans>
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="font-semibold">
              <Trans>Coverage</Trans>
            </p>
            <p className="text-muted-foreground">
              <Trans>70 views: 68 proposed, 2 unaccounted.</Trans>
            </p>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Trans>Open a menu</Trans>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>
              <Trans>Nusrat Jahan, QS</Trans>
            </DropdownMenuLabel>
            <DropdownMenuItem>
              <Trans>Members and access</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Trans>Keys</Trans>
              <DropdownMenuShortcut>
                <KeyCombo combo="?" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Trans>Sign out</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>
              <Trans>Hover for a tooltip</Trans>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <Trans>Download the report</Trans> <Download aria-hidden className="size-3.5" />
          </TooltipContent>
        </Tooltip>
      </Row>
      <Row label={<Trans>Tabs</Trans>}>
        <Tile className="w-[320px] p-0">
          <Tabs defaultValue="selection">
            <TabsList>
              <TabsTrigger value="selection">
                <Trans>Selection</Trans>
              </TabsTrigger>
              <TabsTrigger value="questions">
                <Trans>Questions</Trans>
                <span className="rounded-xs bg-question-surface px-1 text-2xs font-semibold text-question">5</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="selection" className="p-3 text-sm">
              <DrawingText kind="sheet-number" text="S-04" /> <DrawingText kind="title" text={Data.SHEETS[3]!.title} />
            </TabsContent>
            <TabsContent value="questions" className="p-3 text-sm">
              <StatusMark status="question" questionId="Q3" />
            </TabsContent>
          </Tabs>
        </Tile>
      </Row>
      <Row label={<Trans>Command</Trans>}>
        <JumpTo />
      </Row>
    </Section>
  )
}

/** Command in its dialog, as ticket 03's "Jump to" uses it; inline, cmdk scrolls the page to its first item. */
function JumpTo() {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  useKeys([{ key: 'Ctrl K', label: t`Jump to a project or a sheet`, group: 'global', run: () => setOpen(true) }])
  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-[220px] justify-between text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Search aria-hidden className="size-3.5" />
          <Trans>Jump to…</Trans>
        </span>
        <KeyCombo combo="Ctrl K" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title={t`Jump to`} description={t`Find a project or a sheet by number or title.`}>
        <CommandInput placeholder={t`Jump to a project or a sheet…`} />
        <CommandList>
          <CommandEmpty>
            <Trans>Nothing matches.</Trans>
          </CommandEmpty>
          <CommandGroup heading={t`Sheets`}>
            {Data.SHEETS.slice(0, 5).map((s) => (
              <CommandItem key={s.number} value={`${s.number} ${s.title}`} onSelect={() => setOpen(false)}>
                <DrawingText kind="sheet-number" text={s.number} className="font-medium" />
                <DrawingText kind="title" text={s.title} className="text-muted-foreground" />
                <CommandShortcut>
                  <StatusMark status={s.status} compact />
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

function KeysSection({ onOpenKeys }: { onOpenKeys: () => void }) {
  return (
    <Section id="keys" title={<Trans>The key map</Trans>} note={<Trans>Press ? for the keys active where focus is. Focus the canvas above and press ? again: F joins the list.</Trans>}>
      <Row label={<Trans>The ? overlay</Trans>}>
        <Button onClick={onOpenKeys}>
          <Trans>Show the keys</Trans> <KeyCombo combo="?" />
        </Button>
      </Row>
    </Section>
  )
}

function ScreenKeys({ onOpenKeys }: { onOpenKeys: () => void }) {
  const { t } = useLingui()
  useKeys([{ key: '?', label: t`Show the keys`, group: 'global', run: onOpenKeys }])
  return null
}

function LanguageSwitch({ lang }: { lang: string | undefined }) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        to="/dev/specimen"
        search={{}}
        className={`rounded-md px-2 py-1 ${lang !== PSEUDO ? 'bg-selected font-medium text-foreground' : 'text-ink-link hover:bg-hover'}`}
      >
        <Trans>English</Trans>
      </Link>
      <Link
        to="/dev/specimen"
        search={{ lang: PSEUDO }}
        className={`rounded-md px-2 py-1 ${lang === PSEUDO ? 'bg-selected font-medium text-foreground' : 'text-ink-link hover:bg-hover'}`}
      >
        <Trans>Pseudo right to left</Trans>
      </Link>
    </nav>
  )
}

export function Specimen({ lang }: { lang: string | undefined }) {
  const { t } = useLingui()
  const ready = useSpecimenLanguage(lang)
  const sections: [string, string][] = [
    ['tokens', t`Tokens`],
    ['glyphs', t`Glyphs`],
    ['marks', t`Marks and counts`],
    ['controls', t`Buttons`],
    ['drawing-text', t`DrawingText`],
    ['canvas', t`LtrCanvas`],
    ['list', t`List`],
    ['states', t`States`],
    ['access', t`Chips`],
    ['notices', t`Notices`],
    ['primitives', t`Primitives`],
    ['keys', t`Keys`],
  ]
  const [keysOpen, setKeysOpen] = useState(false)
  const openKeys = () => setKeysOpen(true)
  if (!ready) return null
  return (
    <KeyScope level="screen" name="specimen">
      <ScreenKeys onOpenKeys={openKeys} />
      <div data-specimen="" className="min-h-dvh bg-background">
        <header className="sticky top-0 z-(--z-sticky) flex h-topbar items-center gap-3 border-b border-border bg-chrome px-4">
          <Glyph.BrandMark />
          <h1 className="text-md font-semibold">
            <Trans>Specimen of the shared pieces</Trans>
          </h1>
          <span className="text-xs text-muted-foreground">
            <Trans>Development builds only. Every name and figure is invented.</Trans>
          </span>
          <div className="ms-auto">
            <LanguageSwitch lang={lang} />
          </div>
        </header>
        <div className="mx-auto flex max-w-[1360px] gap-8 px-6">
          <nav aria-label={t`Sections`} className="sticky top-topbar h-fit w-[168px] shrink-0 py-6">
            <ol className="flex flex-col gap-0.5 border-s border-border">
              {sections.map(([id, name]) => (
                <li key={id}>
                  <a href={`#${id}`} className="-ms-px block border-s-2 border-transparent ps-3 py-1 text-sm text-ink-secondary hover:border-primary hover:text-foreground">
                    {name}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <main className="min-w-0 flex-1 py-6">
            <TokensSection />
            <GlyphsSection />
            <MarksSection />
            <ControlsSection />
            <DrawingTextSection />
            <CanvasSection />
            <ListSection />
            <StatesSection />
            <AccessSection />
            <NoticesSection />
            <PrimitivesSection />
            <KeysSection onOpenKeys={openKeys} />
          </main>
        </div>
      </div>
      <KeysOverlay open={keysOpen} onOpenChange={setKeysOpen} />
    </KeyScope>
  )
}
