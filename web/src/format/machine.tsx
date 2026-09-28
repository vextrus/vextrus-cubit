/*
 * The machine's sentences (docs/design/m0-screens.md §1.7; docs/plans/M0.md, "Message codes"; ADR 0038
 * item 2): the API sends `{code, params}`, never prose, and the web words it from the catalogue each
 * backend ticket writes, `src/messages/<module>/<submodule>/en.po` (msgid: the code).
 *
 * Parameters are formatted by their name, so a backend ticket words a code without the web knowing it:
 *   - `date` or `…_date` (an ISO instant): the date formatter, "26 Sep 2026", in the Market's zone;
 *   - `time` or `…_time`: the time formatter, "10:42";
 *   - `sheet`, `file`, `revision`, `mark`, `grid` (or `…_sheet`, `…_file`…): drawing notation, isolated
 *     left to right and marked `data-notation` (§1.8);
 *   - a number is left a number, so `{count, plural, one {# sheet} other {# sheets}}` chooses its
 *     form; the shell activates Lingui with the Market's locale, so `#` groups as the Market groups;
 *   - anything else (a name, typed text) is shown as sent, isolated by the message layer.
 * A code with no English never shows its key: the reader sees a plain sentence and development logs the
 * code; `codesWithoutEnglish` is the test that keeps that from happening (machine.node.test.ts).
 */
import type { ReactNode } from 'react'
import type { I18n, Messages } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import { DrawingText, type DrawingTextKind } from '@/ui/DrawingText'
import { isolateLtr } from '@/ui/notation'
import { useFormat, type Format } from './Format'

/** A sentence the machine wrote, as the API sends it. */
export interface MachineMessage {
  code: string
  params: Readonly<Record<string, string | number>>
}

const NOTATION: Readonly<Record<string, DrawingTextKind>> = {
  sheet: 'sheet-number',
  file: 'file-name',
  revision: 'revision',
  mark: 'mark',
  grid: 'grid',
}

type ParamKind = { kind: 'date' | 'time' } | { kind: 'notation'; notation: DrawingTextKind } | { kind: 'as-sent' }

/** How a parameter is shown, read from its name. */
export function paramKind(name: string): ParamKind {
  const last = name.split('_').at(-1) ?? name
  if (last === 'date' || last === 'time') return { kind: last }
  const notation = NOTATION[last]
  return notation ? { kind: 'notation', notation } : { kind: 'as-sent' }
}

const UNWORDED = msg`Vextrus has something to tell you here but no words for it yet.`

function hasEnglish(i18n: I18n, code: string): boolean {
  return Object.prototype.hasOwnProperty.call(i18n.messages, code)
}

function warnUnworded(code: string) {
  if (import.meta.env.DEV) console.error(`No English message for the code ${code}: word it in src/messages/ (m0-screens §1.7)`)
}

/** The sentence as plain text, for a tooltip, a title or the clipboard. */
export function machineText(message: MachineMessage, f: Format, i18n: I18n): string {
  if (!hasEnglish(i18n, message.code)) {
    warnUnworded(message.code)
    return i18n._(UNWORDED)
  }
  const values: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(message.params)) {
    const kind = paramKind(name)
    if (kind.kind === 'date') values[name] = f.date(String(value))
    else if (kind.kind === 'time') values[name] = f.time(String(value))
    else if (kind.kind === 'notation') values[name] = isolateLtr(String(value))
    else values[name] = value
  }
  return i18n._(message.code, values)
}

/** The sentence as an element: notation in its isolates, dates and times formatted. */
export function MachineText({ message }: { message: MachineMessage }) {
  const { i18n } = useLingui()
  const f = useFormat()
  if (!hasEnglish(i18n, message.code)) {
    warnUnworded(message.code)
    return <>{i18n._(UNWORDED)}</>
  }
  const values: Record<string, ReactNode> = {}
  for (const [name, value] of Object.entries(message.params)) {
    const kind = paramKind(name)
    if (kind.kind === 'date') values[name] = f.date(String(value))
    else if (kind.kind === 'time') values[name] = f.time(String(value))
    else if (kind.kind === 'notation') values[name] = <DrawingText kind={kind.notation} text={String(value)} truncate={false} />
    else values[name] = value
  }
  return <Trans id={message.code} values={values} />
}

/** The codes among `codes` that have no English message in `messages`: the list must be empty. */
export function codesWithoutEnglish(codes: readonly string[], messages: Messages): string[] {
  return codes.filter((code) => {
    const message = messages[code]
    return message === undefined || message === '' || (Array.isArray(message) && message.length === 0)
  })
}
