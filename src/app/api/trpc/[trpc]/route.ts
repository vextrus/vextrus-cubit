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
    // R-SPINE-001: a door that hands out or ends a session puts the cookie on the context, and the
    // transport is the one place it becomes a header. Doing it here rather than in a procedure keeps
    // every door free of the wire, and keeps `Set-Cookie` written exactly once per response.
    responseMeta: ({ ctx }) => {
      const cookies = ctx?.cookies ?? [];
      if (cookies.length === 0) return {};
      const headers = new Headers();
      for (const cookie of cookies) headers.append("set-cookie", cookie);
      return { headers };
    },
  });
}

export { handler as GET, handler as POST };
