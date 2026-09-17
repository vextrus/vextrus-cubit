/**
 * The stage J-030's documents walk stands on (test contract: `stageDocuments`, `stageBareProject`).
 *
 * Mechanics only — nothing here judges the product. The project is made through the shipped screen by
 * `stageBareProject`, and the two issues are written in-process through the store's OWN writer,
 * `storeDocument`, over the journey lane's database and the served product's storage root: the same
 * shape `src/app/api/documents/__tests__/route.db.test.ts` stages, for the same reason. The PDF bytes
 * are a stand-in — a `%PDF` head and an `%%EOF` tail — because what is under proof here is the
 * SCREEN, not the renderer, and a typst run in a Playwright worker would buy the walk nothing.
 *
 * Issuing from a screen is this increment's out-of-scope, so there is no door to click: the stage
 * installs what a reader is meant to find, exactly as the schedules stage installs a partitioned
 * drawing (AM-09 §2 — a fixture the lane installs, never a leg of the journey).
 *
 * Two orderings matter, as they do for every stage of this lane: `DATABASE_URL` is pointed at the
 * journeys' database BEFORE any product module opens a pool, and the storage root is left exactly as
 * the served product resolves it, so the bytes this writes are the bytes that server serves.
 */
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { stageBareProject } from "../takeoff/schedules-stage";
import { e2eDatabaseUrl } from "../support/scratch-db";
import { heldAttribute } from "../support/retrying-read";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

/** The journeys' own database, stated before a product module opens a pool. */
process.env["DATABASE_URL"] = e2eDatabaseUrl();

/** The one stage a bare project is made by, re-exported so this journey has a single import. */
export { stageBareProject };

/** The kind both issues are (the one SEAM-DOC ships today — inc-300a's proof document). */
export const PROOF_KIND = "proof";

/** The taxonomy every issue of this lane is recorded under. */
const TAXONOMY_VERSION = "taxonomy-2026-03";

/** The renderer pin a stored document records — a pin, not a run: no typst is asked for here. */
const RENDERER_PIN = `typst 0.15.1 ${"e".repeat(64)}`;

/** One issued document, as the stage wrote it and as the store will list it. */
export interface StagedDocument {
  readonly id: string;
  readonly kind: string;
  readonly version: number;
  readonly sha256: string;
  readonly actIds: readonly string[];
  readonly supersededBy: string | null;
}

/** What a staged documents list is, as this journey addresses it (test contract). */
export interface StagedDocuments {
  readonly tenantId: string;
  readonly projectId: string;
  readonly issuedBy: string;
  /** The store's own answer, newest first — never an order this file arranged. */
  readonly documents: readonly StagedDocument[];
}

/** Import a product module by repo-relative path, saying which file is missing when one is. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(process.cwd(), relative);
  if (!existsSync(absolute)) throw new Error(`${relative} is missing from the checkout — the product does not provide it yet`);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** The signed-in person, as the shell states them. */
async function userIdOf(page: Page): Promise<string> {
  const userId = await heldAttribute(page.locator(testIdSelector(TESTIDS.shell.user)), "data-user-id");
  expect(userId, "the journey is signed in, so the shell names the person acting").toBeTruthy();
  return userId as string;
}

interface Listing {
  id: string;
  kind: string;
  version: number;
  sha256: string;
  issuedBy: string;
  supersededBy: string | null;
}

interface StoreModule {
  storeDocument(deps: { tx: unknown; storage: unknown }, rendered: unknown, issue: Record<string, unknown>): Promise<{ id: string }>;
  listDocuments(tx: unknown, projectId: string): Promise<readonly Listing[]>;
}

/**
 * A project of the signed-in workspace holding two issues of one kind: version 1, then the version 2
 * that supersedes it, each citing one act of its own.
 */
export async function stageDocuments(page: Page, options: { label?: string } = {}): Promise<StagedDocuments> {
  const label = options.label ?? "documents";
  const { tenantId, projectId } = await stageBareProject(page, { label });
  const issuedBy = await userIdOf(page);

  const db = await productModule<{ forTenant: (scope: { tenantId: string }) => { transaction: <T>(body: (tx: unknown) => Promise<T>) => Promise<T> } }>("src/core/db.ts");
  const app = await productModule<{ appStorage: () => unknown }>("src/core/storage/app.ts");
  const store = await productModule<StoreModule>("src/core/documents/store.ts");
  const storage = app.appStorage();

  const cited = new Map<string, readonly string[]>();
  for (const issue of [1, 2]) {
    const pdf = new Uint8Array(Buffer.from(`%PDF-1.7\nthe ${PROOF_KIND} ${label} issue ${issue} ${randomUUID()}\n%%EOF\n`, "utf8"));
    const actIds = [randomUUID()];
    const written = await db.forTenant({ tenantId }).transaction((tx) =>
      store.storeDocument(
        { tx, storage },
        {
          kind: PROOF_KIND,
          pdf,
          sha256: createHash("sha256").update(pdf).digest("hex"),
          payloadDigest: createHash("sha256").update(`${label} payload ${issue}`).digest("hex"),
          rendererPin: RENDERER_PIN,
          fontHashes: { "spline-sans-regular.ttf": "f".repeat(64) },
        },
        { tenantId, projectId, issuedBy, taxonomyVersion: TAXONOMY_VERSION, actIds },
      ),
    );
    cited.set(written.id, actIds);
  }

  // The roster the journey asserts against is the STORE's answer, read back in its own order, so the
  // walk can never be measured against an order this file arranged (B-19).
  const listings = await db.forTenant({ tenantId }).transaction((tx) => store.listDocuments(tx, projectId));
  expect(listings.length, `the stage issued two documents of this project: ${JSON.stringify(listings.map((one) => one.id))}`).toBe(2);

  return {
    tenantId,
    projectId,
    issuedBy,
    documents: listings.map((listing) => ({
      id: listing.id,
      kind: listing.kind,
      version: listing.version,
      sha256: listing.sha256,
      actIds: cited.get(listing.id) ?? [],
      supersededBy: listing.supersededBy ?? null,
    })),
  };
}
