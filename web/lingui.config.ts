/*
 * The chrome's catalogues: one English catalogue per feature folder, `src/<feature>/locales/en.po`,
 * extracted from that folder's code (docs/plans/M0.md, "The shape of M0's code"; ADR 0038).
 * The machine's message codes live in `src/messages/` and are compiled by
 * `lingui.messages.config.ts`; they are worded by hand, never extracted.
 */
import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

/** Folders under src/ that hold no chrome catalogue of their own (acceptance/: tests and their helpers). */
const NOT_FEATURES = ['messages', 'routes', 'i18n', 'test', 'api', 'acceptance']

/**
 * Takeoff's catalogues, one per screen area so each later ticket owns one (S15-W0): the areas' source
 * files, each area's catalogue `src/takeoff/locales/<area>/en.po`. Every other file of the folder stays
 * in `src/takeoff/locales/en.po`, the generic catalogue below. A message two areas share is in both.
 */
const TAKEOFF_AREAS: Record<string, string[]> = {
  words: ['words.tsx'],
  answers: ['questionWords.tsx'],
  step1: ['Step1Screen.tsx', 'Step1Inspector.tsx'],
  toasts: ['acts.tsx'],
}
const TAKEOFF_SPLIT = Object.values(TAKEOFF_AREAS).flat()

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
        ...TAKEOFF_SPLIT.map((f) => `<rootDir>/src/takeoff/${f}`),
      ],
    },
    ...Object.entries(TAKEOFF_AREAS).map(([area, files]) => ({
      path: `<rootDir>/src/takeoff/locales/${area}/{locale}`,
      include: files.map((f) => `<rootDir>/src/takeoff/${f}`),
    })),
  ],
})
