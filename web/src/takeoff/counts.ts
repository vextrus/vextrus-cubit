/*
 * Step 1's counts for the frame around it (the toolbar's Count, the step rail's mark and Count, the
 * inspector's Questions tab), on every Takeoff step. They are read from Step 1's own queries, the ones
 * the rows are drawn from, so they change in the same render as the rows and no read of the session can
 * reset them (S26-D7). Until Step 1 has been read, they say so (`found: null`, "—").
 */
import { useQueries } from '@tanstack/react-query'
import { proposalsQuery, questionsQuery } from './data'
import { STEP1_NOT_READ, step1Counts, type Step1Counts } from './model'

export function useStep1Counts(projectId: string): Step1Counts {
  return useQueries({
    queries: [proposalsQuery(projectId), questionsQuery(projectId)],
    combine: ([proposals, questions]) => (proposals.data && questions.data ? step1Counts(proposals.data, questions.data) : STEP1_NOT_READ),
  })
}
