/*
 * The router and the query client (docs/design/m0-screens.md §4.1: "query and router set up").
 * TanStack Router's file routes (src/routes/; the tree is generated, never committed) with the
 * TanStack Query client in their context, so a route's loader ensures what its screen reads.
 */
import { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'

export interface RouterContext {
  queryClient: QueryClient
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // "This page keeps trying" (§4.1): a query that cannot reach the server retries, and the
        // frame's ErrorBar shows until one succeeds.
        retry: (failures, error) => error instanceof TypeError || failures < 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
        refetchOnWindowFocus: false,
      },
    },
  })
}

export function createAppRouter({ queryClient, history }: { queryClient: QueryClient; history?: RouterHistory }) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
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
