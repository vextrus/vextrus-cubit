/*
 * The drawing list, pasted or typed (m0-screens §6.10; the plan's QS review, Q4): "The architectural
 * drawing list". What the QS pastes or types is read back by 19a (`drawing-list/read`, nothing kept)
 * and shown parsed before "Use as the drawing list" sets it: a typed range as "Read as a range: 8
 * sheets, A-01 to A-08, no titles.", a pasted list as its sheet lines, the rest ignored.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { ProblemWords, problemOf, type Problem } from '@/auth/problem'
import { Button, DrawingText } from '@/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'
import { readList, type ParsedListOut } from './data'
import { LIST_TITLES, OTHER_LIST_TITLE } from './words'

const READ_AFTER_MS = 250

export function DrawingListDialog({
  projectId,
  discipline,
  fileName,
  readOnly,
  onUse,
  onClose,
}: {
  projectId: string
  discipline: string
  /** The Discipline's file, as the QS named it. */
  fileName: string
  readOnly: boolean
  onUse: (text: string) => Promise<boolean>
  onClose: () => void
}) {
  const { t, i18n } = useLingui()
  const fieldId = useId()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedListOut | null>(null)
  const [problem, setProblem] = useState<Problem>(null)
  const [saving, setSaving] = useState(false)
  const asked = useRef(0)

  useEffect(() => {
    const ask = ++asked.current
    if (!text.trim()) return
    const timer = setTimeout(() => {
      readList(projectId, discipline, text).then(
        (out) => {
          if (ask !== asked.current) return
          setParsed(out)
          setProblem(null)
        },
        (error: unknown) => {
          if (ask !== asked.current) return
          setParsed(null)
          setProblem(problemOf(error))
        },
      )
    }, READ_AFTER_MS)
    return () => clearTimeout(timer)
  }, [projectId, discipline, text])

  const file = <DrawingText kind="file-name" text={fileName} truncate={false} />
  const count = parsed?.numbers.length ?? 0
  const first = parsed?.numbers[0] ?? ''
  const last = parsed?.numbers.at(-1) ?? ''
  const ready = !!parsed && count > 0 && !saving

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{i18n._(LIST_TITLES[discipline] ?? OTHER_LIST_TITLE)}</DialogTitle>
          <DialogDescription>
            <Trans>
              {file} carries no drawing list. Paste the consultant’s list (the transmittal or an email), or type the range it gives, and Vextrus checks it against
              the sheets found, both ways. Its source is marked as pasted or typed.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        <label htmlFor={fieldId} className="sr-only">
          <Trans>The drawing list, pasted or typed</Trans>
        </label>
        <textarea
          id={fieldId}
          value={text}
          readOnly={readOnly}
          onChange={(event) => {
            setText(event.target.value)
            if (!event.target.value.trim()) {
              setParsed(null)
              setProblem(null)
            }
          }}
          rows={8}
          placeholder={t`A-01–A-29, or the list as the consultant sent it`}
          className="min-h-32 w-full rounded-md border border-input bg-paper p-2 font-mono text-sm"
        />
        <div aria-live="polite" className="min-h-10 text-sm">
          {problem ? <ProblemWords problem={problem} /> : null}
          {parsed && parsed.source === 'typed' ? (
            <p>
              <Trans>
                Read as a range: <Plural value={count} one="# sheet" other="# sheets" />, <DrawingText kind="sheet-number" text={first} truncate={false} /> to{' '}
                <DrawingText kind="sheet-number" text={last} truncate={false} />, no titles.
              </Trans>
            </p>
          ) : null}
          {parsed && parsed.source !== 'typed' ? (
            <>
              <p>
                <Plural value={count} one="# sheet line found; other lines are ignored." other="# sheet lines found; other lines are ignored." />
              </p>
              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-secondary">
                {parsed.numbers.map((n, i) => (
                  <DrawingText key={`${n}-${i}`} kind="sheet-number" text={n} truncate={false} />
                ))}
              </p>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>
            <Trans>Close</Trans>
          </Button>
          {readOnly ? null : (
            <Button
              variant="primary"
              disabled={!ready}
              onClick={async () => {
                setSaving(true)
                const done = await onUse(text)
                setSaving(false)
                if (done) onClose()
              }}
            >
              <Trans>Use as the drawing list</Trans>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
