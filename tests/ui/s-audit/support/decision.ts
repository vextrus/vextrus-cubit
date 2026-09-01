/**
 * Acceptance support for S-Audit's public set (inc-016-audit-surfaces).
 *
 * Nothing here transcribes the screen's copy. `docs/design/s-audit.md` is the committed contract
 * this increment ships, and its §3 spells every key and its wording verbatim — so the expected copy
 * is DERIVED from that section rather than restated in a test file. A later increment that lawfully
 * re-words a line under B-20 re-words the Decision, and these tests follow it instead of freezing
 * the wording of the day they were written (B-19).
 *
 * The ten test ids are the closed contract of C-05 (Increment Spec "testids", Decision §7): they are
 * spelled here because they are the acceptance's own vocabulary, not a roster that grows.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout these tests run against. */
export const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The homes the Increment Spec's interfaces and the Decision §1 name. */
export const ROUTE_DIR = "src/app/(app)/t/[tenant]/p/[project]/audit";
export const AUDIT_MODULE = "src/modules/spine/audit/index.ts";
export const PAGE_MODULE = `${ROUTE_DIR}/page.tsx`;
export const EXPLORER_MODULE = `${ROUTE_DIR}/act-log-explorer.tsx`;
export const STRINGS_MODULE = `${ROUTE_DIR}/strings.ts`;
export const STATES_MODULE = `${ROUTE_DIR}/states.ts`;
export const DESIGN_DECISION = "docs/design/s-audit.md";

/** The screen's route, as the test contract spells it. */
export const AUDIT_ROUTE = "/t/[tenant]/p/[project]/audit";

/** C-05's closed set of hooks for this screen. */
export const TESTID = {
  acts: "audit-acts",
  actRow: "audit-act-row",
  consequence: "audit-act-consequence",
  evidence: "audit-act-evidence",
  empty: "audit-acts-empty",
  filterType: "audit-filter-type",
  filterActor: "audit-filter-actor",
  filterSubject: "audit-filter-subject",
  panelModelLedger: "audit-panel-model-ledger",
  panelJobs: "audit-panel-jobs",
} as const;

/** The two data attributes a row carries, and the one a panel carries (test contract). */
export const ATTR_ACT_TYPE = "data-act-type";
export const ATTR_ACTOR_ID = "data-actor-id";
export const ATTR_ARMED = "data-armed";

/** One act, as `getAuditSurfaces` answers it and as `ActLogExplorer` takes it (test contract). */
export interface AuditAct {
  readonly actId: string;
  readonly actType: string;
  readonly actorId: string;
  readonly actorLabel: string;
  readonly subjects: readonly string[];
  readonly consequenceDigest: string;
  readonly occurredAt: Date;
}

/**
 * Import a product module by repo-relative path, asserting it exists first — so a module the
 * Builder has not written yet fails as an assertion naming the file rather than as an unreadable
 * resolution error (the idiom tests/server/support/wire.ts already established).
 */
export async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** A file of the checkout, read as text — for the claims that are about the tree rather than a run. */
export function sourceOf(relative: string): string {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return readFileSync(abs, "utf8");
}

/** Whitespace inside a Decision line is markdown wrapping, never copy. */
function collapsed(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * The copy the Decision fixes, read out of `docs/design/s-audit.md` §3 — `key` **wording** pairs,
 * bounded to that section so a key merely MENTIONED in the layout section cannot masquerade as copy.
 */
export function decisionCopy(): Readonly<Record<string, string>> {
  const document = sourceOf(DESIGN_DECISION);
  const opens = document.indexOf("## 3.");
  const closes = document.indexOf("## 4.", opens + 1);
  expect(opens, `${DESIGN_DECISION} must carry a "## 3." copy section — it is where the screen's wording is ruled`).toBeGreaterThan(-1);
  expect(closes, `${DESIGN_DECISION}'s copy section must be closed by "## 4."`).toBeGreaterThan(opens);

  const section = document.slice(opens, closes);
  const pairs: Record<string, string> = {};
  for (const match of section.matchAll(/`(audit_[A-Za-z0-9_]+)`\s*\*\*([^*]+)\*\*/g)) {
    const key = match[1] ?? "";
    pairs[key] = collapsed(match[2] ?? "");
  }
  expect(
    Object.keys(pairs).length,
    `no \`audit_key\` **copy** pairs could be read out of ${DESIGN_DECISION} §3 — the acceptance derives the screen's wording from the Decision rather than restating it`,
  ).toBeGreaterThan(0);
  return pairs;
}

/**
 * The screen's typed string table (C-SPINE-PLATFORM, Decision I-24): the one export of
 * `strings.ts` that is a record of `audit_`-keyed English strings. Found by its shape rather than
 * by a name the contract never fixes — `rulesetStrings` is the precedent, but the identifier is the
 * Builder's to choose.
 */
export async function stringsTable(): Promise<Readonly<Record<string, string>>> {
  const module = await productModule<Record<string, unknown>>(STRINGS_MODULE);
  const tables = Object.values(module).filter((value): value is Record<string, string> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length > 0 && entries.every(([key, held]) => key.startsWith("audit_") && typeof held === "string");
  });
  expect(
    tables.length,
    `${STRINGS_MODULE} must export this screen's typed string table — a record of audit_-keyed English strings (C-SPINE-PLATFORM, Decision I-24). Exports found: ${Object.keys(module).join(", ") || "none"}`,
  ).toBeGreaterThan(0);
  return Object.assign({}, ...tables) as Record<string, string>;
}

/** A fixture act. Every field is the caller's, so no case leans on another's values. */
export function act(over: Partial<AuditAct> & Pick<AuditAct, "actId">): AuditAct {
  return {
    actType: "ASSIGN_PARTICIPANT_ROLE",
    actorId: "11111111-1111-4111-8111-111111111111",
    actorLabel: "Farhana Rahman",
    subjects: ["22222222-2222-4222-8222-222222222222"],
    consequenceDigest: "0".repeat(64),
    occurredAt: new Date(2026, 6, 14, 10, 30, 0),
    ...over,
  };
}
