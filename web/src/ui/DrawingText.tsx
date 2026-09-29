/*
 * A string from a drawing, shown as the drawing wrote it (docs/design/m0-screens.md §3): a sheet
 * number, revision mark, mark, grid label or file name is isolated left to right and marked
 * `data-notation`; a sheet or view title is isolated in its own direction, so a title in another
 * script neither reorders the sentence around it nor is forced left to right (§1.8). Cut with an
 * ellipsis, with the whole text as its tooltip, only when it does not fit.
 *
 * The web never decodes drawing text (§1.3: engine/text/decode.py does, before it is stored); in
 * development, a raw CAD code reaching this component is logged so the leak is found.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from './cn'
import { isolateLtr, isolateOwn, type NotationKind } from './notation'

export type DrawingTextKind = Extract<NotationKind, 'sheet-number' | 'revision' | 'mark' | 'grid' | 'file-name'> | 'title'

const RAW_CAD_CODE = /%%|\\P|\\f|\\S|\^J|\{\\/

export function DrawingText({
  text,
  kind,
  className,
  truncate = true,
}: {
  text: string
  kind: DrawingTextKind
  className?: string
  /** Cut with an ellipsis when it does not fit (default); off where the text may wrap. */
  truncate?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const [cut, setCut] = useState(false)

  if (import.meta.env.DEV && RAW_CAD_CODE.test(text)) {
    console.warn(`DrawingText was given a raw CAD code; decode it on the server (engine/text/decode.py): ${JSON.stringify(text)}`)
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !truncate) return
    const measure = () => setCut(el.scrollWidth > el.clientWidth + 0.5)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, truncate])

  const notation = kind !== 'title'
  return (
    <bdi
      ref={ref}
      dir={notation ? 'ltr' : 'auto'}
      data-notation={notation ? kind : undefined}
      title={cut ? (notation ? isolateLtr(text) : isolateOwn(text)) : undefined}
      className={cn(truncate ? 'inline-block max-w-full truncate align-bottom' : notation && 'whitespace-nowrap', className)}
    >
      {text}
    </bdi>
  )
}
