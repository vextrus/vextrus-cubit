/*
 * The root route: the query client travels in the router's context (src/app/router.ts), and an
 * address nothing matches shows "Page not found" inside the frame (docs/design/m0-screens.md §4.1).
 * Routes hold no words (eslint.config.js).
 */
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { RouterContext } from '@/app/router'
import { NotFoundInFrame } from '@/app/routes'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFoundInFrame,
})
