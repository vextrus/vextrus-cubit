/*
 * A field's error line (docs/design/system.md §7; m0-screens §3, ErrorBar: "field errors are a red edge
 * and a line under the field"): what is wrong with this field and what to do, from the catalogue or
 * the machine's sentence. Its field points at it with `aria-describedby` and is marked `aria-invalid`.
 * Renders nothing without a message.
 */
import type { ReactNode } from 'react'
import { cn } from './cn'

export function FieldError({ id, children, className }: { id?: string; children?: ReactNode; className?: string }) {
  if (children === null || children === undefined || children === false || children === '') return null
  return (
    <p id={id} data-field-error="" className={cn('text-xs text-destructive', className)}>
      {children}
    </p>
  )
}
