/*
 * Ticket S15-W0's acceptance tests, the areas: "Split the takeoff catalogue by screen area; extract
 * after merge, never hand-merge" (.private tickets, S15-W0), so that the parallel web tickets after it
 * each own one catalogue: S15-W1 the app frame and its errors ("Owns: web app router/frame"), S15-W2
 * Step 1's keys ("Owns: Step 1 screen keys"), S15-W3 Step 1's words and toasts ("Owns: Step 1 screen
 * words, toasts").
 *
 * An area is known here by the source files whose messages a catalogue holds (each entry's `#:` origin),
 * so the builder chooses the areas' names, folders and how many there are. A file is matched by its name
 * anywhere under its folder, so moving it into a sub-folder keeps it the same file:
 * - Step 1's keys: `Step1Screen.tsx`, where Step 1 registers its keys (§6.15) and their help labels;
 * - Step 1's toasts and answer words: `acts.tsx` (every act's toast and its Undo) and
 *   `questionWords.tsx` (each Question's options and what an answer did);
 * - the app frame: every file under `src/app/`.
 */
import { describe, expect, it } from 'vitest'
import { chromeCatalogues } from './po'

/** The catalogues (paths) holding a message whose origin is a file under `folder` named `name` (any name when absent). */
function cataloguesOf(folder: string, name?: string): string[] {
  const matches = (origin: string) =>
    origin.startsWith(`src/${folder}/`) && (name === undefined || origin.split('/').at(-1) === name)
  return chromeCatalogues()
    .filter((c) => c.entries.some((e) => e.origins.some(matches)))
    .map((c) => c.path)
}

const keys = () => cataloguesOf('takeoff', 'Step1Screen.tsx')
const toasts = () => cataloguesOf('takeoff', 'acts.tsx')
const answers = () => cataloguesOf('takeoff', 'questionWords.tsx')
const frame = () => cataloguesOf('app')

describe('each later web ticket owns one catalogue (S15-W0)', () => {
  it('keeps Step 1’s keys in a catalogue that holds none of Step 1’s toasts', () => {
    expect(keys(), 'Step1Screen.tsx has messages in some catalogue').not.toEqual([])
    expect(toasts(), 'acts.tsx has messages in some catalogue').not.toEqual([])
    const shared = keys().filter((path) => toasts().includes(path))
    expect(shared, 'catalogues holding both Step 1’s keys and its toasts').toEqual([])
  })

  it('keeps Step 1’s keys in a catalogue that holds none of the Questions’ answer words', () => {
    expect(answers(), 'questionWords.tsx has messages in some catalogue').not.toEqual([])
    const shared = keys().filter((path) => answers().includes(path))
    expect(shared, 'catalogues holding both Step 1’s keys and its answer words').toEqual([])
  })

  it('keeps the app frame’s words out of every catalogue that holds Step 1’s', () => {
    expect(frame(), 'src/app/ has messages in some catalogue').not.toEqual([])
    const step1 = new Set([...keys(), ...toasts(), ...answers()])
    expect(frame().filter((path) => step1.has(path)), 'catalogues holding both').toEqual([])
  })
})
