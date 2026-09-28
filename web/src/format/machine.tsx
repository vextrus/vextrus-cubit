/*
 * The machine's sentences (docs/design/m0-screens.md §1.7; docs/plans/M0.md, "Message codes"; ADR 0038
 * item 2): the API sends `{code, params}`, never prose, and the web words it from the catalogue each
 * backend ticket writes, `src/messages/<module>/<submodule>/en.po` (msgid: the code).
 *
 * Parameters are formatted by their name, so a backend ticket words a code without the web knowing it
 * (the name, or its last `_` part: `read_date`, `top_level`):
 *   - `date`, `time` (an ISO instant): "26 Sep 2026", "10:42", in the Market's time zone;
 *   - `sheet`, `file`, `revision`, `mark`, `grid` (drawing text, as read): isolated left to right and
 *     marked `data-notation` (§1.8);
 *   - `level`, `length`, `coordinate` (in millimetres, a number or a decimal string) and `scale` (its
 *     denominator, 100 for 1:100, or the words the drawing states): through their formatters, in the
 *     project's unit system, isolated left to right and marked `data-notation`;
 *   - any other number: grouped as the Market groups ("1,24,842"), except where the message chooses a
 *     form by it (`{count, plural, one {# sheet} other {# sheets}}`), where it stays a number and the
 *     frame's Lingui locale groups its `#` the same way;
 *   - anything else (a name, typed text) is shown as sent, isolated by the message layer.
 * A code with no English never shows its key: the reader sees a plain sentence and development logs the
 * code; `codesWithoutEnglish` is what message-codes.node.test.ts runs over every code the API can send.
 */
import type { ReactNode } from 'react'
import type { I18n, Messages } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import { DrawingText, type DrawingTextKind } from '@/ui/DrawingText'
import { isolateLtr } from '@/ui/notation'
import { useFormat, type Format } from './Format'
import { lengthFromMm, type Length } from './notation'

/** A sentence the machine wrote, as the API sends it. */
export interface MachineMessage {
  code: string
  params: Readonly<Record<string, string | number>>
}

const DRAWING_TEXT: Readonly<Record<string, DrawingTextKind>> = {
  sheet: 'sheet-number',
  file: 'file-name',
  revision: 'revision',
  mark: 'mark',
  grid: 'grid',
}

type Figure = 'level' | 'length' | 'coordinate' | 'scale'
const FIGURES: readonly string[] = ['level', 'length', 'coordinate', 'scale'] satisfies Figure[]

type ParamKind =
  | { kind: 'date' | 'time' }
  | { kind: 'drawing-text'; notation: DrawingTextKind }
  | { kind: 'figure'; figure: Figure }
  | { kind: 'as-sent' }

/** How a parameter is shown, read from its name (a number that is none of these is counted). */
export function paramKind(name: string): ParamKind {
  const last = name.split('_').at(-1) ?? name
  if (last === 'date' || last === 'time') return { kind: last }
  if (FIGURES.includes(last)) return { kind: 'figure', figure: last as Figure }
  const notation = DRAWING_TEXT[last]
  return notation ? { kind: 'drawing-text', notation } : { kind: 'as-sent' }
}

const UNWORDED = msg`Vextrus has something to tell you here but no words for it yet.`

function hasEnglish(i18n: I18n, code: string): boolean {
  return Object.prototype.hasOwnProperty.call(i18n.messages, code)
}

function warnUnworded(code: string) {
  if (import.meta.env.DEV) console.error(`No English message for the code ${code}: word it in src/messages/ (m0-screens §1.7)`)
}

const CHOICES = new Set(['plural', 'selectordinal', 'select'])

/** The parameters a compiled message chooses a form by (plural, select): they must stay as sent. */
export function choiceParams(message: unknown): Set<string> {
  const found = new Set<string>()
  const walk = (tokens: unknown) => {
    if (!Array.isArray(tokens)) return
    for (const token of tokens) {
      if (!Array.isArray(token)) continue
      const [name, type, choices] = token as [unknown, unknown, unknown]
      if (typeof name === 'string' && typeof type === 'string' && CHOICES.has(type)) {
        found.add(name)
        if (choices && typeof choices === 'object') for (const branch of Object.values(choices)) walk(branch)
      }
    }
  }
  walk(message)
  return found
}

function millimetres(value: string | number): Length {
  return lengthFromMm(typeof value === 'number' ? value : Number(value))
}

function scaleOf(value: string | number): number | string {
  return typeof value === 'number' || /^\d+$/.test(value) ? Number(value) : value
}

/** Each parameter formatted by its kind; `element` gives isolates as elements, else as LRI…PDI text. */
function formatParams<T>(
  message: MachineMessage,
  f: Format,
  i18n: I18n,
  as: { notation(kind: DrawingTextKind, text: string): T; figure(figure: Figure, value: string | number): T },
): Record<string, string | number | T> {
  const choices = choiceParams(i18n.messages[message.code])
  const values: Record<string, string | number | T> = {}
  for (const [name, value] of Object.entries(message.params)) {
    const kind = paramKind(name)
    if (kind.kind === 'date') values[name] = f.date(String(value))
    else if (kind.kind === 'time') values[name] = f.time(String(value))
    else if (kind.kind === 'drawing-text') values[name] = as.notation(kind.notation, String(value))
    else if (kind.kind === 'figure') values[name] = as.figure(kind.figure, value)
    else if (typeof value === 'number' && Number.isInteger(value) && !choices.has(name)) values[name] = f.integer(value)
    else values[name] = value
  }
  return values
}

/** The sentence as plain text, for a tooltip, a title or the clipboard. */
export function machineText(message: MachineMessage, f: Format, i18n: I18n): string {
  if (!hasEnglish(i18n, message.code)) {
    warnUnworded(message.code)
    return i18n._(UNWORDED)
  }
  const values = formatParams<string>(message, f, i18n, {
    notation: (_, text) => isolateLtr(text),
    figure: (figure, value) => (figure === 'scale' ? f.plain.scale(scaleOf(value)) : f.plain[figure](millimetres(value))),
  })
  return i18n._(message.code, values)
}

/** The sentence as an element: notation in its marked isolates, figures and dates formatted. */
export function MachineText({ message }: { message: MachineMessage }) {
  const { i18n } = useLingui()
  const f = useFormat()
  if (!hasEnglish(i18n, message.code)) {
    warnUnworded(message.code)
    return <>{i18n._(UNWORDED)}</>
  }
  const values = formatParams<ReactNode>(message, f, i18n, {
    notation: (kind, text) => <DrawingText kind={kind} text={text} truncate={false} />,
    figure: (figure, value) => (figure === 'scale' ? f.scale(scaleOf(value)) : f[figure](millimetres(value))),
  })
  return <Trans id={message.code} values={values} />
}

/** The codes among `codes` that have no English message in `messages`: the list must be empty. */
export function codesWithoutEnglish(codes: readonly string[], messages: Messages): string[] {
  return codes.filter((code) => {
    const message = messages[code]
    return message === undefined || message === '' || (Array.isArray(message) && message.length === 0)
  })
}
