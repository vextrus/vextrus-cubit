/**
 * The per-table probes the V-DB suite exercises (R-SPINE-004, Q-02).
 *
 * AC-2 discovers the tables from information_schema and refuses to pass over one it cannot
 * exercise. That refusal is only useful if registering a table is something a later
 * increment can actually do, so the registry is a directory rather than a list: a
 * module-founding increment that adds a tenant-carrying table drops
 * `db/__tests__/probes/<module>.ts` beside this file, default-exporting its tables, and the
 * enumeration turns green again on evidence rather than on an edit to somebody else's test.
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ScopedHandle } from '../support/seam';

export interface TableProbe {
  /** The column the policy scopes on — `tenant_id`, or `id` on `tenants` itself. */
  readonly scopeColumn: string;
  /** A row belonging to the given tenant, written under system scope. */
  readonly seed: (system: ScopedHandle, tenantId: string) => Promise<void>;
  /** The write a tenant must never make: this row belongs to somebody else. */
  readonly crossTenantInsert: (scoped: ScopedHandle, otherTenantId: string) => Promise<unknown>;
}

/** A probe file default-exports its tables, keyed by the table name in `public`. */
export type ProbeModule = Record<string, TableProbe>;

const HERE = dirname(fileURLToPath(import.meta.url));

export async function probes(): Promise<Map<string, TableProbe>> {
  const registered = new Map<string, TableProbe>();
  for (const name of readdirSync(HERE).sort()) {
    if (!name.endsWith('.ts') || name === 'index.ts') continue;
    const loaded = (await import(pathToFileURL(join(HERE, name)).href)) as {
      default?: ProbeModule;
    };
    for (const [table, probe] of Object.entries(loaded.default ?? {})) {
      registered.set(table, probe);
    }
  }
  return registered;
}
