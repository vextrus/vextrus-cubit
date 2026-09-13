/**
 * AC-3: `GET /api/exports/[id]` serves a stored artefact to a member of the URL's workspace, and to
 * nobody else — driven live against a scratch database the committed migrations built (V-DB).
 *
 * The scene is the whole journey the seam exists for, end to end: a workbook and a CSV are BUILT,
 * STORED through SEAM-STORAGE's content addressing, a signed URL is MINTED from the storage seam's
 * own signer, and the shipped route handler is called with three different cookie jars.
 *
 * Two real accounts are enrolled through the product's own sign-up door, so each owns a workspace
 * and is a member of that one only: the outsider is an outsider because R-SPINE-002 made them one,
 * not because a row was withheld. Raw SQL is spoken through psql, never a driver import
 * (SEAM-TENANT). Product modules are imported after DATABASE_URL, STORAGE_ROOT and the signing
 * secret name the scratch world, and by relative path, exactly as db/__tests__/authz/
 * authorize.live.test.ts does; the database harness is that lane's, borrowed rather than copied.
 *
 * It sits in the server-spine acceptance directory because that is what it is — a shipped route
 * handler, asked its questions over `Request`/`Response` — and because `tests/server/` is governed
 * by its own config. The lane split reads the import graph and puts a pg-bound suite in the
 * database lane wherever it lives (scripts/lib/pg-suites.mjs), so it runs where a cluster is.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "../../db/__tests__/support/fixtures";
import { lit, scalar } from "../../db/__tests__/support/live-sql";

// The door's admission is `authorize()`'s (AM-11 §2). It is wrapped rather than replaced, so the
// live guard still answers and the criterion's "asked with { userId, tenantId }" can be read off it.
vi.mock("../../src/server/authorize", async (importOriginal) => {
  const real = (await importOriginal()) as typeof import("../../src/server/authorize");
  return { ...real, authorize: vi.fn(real.authorize) };
});

/** The spec AC-1 publishes, verbatim — the artefact this door is asked for. */
const SAMPLE = {
  name: "Bill",
  freezeHeader: true,
  columns: [
    { key: "item", header: "Item", kind: "text" },
    { key: "quantity", header: "Quantity", kind: "number", fractionDigits: 3 },
    { key: "rate", header: "Rate", kind: "money" },
    { key: "amount", header: "Amount", kind: "money" },
  ],
  rows: [
    ["Concrete M25", "12345.678", "8500.00", { formula: "B2*C2" }],
    ['Rebar Fe500, "TMT"', "1.500", "95000.00", { formula: "B3*C3" }],
  ],
} as const;

type Seam = {
  buildWorkbook: (spec: { sheets: readonly unknown[] }) => Promise<Uint8Array>;
  writeCsv: (sheet: unknown) => Uint8Array;
  storeExport: (storage: unknown, tenantId: string, bytes: Uint8Array) => Promise<{ sha256: string }>;
  exportDownloadUrl: (storage: unknown, address: { tenantId: string; sha256: string; kind: string; expiresInSeconds: number }) => string;
  MIME_OF_KIND: Record<string, string>;
};

type Route = { GET: (request: Request, address?: { params: Promise<Record<string, string>> }) => Promise<Response> };

type Person = { userId: string; token: string };

let scratch: ScratchDb | undefined;
let seam: Seam;
let route: Route;
let storage: unknown;
let sessionCookie: string;

const scene = { tenantId: "", member: { userId: "", token: "" } as Person, outsider: { userId: "", token: "" } as Person, csv: "", xlsx: "", csvBytes: new Uint8Array() as Uint8Array<ArrayBufferLike> };

/** A staging read, spoken under the system reason the seam's own writes record (SEAM-TENANT). */
const sysScalar = (sql: string): string => scalar(scratch?.urlMigrate ?? "", `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);

/** The request a browser makes: the signed path, with whatever cookie jar the case is testing. */
const ask = async (path: string, token: string | null): Promise<Response> => {
  const url = new URL(path, "http://localhost");
  const id = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  const headers: Record<string, string> = token === null ? {} : { cookie: `${sessionCookie}=${token}` };
  return route.GET(new Request(url, { headers }), { params: Promise.resolve({ id }) });
};

const refusalCodeOf = async (answer: Response): Promise<unknown> => ((await answer.json()) as { refusal?: { code?: unknown } }).refusal?.code;

let staging: Promise<void> | undefined;

/**
 * The scene, staged once and awaited by every case. Lazy and memoised rather than a hook: a hook
 * that throws — because the seam it imports is not written yet — leaves every case SKIPPED, and a
 * skipped case judges nothing. Staged here, the missing door is the failure of each case that needs
 * it, named in the case that names the criterion.
 */
const staged = (): Promise<void> => (staging ??= stage());

async function stage(): Promise<void> {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;
  process.env["STORAGE_ROOT"] = mkdtempSync(join(tmpdir(), "cubit-exports-ac3-"));
  process.env["CUBIT_STORAGE_SIGNING_SECRET"] = `ac3-${randomUUID()}`;

  const auth = (await import("../../src/server/auth/session")) as typeof import("../../src/server/auth/session");
  sessionCookie = auth.SESSION_COOKIE;

  /** One real account through the shipped door: R-SPINE-002 writes the workspace and the membership. */
  const enrol = async (label: string): Promise<Person> => {
    const marker = `${label}-${randomUUID().slice(0, 8)}`;
    const email = `inc301-${marker}@cubit.test`;
    const { sessionToken } = await auth.signUp({
      email,
      password: "correct horse battery staple",
      tenantName: `Exports ${marker}`,
      deviceLabel: "acceptance",
      origin: "https://cubit.example",
      requestId: randomUUID(),
    });
    // The identity seam stores a FOLDED address, so the account is found by the marker its address
    // carries rather than by the text that was presented (R-SPINE-007).
    const userId = sysScalar(`select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
    return { userId, token: sessionToken };
  };

  scene.member = await enrol("member");
  scene.outsider = await enrol("outsider");
  scene.tenantId = sysScalar(`select tenant_id::text from memberships where user_id = ${lit(scene.member.userId)} limit 1;`);

  seam = (await import("../../src/core/exports")) as unknown as Seam;
  const app = (await import("../../src/core/storage/app")) as typeof import("../../src/core/storage/app");
  storage = app.appStorage();

  scene.csvBytes = seam.writeCsv(SAMPLE);
  ({ sha256: scene.csv } = await seam.storeExport(storage, scene.tenantId, scene.csvBytes));
  ({ sha256: scene.xlsx } = await seam.storeExport(storage, scene.tenantId, await seam.buildWorkbook({ sheets: [SAMPLE] })));

  route = (await import("../../src/app/api/exports/[id]/route")) as unknown as Route;
}

afterAll(async () => {
  if (scratch === undefined) return;
  const { closePools } = (await import("../../src/core/db")) as typeof import("../../src/core/db");
  await closePools();
  await scratch.drop();
});

describe("AC-3: a stored export is served to a member of the workspace that stored it", () => {
  it("AC-3: storeExport addresses an artefact by the sha256 of its own bytes", async () => {
    await staged();
    expect(scene.csv, "the answer is the lowercase-hex sha256 of the bytes stored (R-SPINE-021)").toBe(createHash("sha256").update(scene.csvBytes).digest("hex"));
  });

  it("AC-3: exportDownloadUrl re-addresses the storage seam's own signature at the download route", async () => {
    await staged();
    const url = seam.exportDownloadUrl(storage, { tenantId: scene.tenantId, sha256: scene.csv, kind: "csv", expiresInSeconds: 900 });
    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname, "the address is the artefact's own").toBe(`/api/exports/${scene.csv}`);
    expect(parsed.searchParams.get("tenant")).toBe(scene.tenantId);
    expect(parsed.searchParams.get("kind")).toBe("csv");
    expect(Number(parsed.searchParams.get("expires")), "the URL expires (Q-12)").toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(parsed.searchParams.get("signature"), "the signature is hex, and the storage seam is the only signer").toMatch(/^[0-9a-f]+$/u);
  });

  it("AC-3: a request with no session is refused 401 SIGNED_OUT", async () => {
    await staged();
    const url = seam.exportDownloadUrl(storage, { tenantId: scene.tenantId, sha256: scene.csv, kind: "csv", expiresInSeconds: 900 });
    const answer = await ask(url, null);
    expect(answer.status).toBe(401);
    expect(await refusalCodeOf(answer)).toBe("SIGNED_OUT");
  });

  it("AC-3: a signed-in outsider is refused 403 WORKSPACE_PERMISSION_NOT_HELD, the guard having been asked", async () => {
    await staged();
    const { authorize } = (await import("../../src/server/authorize")) as typeof import("../../src/server/authorize");
    vi.mocked(authorize).mockClear();

    const url = seam.exportDownloadUrl(storage, { tenantId: scene.tenantId, sha256: scene.csv, kind: "csv", expiresInSeconds: 900 });
    const answer = await ask(url, scene.outsider.token);

    expect(answer.status).toBe(403);
    expect(await refusalCodeOf(answer)).toBe("WORKSPACE_PERMISSION_NOT_HELD");
    const asked = vi.mocked(authorize).mock.calls.map(([question]) => ({ userId: question.userId, tenantId: question.tenantId }));
    expect(asked, "the door asks the one authorize() about this caller and the URL's workspace (AM-11 §2)").toContainEqual({
      userId: scene.outsider.userId,
      tenantId: scene.tenantId,
    });
  });

  it("AC-3: the member is served the stored bytes, whole, under the artefact's own headers", async () => {
    await staged();
    const url = seam.exportDownloadUrl(storage, { tenantId: scene.tenantId, sha256: scene.csv, kind: "csv", expiresInSeconds: 900 });
    const answer = await ask(url, scene.member.token);

    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-type")).toBe(seam.MIME_OF_KIND["csv"]);
    expect(answer.headers.get("content-disposition")).toBe(`attachment; filename="${scene.csv}.csv"`);
    expect(answer.headers.get("cache-control"), "an artefact of one workspace is never cached by anything in between").toBe("private, no-store");
    expect(new Uint8Array(await answer.arrayBuffer()), "the body is the bytes that were stored, byte for byte").toEqual(scene.csvBytes);
  });

  it("AC-3: an xlsx address is served as a spreadsheet", async () => {
    await staged();
    expect(seam.MIME_OF_KIND, "the seam's one media-type table, as the interfaces publish it").toEqual({
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv; charset=utf-8",
    });

    const url = seam.exportDownloadUrl(storage, { tenantId: scene.tenantId, sha256: scene.xlsx, kind: "xlsx", expiresInSeconds: 900 });
    const answer = await ask(url, scene.member.token);

    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-type")).toBe(seam.MIME_OF_KIND["xlsx"]);
    expect(answer.headers.get("content-disposition")).toBe(`attachment; filename="${scene.xlsx}.xlsx"`);
  });
});
