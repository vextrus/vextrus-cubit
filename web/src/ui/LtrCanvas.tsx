/*
 * The canvas's frame (docs/design/m0-screens.md §1.8; ADR 0038): fixed left to right and never
 * mirrored, whatever the page's language. The sheet canvas, its thumbnails and outline chips (16),
 * and from M1 the 3D canvas, mount inside it; the chrome around it mirrors. Radix primitives inside
 * it read left to right too. Code inside it may use physical positions (the logical-CSS lint exempts
 * <LtrCanvas> subtrees and files under a `canvas/` folder).
 */
import type { HTMLAttributes } from 'react'
import { Direction } from 'radix-ui'
import { cn } from './cn'

export function LtrCanvas({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Direction.Provider dir="ltr">
      <div {...rest} dir="ltr" data-ltr-canvas="" className={cn('relative isolate transform-none', className)}>
        {children}
      </div>
    </Direction.Provider>
  )
}
