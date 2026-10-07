/*
 * Lingui's compile step writes `en.js` beside each catalogue, at any depth (takeoff has one folder per
 * screen area, S15-W0): git and ESLint must ignore them all, or `git add -A` commits build output.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const web = fileURLToPath(new URL('..', import.meta.url))

describe('compiled catalogues are ignored at any depth', () => {
  it('git ignores src/<feature>/locales/en.js and src/<feature>/locales/<area>/en.js', () => {
    for (const path of ['src/takeoff/locales/en.js', 'src/takeoff/locales/words/en.js']) {
      const run = spawnSync('git', ['check-ignore', '--quiet', path], { cwd: web })
      expect(run.status, `${path} is ignored by git`).toBe(0)
    }
  })

  it('ESLint ignores them too', () => {
    expect(readFileSync(`${web}eslint.config.js`, 'utf8')).toContain("'**/locales/**/*.js'")
  })
})
