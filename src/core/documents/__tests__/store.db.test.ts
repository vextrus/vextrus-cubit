/**
 * AC-4: THE DOCUMENTS TABLE — a rendered document is stored content-addressed through
 * SEAM-STORAGE and recorded in the docs shard with everything it was rendered under, each issue
 * superseding the last (R-SPINE-040, SEAM-STORAGE, L-FMT-03, AM-11).
 *
 * Live, against a scratch database the committed migrations built: the row is read back with SQL
 * through psql, never through the writer's own reader, so a column the seam silently dropped is a
 * failure here and not a round trip that agrees with itself. The account and the workspace are made
 * through the product's own sign-up door, because `issued_by` points at a real user.
 *
 * Nothing renders here: `storeDocument` takes a RenderedDocument, so the bytes are built in the
 * test and the subprocess stays out of the database lane.
 *
 * The drift lane's own green is the drift lane's (db/__tests__); what this suite asks of the
 * registries is that the table is reachable where AM-11's split says it is.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, SEED_REASON, TENANT_ALPHA } from "../../../../db/__tests__/support/fixtures";
import { lit, psql, run, scalar, seedTenants } from "../../../../db/__tests__/support/live-sql";
import { inTree, productModule } from "../../../../tests/docs/support/product";
import type { RenderedDocument } from "../../../../tests/docs/support/seam";
import { closePools, forTenant, type TenantTx } from "../../db";

/** What a document is issued under, beside the payload it was rendered from (R-SPINE-040). */
type Issue = { tenantId: string; projectId: string; issuedBy: string; taxonomyVersion: string; actIds: readonly string[] };

type Storage = { put(tenantId: string, bytes: Uint8Array): Promise<{ sha256: string }>; get(tenantId: string, sha256: string): Promise<Uint8Array | null> };

type DocumentListing = {
  id: string;
  kind: string;
  version: number;
  sha256: string;
  issuedBy: string;
  actIds: readonly string[];
  supersededBy: string | null;
};

type StoreModule = {
  storeDocument(deps: { tx: TenantTx; storage: Storage }, rendered: RenderedDocument, issue: Issue): Promise<{ id: string; version: number }>;
  listDocuments(tx: TenantTx, projectId: string): Promise<readonly DocumentListing[]>;
};

const KIND = "proof";
const TAXONOMY = "taxonomy-2026-03";

let scratch: ScratchDb | undefined;
let staging: Promise<Scene> | undefined;

type Scene = { tenantId: string; projectId: string; userId: string; store: StoreModule; storage: Storage };

/** A read spoken under the system reason the seam's own writes record (SEAM-TENANT). */
const sysRun = (sql: string): string[][] => run(scratch?.urlMigrate ?? "", `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
const sysScalar = (sql: string): string => scalar(scratch?.urlMigrate ?? "", `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);

const staged = (): Promise<Scene> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    process.env["STORAGE_ROOT"] = mkdtempSync(join(tmpdir(), "cubit-documents-ac4-"));
    process.env["CUBIT_STORAGE_SIGNING_SECRET"] = `ac4-${randomUUID()}`;

    // The scene is spoken in SQL rather than through the identity door: src/core reaches nothing
    // above it (ARCH-01), and what this criterion needs of a person is only that `issued_by` points
    // at a real user. The door's own acceptance is the door's (AC-5).
    const marker = `ac4-${randomUUID().slice(0, 8)}`;
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, "the scenario seeded no workspace to issue documents in").not.toBe("");
    const userId = sysScalar(`insert into users (email, password_hash) values (${lit(`inc300a-${marker}@cubit.test`)}, 'x') returning user_id::text;`);
    const projectId = sysScalar(`insert into projects (tenant_id, name) values (${lit(tenantId)}, 'Document seam acceptance') returning project_id::text;`);

    const app = (await import("../../storage/app")) as typeof import("../../storage/app");
    const store = await productModule<StoreModule>("src/core/documents/store.ts");
    return { tenantId, projectId, userId, store, storage: app.appStorage() as unknown as Storage };
  })());

afterAll(async () => {
  await closePools();
  await scratch?.drop();
});

/** A rendered document built from bytes: what `storeDocument` is handed, without a subprocess. */
function renderedFrom(text: string): RenderedDocument {
  const pdf = new Uint8Array(Buffer.from(`%PDF-1.7\n${text}\n%%EOF\n`, "utf8"));
  return {
    kind: KIND,
    pdf,
    sha256: createHash("sha256").update(pdf).digest("hex"),
    payloadDigest: createHash("sha256").update(`payload:${text}`).digest("hex"),
    rendererPin: `typst 0.15.1 ${"a".repeat(64)}`,
    fontHashes: { "spline-sans-regular.ttf": "b".repeat(64) },
  };
}

/** The row as the database holds it, column by column. */
function rowOf(id: string): Record<string, string> {
  const [row] = sysRun(
    `select kind, version, sha256, payload_digest, renderer_pin, font_hashes::text, taxonomy_version, act_ids::text, issued_by::text, coalesce(superseded_by::text, '')
       from documents where id = ${lit(id)};`,
  );
  const names = ["kind", "version", "sha256", "payload_digest", "renderer_pin", "font_hashes", "taxonomy_version", "act_ids", "issued_by", "superseded_by"];
  return Object.fromEntries(names.map((name, index) => [name, row?.[index] ?? ""]));
}

describe("AC-4: the documents table", () => {
  it("AC-4: a stored document is addressed by its own bytes and recorded with what it was rendered under", async () => {
    const scene = await staged();
    const rendered = renderedFrom(`first issue ${randomUUID()}`);
    const actIds = [randomUUID(), randomUUID()];
    const issue: Issue = { tenantId: scene.tenantId, projectId: scene.projectId, issuedBy: scene.userId, taxonomyVersion: TAXONOMY, actIds };

    const stored = await forTenant({ tenantId: scene.tenantId }).transaction(async (tx) => scene.store.storeDocument({ tx, storage: scene.storage }, rendered, issue));

    const address = createHash("sha256").update(rendered.pdf).digest("hex");
    const held = await scene.storage.get(scene.tenantId, address);
    expect(held, "the bytes went through SEAM-STORAGE, content-addressed (R-SPINE-021)").not.toBeNull();
    expect(Buffer.from(held ?? new Uint8Array()).equals(Buffer.from(rendered.pdf)), "and what storage holds at that address is the document").toBe(true);

    const row = rowOf(stored.id);
    expect(row["sha256"], "the row's address is the address storage answered, which is the sha256 of the bytes").toBe(address);
    expect(row["kind"]).toBe(KIND);
    expect(row["payload_digest"]).toBe(rendered.payloadDigest);
    expect(row["renderer_pin"], "the pin the document was rendered under travels with it (L-FMT-03)").toBe(rendered.rendererPin);
    expect(JSON.parse(row["font_hashes"] ?? "null"), "and so do the hashes of the faces it embedded").toEqual(rendered.fontHashes);
    expect(row["taxonomy_version"]).toBe(TAXONOMY);
    expect(row["act_ids"], "the acts it was rendered under").toBe(`{${actIds.join(",")}}`);
    expect(row["issued_by"]).toBe(scene.userId);
    expect(Number(row["version"]), "the first issue of a kind on a project is version 1").toBe(1);
    expect(row["superseded_by"], "nothing has superseded it yet").toBe("");
    expect(stored.version).toBe(1);
  });

  it("AC-4: the next issue is version 2 and supersedes the first, in one transaction", async () => {
    const scene = await staged();
    const first = await forTenant({ tenantId: scene.tenantId }).transaction(async (tx) =>
      scene.store.storeDocument({ tx, storage: scene.storage }, renderedFrom(`superseded ${randomUUID()}`), {
        tenantId: scene.tenantId,
        projectId: scene.projectId,
        issuedBy: scene.userId,
        taxonomyVersion: TAXONOMY,
        actIds: [],
      }),
    );

    // A transaction that does not commit leaves neither the new row nor the supersession: the two
    // writes are one act, not two that happen to follow each other.
    const abandoned = await forTenant({ tenantId: scene.tenantId })
      .transaction(async (tx) => {
        await scene.store.storeDocument({ tx, storage: scene.storage }, renderedFrom(`abandoned ${randomUUID()}`), {
          tenantId: scene.tenantId,
          projectId: scene.projectId,
          issuedBy: scene.userId,
          taxonomyVersion: TAXONOMY,
          actIds: [],
        });
        throw new Error("the caller's work failed after the document was recorded");
      })
      .then(
        () => null,
        (failure: unknown) => failure,
      );
    expect(abandoned, "the failing transaction failed").not.toBeNull();
    expect(rowOf(first.id)["superseded_by"], "an issue that was rolled back supersedes nothing").toBe("");

    const second = await forTenant({ tenantId: scene.tenantId }).transaction(async (tx) =>
      scene.store.storeDocument({ tx, storage: scene.storage }, renderedFrom(`second issue ${randomUUID()}`), {
        tenantId: scene.tenantId,
        projectId: scene.projectId,
        issuedBy: scene.userId,
        taxonomyVersion: TAXONOMY,
        actIds: [],
      }),
    );

    expect(second.version, "the next issue of the same kind on the same project counts on from the last").toBe(first.version + 1);
    expect(rowOf(first.id)["superseded_by"], "and the one it replaces says so").toBe(second.id);
    expect(rowOf(second.id)["superseded_by"], "the newest issue is superseded by nothing").toBe("");
  });

  it("AC-4: listDocuments answers the project's issues, newest first", async () => {
    const scene = await staged();
    const listed = await forTenant({ tenantId: scene.tenantId }).transaction(async (tx) => scene.store.listDocuments(tx, scene.projectId));

    expect(listed.length, "every issue this project has had").toBeGreaterThanOrEqual(2);
    const versions = listed.filter((entry) => entry.kind === KIND).map((entry) => entry.version);
    expect(versions, "newest first").toEqual([...versions].sort((a, b) => b - a));

    const newest = listed[0];
    expect(newest, "the listing is not empty").toBeDefined();
    for (const field of ["id", "kind", "version", "sha256", "issuedBy", "actIds"] as const) {
      expect(newest?.[field], `a listed document states its ${field}`).toBeDefined();
    }
    // R-SPINE-040's act ids come back as the listing's own array, so a reader of the list can say
    // what an issue stands on without a second read of the row it was already given.
    expect(Array.isArray(newest?.actIds), "and the acts it was rendered under are a roster, not a scalar").toBe(true);
    expect(newest?.issuedBy, "who issued it").toBe(scene.userId);
    expect(newest?.supersededBy, "the newest issue is superseded by nothing").toBeNull();
    const superseded = listed.find((entry) => entry.version === (newest?.version ?? 0) - 1 && entry.kind === KIND);
    expect(superseded?.supersededBy, "and the issue before it names the one that replaced it").toBe(newest?.id);
  });

  it("AC-4: one version of a kind per project, and the table is reachable where AM-11 puts it", async () => {
    const scene = await staged();
    const existing = sysRun(`select id::text, kind, version from documents where project_id = ${lit(scene.projectId)} order by version limit 1;`)[0] ?? [];
    const attempt = psql(
      scratch?.urlMigrate ?? "",
      `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};
       insert into documents (tenant_id, project_id, kind, version, sha256, payload_digest, renderer_pin, font_hashes, taxonomy_version, act_ids, issued_by)
       values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(existing[1] ?? KIND)}, ${existing[2] ?? 1}, ${lit("c".repeat(64))}, ${lit("d".repeat(64))}, 'typst', '{}'::jsonb, ${lit(TAXONOMY)}, '{}'::uuid[], ${lit(scene.userId)});`,
    );
    expect(attempt.ok, "a project cannot hold two documents of one kind at the same version").toBe(false);
    expect(attempt.sqlstate, "and what refuses it is a unique index, on (project_id, kind, version) — 23505 is unique_violation").toBe("23505");
    // The table arrives by ITS OWN migration, identified by what it is rather than by the slot it
    // happens to take: a four-digit ordinal and the tag `documents`. The number is the toolchain's
    // to assign (scripts/db-regenerate-migration.mjs takes max(disk, journal) + 1) and another
    // increment may land in the slot this one was drafted against — what the clause requires is a
    // migration that is this increment's, appended to a history that is never edited, and the
    // journal that names it (tests/toolchain/migrations-numbering.test.ts holds the numbering law).
    // white-box: AC-4 — "the migration db/migrations/<n>_documents.sql creates documents" is a
    // property of the committed history, not of any query: the scratch database above proves the
    // table and its unique index exist, and this proves they arrived the one lawful way.
    const migrations = readdirSync(inTree("db/migrations")).filter((file) => /^\d{4}_.*\.sql$/u.test(file));
    const mine = migrations.filter((file) => /^\d{4}_documents\.sql$/u.test(file));
    expect(mine.length, `exactly one committed migration is the documents table's own — found ${mine.join(", ") || "none"} among ${migrations.length}`).toBe(1);
    const journal = JSON.parse(readFileSync(inTree("db/migrations/meta/_journal.json"), "utf8")) as { entries?: { idx?: number; tag?: string }[] };
    const tag = (mine[0] ?? "").replace(/\.sql$/u, "");
    expect(
      (journal.entries ?? []).map((entry) => entry.tag),
      `the journal names ${tag}, at the ordinal the file wears — a migration the journal does not carry is a history that disagrees with itself`,
    ).toContain(tag);
    const entry = (journal.entries ?? []).find((held) => held.tag === tag);
    expect(entry?.idx, `${tag}'s journal idx is the number its own file name carries`).toBe(Number(tag.slice(0, 4)));

    const schema = (await import("../../db/schema-docs")) as { DOCS_TABLES: Record<string, unknown> };
    expect(Object.keys(schema.DOCS_TABLES), "the docs area declares its table in its own schema file (AM-11)").toContain("documents");
    const seam = (await import("../../db")) as Record<string, unknown>;
    expect(seam["documents"], "and the seam's own barrel spells it in its roster").toBeDefined();
    // db/schema/docs.ts's re-export is the DRIFT lane's own reading (the generator sees a table
    // only through the schema tree), and this file may not import the schema directly
    // (cubit/no-db-outside-seam) — so it is proved where it is read, not a second time here.
  });
});
