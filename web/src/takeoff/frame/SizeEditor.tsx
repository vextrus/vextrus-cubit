/*
 * The size answer (S16-W1; the contract's `edit` with `{section_b, section_d, unit}`): E on a column
 * group opens it in the inspector, two fields and the unit the size is written in. Enter posts, Esc
 * goes back to the list; typing wins, so an X typed here is an X, never a leave-out.
 */
import { useEffect, useRef, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyCombo, KeyRegion, TextField } from '@/ui'
import { EnterKey } from './parts'
import type { FrameGroup } from './api'
import { readSize, valueText } from './model'

type Unit = 'in' | 'mm'

export function SizeEditor({
  group,
  onCancel,
  onSubmit,
  busy,
}: {
  group: FrameGroup
  onCancel: () => void
  onSubmit: (values: { section_b: string; section_d: string; unit: Unit }) => void | Promise<void>
  busy: boolean
}) {
  const { t } = useLingui()
  const first = group.proposals.find((p) => valueText(p.values, 'section_b') !== null)
  const [b, setB] = useState(first ? (valueText(first.values, 'section_b') ?? '') : '')
  const [d, setD] = useState(first ? (valueText(first.values, 'section_d') ?? '') : '')
  const [unit, setUnit] = useState<Unit>(valueText(first?.values ?? {}, 'unit') === 'mm' ? 'mm' : 'in')
  const [refused, setRefused] = useState<{ b?: boolean; d?: boolean }>({})
  const firstField = useRef<HTMLInputElement>(null)
  useEffect(() => {
    firstField.current?.focus()
    firstField.current?.select()
  }, [])

  function submit() {
    const sb = readSize(b)
    const sd = readSize(d)
    setRefused({ b: sb === null, d: sd === null })
    if (sb !== null && sd !== null) void onSubmit({ section_b: sb, section_d: sd, unit })
  }
  const label = group.label
  const problem = <Trans>Type a size above zero, like 12.</Trans>
  return (
    <KeyRegion name="size-editor" aria-label={t`Type the size`} role="group" data-size-editor="" className="flex flex-col gap-2 border-b border-border p-3">
      {/* Enter in a field is this form's: the screen's Enter (confirm) never sees it. */}
      <EnterKey label={t`Save the size`} run={submit} />
      <h3 className="text-sm font-semibold">
        <Trans>Type the size of {label}</Trans>
      </h3>
      <TextField ref={firstField} label={t`Width`} value={b} onChange={(e) => setB(e.target.value)} error={refused.b ? problem : undefined} inputMode="decimal" autoComplete="off" />
      <TextField label={t`Depth`} value={d} onChange={(e) => setD(e.target.value)} error={refused.d ? problem : undefined} inputMode="decimal" autoComplete="off" />
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-secondary">
        <Trans>Written in</Trans>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value === 'mm' ? 'mm' : 'in')}
         
          className="h-control rounded-md border border-input bg-paper px-2 text-sm font-normal text-foreground"
        >
          <option value="in">{t`inches`}</option>
          <option value="mm">{t`millimetres`}</option>
        </select>
      </label>
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={submit} disabled={busy}>
          <Trans>Save the size</Trans>
          <KeyCombo combo="Enter" />
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <Trans>Cancel</Trans>
          <KeyCombo combo="Esc" />
        </Button>
      </div>
    </KeyRegion>
  )
}
