/*
 * AccessChip (docs/design/m0-screens.md §3, §1.4; session 02 Q11): in the top bar for anyone whose
 * access has an end date or covers chosen projects only: a Vextrus Engineer always, a Guest, a member
 * given chosen projects. It names the projects when the access is to chosen ones and the end date
 * when it has one; more than three projects are counted, their codes in the tooltip. Amber, and
 * counting days, when 3 days or fewer are left.
 *
 * `until` arrives formatted by ticket 03's date formatter ("26 Oct 2026"); `daysLeft` is counted in
 * the Market's time zone by the caller. Project codes are isolated left to right.
 *
 * The end date is the chip's point and is never cut (design gate 20a r1): the chip takes the room its
 * parent gives it, and where the whole sentence does not fit it counts the projects instead of naming
 * them ("Vextrus access to 2 projects at Shapla Homes Ltd until 5 Nov 2026"), then says only the date
 * ("Vextrus access until 5 Nov 2026"); the tooltip always says it all. Give it a parent with the room
 * there is (in a flex row, `flex min-w-0 flex-1`).
 */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { ShieldCheck } from 'lucide-react'
import { cn } from './cn'
import { isolateLtr } from './notation'
import { Tooltip, TooltipContent, TooltipTrigger } from './primitives/tooltip'

export interface AccessChipProps {
  /** A Vextrus Engineer's access (always shown), or anyone else's. */
  vextrus: boolean
  developer: string
  /** The project codes the access covers, or 'all'. */
  projects: readonly string[] | 'all'
  /** The end date, formatted; null when the access has none. */
  until: string | null
  /** Whole days until the end date; null when there is none. */
  daysLeft: number | null
  className?: string
}

const Code = ({ code }: { code: string }) => <bdi dir="ltr">{code}</bdi>

/** "KR-01", "KR-01 and BP-02", "KR-01, BP-02 and GH-03", or "4 projects": the catalogue's list pattern. */
function ProjectList({ codes, counted = false }: { codes: readonly string[]; counted?: boolean }): ReactNode {
  const [a = '', b = '', c = ''] = codes
  const first = <Code code={a} />
  const second = <Code code={b} />
  const third = <Code code={c} />
  if (counted && codes.length > 1) return <Plural value={codes.length} one="# project" other="# projects" />
  if (codes.length === 1) return first
  if (codes.length === 2) return <Trans>{first} and {second}</Trans>
  if (codes.length === 3) return <Trans>{first}, {second} and {third}</Trans>
  return <Plural value={codes.length} one="# project" other="# projects" />
}

/**
 * Which of the chip's forms (longest first) is shown: the first whose words are not cut. It steps to
 * the next while the words overflow, and starts again from the longest whenever the room its parent
 * gives changes, the words change, or the fonts load.
 */
function useFit(chip: RefObject<HTMLSpanElement | null>, count: number, words: string): number {
  const [fit, setFit] = useState(0)
  const [round, setRound] = useState(0)
  // New words: start again from the longest form.
  const [wordsShown, setWordsShown] = useState(words)
  if (wordsShown !== words) {
    setWordsShown(words)
    setFit(0)
  }
  // New room (or the fonts in): start again from the longest form.
  useLayoutEffect(() => {
    const parent = chip.current?.parentElement
    if (!parent) return
    const again = () => {
      setFit(0)
      setRound((r) => r + 1)
    }
    const observer = new ResizeObserver(again)
    observer.observe(parent)
    void document.fonts.ready.then(again)
    return () => observer.disconnect()
  }, [chip])
  // The words shown are cut: the next form, measured again once drawn.
  useLayoutEffect(() => {
    // Measuring what was drawn, before it is painted, is what a layout effect is for (react.dev, useLayoutEffect).
    setFit(nextFit(chip.current, fit, count)) // eslint-disable-line react-hooks/set-state-in-effect -- a measurement, see above
  }, [chip, fit, round, count, words])
  return Math.min(fit, count - 1)
}

/** The form to show after `fit`, as the chip is now drawn: the next while its words are cut. */
function nextFit(chip: HTMLSpanElement | null, fit: number, count: number): number {
  const shown = chip?.querySelector<HTMLElement>('[data-words]')
  return shown && shown.scrollWidth > shown.clientWidth + 0.5 && fit < count - 1 ? fit + 1 : fit
}

export function AccessChip({ vextrus, developer, projects, until, daysLeft, className }: AccessChipProps) {
  const { t } = useLingui()
  const chip = useRef<HTMLSpanElement>(null)
  const ending = daysLeft !== null && daysLeft <= 3
  const counted = projects !== 'all' && projects.length > 1 && projects.length <= 3
  const count = ending ? 1 : 1 + (counted ? 1 : 0) + (until ? 1 : 0)
  const fit = useFit(chip, count, [vextrus, developer, projects === 'all' ? 'all' : projects.join(' '), until ?? '', daysLeft ?? ''].join('|'))
  if (!vextrus && projects === 'all' && until === null) return null

  const days = Math.max(0, daysLeft ?? 0)
  const date = until ?? ''

  /** The sentence, naming the projects or counting them. */
  const sentence = (counted: boolean): ReactNode => {
    const list = projects === 'all' ? null : <ProjectList codes={projects} counted={counted} />
    if (vextrus) {
      if (list && until) return <Trans>Vextrus access to {list} at {developer} until {date}</Trans>
      if (list) return <Trans>Vextrus access to {list} at {developer}</Trans>
      if (until) return <Trans>Vextrus access to {developer} until {date}</Trans>
      return <Trans>Vextrus access to {developer}</Trans>
    }
    if (list && until) return <Trans>Access to {list} at {developer} until {date}</Trans>
    if (list) return <Trans>Access to {list} at {developer}</Trans>
    return <Trans>Access to {developer} until {date}</Trans>
  }

  // Longest first; the first that fits is shown.
  const forms: ReactNode[] = []
  if (ending) {
    forms.push(
      vextrus ? (
        <Plural value={days} _0="Vextrus access ends today" one="Vextrus access ends in # day" other="Vextrus access ends in # days" />
      ) : (
        <Plural value={days} _0="Access ends today" one="Access ends in # day" other="Access ends in # days" />
      ),
    )
  } else {
    forms.push(sentence(false))
    if (counted) forms.push(sentence(true))
    if (until) forms.push(vextrus ? <Trans>Vextrus access until {date}</Trans> : <Trans>Access until {date}</Trans>)
  }

  // The tooltip: one message per case, every project named through the catalogue's list pattern,
  // and the date kept on one line (design gate m3, m4).
  // "A", "A and B", "A, B and C", "A, B, C and D": the catalogue's two list words, never a comma in code.
  const joinList = (items: readonly string[]): string => {
    if (items.length <= 1) return items[0] ?? ''
    let head = items[0]!
    for (const item of items.slice(1, -1)) head = t`${head}, ${item}`
    const last = items[items.length - 1]!
    return t`${head} and ${last}`
  }
  // A code never breaks at its hyphen (a word joiner follows it; design gate m4b).
  const codes = projects === 'all' ? '' : joinList(projects.map((c) => isolateLtr(c.replace(/-/g, '-⁠'))))
  const day = (until ?? '').replace(/ /g, ' ')
  let tooltip: string
  if (vextrus) {
    if (projects !== 'all' && until) tooltip = t`Vextrus access to ${codes} at ${developer} ends on ${day}.`
    else if (projects !== 'all') tooltip = t`Vextrus access covers ${codes} at ${developer}.`
    else if (until) tooltip = t`Vextrus access to ${developer} ends on ${day}.`
    else tooltip = t`Vextrus access to ${developer}.`
  } else if (projects !== 'all' && until) tooltip = t`Your access to ${codes} at ${developer} ends on ${day}.`
  else if (projects !== 'all') tooltip = t`Your access covers ${codes} at ${developer}.`
  else tooltip = t`Your access to ${developer} ends on ${day}.`

  const look = cn(
    'inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-xs border px-2 text-xs font-medium whitespace-nowrap',
    ending ? 'border-question-stroke bg-question-surface text-question' : 'border-border-strong bg-chrome-sunken text-ink-secondary',
    className,
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span ref={chip} data-testid="access-chip" data-ending={ending || undefined} tabIndex={0} className={look}>
          <ShieldCheck aria-hidden size={14} strokeWidth={1.5} className="shrink-0" />
          <span data-words className="truncate">
            {forms[Math.min(fit, forms.length - 1)]}
          </span>
        </span>
      </TooltipTrigger>
      {tooltip ? <TooltipContent>{tooltip}</TooltipContent> : null}
    </Tooltip>
  )
}
