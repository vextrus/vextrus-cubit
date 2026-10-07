/*
 * The router and the query client (docs/design/m0-screens.md §4.1: "query and router set up").
 * TanStack Router's file routes (src/routes/; the tree is generated, never committed) with the
 * TanStack Query client in their context, so a route's loader ensures what its screen reads.
 */
import { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { ScreenError } from '@/auth'
import { routeTree } from '@/routeTree.gen'
import { mutationPolicy, queryPolicy } from './query-policy'

export interface RouterContext {
  queryClient: QueryClient
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // "This page keeps trying" (§4.1); the rule is app/query-policy.ts, the one place.
        ...queryPolicy,
        refetchOnWindowFocus: false,
      },
      mutations: { ...mutationPolicy },
    },
  })
}

export function createAppRouter({ queryClient, history }: { queryClient: QueryClient; history?: RouterHistory }) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    // A screen that throws is shown inside the frame; routes with a component of their own keep it.
    defaultErrorComponent: ScreenError,
    defaultPreload: 'intent',
    // The Query cache holds the data; the router re-runs loaders only to check access.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
