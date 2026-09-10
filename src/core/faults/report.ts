// ARCH-03: the one fault seam. Every non-refusal server-side failure crosses this file and is
// recorded — request id, actor, route, cause — before any user-facing mapping, so the operator
// sees the outage the user only feels (B-21). Re-deriving this anywhere else is a defect (ARCH-02).
// The id comes from the Web Crypto API, not `node:crypto`: this file is imported from the Edge
// instrumentation bundle and from Server Components, and `next build` warned on every gate run
// since inc-121 that a Node API is used in the Edge Runtime — a warning nobody read because the
// stage was green (Vextrus Builder v21 3.2). `globalThis.crypto` exists on Node ≥ 19 and on Edge.

/** What the operator reads. One fault, one record, every field always present. */
export interface FaultRecord {
  faultId: string;
  requestId: string;
  actor: string;
  route: string;
  cause: string;
  at: string;
}

/** Where records go. Swappable so a host can ship them; never so a tier can silence them. */
export type FaultSink = (record: FaultRecord) => void;

export interface FaultInput {
  requestId: string;
  actor: string;
  route: string;
  cause: unknown;
}

/** The default sink: one JSON line per fault on stderr — the operator's stream, not the user's. */
const defaultSink: FaultSink = (record) => {
  // The operator's stream where there is one (Node); the console's error channel where there is not
  // (the Edge Runtime has no `process.stderr`) — the record is written either way, never dropped.
  const line = JSON.stringify(record);
  // Reached through globalThis, never as the `process.stderr` token: the Edge bundler flags the
  // token itself at compile time, guard or no guard.
  const proc = (globalThis as { process?: { stderr?: { write?: (chunk: string) => unknown } } }).process;
  const write = proc?.stderr?.write;
  if (typeof write === "function") write.call(proc!.stderr, `${line}\n`);
  else console.error(line);
};

/**
 * ARCH-02 reads "one home" as an identity property, and a module-scope binding only holds it for as
 * long as the module instance does — a bundler that compiles this file into two graphs, or a module
 * runner that instantiates it twice under a racing first import, would leave the tier with two
 * sinks. Half the faults would then go to a sink the host swapped out, which is silence by
 * packaging accident. The one sink is therefore anchored to the process.
 */
const SINK_KEY = Symbol.for("vextrus.cubit.core.faults.sink");

const processScope = globalThis as typeof globalThis & { [SINK_KEY]?: { current: FaultSink } };

const held: { current: FaultSink } = (processScope[SINK_KEY] ??= { current: defaultSink });

/** Swap the sink, answering with the one replaced so a caller can always put it back. */
export function setFaultSink(next: FaultSink): FaultSink {
  const previous = held.current;
  held.current = next;
  return previous;
}

/**
 * Record one fault and answer with its id. The seam is the last line of defence, so it answers
 * rather than throws: a sink that is itself down must not become the failure the user sees
 * instead of the real one (ARCH-03).
 */
export function reportFault(input: FaultInput): { faultId: string; requestId: string } {
  const faultId = globalThis.crypto.randomUUID();
  const record: FaultRecord = {
    faultId,
    requestId: input.requestId,
    actor: input.actor,
    route: input.route,
    cause: describeCause(input.cause),
    at: new Date().toISOString(),
  };
  try {
    held.current(record);
  } catch {
    // A sink that throws is itself an outage, and an outage inside the seam may not propagate:
    // the caller's own failure is the one the tier is answering (ARCH-03).
  }
  return { faultId, requestId: input.requestId };
}

/**
 * The cause as one line the operator can read: an Error by name and message, anything else by
 * `String(x)`. A value whose own stringification throws still yields a record, never an exception.
 */
function describeCause(cause: unknown): string {
  try {
    if (cause instanceof Error) {
      const name = cause.name === "" ? "Error" : cause.name;
      return cause.message === "" ? name : `${name}: ${cause.message}`;
    }
    return String(cause);
  } catch {
    return "[a cause that could not be stringified]";
  }
}
