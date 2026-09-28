/*
 * The machine's catalogues (docs/plans/M0.md, "Messages"; the reviews A5, R7). Every sentence the
 * backend or the engine writes reaches the web as `{code, params}`; each backend ticket words its own
 * codes in `src/messages/<module>/<submodule>/en.po` (msgid: the code; msgstr: the English ICU
 * message), one catalogue per submodule so two tickets never share a file.
 *
 * These catalogues are worded by hand and never extracted (nothing in the web's code names a code as
 * a literal), so this config is used only to compile them strictly: an empty English msgstr fails.
 */
import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

/** The 12 Django modules (docs/plans/M0.md, "The shape of M0's code") and the engine. */
export const MESSAGE_MODULES = [
  'platform',
  'projects',
  'drawings',
  'live_model',
  'takeoff',
  'measurement',
  'rates',
  'boq',
  'revisions',
  'summary',
  'exports',
  'assistant',
  'engine',
] as const

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en'],
  format: formatter({ lineNumbers: false, origins: false, explicitIdAsDefault: true }),
  orderBy: 'messageId',
  catalogs: MESSAGE_MODULES.map((module) => ({
    path: `<rootDir>/src/messages/${module}/{name}/{locale}`,
    include: [`<rootDir>/src/messages/${module}/{name}/`],
  })),
})
