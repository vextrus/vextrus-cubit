/* The router's search rule (app/router.ts). */
import { defaultParseSearch, defaultStringifySearch } from '@tanstack/react-router'

/**
 * The router parses every search value as JSON, so `?sheet=1.10` reads back as the number 1.1 and "2.0" as 2. A sheet's
 * number is text (Step 1's `?sheet=`, written by Step 1, Jump to and the Drawing Set's links): `sheet` is read and written
 * as typed, whatever it looks like; every other value keeps the router's own rule.
 */
export function parseSearch(searchStr: string): Record<string, unknown> {
  const search = defaultParseSearch(searchStr)
  const sheet = new URLSearchParams(searchStr).get('sheet')
  return sheet === null ? search : { ...search, sheet }
}

export function stringifySearch(search: Record<string, unknown>): string {
  const { sheet, ...rest } = search
  if (typeof sheet !== 'string') return defaultStringifySearch(search)
  const others = defaultStringifySearch(rest)
  const own = `sheet=${encodeURIComponent(sheet)}`
  return others ? `${others}&${own}` : `?${own}`
}
