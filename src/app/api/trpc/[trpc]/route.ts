/**
 * `/api/trpc/*` — the whole API, mounted (R-SPINE-004).
 *
 * One handler for every procedure: tRPC's fetch adapter resolves the path after the endpoint
 * against `appRouter`, and builds the context for each request with `createContext`, which is
 * where the session and the tenant are established. Nothing is authenticated here, because
 * nothing that reaches a procedure got past that.
 *
 * `force-dynamic` for the same reason `/api/auth/*` has it: the answer depends on the request's
 * own cookies and its `x-cubit-tenant` header, so it can never be cached (B-03).
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createContext } from '../../../../server/context';
import { appRouter } from '../../../../server/root';

export const dynamic = 'force-dynamic';

const ENDPOINT = '/api/trpc';

function handle(request: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: request,
    router: appRouter,
    createContext,
  });
}

export function GET(request: Request): Promise<Response> {
  return handle(request);
}

export function POST(request: Request): Promise<Response> {
  return handle(request);
}
