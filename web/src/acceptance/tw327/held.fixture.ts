/*
 * T-W327's acceptance fake: KR-01 after reading (22's Step 1 fake with 21c's answer operation, ../t156)
 * and its Drawing Set (14's files list, ../t20b) on one API, with two held DWGs, each with its own
 * `file_misread` Question whose `subject_id` is the file's id (the wiring of ../t206, copied, not
 * imported). Every file name and person here is invented.
 *
 *   const { fake, set, first, second } = twoHeld()            // both Questions open
 *   const { second } = twoHeld({ second: 'read_anyway' })     // the second answered "Read it anyway"
 */
import { FakeDrawingSet, file, msg, type FileOut } from '@/acceptance/t20b/drawings.fixture'
import { FakeAnswers, type Question21c } from '../t156/answer.fixture'

export const READ_NAME = 'KR-ARC-R2.dwg'
export const FIRST_HELD = 'KR-MEC-old.dwg'
export const SECOND_HELD = 'KR-FIR-old.dwg'

export type HeldAnswer = 'read_anyway' | 'await_resaved' | 'sent_to_vextrus'

const STATUS: Record<HeldAnswer, string> = {
  read_anyway: 'drawings.files.held_read_anyway',
  await_resaved: 'drawings.files.await_resaved',
  sent_to_vextrus: 'drawings.files.sent_to_vextrus',
}

export interface Held {
  file: FileOut
  question: Question21c
}

function answer(question: Question21c, heldFile: FileOut, option: HeldAnswer | null): void {
  heldFile.status = msg(option ? STATUS[option] : 'drawings.files.held')
  if (option) Object.assign(question, { status: 'answered', answer: { option, by: 'Farhana Kabir' }, answered_at: '2026-10-05T04:00:00Z' })
}

/**
 * KR-01 with a read DWG and two held DWGs (`first`, `second`), their Questions open unless an answer
 * is given; the held rows first when `heldFirst` (the table's order is the API's).
 */
export function twoHeld({ first = null, second = null, heldFirst = false }: { first?: HeldAnswer | null; second?: HeldAnswer | null; heldFirst?: boolean } = {}) {
  const fake = new FakeAnswers()
  fake.questions = fake.step1.questions.map((q) => ({
    ...q,
    proposals: q.subject_id ? fake.step1.proposals.filter((p) => p.sheet_id === q.subject_id).map((p) => p.id) : [],
  }))
  const one = fake.questions.find((q) => q.kind === 'file_misread')!
  const set = new FakeDrawingSet(fake.api, 'KR-01')
  const firstFile = file({ id: one.subject_id!, name: FIRST_HELD, discipline: 'mechanical', state: 'held', status: msg('drawings.files.held') })
  const secondFile = file({ name: SECOND_HELD, discipline: 'fire', state: 'held', status: msg('drawings.files.held') })
  const two: Question21c = {
    ...one,
    id: '00000000-0000-4000-8000-0000000c3270',
    discipline: 'fire',
    subject_id: secondFile.id,
    options: one.options.map((o) => ({ ...o })),
    proposals: [],
  }
  fake.questions = [...fake.questions, two]
  answer(one, firstFile, first)
  answer(two, secondFile, second)
  const read = file({ name: READ_NAME, discipline: 'architectural', state: 'read', status: msg('drawings.files.read'), sheets_found: 9 })
  set.files = heldFirst ? [firstFile, secondFile, read] : [read, firstFile, secondFile]
  set.summary = msg('drawings.files.summary', { files: 3, sheets: 9, held_sheets: 0, reading: 0, failed: 0, held: 2, refused: 0 })
  return { fake, set, read, first: { file: firstFile, question: one } as Held, second: { file: secondFile, question: two } as Held }
}
