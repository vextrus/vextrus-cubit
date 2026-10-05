/*
 * Step 1's address for one printed sheet (#118's "Open in Step 1" on the Drawing Set's report): Step 1
 * opens in sheet mode on it; an id Step 1 does not list opens the list. And for a held file's Question
 * (#327's "Open the Question" on the Drawing Set's row): Step 1 opens on that Question's row, or on the
 * file's report once it is answered; an id with no such Question opens the list.
 */
import { PATHS } from '@/app/AppLink'

export function step1SheetPath(code: string, sheetId: string): string {
  return `${PATHS.takeoff(code, 1)}?sheet=${encodeURIComponent(sheetId)}`
}

export function step1FilePath(code: string, fileId: string): string {
  return `${PATHS.takeoff(code, 1)}?file=${encodeURIComponent(fileId)}`
}
