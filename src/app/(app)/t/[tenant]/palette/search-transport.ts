// `spine.search` as a browser reaches it: one GET against the tRPC mount, and the answer or the
// failure that came back (the identity lane's shape, `src/app/(auth)/transport.ts`).
//
// A failure is re-thrown carrying the envelope's own `data` — the shape src/server/trpc.ts stamps
// with which of ARCH-03's answers it is — so the screen decides between a refusal and a fault from
// what the server decided, never from a status code or a message it re-reads.

/** The mount, and the procedure under it: `src/app/api/trpc/[trpc]/route.ts` serves this address. */
const ADDRESS = "/api/trpc/spine.search";

/** What the search is asked, and what it answers (docs/design/command-palette.md §7). */
export interface SearchInput {
  tenantId: string;
  query: string;
}

/** One thing the workspace holds that the query named (R-SPINE-050's four kinds). */
export interface SearchHit {
  kind: "project" | "drawing" | "sheet" | "set";
  label: string;
  projectId: string;
  drawingId?: string;
  setId?: string;
  layoutName?: string;
}

export interface SearchAnswer {
  hits: readonly SearchHit[];
}

/** The envelope tRPC answers with: a result, or the error the formatter shaped (src/server/trpc.ts). */
interface Envelope {
  result?: { data?: unknown };
  error?: { message?: string; data?: unknown };
}

/**
 * The answer, or the failure as this tier must see it. `data` travels onto the thrown value so the
 * refusal code or the fault id survives the throw; nothing else of the envelope does, because a
 * fault's internals belong on the sink and never on a screen (ARCH-03).
 */
export async function searchWorkspace(input: SearchInput): Promise<SearchAnswer> {
  const address = `${ADDRESS}?input=${encodeURIComponent(JSON.stringify(input))}`;
  const response = await fetch(address, { method: "GET", credentials: "same-origin" });
  const body = await response.text();
  let envelope: Envelope;
  try {
    envelope = JSON.parse(body) as Envelope;
  } catch {
    // A body that is not the tRPC envelope is still a server that answered: it is a fault carrying
    // no id to quote, never the unreachable reading a person would check their connection over.
    throw Object.assign(new Error(`the server answered ${response.status} with a body that is not a tRPC envelope`), {
      data: { kind: "fault", faultId: null },
    });
  }
  const failure = envelope.error;
  if (failure !== undefined) throw Object.assign(new Error(failure.message ?? ""), { data: failure.data });
  const answered = envelope.result?.data as { hits?: unknown } | undefined;
  return { hits: Array.isArray(answered?.hits) ? (answered.hits as SearchHit[]) : [] };
}
