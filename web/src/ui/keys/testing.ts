/* eslint-disable lingui/no-unlocalized-strings -- test failure messages for developers, never shown in the UI */
/*
 * For each screen's tests (03, 16, 20a, 20b, 22): render the screen on the seed inside a
 * `KeyMapProvider` whose map you hold, then call `expectKeyMapSound(map)`. It fails on two bindings
 * for one key in one scope and on a binding without a label (m0-screens §2.1 and §8, item 2), even
 * where the map was built non-strict.
 */
import type { KeyMap } from './registry'

export function keyMapProblems(map: KeyMap): string[] {
  const problems: string[] = []
  const seen = new Map<string, string>()
  for (const b of map.all()) {
    const where = `${b.scope.level} "${b.scope.name}"`
    if (!b.label.trim()) problems.push(`${b.combo} in ${where} has no label`)
    const slot = `${b.scope.id}\u0000${b.combo}`
    const first = seen.get(slot)
    if (first !== undefined) problems.push(`${b.combo} is bound twice in ${where}: "${first}" and "${b.label}"`)
    else seen.set(slot, b.label)
  }
  return problems
}

export function expectKeyMapSound(map: KeyMap): void {
  const problems = keyMapProblems(map)
  if (problems.length) throw new Error(`The key map is not sound:\n- ${problems.join('\n- ')}`)
}
