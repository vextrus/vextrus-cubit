import { afterAll, describe, it } from 'vitest'
import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import vextrus from './vextrus.js'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.afterAll = afterAll

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('logical CSS only (docs/design/m0-screens.md §1.8; ADR 0038)', () => {
  tester.run('logical-classes', vextrus.rules['logical-classes'], {
    valid: [
      { code: `const a = <div className="ms-2 me-auto ps-3 pe-1 start-0 end-2 text-start border-s-2 rounded-e-md" />` },
      { code: `const a = cn('flex gap-2', open && 'bg-paper', 'data-[side=left]:slide-in-from-right-2')` },
      { code: `const a = <LtrCanvas><div className="left-0 ml-2 translate-x-4" /></LtrCanvas>` },
      { code: `const words = 'the left margin'` },
    ],
    invalid: [
      { code: `const a = <div className="flex ml-2" />`, errors: [{ messageId: 'physicalClass', data: { token: 'ml-2' } }] },
      ...['mr-auto', 'pl-3', 'pr-1', 'left-0', 'right-2', 'text-left', 'text-right', 'border-l', 'border-r-2', 'rounded-l-md', 'rounded-r', 'rounded-tl-md', '-ml-px', 'hover:pl-4', 'md:!mr-2', 'float-left', 'translate-x-1/2', '-translate-x-full', 'scroll-ml-2'].map((token) => ({
        code: `const a = cn('flex ${token}')`,
        errors: [{ messageId: 'physicalClass' as const }],
      })),
      { code: 'const a = `gap-2 ${x} pr-2`', errors: [{ messageId: 'physicalClass' }] },
    ],
  })

  tester.run('logical-inline-style', vextrus.rules['logical-inline-style'], {
    valid: [
      { code: `const a = <div style={{ marginInlineStart: 4, paddingInlineEnd: 2, insetInlineStart: 0, width: '50%' }} />` },
      { code: `const a = <LtrCanvas><svg style={{ left: 3, marginLeft: 2 }} /></LtrCanvas>` },
      { code: `const a = <div style={{ textAlign: 'start' }} />` },
    ],
    invalid: [
      { code: `const a = <div style={{ marginLeft: 4 }} />`, errors: [{ messageId: 'physicalStyle', data: { name: 'marginLeft' } }] },
      ...['marginRight', 'paddingLeft', 'paddingRight', 'left', 'right', 'borderLeft', 'borderRightWidth', 'borderTopLeftRadius'].map((name) => ({
        code: `const a = <div style={{ ${name}: 1 }} />`,
        errors: [{ messageId: 'physicalStyle' as const }],
      })),
      { code: `const a = <div style={{ textAlign: 'left' }} />`, errors: [{ messageId: 'physicalStyle' }] },
      { code: `el.style.paddingLeft = '2px'`, errors: [{ messageId: 'physicalStyle' }] },
      { code: `const a = <div style={{ 'margin-right': 2 }} />`, errors: [{ messageId: 'physicalStyle' }] },
    ],
  })

  tester.run('no-translate-x', vextrus.rules['no-translate-x'], {
    valid: [
      { code: `const a = <div style={{ transform: 'translateY(4px)' }} />` },
      { code: `const a = <LtrCanvas><g transform="translateX(4)" /></LtrCanvas>` },
    ],
    invalid: [
      { code: `const a = <div style={{ transform: 'translateX(4px)' }} />`, errors: [{ messageId: 'translateX' }] },
      { code: 'el.style.transform = `translate3d(${x}px, 0, 0)`', errors: [{ messageId: 'translateX' }] },
      { code: `const a = <div style={{ translateX: 4 }} />`, errors: [{ messageId: 'translateX' }] },
    ],
  })

  tester.run('no-scroll-left', vextrus.rules['no-scroll-left'], {
    valid: [
      { code: `el.scrollTop = 0` },
      { code: `const a = <LtrCanvas><Pane onScroll={(e) => e.currentTarget.scrollLeft} /></LtrCanvas>` },
    ],
    invalid: [
      { code: `el.scrollLeft = 10`, errors: [{ messageId: 'scrollLeft' }] },
      { code: `const x = el.scrollLeft`, errors: [{ messageId: 'scrollLeft' }] },
      { code: `el.scrollTo({ left: 10 })`, errors: [{ messageId: 'scrollLeft' }] },
    ],
  })
})

describe('tooltips and accessible names come from the catalogue (m0-screens §1.7)', () => {
  tester.run('visible-attributes', vextrus.rules['visible-attributes'], {
    valid: [
      { code: 'const a = <div title={t`Fit the whole sheet`} aria-label={label} />' },
      { code: `const a = <Chip title="Proposal" />` },
      { code: `const a = <div title="—" />` },
    ],
    invalid: [
      { code: `const a = <div title="Fit the whole sheet" />`, errors: [{ messageId: 'literal' }] },
      { code: `const a = <svg aria-label="Vextrus" />`, errors: [{ messageId: 'literal' }] },
      { code: 'const a = <span title={`Access ends`} />', errors: [{ messageId: 'literal' }] },
    ],
  })
})

describe('keys go through the one key map (m0-screens §2)', () => {
  tester.run('no-own-key-listener', vextrus.rules['no-own-key-listener'], {
    valid: [{ code: `window.addEventListener('resize', f)` }, { code: `const a = <input onChange={f} />` }],
    invalid: [
      { code: `window.addEventListener('keydown', f)`, errors: [{ messageId: 'ownListener' }] },
      { code: `document.addEventListener("keyup", f)`, errors: [{ messageId: 'ownListener' }] },
      { code: `const a = <div onKeyDown={f} />`, errors: [{ messageId: 'ownListener' }] },
    ],
  })
})
