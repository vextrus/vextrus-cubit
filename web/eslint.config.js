/*
 * The web's lint (`npm run lint`, a step of .github/workflows/web.yml).
 *
 * - The catalogue lint (docs/design/m0-screens.md §1.7; ADR 0038): Lingui's no-unlocalized-strings
 *   fails any visible string literal in UI code outside a catalogue: JSX text, and strings in
 *   attributes and props such as title, aria-label, placeholder or label. Strings that are not
 *   words people read (class names, ids, keys, one-word identifiers, drawing notation in the
 *   specimen's invented data) are ignored below, each with its reason.
 * - Logical CSS (§1.8): eslint/vextrus.js; CSS files are checked by scripts/lint-css.mjs.
 * - One key map (§2): no key listener outside src/ui/keys/.
 */
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import pluginLingui from 'eslint-plugin-lingui'
import vextrus from './eslint/vextrus.js'

const UI_CODE = ['src/**/*.{ts,tsx}']
const NOT_UI_CODE = [
  '**/*.test.{ts,tsx}',
  'src/test/**',
  // Invented data for the development-only specimen: drawing text and names are data (§1.7).
  '**/*.fixture.{ts,tsx}',
  // Language data and the test-only pseudo language: tags and accent tables, no prose.
  'src/i18n/languages.ts',
  'src/i18n/pseudo.ts',
]

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src/routeTree.gen.ts', 'src/api/schema.gen.ts', '**/locales/**/*.js', 'src/messages/**/*.js', '.vitest/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['*.{js,ts}', 'scripts/**/*.{mjs,ts}', 'eslint/**/*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  pluginLingui.configs['flat/recommended'],

  // The catalogue lint.
  {
    files: UI_CODE,
    ignores: NOT_UI_CODE,
    rules: {
      'lingui/no-unlocalized-strings': [
        'error',
        {
          ignore: [
            // One word that does not start with a capital: an identifier, a token, a data key.
            '^(?![A-Z])\\S+$',
            // Constants and codes: KR-01, UTF-8, ID.
            '^[A-Z0-9_.:+/-]+$',
            // Signs and figures with no letters: ↵, —, 1:100, 12 / 13.
            '^[^A-Za-z]*$',
          ],
          ignoreNames: [
            { regex: { pattern: 'className', flags: 'i' } },
            { regex: { pattern: '^data-' } },
            { regex: { pattern: '^[A-Z0-9_]+$' } },
            // A key map binding's key (`Ctrl K`), a combination, a CSS selector, a style value.
            'key',
            'combo',
            'keys',
            'selector',
            'style',
            'type',
            'role',
            'id',
            'htmlFor',
            'dir',
            'lang',
            'href',
            'displayName',
            'viewBox',
            'd',
            'fill',
            'stroke',
            'strokeDasharray',
            'transform',
            'width',
            'height',
          ],
          ignoreFunctions: [
            'cn',
            'cva',
            'clsx',
            'twMerge',
            'Error',
            'KeyMapError',
            'CatalogueClash',
            'console.*',
            'this.fail',
            'normaliseCombo',
            'createFileRoute',
            'createRootRoute',
            'lazyRouteComponent',
            '*.closest',
            '*.querySelector',
            '*.querySelectorAll',
            '*.matches',
            '*.getAttribute',
            '*.setAttribute',
            '*.removeAttribute',
            '*.addEventListener',
            '*.removeEventListener',
            '*.getPropertyValue',
            'matchMedia',
            'useMedia',
            'window.matchMedia',
            'import.meta.glob',
            '*.startsWith',
            '*.endsWith',
            '*.includes',
            '*.split',
            '*.join',
            '*.replace',
            'useScope',
          ],
        },
      ],
    },
  },

  {
    files: UI_CODE,
    ignores: NOT_UI_CODE,
    plugins: { vextrus },
    rules: { 'vextrus/visible-attributes': 'error' },
  },

  // Routes hold no words: a route file imports its feature's page (the feature folder's catalogue).
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@lingui/*'], message: 'Routes hold no words; put them in the feature folder, whose catalogue extracts them.' }] },
      ],
    },
  },

  // Logical CSS; the canvases (LtrCanvas and code under a canvas/ folder) are exempt.
  {
    files: UI_CODE,
    ignores: ['**/canvas/**', 'src/ui/LtrCanvas.tsx', '**/*.test.{ts,tsx}'],
    plugins: { vextrus },
    rules: {
      'vextrus/logical-classes': 'error',
      'vextrus/logical-inline-style': 'error',
      'vextrus/no-translate-x': 'error',
      'vextrus/no-scroll-left': 'error',
    },
  },

  // One key map.
  {
    files: UI_CODE,
    ignores: ['src/ui/keys/**', '**/*.test.{ts,tsx}'],
    plugins: { vextrus },
    rules: { 'vextrus/no-own-key-listener': 'error' },
  },
)
