/*
 * Every code the machine may send has an English message (docs/plans/M0.md, "Message codes"; the
 * reviews A5, R7; m0-screens §1.7). The codes come from the generated API types (`MessageCode`, the
 * enum `vextrus/api.py` assembles from every module's `messages/` package and the engine's), and the
 * words from every catalogue under src/messages/, gathered by glob: so a backend ticket that adds a code
 * without wording it fails its own PR, and no ticket edits a shared list.
 *
 * The types are generated, never committed: `npm run api:types` (web.yml runs it before this test).
 */
import { describe, expect, it } from 'vitest'
import { englishMessages } from '@/i18n/catalogues'
import { codesWithoutEnglish } from './machine'

const generated = import.meta.glob<{ messageCodeValues?: readonly string[] }>('../api/schema.gen.ts', { eager: true })
const schema = Object.values(generated)[0]

describe('every message code in the generated API types has an English message', () => {
  it('finds the generated types (run `npm run api:types` first)', () => {
    expect(schema, 'src/api/schema.gen.ts is missing: run `npm run api:types` (it exports the schema from the backend)').toBeDefined()
    expect(schema?.messageCodeValues, 'the generated types carry no messageCodeValues: api:types runs openapi-typescript with --enum-values').toBeDefined()
  })

  it('words every code', () => {
    expect(codesWithoutEnglish(schema?.messageCodeValues ?? [], englishMessages())).toEqual([])
  })
})

describe('codesWithoutEnglish', () => {
  it('names each code with no message, or an empty one', () => {
    const messages = { 'platform.tenancy.ended': ['Access ended'], 'engine.read.blank': '', 'engine.read.empty': [] }
    expect(codesWithoutEnglish(['platform.tenancy.ended', 'engine.read.blank', 'engine.read.empty', 'drawings.upload.scan'], messages)).toEqual([
      'engine.read.blank',
      'engine.read.empty',
      'drawings.upload.scan',
    ])
  })
})
