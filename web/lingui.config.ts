/*
 * The chrome's catalogues: one English catalogue per feature folder, `src/<feature>/locales/en.po`,
 * extracted from that folder's code (docs/plans/M0.md, "The shape of M0's code"; ADR 0038).
 * The machine's message codes live in `src/messages/` and are compiled by
 * `lingui.messages.config.ts`; they are worded by hand, never extracted.
 */
import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

/** Folders under src/ that hold no chrome catalogue of their own. */
const NOT_FEATURES = ['messages', 'routes', 'i18n', 'test', 'api']

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en'],
  format: formatter({ lineNumbers: false }),
  orderBy: 'messageId',
  catalogs: [
    {
      path: '<rootDir>/src/{name}/locales/{locale}',
      include: ['<rootDir>/src/{name}/'],
      exclude: [
        ...NOT_FEATURES.map((f) => `<rootDir>/src/${f}/**`),
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/locales/**',
      ],
    },
  ],
})
