/*
 * A range of sheet numbers, "S-01–S-13", as ONE left-to-right isolate (m0-screens §1.8; the design
 * gate's M10): isolating each number on its own lets a right-to-left language read the range backwards
 * ("S-13–S-01"), and it never wraps inside ("S-01–S-\n12"). `web/scripts/notation-ranges.test.ts` refuses the split form.
 */
import { DrawingText } from '@/ui'

export function SheetRange({ first, last }: { first: string; last: string }) {
  return <DrawingText kind="sheet-number" text={`${first}–${last}`} truncate={false} className="whitespace-nowrap" />
}
