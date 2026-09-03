// The upload seam's tables under live policy (R-SPINE-020, R-SPINE-021, SEAM-TENANT, V-DB): a
// scoped read proves each policy's USING clause, and only a write proves its WITH CHECK — so every
// table is driven as the app role with one workspace's scope armed, offered a row belonging to the
// other, and must refuse it. An own-workspace control stands beside each refusal, because a refusal
// that is really "this insert could never have worked" proves nothing about the policy.
//
// Beside the policies, the two properties the store itself has to hold for "duplicate content
// detected and linked, not re-stored" to mean anything: one row per (workspace, content), and a
// drawing that names content the workspace does not hold is no drawing at all.
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
// rest of the tree.
import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_TENANT, ROLE_APP, TENANT_ALPHA, TENANT_BETA, TENANT_COLUMN } from "./support/fixtures";
import { ident, lit, psql, seedTenants, withSession } from "./support/live-sql";

const FILES = "files";
const DRAWINGS = "drawings";
const UPLOADS = "uploads";

/** A row-level security refusal: "new row violates row-level security policy". */
const RLS_REFUSAL = "42501";
/** The unique violation a content address answers a second time with, and the missing-content one. */
const ALREADY_HELD = "23505";
const NO_SUCH_CONTENT = "23503";

/** A content address, as the seam mints them: the lowercase-hex sha256 of some bytes. */
function address(of: string): string {
  return createHash("sha256").update(of).digest("hex");
}

let scratch: ScratchDb | undefined;

afterAll(async () => {
  await scratch?.drop();
});

type Stage = { urlApp: string; alpha: string; beta: string };

let staging: Promise<Stage> | undefined;

/** Staged lazily and memoised, so a failure here fails cases rather than skipping them. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const alpha = tenantIds[TENANT_ALPHA] ?? "";
    const beta = tenantIds[TENANT_BETA] ?? "";
    expect(alpha, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    expect(beta, `the scenario seeded no ${TENANT_BETA}`).not.toBe("");
    return { urlApp: provisioned.urlApp, alpha, beta };
  })());

/** One stored content offered as the app role, under `scope`, naming `tenantId` as its owner. */
function offerFile(stage: Stage, scope: string, tenantId: string, sha256: string): ReturnType<typeof psql> {
  return psql(
    stage.urlApp,
    withSession(
      { [GUC_TENANT]: scope },
      `insert into ${ident(FILES)} (${ident(TENANT_COLUMN)}, sha256, byte_length, format, scan_verdict)
         values (${lit(tenantId)}::uuid, ${lit(sha256)}, 4, 'dxf', 'skipped');`,
    ),
  );
}

/** One drawing offered the same way, pointing at a content address. */
function offerDrawing(stage: Stage, scope: string, tenantId: string, sha256: string, name = "structural/S-101.dxf"): ReturnType<typeof psql> {
  return psql(
    stage.urlApp,
    withSession(
      { [GUC_TENANT]: scope },
      `insert into ${ident(DRAWINGS)} (${ident(TENANT_COLUMN)}, project_id, sha256, name, format, uploaded_by)
         values (${lit(tenantId)}::uuid, ${lit(randomUUID())}::uuid, ${lit(sha256)}, ${lit(name)}, 'dxf', ${lit(randomUUID())}::uuid);`,
    ),
  );
}

/** One upload session offered the same way. */
function offerUpload(stage: Stage, scope: string, tenantId: string): ReturnType<typeof psql> {
  return psql(
    stage.urlApp,
    withSession(
      { [GUC_TENANT]: scope },
      `insert into ${ident(UPLOADS)} (${ident(TENANT_COLUMN)}, project_id, name, declared_size, declared_sha256, created_by)
         values (${lit(tenantId)}::uuid, ${lit(randomUUID())}::uuid, 'rcc6.dxf', 4, ${lit(address(randomUUID()))}, ${lit(randomUUID())}::uuid);`,
    ),
  );
}

describe(`a cross-workspace write is refused by policy on all three tables`, () => {
  it(`as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, content naming ${TENANT_BETA} is refused`, async () => {
    const stage = await staged();

    // The control first: the same statement, differing only in the workspace it names, is admitted.
    const control = offerFile(stage, stage.alpha, stage.alpha, address(randomUUID()));
    expect(control.ok, `content belonging to the scope it is written under is a lawful row\n${control.stderr.slice(-400)}`).toBe(true);

    const foreign = offerFile(stage, stage.alpha, stage.beta, address(randomUUID()));
    expect(foreign.ok, "a workspace cannot store content into another workspace's shelf").toBe(false);
    expect(foreign.sqlstate, `the refusal is the policy's, not a constraint's\n${foreign.stderr.slice(-400)}`).toBe(RLS_REFUSAL);
  });

  it(`as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, a drawing naming ${TENANT_BETA} is refused`, async () => {
    const stage = await staged();
    const own = address(randomUUID());
    expect(offerFile(stage, stage.alpha, stage.alpha, own).ok, "the control's content is stored first — a drawing points at content").toBe(true);
    expect(offerDrawing(stage, stage.alpha, stage.alpha, own).ok, "a drawing of this workspace's own content is a lawful row").toBe(true);

    const beta = address(randomUUID());
    expect(offerFile(stage, stage.beta, stage.beta, beta).ok, "the other workspace's content, stored under its own scope").toBe(true);
    const foreign = offerDrawing(stage, stage.alpha, stage.beta, beta);
    expect(foreign.ok, "a workspace cannot record a drawing in another workspace").toBe(false);
    expect(foreign.sqlstate, `the refusal is the policy's\n${foreign.stderr.slice(-400)}`).toBe(RLS_REFUSAL);
  });

  it(`as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, an upload session naming ${TENANT_BETA} is refused`, async () => {
    const stage = await staged();
    const control = offerUpload(stage, stage.alpha, stage.alpha);
    expect(control.ok, `a session opened in the workspace it is scoped to is a lawful row\n${control.stderr.slice(-400)}`).toBe(true);

    const foreign = offerUpload(stage, stage.alpha, stage.beta);
    expect(foreign.ok, "a workspace cannot open an upload session in another workspace").toBe(false);
    expect(foreign.sqlstate, `the refusal is the policy's\n${foreign.stderr.slice(-400)}`).toBe(RLS_REFUSAL);
  });
});

describe("the store holds one row per content, and a drawing points at content it holds", () => {
  it("a second row for the same content in the same workspace is refused as already held", async () => {
    const stage = await staged();
    const twice = address(randomUUID());
    expect(offerFile(stage, stage.alpha, stage.alpha, twice).ok, "the first upload of a content stores it").toBe(true);

    const again = offerFile(stage, stage.alpha, stage.alpha, twice);
    expect(again.ok, "identical bytes have one address, and one row at it — a second upload links rather than stores").toBe(false);
    expect(again.sqlstate, `the key is what refuses it\n${again.stderr.slice(-400)}`).toBe(ALREADY_HELD);
  });

  it("the same content in another workspace is its own row: dedupe is per workspace, as the prefix is", async () => {
    const stage = await staged();
    const shared = address(randomUUID());
    expect(offerFile(stage, stage.alpha, stage.alpha, shared).ok, "one workspace holds the content").toBe(true);
    expect(offerFile(stage, stage.beta, stage.beta, shared).ok, "and the other holds its own copy, under its own prefix (SEAM-STORAGE)").toBe(true);
  });

  it("a drawing naming content the workspace does not hold is refused", async () => {
    const stage = await staged();
    const missing = offerDrawing(stage, stage.alpha, stage.alpha, address(randomUUID()));
    expect(missing.ok, "a drawing is made of content, and content nobody stored is a drawing nobody can open").toBe(false);
    expect(missing.sqlstate, `the composite foreign key is what refuses it\n${missing.stderr.slice(-400)}`).toBe(NO_SUCH_CONTENT);
  });

  it("two drawings may be made of one content: a duplicate is linked, never stored twice", async () => {
    const stage = await staged();
    const shared = address(randomUUID());
    expect(offerFile(stage, stage.alpha, stage.alpha, shared).ok, "the content is stored once").toBe(true);
    expect(offerDrawing(stage, stage.alpha, stage.alpha, shared, "structural/S-101.dxf").ok, "the first presented name records a drawing").toBe(true);
    expect(offerDrawing(stage, stage.alpha, stage.alpha, shared, "archive/S-101.dxf").ok, "and a second presented name records another, of the same content").toBe(true);
  });
});
