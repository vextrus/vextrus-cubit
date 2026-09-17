/**
 * BREAKER (inc-300a, R-SPINE-040, AC-4): `listDocuments` answers a project's issues "newest first",
 * and it does not — as soon as two issues share an `issued_at`, which they always do when they are
 * issued in one transaction, because Postgres' `now()` is the transaction's clock and not the
 * statement's.
 *
 * The order is `issued_at desc, version desc, id desc`. `listDocuments`' own comment states exactly
 * why the version cannot be the leading key: "ordering by version alone would file a bill's third
 * issue above a schedule's first whatever order they were actually issued in". Under a tie in
 * `issued_at` the version becomes the leading key again, and the very thing that comment rules out
 * is what the reader gets. Issue `alpha` v1, then `beta` v1, then `alpha` v2 in one transaction and
 * the list comes back `alpha v2 > alpha v1 > beta v1`: the SUPERSEDED first issue of one kind is
 * filed above the LIVE first issue of another that was issued after it.
 *
 * A reader scanning a project's documents newest-first therefore meets a withdrawn document before a
 * current one, and a caller taking `rows[1]` as "the issue before the newest" takes a document from
 * a different chain. The row set carries no monotonic key to break the tie with — `id` is
 * `gen_random_uuid()` and `version` counts per kind — so the fix is the store's to choose.
 *
 * Live, beside AC-4's own suite: the three issues are written through `storeDocument` in one
 * transaction, which is the shape a caller issuing a bill and its schedule together has.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, SEED_REASON, TENANT_ALPHA } from "../../../../db/__tests__/support/fixtures";
import { lit, scalar, seedTenants } from "../../../../db/__tests__/support/live-sql";
import { closePools, forTenant } from "../../db";
import type { RenderedDocument } from "../contract";

const TAXONOMY = "taxonomy-2026-03";

let scratch: ScratchDb | undefined;
let staging: Promise<Scene> | undefined;

type Scene = {
  tenantId: string;
  projectId: string;
  userId: string;
  store: typeof import("../store");
  storage: Awaited<ReturnType<typeof import("../../storage/app").appStorage>>;
};

const staged = (): Promise<Scene> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    process.env["STORAGE_ROOT"] = mkdtempSync(join(tmpdir(), "cubit-documents-listing-breaker-"));
    process.env["CUBIT_STORAGE_SIGNING_SECRET"] = `listing-breaker-${randomUUID()}`;

    const sysScalar = (sql: string): string => scalar(provisioned.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, "the scenario seeded no workspace to issue documents in").not.toBe("");
    const marker = `listing-breaker-${randomUUID().slice(0, 8)}`;
    const userId = sysScalar(`insert into users (email, password_hash) values (${lit(`inc300a-${marker}@cubit.test`)}, 'x') returning user_id::text;`);
    const projectId = sysScalar(`insert into projects (tenant_id, name) values (${lit(tenantId)}, 'Document listing order') returning project_id::text;`);

    const store = (await import("../store")) as typeof import("../store");
    const app = (await import("../../storage/app")) as typeof import("../../storage/app");
    return { tenantId, projectId, userId, store, storage: app.appStorage() };
  })());

afterAll(async () => {
  await closePools();
  await scratch?.drop();
});

/** A rendered document built from bytes: the store takes one, so no subprocess runs in this lane. */
function renderedAs(kind: string, body: string): RenderedDocument {
  const pdf = new Uint8Array(Buffer.from(`%PDF-1.7 ${body}`, "utf8"));
  return Object.freeze({
    kind,
    pdf,
    sha256: createHash("sha256").update(pdf).digest("hex"),
    payloadDigest: createHash("sha256").update(body, "utf8").digest("hex"),
    rendererPin: "typst 0.15.1 29273eaa04f6d00edd0c2bec578f565fc9c65be856bfbffc894567c68ed0b237",
    fontHashes: Object.freeze({ "spline-sans-regular.ttf": "0".repeat(64) }),
  });
}

describe("BREAKER: a project's documents list newest first, whatever their kinds", () => {
  it("does not file a superseded issue above a live issue that was issued after it", async () => {
    const scene = await staged();
    const issue = { tenantId: scene.tenantId, projectId: scene.projectId, issuedBy: scene.userId, taxonomyVersion: TAXONOMY, actIds: [] as readonly string[] };

    // One transaction, three issues, in this order. Every row therefore carries the same `issued_at`.
    const written = await forTenant({ tenantId: scene.tenantId }).transaction(async (tx) => {
      const alphaOne = await scene.store.storeDocument({ tx, storage: scene.storage }, renderedAs("alpha", "alpha-1"), issue);
      const betaOne = await scene.store.storeDocument({ tx, storage: scene.storage }, renderedAs("beta", "beta-1"), issue);
      const alphaTwo = await scene.store.storeDocument({ tx, storage: scene.storage }, renderedAs("alpha", "alpha-2"), issue);
      return { alphaOne, betaOne, alphaTwo };
    });
    expect([written.alphaOne.version, written.betaOne.version, written.alphaTwo.version], "the versions count per kind, as AC-4 states").toEqual([1, 1, 2]);

    const listed = await forTenant({ tenantId: scene.tenantId }).transaction(async (tx) => scene.store.listDocuments(tx, scene.projectId));
    const order = listed.map((row) => `${row.kind}v${String(row.version)}`);

    expect(order, "every issue of the project is listed").toEqual(expect.arrayContaining(["alphav1", "alphav2", "betav1"]));
    expect(
      order.indexOf("betav1"),
      `"newest first" (R-SPINE-040, AC-4): beta v1 was issued after alpha v1 and is still the live issue of its kind, so it cannot be filed below a superseded one — got ${order.join(" > ")}`,
    ).toBeLessThan(order.indexOf("alphav1"));

    const supersededBefore = listed.findIndex((row) => row.supersededBy !== null);
    const liveAfter = listed.findIndex((row, at) => row.supersededBy === null && at > supersededBefore);
    expect(
      supersededBefore === -1 || liveAfter === -1,
      `a reader scanning newest-first meets a withdrawn document before a current one — got ${order.join(" > ")}`,
    ).toBe(true);
  }, 120_000);
});
