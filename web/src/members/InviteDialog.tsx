/*
 * The invite dialog (docs/design/m0-screens.md §4.4, §1.4; stories 58, 61, 101): "Invite someone to
 * Shapla Homes Ltd".
 * - Email.
 * - Role, as the inviter may give it: the MD the segmented "QS | MD | Guest | Vextrus Engineer", QS
 *   chosen; a QS no choice, only "Role: Vextrus Engineer". With Guest chosen, what a Guest may do.
 * - Projects: "All projects" | "Chosen projects" (All chosen; a Guest, Chosen), and with Chosen a
 *   checklist of the inviter's projects by code and name. An inviter given chosen projects offers only
 *   those, never "All projects" (the API refuses it). None ticked: "Choose at least one project."
 * - The end date: a Vextrus Engineer's "Access ends on", required, 30 days ahead; anyone else's the
 *   checkbox "End their access on a date" (ticked for a Guest, off for a QS or an MD) with the date
 *   under it, and the line for someone from outside. A date in 1.2's form, in the Market's time zone,
 *   sent as the end of that day there.
 * - "Create link", then the link, shown once.
 * No name or firm is asked (4.4 gives no such field).
 */
import { useId, useState, type FormEvent } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { ApiRefused } from '@/api/client'
import { roleName } from '@/app/roles'
import type { Role, Session } from '@/app/session'
import { ProblemBar, invitableRoles, problemOf, sameSession, useSignedInAgain, type Problem } from '@/auth'
import { MachineText, type MachineMessage } from '@/format/machine'
import { DiscardBar, useDiscardGuard } from '@/projects'
import { Button, Checkbox, FieldError, Segmented, TextField } from '@/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'
import { addDays, dayIn, endOfDay, type Day } from './dates'
import { DateField } from './DateField'
import { LinkShown } from './LinkShown'
import { invite, inviteLink, membersQuery } from './data'

const DEFAULT_DAYS = 30

type Field = 'email' | 'role' | 'projects' | 'end'
type Words = MachineMessage | string

const FIELD_OF: Readonly<Record<string, Field>> = {
  'platform.invitations.invalid_email': 'email',
  'platform.invitations.already_member': 'email',
  'platform.invitations.already_invited': 'email',
  'platform.invitations.access_ended': 'email',
  'platform.invitations.role_not_yours': 'role',
  'platform.invitations.choose_a_project': 'projects',
  'platform.invitations.projects_not_yours': 'projects',
  'platform.invitations.end_in_past': 'end',
}

function Words({ words }: { words: Words | undefined }) {
  if (words === undefined) return null
  return typeof words === 'string' ? <>{words}</> : <MachineText message={words} />
}

type Created = { email: string; link: string; worksUntil: string }

export function InviteDialog({ session, open, onOpenChange }: { session: Session; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useLingui()
  const queryClient = useQueryClient()
  const formId = useId()
  const roles = invitableRoles(session)
  const scoped = session.scope !== 'all'
  const timeZone = session.market.timeZone
  const [today] = useState(() => dayIn(Date.now(), timeZone))
  const developer = session.developer.name

  const defaults = (role: Role) => ({ mode: (scoped || role === 'guest' ? 'chosen' : 'all') as 'all' | 'chosen', endOn: role === 'guest' })
  const first = roles[0] ?? 'vextrus_engineer'
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>(first)
  const [mode, setMode] = useState(defaults(first).mode)
  // An inviter given one project has one to give: it is ticked already (design gate 20a r1).
  const only = scoped && session.projects.length === 1 ? session.projects[0]!.id : null
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(only ? [only] : []))
  const [endOn, setEndOn] = useState(defaults(first).endOn)
  const [endDay, setEndDay] = useState<Day | null>(addDays(today, DEFAULT_DAYS))
  const [touched, setTouched] = useState({ mode: false, end: false })
  const [errors, setErrors] = useState<Partial<Record<Field, Words>>>({})
  const [bar, setBar] = useState<Problem>(null)
  useSignedInAgain(setBar)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)

  const engineer = role === 'vextrus_engineer'
  const ending = engineer || endOn
  const dirty = created === null && (email.trim() !== '' || chosen.size > 0 || role !== first || touched.mode || touched.end)

  function reset() {
    setEmail('')
    setRole(first)
    setMode(defaults(first).mode)
    setChosen(new Set(only ? [only] : []))
    setEndOn(defaults(first).endOn)
    setEndDay(addDays(today, DEFAULT_DAYS))
    setTouched({ mode: false, end: false })
    setErrors({})
    setBar(null)
    setTried(false)
    setCreated(null)
  }
  const guard = useDiscardGuard(dirty && !saving, () => {
    reset()
    onOpenChange(false)
  })

  function chooseRole(next: Role) {
    setRole(next)
    const d = defaults(next)
    if (!touched.mode) setMode(d.mode)
    if (!touched.end) setEndOn(d.endOn)
  }

  function focus(field: Field) {
    document.getElementById(`${formId}-${field}`)?.focus()
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setTried(true)
    setBar(null)
    const found: Partial<Record<Field, Words>> = {}
    if (mode === 'chosen' && chosen.size === 0) found.projects = t`Choose at least one project.`
    if (ending && endDay === null) found.end = ''
    setErrors(found)
    const firstBad = (['email', 'role', 'projects', 'end'] as const).find((f) => f in found)
    if (firstBad) return focus(firstBad)
    setSaving(true)
    const current = sameSession(queryClient)
    try {
      const link = await invite({
        email: email.trim(),
        role,
        projectIds: mode === 'all' ? null : session.projects.filter((p) => chosen.has(p.id)).map((p) => p.id),
        expiresAt: ending && endDay ? endOfDay(endDay, timeZone) : null,
      })
      // Signed out, switched or someone else meanwhile: the link is not theirs to see.
      if (!current()) return
      await queryClient.invalidateQueries({ queryKey: membersQuery.queryKey })
      setCreated({ email: email.trim(), link: inviteLink(link.token), worksUntil: link.link_expires_at })
    } catch (error) {
      if (!current()) return
      const field = error instanceof ApiRefused && error.refusal ? FIELD_OF[error.refusal.code] : undefined
      if (field && error instanceof ApiRefused && error.refusal) {
        setErrors({ [field]: error.refusal })
        focus(field)
      } else setBar(problemOf(error))
    } finally {
      setSaving(false)
    }
  }

  const roleWord = roleName(role, i18n)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return onOpenChange(true)
        if (!created) return guard.requestClose()
        // The link was shown; closing loses nothing typed.
        reset()
        onOpenChange(false)
      }}
    >
      <DialogContent className="sm:max-w-[480px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            <Trans>Invite someone to {developer}</Trans>
          </DialogTitle>
        </DialogHeader>
        {created ? (
          <LinkShown email={created.email} link={created.link} worksUntil={created.worksUntil} />
        ) : (
          <form noValidate onSubmit={(event) => void create(event)} className="flex flex-col gap-3">
            <TextField
              id={`${formId}-email`}
              label={t`Email`}
              type="email"
              autoComplete="off"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              error={errors.email !== undefined ? <Words words={errors.email} /> : undefined}
            />

            <div className="flex flex-col gap-1.5">
              {roles.length > 1 ? (
                <>
                  <span className="text-xs font-semibold text-ink-secondary">
                    <Trans>Role</Trans>
                  </span>
                  <Segmented
                    label={t`Role`}
                    value={role}
                    onChange={chooseRole}
                    className="self-start"
                    options={roles.map((r) => ({ value: r, label: roleName(r, i18n) }))}
                  />
                </>
              ) : (
                <p className="text-sm text-foreground">
                  <Trans>Role: {roleWord}</Trans>
                </p>
              )}
              {role === 'guest' ? (
                <p className="text-xs text-muted-foreground">
                  {mode === 'all' ? (
                    <Trans>Read only: a Guest can look at the drawings and the Takeoff of every project, and change nothing.</Trans>
                  ) : (
                    <Trans>Read only: a Guest can look at the drawings and the Takeoff of the chosen projects, and change nothing.</Trans>
                  )}
                </p>
              ) : null}
              <FieldError id={`${formId}-role`}>
                <Words words={errors.role} />
              </FieldError>
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-xs font-semibold text-ink-secondary">
                <Trans>Projects</Trans>
              </legend>
              {scoped ? null : (
                <Segmented
                  label={t`Projects`}
                  value={mode}
                  onChange={(next) => {
                    setMode(next)
                    setTouched((x) => ({ ...x, mode: true }))
                  }}
                  className="self-start"
                  options={[
                    { value: 'all', label: t`All projects` },
                    { value: 'chosen', label: t`Chosen projects` },
                  ]}
                />
              )}
              {mode === 'chosen' ? (
                <div id={`${formId}-projects`} tabIndex={-1} className="flex max-h-[140px] flex-col gap-0.5 overflow-y-auto outline-none">
                  {session.projects.map((p) => (
                    <Checkbox
                      key={p.id}
                      checked={chosen.has(p.id)}
                      onCheckedChange={(on) => {
                        setChosen((set) => {
                          const next = new Set(set)
                          if (on) next.add(p.id)
                          else next.delete(p.id)
                          return next
                        })
                        // A project ticked answers "Choose at least one project." (design gate 20a r1).
                        if (on) setErrors(({ projects: _answered, ...rest }) => rest)
                      }}
                      label={
                        <>
                          <bdi dir="ltr" className="num">
                            {p.code}
                          </bdi>{' '}
                          <bdi>{p.name}</bdi>
                        </>
                      }
                    />
                  ))}
                </div>
              ) : null}
              <FieldError>
                <Words words={errors.projects} />
              </FieldError>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              {engineer ? null : (
                <>
                  <Checkbox
                    checked={endOn}
                    onCheckedChange={(on) => {
                      setEndOn(on)
                      setTouched((x) => ({ ...x, end: true }))
                    }}
                    label={t`End their access on a date`}
                  />
                  <p className="text-xs text-muted-foreground">
                    <Trans>For someone from outside {developer}, such as a consultant’s engineer or a contractor’s QS, set an end date.</Trans>
                  </p>
                </>
              )}
              {ending ? (
                <DateField
                  id={`${formId}-end`}
                  label={t`Access ends on`}
                  value={endDay}
                  onChange={setEndDay}
                  today={today}
                  showError={tried}
                  error={errors.end ? <Words words={errors.end} /> : undefined}
                />
              ) : null}
            </div>

            <ProblemBar problem={bar} />
            <DiscardBar guard={guard} />
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={guard.requestClose}>
                <Trans>Cancel</Trans>
              </Button>
              <Button type="submit" variant="primary" saving={saving}>
                <Trans>Create link</Trans>
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
