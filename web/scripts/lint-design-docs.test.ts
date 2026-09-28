import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintDesignDocs } from './lint-design-docs.mjs'

/** A throwaway docs/design/ tree with the given files. */
function designDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'design-docs-'))
  mkdirSync(join(root, 'm0-wireframes'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text)
  return root
}

const svgText = (text: string) => `<svg><text x="1" y="2" font-size="12">${text}</text></svg>`

describe('the design-docs lint (docs/plans/M0.md, 01b; the reviews U3, U6)', () => {
  it('passes a clean tree', () => {
    const root = designDir({
      'm0-screens.md': 'Ticket 20a builds sign-in; tickets 16, 20a, 20b and 22 grep the DOM. The decode function is engine/text/decode.py.',
      'm0-wireframes/sheet-viewer-1280.svg': svgText('As read') + svgText('Vextrus Engineer') + svgText('KR-ELE-R0.dwg'),
    })
    expect(lintDesignDocs(root)).toEqual([])
  })

  it.each([
    ['a bare "ticket 20 "', 'the frame is ticket 20 and the list', 'ticket 20'],
    ['a bare "ticket 20" before a comma', 'see ticket 20, above', 'ticket 20'],
    ['render/text.py', 'decoded by engine/render/text.py first', 'render/text.py'],
    ['app/keys', 'the key map in web/src/app/keys', 'app/keys'],
    ['make_dwg.py', 'fixtures from make_dwg.py', 'make_dwg.py'],
  ])('fails on %s in docs/design/', (_, text, found) => {
    const findings = lintDesignDocs(designDir({ 'm0-screens.md': `line one\n${text}\n` }))
    expect(findings).toEqual([expect.objectContaining({ file: 'm0-screens.md', line: 2, found })])
  })

  it.each([
    ['"MEP" as an exclusion reason', 'Leave out, MEP'],
    ['"MEP" in the reasons list', 'or index, MEP'],
    ['MEP sheets excluded', 'Read from their title blocks; 3 MEP sheets excluded'],
  ])('fails on %s in a wireframe', (_, text) => {
    const findings = lintDesignDocs(designDir({ 'm0-wireframes/step1-list-1280.svg': svgText(text) }))
    expect(findings).toEqual([expect.objectContaining({ file: 'm0-wireframes/step1-list-1280.svg', found: text })])
  })

  it('fails on "Engine" as a viewer mode in a wireframe', () => {
    const findings = lintDesignDocs(designDir({ 'm0-wireframes/sheet-viewer-1440.svg': svgText('Engine') + svgText('Plot') }))
    expect(findings).toEqual([expect.objectContaining({ found: 'Engine' })])
  })

  it('passes MEP as a Discipline Part and Engine inside another word', () => {
    const root = designDir({
      'm0-wireframes/step1-sheet-1280.svg':
        svgText('MEP · Electrical, M3 onwards') + svgText('Vextrus Engineer') + svgText('excluded: for information'),
    })
    expect(lintDesignDocs(root)).toEqual([])
  })
})
