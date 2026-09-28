/*
 * The addresses the shell links to (docs/design/m0-screens.md §4.1, "Routes"). Some are other
 * tickets' routes (20a: /projects, /members, /sign-in; 20b: the Drawing Set; 22: Step 1's own screen),
 * which may not exist in the route tree yet, so the shell names them here and links through AppLink
 * rather than through the route tree's types. An address with no route shows "Page not found".
 */
import type { ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'

export const PATHS = {
  projects: '/projects',
  members: '/members',
  signIn: '/sign-in',
  drawingSet: (code: string) => `/p/${encodeURIComponent(code)}/drawing-set`,
  takeoff: (code: string, step: number) => `/p/${encodeURIComponent(code)}/takeoff/${step}`,
} as const

type AnyPath = '/'

export function AppLink({
  to,
  className,
  children,
  ...rest
}: {
  to: string
  className?: string
  children: ReactNode
  'aria-current'?: 'page' | undefined
  onClick?: () => void
}) {
  // The route tree's types know only the routes built so far; see above.
  return (
    <Link to={to as AnyPath} className={className} {...rest}>
      {children}
    </Link>
  )
}

/** Navigates to an address in PATHS. */
export function useGo(): (to: string) => void {
  const navigate = useNavigate()
  return (to) => void navigate({ to: to as AnyPath })
}
