/*
 * Projects named in a sentence, by the catalogue's list pattern (m0-screens §1.7): "KR-01", "KR-01 and
 * BP-02", "KR-01, BP-02 and SG-03", and so on for any number: a page has room to name them all (the
 * AccessChip alone counts past three, for its width). Each code is isolated left to right.
 */
import type { ReactNode } from 'react'
import { Trans } from '@lingui/react/macro'

/** A project code: isolated left to right, as the top bar writes it (not one of §1.8's drawing kinds). */
export const Code = ({ code }: { code: string }) => <bdi dir="ltr">{code}</bdi>

/** "A", "A and B", "A, B and C", "A, B, C and D": the catalogue's two list words, never a comma in code. */
function listOf(items: readonly ReactNode[]): ReactNode {
  if (items.length <= 1) return items[0] ?? null
  let head = items[0]
  for (const item of items.slice(1, -1)) head = <Trans>{head}, {item}</Trans>
  const last = items[items.length - 1]
  return <Trans>{head} and {last}</Trans>
}

export function CodeList({ codes }: { codes: readonly string[] }): ReactNode {
  return listOf(codes.map((code) => <Code key={code} code={code} />))
}

/** Projects by code and name, "KR-01 Kadam Residence", joined by the list pattern. */
export function ProjectNameList({ projects }: { projects: readonly { code: string; name: string }[] }): ReactNode {
  return listOf(
    projects.map((p) => (
      <span key={p.code}>
        <Code code={p.code} /> <bdi>{p.name}</bdi>
      </span>
    )),
  )
}
