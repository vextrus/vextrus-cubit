import { describe, expect, it } from 'vitest'
import { lintCss } from './lint-css.mjs'

describe('logical properties only in CSS (m0-screens §1.8)', () => {
  it('passes logical properties', () => {
    const css = `.a { margin-inline-start: 4px; padding-inline: 2px; inset-inline-end: 0; text-align: start;
      border-inline-start: 1px solid; border-start-end-radius: 2px; }
      @keyframes s { from { inset-inline-start: -30% } }
      /* margin-left: 2px in a comment is fine */`
    expect(lintCss(css)).toEqual([])
  })

  it.each([
    ['margin-left: 2px', 'margin-left'],
    ['margin-right:0', 'margin-right'],
    ['padding-left: 1px', 'padding-left'],
    ['padding-right: 1px', 'padding-right'],
    ['left: 0', 'left'],
    ['right: 0', 'right'],
    ['border-left: 1px solid', 'border-left'],
    ['border-right-width: 2px', 'border-right-width'],
    ['border-top-left-radius: 2px', 'border-top-left-radius'],
    ['text-align: right', 'text-align: right'],
    ['float: left', 'float: left'],
    ['transform: translateX(4px)', 'translateX('],
  ])('fails on %s', (declaration, found) => {
    const findings = lintCss(`.a {\n  color: red;\n  ${declaration};\n}`)
    expect(findings).toEqual([expect.objectContaining({ line: 3, found })])
  })

  it('fails on a physical class pulled in with @apply', () => {
    expect(lintCss('.a { @apply flex ml-2; }')).toEqual([expect.objectContaining({ found: 'ml-2' })])
  })
})
