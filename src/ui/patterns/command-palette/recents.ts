// I-141: recents are this browser's, per workspace. They are the palette's memory of where a person
// went from it — kept newest first, deduplicated by address, and answered only to a blank query,
// because with a query typed the list is answering the query.
//
// Storage that throws or is unavailable simply yields no recents: a browser with storage denied is
// not a fault and not a refusal, and a person still gets every other group (R-UI-050's offline
// register — the palette degrades, it does not fail).
import type { PaletteRow } from "./types";

/** How many the palette keeps. Stated once; every surface and its acceptance read it here (B-19). */
export const RECENT_LIMIT = 8;

/** Where one workspace's recents live. Keyed per workspace: another tenant's rows are not yours. */
export function RECENT_STORAGE_KEY(tenantId: string): string {
  return `cubit.palette.recents.${tenantId}`;
}

/** What is stored per row: the words it showed and the address it led to, and nothing else. */
interface StoredRecent {
  readonly key: string;
  readonly kind: string;
  readonly label: string;
  readonly meta: string | null;
  readonly href: string;
}

/** The store, or null where the browser has none (a server render, or storage denied). */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** One stored row, read defensively: what a previous release wrote is not this release's type. */
function storedRowOf(value: unknown): StoredRecent | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Partial<StoredRecent>;
  if (typeof row.key !== "string" || typeof row.kind !== "string") return null;
  if (typeof row.label !== "string" || typeof row.href !== "string" || row.href === "") return null;
  return { key: row.key, kind: row.kind, label: row.label, meta: typeof row.meta === "string" ? row.meta : null, href: row.href };
}

/** This workspace's stored rows, newest first, never more than the cap. */
function storedRecents(tenantId: string): StoredRecent[] {
  const store = storage();
  if (store === null) return [];
  try {
    const raw = store.getItem(RECENT_STORAGE_KEY(tenantId));
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(storedRowOf).filter((row): row is StoredRecent => row !== null).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/** The rows the recent group renders, newest first (I-141). */
export function readRecents(tenantId: string): readonly PaletteRow[] {
  return storedRecents(tenantId).map((row) => ({
    key: row.key,
    group: "recent" as const,
    kind: row.kind,
    label: row.label,
    meta: row.meta,
    href: row.href,
  }));
}

/**
 * Remember a chosen row for this workspace, newest first and deduplicated by address — the same
 * place chosen twice is one recent, not two — and answer the rows as they now stand, so the caller
 * never re-reads what it just wrote.
 */
export function rememberRecent(tenantId: string, row: PaletteRow): readonly PaletteRow[] {
  const href = row.href ?? "";
  if (href === "") return readRecents(tenantId);

  const kept: StoredRecent[] = [
    { key: row.key, kind: row.kind, label: row.label, meta: row.meta ?? null, href },
    ...storedRecents(tenantId).filter((stored) => stored.href !== href),
  ].slice(0, RECENT_LIMIT);

  const store = storage();
  if (store !== null) {
    try {
      store.setItem(RECENT_STORAGE_KEY(tenantId), JSON.stringify(kept));
    } catch {
      // A browser that will not store is a browser with no recents, never a failure of the palette.
    }
  }
  return readRecents(tenantId);
}
