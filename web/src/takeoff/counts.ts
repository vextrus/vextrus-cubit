/*
 * Step 1's counts for the frame around it (the toolbar's Count, the step rail's mark and Count, the
 * inspector's Questions tab), on every Takeoff step. They are read from Step 1's own queries, the ones
 * the rows and the status bar's Coverage are drawn from, as the same snapshot (`useSettled`), so they
 * change in the same render as the rows and no read of the session can reset them (S26-D7). Until Step 1
 * has been read, they say so (`found: null`, a bar in the toolbar).
 */
import { useQuery } from '@tanstack/react-query'
import { proposalsQuery, questionsQuery, useSettled } from './data'
import { STEP1_NOT_READ, step1Counts, type Step1Counts } from './model'

export function useStep1Counts(projectId: string): Step1Counts {
  const proposals = useQuery(proposalsQuery(projectId)).data
  const questions = useQuery(questionsQuery(projectId)).data
  const read = useSettled(projectId, proposals && questions ? { proposals, questions } : null)
  return read ? step1Counts(read.proposals, read.questions) : STEP1_NOT_READ
}
