/*
 * Project codes named in a sentence, by the catalogue's list pattern (m0-screens §1.7): "KR-01",
 * "KR-01 and BP-02", "KR-01, BP-02 and SG-03", and past three a count, "4 projects" (as the
 * AccessChip names them, §3). Each code is isolated left to right.
 */
import type { ReactNode } from 'react'
import { Plural, Trans } from '@lingui/react/macro'

/** A project code: isolated left to right, as the top bar writes it (not one of §1.8's drawing kinds). */
export const Code = ({ code }: { code: string }) => <bdi dir="ltr">{code}</bdi>

export function CodeList({ codes }: { codes: readonly string[] }): ReactNode {
  const [a = '', b = '', c = ''] = codes
  const first = <Code code={a} />
  const second = <Code code={b} />
  const third = <Code code={c} />
  if (codes.length === 1) return first
  if (codes.length === 2) return <Trans>{first} and {second}</Trans>
  if (codes.length === 3) return <Trans>{first}, {second} and {third}</Trans>
  return <Plural value={codes.length} one="# project" other="# projects" />
}

/** Projects by code and name, "KR-01 Kadam Residence", joined by the list pattern; past three, a count. */
export function ProjectNameList({ projects }: { projects: readonly { code: string; name: string }[] }): ReactNode {
  const one = (p: { code: string; name: string } | undefined) =>
    p ? (
      <>
        <Code code={p.code} /> <bdi>{p.name}</bdi>
      </>
    ) : null
  const [a, b, c] = projects
  const first = one(a)
  const second = one(b)
  const third = one(c)
  if (projects.length === 1) return first
  if (projects.length === 2) return <Trans>{first} and {second}</Trans>
  if (projects.length === 3) return <Trans>{first}, {second} and {third}</Trans>
  return <Plural value={projects.length} one="# project" other="# projects" />
}
