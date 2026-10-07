/*
 * The frame's endpoints are typed by hand in api.ts from session 16's contract, until K0's frozen schema
 * reaches the generated types. This keeps the two in step: once the generated schema has any path that
 * claims the frame (a takeoff path other than Step 1's, under any base), it must carry all seven of
 * api.ts's paths, each with the method api.ts calls it by, so a schema that names them differently (another
 * base, another segment) fails here instead of at the first real call.
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

const generated = readFileSync(new URL('../../api/schema.gen.ts', import.meta.url), 'utf8')

/** The method keys a path of a generated schema defines (not `never`). */
function methodsOf(schema: string, path: string): string[] | null {
  const at = schema.indexOf(`"${path}": {`)
  if (at < 0) return null
  const end = schema.indexOf('\n    "/', at + 1)
  const block = schema.slice(at, end < 0 ? undefined : end)
  return ['get', 'put', 'post'].filter((m) => new RegExp(`^\\s+${m}: operations\\[`, 'm').test(block))
}

/** The paths of a generated schema (each is a four-space-indented quoted key at the top of `paths`). */
const pathsOf = (schema: string) => [...schema.matchAll(/^ {4}"(\/[^"]+)": \{/gm)].map((m) => m[1]!)

/**
 * A path that claims the frame: anything under a takeoff base other than Step 1's (whatever the base,
 * `/api/projects/{project_id}/takeoff/` or another), and the frame's own last segments under any base.
 */
const claims = (path: string) =>
  (/\/takeoff\//.test(path) && !/\/takeoff\/step1\//.test(path)) || /\/(storeys|view-placements|confirmations)(\/|$)/.test(path)

/** What a generated schema lacks of api.ts's calls, once it has any path that claims the frame; [] when it has none. */
function lacking(schema: string): string[] {
  if (!pathsOf(schema).some(claims)) return []
  return CALLED.filter(([path, method]) => !(methodsOf(schema, path) ?? []).includes(method)).map(([path, method]) => `${method.toUpperCase()} ${path}`)
}

const entry = (path: string, method: string) => `    "${path}": {\n        parameters: {};\n        ${method}: operations["x"];\n    };\n`

describe('the frame’s calls against the generated schema', () => {
  it('has all seven paths as soon as the schema has any path that claims the frame, each with the method api.ts calls', () => {
    expect(lacking(generated)).toEqual([])
  })

  it('tells Step 1’s paths from the frame’s, and reads the schema’s paths', () => {
    expect(pathsOf(generated).length, 'paths read from the generated schema').toBeGreaterThan(10)
    expect(claims('/api/projects/{project_id}/takeoff/step1/confirm')).toBe(false)
    expect(claims('/api/me')).toBe(false)
  })

  it('fails a schema that names all seven under another base (the guard cannot pass by finding none of them)', () => {
    const other = CALLED.map(([path, method]) => entry(path.replace('/api/projects/{project_id}/takeoff', '/api/p/{code}/takeoff'), method)).join('')
    expect(lacking(other)).toHaveLength(7)
  })

  it('passes a schema that carries all seven, and fails one that carries six or the wrong method', () => {
    const all = CALLED.map(([path, method]) => entry(path, method)).join('')
    expect(lacking(all)).toEqual([])
    expect(lacking(CALLED.slice(1).map(([path, method]) => entry(path, method)).join(''))).toEqual([`GET ${BASE}/steps`])
    expect(lacking(CALLED.map(([path, method]) => entry(path, method === 'put' ? 'post' : method)).join('')).length).toBeGreaterThan(0)
  })

  it('has no frame to guard in a schema with Step 1’s paths only', () => {
    expect(lacking(entry('/api/projects/{project_id}/takeoff/step1/confirm', 'post'))).toEqual([])
  })
})
