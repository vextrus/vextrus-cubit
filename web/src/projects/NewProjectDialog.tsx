/*
 * The New project dialog (docs/design/m0-screens.md §4.3; stories 3, 4, 99): Name (required), Code
 * (required, unique in the Developer: "Short, like KR-01"), Address, and Display Units, offered and
 * chosen by the Developer's Market (§1.9; "Imperial (cft, sft, rft)" | "Metric" for Bangladesh), with
 * "How quantities will be billed. You can change it later." No Market, currency or Building field
 * (§1.9, §1.10): the API makes the Site and one Building unseen. "Create project" and "Cancel".
 *
 * A refusal is shown under its field in the API's words ("Give the project a name.", "KR-01 is already
 * used by Kadam Residence. Choose another code."); any other in an ErrorBar. Created, the list is read
 * again and the project opens (`/p/<code>`; the Drawing Set's own address once 20b builds it).
 */
import { useId, useState, type FormEvent } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { ApiRefused, api, unwrap } from '@/api/client'
import { PATHS, useGo } from '@/app/AppLink'
import { sessionQuery, type Session } from '@/app/session'
import { unitSystem } from '@/format/units'
import { MachineText, type MachineMessage } from '@/format/machine'
import { Button, ErrorBar, Segmented, TextField } from '@/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'
import { DiscardBar, useDiscardGuard } from './discard'

type Field = 'name' | 'code' | 'address' | 'unit_system'

const EMPTY = { name: '', code: '', address: '' }

export function NewProjectDialog({ session, open, onOpenChange }: { session: Session; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useLingui()
  const queryClient = useQueryClient()
  const go = useGo()
  const units = session.market.unitSystems
  const [values, setValues] = useState(EMPTY)
  const [unit, setUnit] = useState(units.default)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, MachineMessage>>>({})
  const [refusal, setRefusal] = useState<MachineMessage | null>(null)
  const [unreachable, setUnreachable] = useState(false)
  const [saving, setSaving] = useState(false)
  const formId = useId()

  const dirty = values.name !== '' || values.code !== '' || values.address !== '' || unit !== units.default
  const reset = () => {
    setValues(EMPTY)
    setUnit(units.default)
    setFieldErrors({})
    setRefusal(null)
    setUnreachable(false)
  }
  const guard = useDiscardGuard(dirty && !saving, () => {
    reset()
    onOpenChange(false)
  })

  async function create(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setFieldErrors({})
    setRefusal(null)
    setUnreachable(false)
    setSaving(true)
    try {
      const project = await unwrap(api.POST('/api/projects', { body: { name: values.name, code: values.code, address: values.address, unit_system: unit } }))
      await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey })
      reset()
      onOpenChange(false)
      go(PATHS.project(project.code))
    } catch (error) {
      if (error instanceof ApiRefused && error.refusal) {
        if (error.field) {
          setFieldErrors({ [error.field as Field]: error.refusal })
          document.querySelector<HTMLElement>(`#${CSS.escape(`${formId}-${error.field}`)}`)?.focus()
        } else setRefusal(error.refusal)
      } else if (error instanceof TypeError) setUnreachable(true)
      else throw error
    } finally {
      setSaving(false)
    }
  }

  const under = (field: Field) => (fieldErrors[field] ? <MachineText message={fieldErrors[field]} /> : undefined)
  const set = (field: keyof typeof EMPTY) => (event: { currentTarget: HTMLInputElement }) => {
    const value = event.currentTarget.value
    setValues((v) => ({ ...v, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : guard.requestClose())}>
      <DialogContent className="sm:max-w-[440px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            <Trans>New project</Trans>
          </DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={(event) => void create(event)} className="flex flex-col gap-3">
          <TextField id={`${formId}-name`} label={t`Name`} value={values.name} onChange={set('name')} autoComplete="off" aria-required error={under('name')} />
          <TextField
            id={`${formId}-code`}
            label={t`Code`}
            value={values.code}
            onChange={set('code')}
            autoComplete="off"
            aria-required
            hint={t`Short, like KR-01`}
            error={under('code')}
            fieldClassName="max-w-[160px]"
          />
          <TextField id={`${formId}-address`} label={t`Address`} value={values.address} onChange={set('address')} autoComplete="off" error={under('address')} />
          <div className="flex flex-col gap-1">
            <span id={`${formId}-units`} className="text-xs font-semibold text-ink-secondary">
              <Trans>Display Units</Trans>
            </span>
            <Segmented
              label={t`Display Units`}
              value={unit}
              onChange={setUnit}
              className="self-start"
              options={units.offered.map((key) => ({ value: key, label: i18n._(unitSystem(key).choice) }))}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>How quantities will be billed. You can change it later.</Trans>
            </p>
            {under('unit_system') ? <p className="text-xs text-destructive">{under('unit_system')}</p> : null}
          </div>
          {refusal ? (
            <ErrorBar>
              <MachineText message={refusal} />
            </ErrorBar>
          ) : null}
          {unreachable ? (
            <ErrorBar>
              <Trans>Vextrus can’t be reached. Check your connection and try again.</Trans>
            </ErrorBar>
          ) : null}
          <DiscardBar guard={guard} />
          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={guard.requestClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" variant="primary" saving={saving}>
              <Trans>Create project</Trans>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
