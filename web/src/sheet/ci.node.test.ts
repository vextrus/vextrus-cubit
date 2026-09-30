/*
 * The web's checks run when the engine's renderer changes (review of 122): the pixel checks compare
 * the viewer with the engine's rasters, so an engine PR that changes the raster must run them.
 */
import { describe, expect, it } from 'vitest'
import workflow from '../../../.github/workflows/web.yml?raw'

/** The `changes` job's path pattern: the `grep -E '…'` that decides whether the web job runs. */
function pattern(): RegExp {
  const found = /touched=\$\(grep -E '([^']+)'/.exec(workflow)
  if (!found) throw new Error('web.yml: no `touched=$(grep -E …)` in the changes job')
  return new RegExp(found[1]!)
}

describe('the web workflow’s path filter', () => {
  it.each([
    'engine/render/raster.py',
    'engine/render/buffers.py',
    'engine/render/fixtures/make.py',
    'engine/render/fixtures/tiny-sheet-text@4.png',
  ])('runs the web checks when %s changes', (path) => {
    expect(pattern().test(path)).toBe(true)
  })

  it('still skips them for an engine change outside the renderer', () => {
    expect(pattern().test('engine/read/dwg.py')).toBe(false)
  })
})
