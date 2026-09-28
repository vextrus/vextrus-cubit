/*
 * The web's real lint config, run on planted code: what the owner is shown failing (ticket 01b,
 * "Sees": the lints fail on a planted string literal and a planted ml-2).
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

const web = fileURLToPath(new URL('..', import.meta.url))
const eslint = new ESLint({ cwd: web })

async function ruleIdsFor(code: string, filePath = 'src/ui/Planted.tsx'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message)
}

describe('the catalogue lint: no visible string literal outside a catalogue (m0-screens §1.7)', () => {
  it('fails on a planted string literal in JSX text', async () => {
    expect(await ruleIdsFor(`export const A = () => <p>Sheets confirmed</p>`)).toContain('lingui/no-unlocalized-strings')
  })

  it('fails on a planted accessible name, tooltip or placeholder', async () => {
    for (const attr of ['aria-label="Close"', 'title="Fit the whole sheet"', 'placeholder="Search sheets"']) {
      const ids = await ruleIdsFor(`export const A = () => <button ${attr} />`)
      expect(ids.some((id) => id === 'lingui/no-unlocalized-strings' || id === 'vextrus/visible-attributes'), attr).toBe(true)
    }
  })

  it('fails on a literal SVG title', async () => {
    expect(await ruleIdsFor(`export const A = () => <svg><title>Proposal</title></svg>`)).toContain('lingui/no-unlocalized-strings')
    expect(await ruleIdsFor(`export const A = () => <svg aria-label="Proposal" />`)).toContain('vextrus/visible-attributes')
  })

  it('fails on a visible string held in a variable', async () => {
    expect(await ruleIdsFor(`const label = 'Not saved: the connection dropped'\nexport const A = () => <p>{label}</p>`)).toContain(
      'lingui/no-unlocalized-strings',
    )
  })

  it('passes a message from the catalogue and strings no one reads', async () => {
    const code = [
      `import { Trans, useLingui } from '@lingui/react/macro'`,
      `export function A() {`,
      `  const { t } = useLingui()`,
      `  return <div className="flex gap-2 text-sm" data-state="open" role="status" aria-label={t\`Close\`}><Trans>Sheets confirmed</Trans></div>`,
      `}`,
    ].join('\n')
    expect(await ruleIdsFor(code)).toEqual([])
  })

  it('does not apply to tests', async () => {
    expect(await ruleIdsFor(`export const A = () => <p>Sheets confirmed</p>`, 'src/ui/Planted.test.tsx')).toEqual([])
  })
})

describe('the logical-CSS lint (m0-screens §1.8)', () => {
  it('fails on a planted ml-2', async () => {
    expect(await ruleIdsFor(`export const A = () => <div className="flex ml-2" />`)).toContain('vextrus/logical-classes')
  })

  it('fails on a physical inline style, translateX and scrollLeft', async () => {
    expect(await ruleIdsFor(`export const A = () => <div style={{ paddingLeft: 4 }} />`)).toContain('vextrus/logical-inline-style')
    expect(await ruleIdsFor(`export const A = () => <div style={{ transform: 'translateX(4px)' }} />`)).toContain('vextrus/no-translate-x')
    expect(await ruleIdsFor(`export const f = (el: HTMLElement) => el.scrollLeft`)).toContain('vextrus/no-scroll-left')
  })

  it('exempts code inside LtrCanvas and under a canvas/ folder', async () => {
    const inside = `import { LtrCanvas } from '@/ui/LtrCanvas'\nexport const A = () => <LtrCanvas><svg className="left-0" style={{ marginLeft: 2 }} /></LtrCanvas>`
    expect(await ruleIdsFor(inside)).toEqual([])
    expect(await ruleIdsFor(`export const f = (el: HTMLElement) => el.scrollLeft`, 'src/sheet/canvas/pan.ts')).toEqual([])
  })
})

describe('one key map (m0-screens §2)', () => {
  it('fails on a key listener outside src/ui/keys/', async () => {
    expect(await ruleIdsFor(`window.addEventListener('keydown', () => {})`, 'src/sheet/Viewer.tsx')).toContain('vextrus/no-own-key-listener')
  })
})
