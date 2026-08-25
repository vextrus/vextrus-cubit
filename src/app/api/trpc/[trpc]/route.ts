// The tRPC mount. The handler is thin on purpose (SEAM-ACT): it mints the context, serves the one
// composed router, and hands every failure to the one fault seam through `trpcOnError` (ARCH-03).
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "../../../../server/context";
import { appRouter, trpcOnError } from "../../../../server/root";

const ENDPOINT = "/api/trpc";

function handler(req: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req,
    router: appRouter,
    createContext: (opts) => createContext({ req: opts.req }),
    onError: trpcOnError,
  });
}

export { handler as GET, handler as POST };
