/*
 * A canvas screen (the Takeoff; docs/design/m0-screens.md §4.1, §4.7): under the top bar, the 48 px
 * step rail, the 32 px toolbar over the canvas, the docked 320 px inspector, and the 24 px status bar.
 * At 1440×900 the canvas is 1072 × 804 px (74% of the width); at 1280×800, 912 × 704 (71%). The
 * inspector never floats, so selecting never moves the drawing; the open rail overlays the canvas and
 * never reflows it.
 *
 * Later tickets only fill it: the canvas is the step route's child (22 draws Step 1 there), and the
 * toolbar, status bar and inspector take items through slots (slots.tsx).
 */
import { useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronRight, Keyboard } from 'lucide-react'
import { useFormat } from '@/format'
import { useLanguage } from '@/i18n/activate'
import { Count, IconButton, ReadOnlyChip, STEP_GLYPHS, ConfirmedGlyph, ProposalGlyph, QuestionGlyph, Empty, buttonVariants, cn } from '@/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip'
import { AppLink, PATHS } from './AppLink'
import { usePerfFlag } from './perf'
import type { ProjectSummary, Session } from './session'
import { useCloseOnEsc, useShell } from './shell'
import { SlotOutlet } from './slots'
import { TAKEOFF_STEPS, type TakeoffStep } from './steps'

type Step1 = ProjectSummary['step1']

/** Step 1's state mark (screens.md): a Question wins, then all confirmed, then Proposals ready; none before. */
function step1Mark(s: Step1): 'question' | 'confirmed' | 'proposal' | null {
  if (s.questionsOpen > 0) return 'question'
  if (s.found !== null && s.found > 0 && s.confirmed + s.excluded >= s.found) return 'confirmed'
  if (s.found !== null && s.found > 0) return 'proposal'
  return null
}

function StepMark({ mark }: { mark: ReturnType<typeof step1Mark> }) {
  const { t } = useLingui()
  if (mark === 'question') return <QuestionGlyph size={12} className="text-question" title={t`Questions open`} />
  if (mark === 'confirmed') return <ConfirmedGlyph size={12} className="text-confirmed" title={t`Confirmed`} />
  if (mark === 'proposal') return <ProposalGlyph size={12} className="text-proposal" title={t`Proposals ready`} />
  return null
}

function StepRail({ project, current }: { project: ProjectSummary; current: TakeoffStep }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const language = useLanguage()
  const [open, setOpen] = useState(false)
  useCloseOnEsc(open, () => setOpen(false))
  const side = language.dir === 'rtl' ? 'left' : 'right'
  return (
    <nav
      data-region="rail"
      aria-label={t`Takeoff Steps`}
      className={cn(
        'focus-inset absolute inset-y-0 start-0 z-(--z-canvas-overlay) flex flex-col border-e border-border bg-chrome transition-[width] duration-(--motion-panel) ease-(--ease)',
        open ? 'w-(--rail-expanded) shadow-3' : 'w-rail',
      )}
    >
      <ol className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-1">
        {TAKEOFF_STEPS.map((step) => {
          const Glyph = STEP_GLYPHS[step.key]
          const name = i18n._(step.name)
          const number = step.number
          const here = step.number === current.number
          const tip = step.open ? t`Step ${number}, ${name}` : t`Step ${number}, ${name}: not open yet`
          const link = (
            <AppLink
              to={PATHS.takeoff(project.code, step.number)}
              aria-current={here ? 'page' : undefined}
              className={cn(
                'relative flex h-9 items-center gap-2 ps-3.5 pe-2 text-sm focus-inset',
                here ? 'bg-selected text-foreground before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-primary' : 'hover:bg-hover',
                step.open ? 'text-foreground' : 'text-ink-disabled',
              )}
            >
              <span className="relative shrink-0">
                <Glyph size={20} aria-hidden />
                {step.number === 1 ? (
                  <span className="absolute -end-1.5 -bottom-1 rounded-xs bg-chrome">
                    <StepMark mark={step1Mark(project.step1)} />
                  </span>
                ) : null}
              </span>
              {open ? (
                <>
                  <span className="num w-5 shrink-0 text-end text-xs text-muted-foreground">{f.integer(step.number)}</span>
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {step.number === 1 ? <Count n={project.step1.confirmed} N={project.step1.found} format={f.integer} className="text-xs" /> : null}
                </>
              ) : (
                <span className="sr-only">{tip}</span>
              )}
            </AppLink>
          )
          return (
            <li key={step.key}>
              {open ? (
                link
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side={side}>{tip}</TooltipContent>
                </Tooltip>
              )}
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t`Close the step rail` : t`Open the step rail`}
        className="flex h-control shrink-0 items-center justify-center border-t border-border text-ink-secondary hover:bg-hover"
      >
        <ChevronRight aria-hidden size={16} strokeWidth={1.5} className={cn('rtl:-scale-x-100', open && 'rotate-180 rtl:rotate-0')} />
      </button>
    </nav>
  )
}

function Toolbar({ session, project, step }: { session: Session; project: ProjectSummary; step: TakeoffStep }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const shell = useShell()
  const number = step.number
  const s = project.step1
  const excluded = s.excluded
  return (
    <div data-region="toolbar" role="toolbar" aria-label={t`The step's tools`} className="focus-inset flex h-toolbar shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-chrome px-2">
      <span className="text-sm whitespace-nowrap text-ink-secondary">
        <Trans>Step {number}</Trans>
      </span>
      <span className="text-sm font-semibold whitespace-nowrap">{i18n._(step.name)}</span>
      {step.number === 1 ? (
        <span className="text-sm whitespace-nowrap text-ink-secondary">
          <Trans>
            Confirmed <Count n={s.confirmed} N={s.found} format={f.integer} />
          </Trans>
          {excluded > 0 ? <Trans>, {excluded} excluded</Trans> : null}
        </span>
      ) : null}
      {session.role === 'md' || session.role === 'guest' ? <ReadOnlyChip role={session.role} /> : null}
      <SlotOutlet name="toolbar.start" className="flex-1 gap-2" />
      <SlotOutlet name="toolbar.end" className="gap-2" />
      <IconButton label={t`Keys`} combo="?" onClick={(event) => shell.openKeys(event.currentTarget)}>
        <Keyboard strokeWidth={1.5} />
      </IconButton>
    </div>
  )
}

function Inspector({ project, step }: { project: ProjectSummary; step: TakeoffStep }) {
  const { t } = useLingui()
  const questions = step.number === 1 ? project.step1.questionsOpen : 0
  return (
    <aside data-region="inspector" aria-label={t`Inspector`} className="focus-inset flex w-inspector shrink-0 flex-col border-s border-border bg-chrome">
      <Tabs defaultValue="selection" className="min-h-0 flex-1">
        <TabsList>
          <TabsTrigger value="selection">
            <Trans>Selection</Trans>
          </TabsTrigger>
          <TabsTrigger value="questions">
            <Trans>Questions</Trans>
            {questions > 0 ? (
              <span className="num inline-flex h-4 min-w-4 items-center justify-center rounded-xs bg-question-surface px-1 text-xs font-semibold text-question">
                {questions}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="selection" forceMount className="min-h-0 overflow-y-auto data-[state=inactive]:hidden">
          <SlotOutlet name="inspector.selection" className="flex-col items-stretch" />
        </TabsContent>
        <TabsContent value="questions" forceMount className="min-h-0 overflow-y-auto data-[state=inactive]:hidden">
          <SlotOutlet name="inspector.questions" className="flex-col items-stretch" />
        </TabsContent>
      </Tabs>
    </aside>
  )
}

function StatusBar() {
  const f = useFormat()
  const perf = usePerfFlag()
  return (
    <footer data-region="status-bar" className="focus-inset flex h-statusbar shrink-0 items-center gap-4 border-t border-border bg-chrome px-3 text-2xs whitespace-nowrap text-ink-secondary">
      <SlotOutlet name="status.start" className="gap-4" />
      <span data-testid="unit-system">{f.unitSystemName}</span>
      <span className="flex-1" />
      <SlotOutlet name="status.end" className="gap-4" />
      {perf ? <SlotOutlet name="status.perf" className="gap-3" /> : null}
    </footer>
  )
}

export function CanvasFrame({ session, project, step, children }: { session: Session; project: ProjectSummary; step: TakeoffStep; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="relative w-rail shrink-0">
          <StepRail project={project} current={step} />
        </div>
        <main className="flex min-w-0 flex-1 flex-col">
          <Toolbar session={session} project={project} step={step} />
          <div data-region="canvas" data-canvas-area="" className="focus-inset relative min-h-0 flex-1 overflow-hidden bg-background">
            {children}
          </div>
        </main>
        <Inspector project={project} step={step} />
      </div>
      <StatusBar />
    </div>
  )
}

/** A step that is not open in M0 (§4.1): the canvas's empty state and the way back to Step 1. */
export function StepNotOpen({ project, step }: { project: ProjectSummary; step: TakeoffStep }) {
  const { i18n } = useLingui()
  const Glyph = STEP_GLYPHS[step.key]
  const number = step.number
  const name = i18n._(step.name)
  return (
    <div className="flex h-full items-center justify-center">
      <Empty
        glyph={<Glyph />}
        action={
          <AppLink to={PATHS.takeoff(project.code, 1)} className={buttonVariants({ variant: 'secondary' })}>
            <Trans>Back to Step 1</Trans>
          </AppLink>
        }
      >
        <Trans>
          Step {number}, {name}, is not open yet. It will read the sheets you confirm in Step 1.
        </Trans>
      </Empty>
    </div>
  )
}
