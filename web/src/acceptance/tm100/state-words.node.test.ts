/*
 * M1-00, the contract freeze (docs/plans/M1.md C9, A12): "`ProposalState = open | held | blocked |
 * confirmed | excluded | superseded` and `StepStatus = not_started | reading | in_review | confirmed |
 * closed_with_questions | reopened` are `Literal`s in the OpenAPI schema; the web imports the generated
 * unions", and "a contract test compares both sides". The web's side: the generated API types carry
 * both unions by name, with exactly these words.
 *
 * The types are generated, never committed: `npm run api:types` (web.yml runs it before this test).
 */
import { describe, expect, it } from 'vitest'

type Generated = { proposalStateValues?: readonly string[]; stepStatusValues?: readonly string[] }
const generated = import.meta.glob<Generated>('../../api/schema.gen.ts', { eager: true })
const schema = Object.values(generated)[0]

describe('the web state words are the generated unions', () => {
  it('finds the generated types (run `npm run api:types` first)', () => {
    expect(schema, 'src/api/schema.gen.ts is missing: run `npm run api:types`').toBeDefined()
  })

  it('carries ProposalState: open, held, blocked, confirmed, excluded, superseded', () => {
    expect(new Set(schema?.proposalStateValues ?? [])).toEqual(
      new Set(['open', 'held', 'blocked', 'confirmed', 'excluded', 'superseded']),
    )
  })

  it('carries StepStatus: not_started, reading, in_review, confirmed, closed_with_questions, reopened', () => {
    expect(new Set(schema?.stepStatusValues ?? [])).toEqual(
      new Set(['not_started', 'reading', 'in_review', 'confirmed', 'closed_with_questions', 'reopened']),
    )
  })
})
