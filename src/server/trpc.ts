/**
 * The tRPC layer's founding, and the reason it has exactly four exports (R-SPINE-004, L-ACT-02).
 *
 * The `initTRPC` instance below never leaves this file. That is the security property, not a
 * tidiness one: a bare instance in scope anywhere else is a `t.procedure` whose context is
 * whatever the caller says, and a procedure whose context is not `TenantCtx` is a procedure
 * that can reach a database handle SEAM-TENANT never scoped. Because `createContext` itself
 * authenticates and resolves the tenant (src/server/context.ts), the *base* context of this
 * instance already is `TenantCtx` — so `tenantProcedure` needs no middleware to be tenant-
 * scoped, and there is no public procedure for one to be a narrowing of.
 *
 * No transformer is configured (B-03: "no cache that can lie", and the test contract's
 * "JSON-plain"): `result.data` on the wire is the value the resolver returned, not an envelope
 * some client has to be taught to open.
 */
import { createHash } from 'node:crypto';
import { initTRPC } from '@trpc/server';
import type { TenantCtx } from './context';

const t = initTRPC.context<TenantCtx>().create();

/** Composes procedures and sub-routers into a router — tRPC's own factory, bound to this root. */
export const router = t.router;

/**
 * The only procedure builder in the tree. Its `ctx` is a `TenantCtx`, so `ctx.db` is the handle
 * `forTenant` minted for the request's tenant and nothing in a resolver can widen that.
 */
export const tenantProcedure = t.procedure;

/** What `t.router` accepts as one entry — a procedure, a sub-router, or a nested record. */
type RouterEntry = Parameters<typeof t.router>[0][string];

/**
 * L-ACT-02's shape, made the only shape: an act type is a *pair*, so the sub-router mounted
 * for it is built from a required `preview` and a required `commit` and carries nothing else.
 * A half-declared act is a type error rather than an endpoint somebody can call.
 */
export function actPair<TPreview extends RouterEntry, TCommit extends RouterEntry>(pair: {
  preview: TPreview;
  commit: TCommit;
}) {
  return t.router({ preview: pair.preview, commit: pair.commit });
}

/**
 * A deterministic fingerprint of a Consequence — equal Consequences give equal digests, and a
 * Consequence computed from moved state does not.
 *
 * `JSON.stringify` alone would not do: its key order is insertion order, so the same Consequence
 * assembled by two code paths could digest differently and refuse a commit that carried the
 * truth. The serialisation below is canonical — keys sorted, `undefined` members dropped — and
 * the hash over it is SHA-256, which nothing here needs to be reversible.
 */
export function consequenceDigest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

/** The canonical serialisation the digest is taken over. */
function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, member]) => member !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : 1));
  return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonical(member)}`).join(',')}}`;
}
