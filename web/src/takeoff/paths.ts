/*
 * Step 1's address for one printed sheet (Jump to's, and the one form `?sheet=` is written in): Step 1 opens
 * in sheet mode on it; a value Step 1 does not list opens the list. The sheet's number when no other sheet
 * of the project has it, the sheet's id only for copies sharing a number. (The Drawing Set's "Open in Step 1"
 * is a file's act and addresses no sheet.)
 */
import { PATHS } from '@/app/AppLink'

interface Addressable {
  sheet_id: string
  number?: string | null
}

/** What `?sheet=` holds for `sheet`: its number where that is unique among `sheets`, else its id. */
export function sheetAddress(sheet: Addressable, sheets: readonly Addressable[]): string {
  const number = sheet.number
  if (!number) return sheet.sheet_id
  const same = new Set(sheets.filter((o) => o.number === number).map((o) => o.sheet_id))
  same.add(sheet.sheet_id)
  return same.size === 1 ? number : sheet.sheet_id
}

/** Step 1's address for a sheet known only by its id (the id always works). */
export function step1SheetPath(code: string, sheetId: string): string {
  return `${PATHS.takeoff(code, 1)}?sheet=${encodeURIComponent(sheetId)}`
}

/** Step 1's address for `sheet` among the project's `sheets`: by number where that is unique, else by id. */
export function step1AddressFor(code: string, sheet: Addressable, sheets: readonly Addressable[]): string {
  return step1SheetPath(code, sheetAddress(sheet, sheets))
}
