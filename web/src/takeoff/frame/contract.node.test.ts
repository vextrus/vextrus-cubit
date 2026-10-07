/*
 * The frame's endpoints are typed by hand in api.ts from session 16's contract, until K0's frozen schema
 * reaches the generated types. This keeps the two in step: once the generated schema carries any of the
 * takeoff frame's paths, it must carry all seven, each with the method api.ts calls it by, so a schema
 * that names a path differently fails here instead of at the first real call.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const BASE = '/api/projects/{project_id}/takeoff'
const CALLED: readonly (readonly [string, 'get' | 'put' | 'post'])[] = [
  [`${BASE}/steps`, 'get'],
  [`${BASE}/steps/{step}/proposals`, 'get'],
  [`${BASE}/steps/{step}/read`, 'post'],
  [`${BASE}/storeys`, 'get'],
  [`${BASE}/storeys/levels`, 'put'],
  [`${BASE}/view-placements/{view_id}`, 'put'],
  [`${BASE}/confirmations`, 'post'],
]

const schema = readFileSync(new URL('../../api/schema.gen.ts', import.meta.url), 'utf8')

/** The method keys a path of the generated schema defines (not `never`). */
function methodsOf(path: string): string[] | null {
  const at = schema.indexOf(`"${path}": {`)
  if (at < 0) return null
  const end = schema.indexOf('\n    "/', at + 1)
  const block = schema.slice(at, end < 0 ? undefined : end)
  return ['get', 'put', 'post'].filter((m) => new RegExp(`^\\s+${m}: operations\\[`, 'm').test(block))
}

describe('the frame’s calls against the generated schema', () => {
  const present = CALLED.filter(([path]) => methodsOf(path) !== null)

  it('has all seven paths once it has any, each with the method api.ts calls', () => {
    if (present.length === 0) return
    const wrong = CALLED.filter(([path, method]) => !(methodsOf(path) ?? []).includes(method)).map(([path, method]) => `${method.toUpperCase()} ${path}`)
    expect(wrong, 'frame calls the generated schema does not carry').toEqual([])
  })
})
