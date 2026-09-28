/*
 * Vextrus's own ESLint rules (ticket 01b).
 *
 * Logical CSS only (docs/design/m0-screens.md §1.8; ADR 0038; the review U9): the chrome mirrors in
 * a right-to-left language, so UI code never names a physical side. Four rules:
 *   logical-classes       Tailwind classes such as ml-2, pr-4, left-0, text-right, border-l,
 *                         rounded-r, translate-x-1/2 in any string (className, cn(), cva())
 *   logical-inline-style  marginLeft, paddingRight, left, right, borderLeft… and textAlign 'left'
 *                         in a `style` object or on `el.style`
 *   no-translate-x        translateX / translate3d in a string, and a `translateX` style key
 *   no-scroll-left        scrollLeft, and scrollTo({ left })
 * Code inside a <LtrCanvas> element is exempt (the sheet and 3D canvases are fixed left to right),
 * and so are files under a `canvas/` folder (eslint.config.js), where the canvas's own code lives.
 *
 * The catalogue lint's gap (m0-screens §1.7): visible-attributes refuses a literal `title` or
 * accessible name on an HTML or SVG element, which Lingui's rule lets through.
 *
 * One key map (m0-screens §2): no-own-key-listener refuses `addEventListener('keydown')` and
 * `onKeyDown` outside src/ui/keys/.
 */

const PHYSICAL_CLASS =
  /^(?:(?:left|right)-|(?:m[lr]|p[lr]|scroll-m[lr]|scroll-p[lr]|inset-[lr]|border-[lr]|rounded-[lr]|rounded-[tb][lr]|text-(?:left|right)|float-(?:left|right)|clear-(?:left|right)|translate-x|origin-(?:left|right|top-left|top-right|bottom-left|bottom-right))(?:-|$))/

/** The utility a class token names, without its variants (`md:hover:`), `!` or a leading `-`. */
function utilityOf(token) {
  let depth = 0
  let start = 0
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === ':' && depth === 0) start = i + 1
  }
  return token.slice(start).replace(/^!/, '').replace(/^-/, '').replace(/!$/, '')
}

export function physicalClasses(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => PHYSICAL_CLASS.test(utilityOf(token)))
}

const PHYSICAL_STYLE = new Set([
  'marginLeft',
  'marginRight',
  'paddingLeft',
  'paddingRight',
  'left',
  'right',
  'borderLeft',
  'borderRight',
  'borderLeftWidth',
  'borderRightWidth',
  'borderLeftColor',
  'borderRightColor',
  'borderLeftStyle',
  'borderRightStyle',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'scrollMarginLeft',
  'scrollMarginRight',
  'scrollPaddingLeft',
  'scrollPaddingRight',
])
const SIDE_VALUED = new Set(['textAlign', 'float', 'clear'])

function camel(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function propertyName(node) {
  if (node.type !== 'Property') return undefined
  if (node.key.type === 'Identifier' && !node.computed) return node.key.name
  if (node.key.type === 'Literal' && typeof node.key.value === 'string') return camel(node.key.value)
  return undefined
}

function isInsideLtrCanvas(context, node) {
  for (const a of context.sourceCode.getAncestors(node)) {
    if (a.type === 'JSXElement') {
      const n = a.openingElement.name
      const name = n.type === 'JSXIdentifier' ? n.name : n.type === 'JSXMemberExpression' ? n.property.name : ''
      if (name === 'LtrCanvas') return true
    }
  }
  return false
}

function isStyleObject(context, node) {
  const parent = node.parent
  if (parent?.type === 'JSXExpressionContainer' && parent.parent?.type === 'JSXAttribute') {
    return parent.parent.name.name === 'style'
  }
  return false
}

function stringValue(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '').join(' ')
  return undefined
}

const logicalClasses = {
  meta: {
    type: 'problem',
    docs: { description: 'Use logical Tailwind classes (ms-, pe-, start-, text-start…), never a physical side.' },
    messages: {
      physicalClass:
        '"{{token}}" names a physical side and will not mirror in a right-to-left language. Use the logical class (ms-/me-, ps-/pe-, start-/end-, text-start/end, border-s/e, rounded-s/e); only code inside LtrCanvas may be physical (m0-screens §1.8).',
    },
    schema: [],
  },
  create(context) {
    function check(node, text) {
      if (isInsideLtrCanvas(context, node)) return
      for (const token of physicalClasses(text)) context.report({ node, messageId: 'physicalClass', data: { token } })
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string' && node.parent?.type !== 'ImportDeclaration') check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? '')
      },
      JSXText() {},
    }
  },
}

const logicalInlineStyle = {
  meta: {
    type: 'problem',
    docs: { description: 'Inline styles use logical properties (marginInlineStart…), never a physical side.' },
    messages: {
      physicalStyle:
        '"{{name}}" in an inline style names a physical side and will not mirror. Use its logical form (marginInlineStart, paddingInlineEnd, insetInlineStart, borderInlineStart, textAlign "start"…); only code inside LtrCanvas may be physical (m0-screens §1.8).',
    },
    schema: [],
  },
  create(context) {
    function checkProperty(prop) {
      const name = propertyName(prop)
      if (!name) return
      const value = stringValue(prop.value)
      if (PHYSICAL_STYLE.has(name) || (SIDE_VALUED.has(name) && (value === 'left' || value === 'right'))) {
        context.report({ node: prop, messageId: 'physicalStyle', data: { name } })
      }
    }
    return {
      ObjectExpression(node) {
        if (!isStyleObject(context, node) || isInsideLtrCanvas(context, node)) return
        node.properties.forEach(checkProperty)
      },
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier') return
        const obj = node.object
        const onStyle =
          (obj.type === 'MemberExpression' && !obj.computed && obj.property.type === 'Identifier' && obj.property.name === 'style') ||
          (obj.type === 'Identifier' && obj.name === 'style')
        if (onStyle && PHYSICAL_STYLE.has(node.property.name) && !isInsideLtrCanvas(context, node)) {
          context.report({ node, messageId: 'physicalStyle', data: { name: node.property.name } })
        }
      },
    }
  },
}

const TRANSLATE_X = /\btranslate(X|3d)\s*\(/

const noTranslateX = {
  meta: {
    type: 'problem',
    docs: { description: 'No translateX outside LtrCanvas: a horizontal offset mirrors wrongly.' },
    messages: {
      translateX:
        'translateX moves the chrome by a physical offset that does not mirror in a right-to-left language. Lay it out with logical properties instead; only code inside LtrCanvas may translate on x (m0-screens §1.8).',
    },
    schema: [],
  },
  create(context) {
    function check(node, text) {
      if (TRANSLATE_X.test(text) && !isInsideLtrCanvas(context, node)) context.report({ node, messageId: 'translateX' })
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value)
      },
      TemplateLiteral(node) {
        check(node, node.quasis.map((q) => q.value.cooked ?? '').join('0'))
      },
      Property(node) {
        if (propertyName(node) === 'translateX' && !isInsideLtrCanvas(context, node)) context.report({ node, messageId: 'translateX' })
      },
    }
  },
}

const noScrollLeft = {
  meta: {
    type: 'problem',
    docs: { description: 'No scrollLeft outside LtrCanvas: its sign flips in a right-to-left page.' },
    messages: {
      scrollLeft:
        'scrollLeft (and scrollTo with left) is physical and its sign flips in a right-to-left page. Use scrollIntoView or a logical measure; only code inside LtrCanvas may use it (m0-screens §1.8).',
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (!node.computed && node.property.type === 'Identifier' && node.property.name === 'scrollLeft' && !isInsideLtrCanvas(context, node)) {
          context.report({ node, messageId: 'scrollLeft' })
        }
      },
      CallExpression(node) {
        const callee = node.callee
        const name = callee.type === 'MemberExpression' && callee.property.type === 'Identifier' ? callee.property.name : ''
        if (!['scrollTo', 'scrollBy', 'scroll'].includes(name) || isInsideLtrCanvas(context, node)) return
        const arg = node.arguments[0]
        if (arg?.type === 'ObjectExpression' && arg.properties.some((p) => propertyName(p) === 'left')) {
          context.report({ node, messageId: 'scrollLeft' })
        }
      },
    }
  },
}

/*
 * Lingui's no-unlocalized-strings lets any attribute of an HTML element through except placeholder,
 * alt, aria-label and value, and every attribute of an SVG element; a tooltip (`title`) or an
 * accessible description is still read. This closes that gap for the catalogue lint.
 */
const VISIBLE_ATTRIBUTES = new Set([
  'title',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'placeholder',
  'alt',
  'label',
])

const visibleAttributes = {
  meta: {
    type: 'problem',
    docs: { description: 'Tooltips and accessible names on HTML and SVG elements come from the catalogue.' },
    messages: {
      literal: '"{{attribute}}" is read by people, so its text comes from the catalogue (t`…`), never a literal (m0-screens §1.7).',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const element = node.parent
        const tag = element?.type === 'JSXOpeningElement' && element.name.type === 'JSXIdentifier' ? element.name.name : ''
        if (!/^[a-z]/.test(tag) || node.name.type !== 'JSXIdentifier' || !VISIBLE_ATTRIBUTES.has(node.name.name)) return
        let value = node.value
        if (value?.type === 'JSXExpressionContainer') value = value.expression
        const text = value ? stringValue(value) : undefined
        if (text !== undefined && /\p{L}/u.test(text)) context.report({ node, messageId: 'literal', data: { attribute: node.name.name } })
      },
    }
  },
}

const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress'])

const noOwnKeyListener = {
  meta: {
    type: 'problem',
    docs: { description: 'Keys go through the one key map (web/src/ui/keys/), never a listener of their own.' },
    messages: {
      ownListener:
        'Register keys with useKeys from web/src/ui/keys/ instead of a key listener of your own, so the ? overlay and the collision test see them (m0-screens §2).',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        const name = callee.type === 'MemberExpression' && callee.property.type === 'Identifier' ? callee.property.name : ''
        const first = node.arguments[0]
        if (name === 'addEventListener' && first?.type === 'Literal' && KEY_EVENTS.has(String(first.value))) {
          context.report({ node, messageId: 'ownListener' })
        }
      },
      JSXAttribute(node) {
        if (node.name.type === 'JSXIdentifier' && /^onKey(Down|Up|Press)(Capture)?$/.test(node.name.name)) {
          context.report({ node, messageId: 'ownListener' })
        }
      },
    }
  },
}

export default {
  meta: { name: 'eslint-plugin-vextrus', version: '0.0.0' },
  rules: {
    'logical-classes': logicalClasses,
    'logical-inline-style': logicalInlineStyle,
    'no-translate-x': noTranslateX,
    'no-scroll-left': noScrollLeft,
    'no-own-key-listener': noOwnKeyListener,
    'visible-attributes': visibleAttributes,
  },
}
