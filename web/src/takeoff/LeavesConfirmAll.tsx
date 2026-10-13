import { useQueryClient } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { questionsQuery, type QuestionOut } from './data'

/**
 * The tail of a correction's toast for a sheet that was in Confirm all: read when the toast is drawn, so it
 * names the Question the new number raised (it holds the sheet: answered, not "confirmed on its own").
 */
export function LeavesConfirmAll({ projectId, proposal, sheet }: { projectId: string; proposal: string; sheet: string }) {
  const queryClient = useQueryClient()
  const asked = queryClient.getQueryData<readonly QuestionOut[]>(questionsQuery(projectId).queryKey) ?? []
  const holding = asked.find((q) => q.status === 'open' && (q.subject_id === sheet || ((q.proposals ?? []) as readonly string[]).includes(proposal)))
  if (holding) {
    const tag = `Q${holding.raised}`
    return <Trans>A Question holds it now: answer {tag} first.</Trans>
  }
  return <Trans>It is no longer in Confirm all: confirm it on its own.</Trans>
}

