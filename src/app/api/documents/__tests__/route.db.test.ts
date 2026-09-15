/**
 * AC-5: THE DOOR — `GET /api/documents/[id]` serves a stored document to a member of the workspace
 * the signed link names, and to nobody else (R-SPINE-040, Q-12, AM-11 §2).
 *
 * Live, against a scratch database the committed migrations built. Two real accounts are enrolled
 * through the product's own sign-up door, so the outsider is an outsider because R-SPINE-002 made
 * them one; the document is stored through the seam, the link is minted by the seam, and the
 * shipped handler is called with three different cookie jars.
 *
 * The questions are asked in the order they stop being answerable in: an unreadable statement, then
 * a session, then membership of the workspace the link names, and only then the link itself — a
 * stranger holding a leaked link learns nothing about whether it was a good one.
 *
 * The expired link is minted by a storage instance over the SAME root and secret with its clock an
 * hour back: the signature is genuine and the expiry is past, which is the one case a test cannot
 * make by waiting.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "../../../../../db/__tests__/support/fixtures";
import { lit, scalar } from "../../../../../db/__tests__/support/live-sql";
import { productModule } from "../../../../../tests/docs/support/product";
import type { RenderedDocument } from "../../../../../tests/docs/support/seam";
import { closePools, forTenant, type TenantTx } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import { makeStorage, type Storage } from "@/core/storage/index";

// The door's admission is `authorize()`'s (AM-11 §2). It is wrapped rather than replaced, so the
// live guard still answers and the criterion's "asked with that userId and tenantId" is read off it.
vi.mock("@/server/authorize", async (importOriginal) => {
  const real = (await importOriginal()) as typeof import("@/server/authorize");
  return { ...real, authorize: vi.fn(real.authorize) };
});

type Issue = { tenantId: string; projectId: string; issuedBy: string; taxonomyVersion: string; actIds: readonly string[] };
type StoredRow = { id: string; tenantId: string; sha256: string; kind: string };
type StoreModule = {
  storeDocument(deps: { tx: TenantTx; storage: Storage }, rendered: RenderedDocument, issue: Issue): Promise<StoredRow>;
  documentDownloadUrl(storage: Storage, row: { id: string; tenantId: string; sha256: string }, opts: { expiresInSeconds: number }): string;
};
type Route = { GET: (request: Request, address?: { params: Promise<Record<string, string>> }) => Promise<Response> };
type Person = { userId: string; token: string };

const KIND = "proof";
const LIVE_SECONDS = 900;

let scratch: ScratchDb | undefined;
let staging: Promise<Scene> | undefined;

type Scene = {
  tenantId: string;
  projectId: string;
  member: Person;
  outsider: Person;
  store: StoreModule;
  storage: Storage;
  route: Route;
  sessionCookie: string;
  row: StoredRow;
  bytes: Uint8Array;
  root: string;
  secret: string;
};

const sysScalar = (sql: string): string => scalar(scratch?.urlMigrate ?? "", `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);

const staged = (): Promise<Scene> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const root = mkdtempSync(join(tmpdir(), "cubit-documents-ac5-"));
    const secret = `ac5-${randomUUID()}`;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    process.env["STORAGE_ROOT"] = root;
    process.env["CUBIT_STORAGE_SIGNING_SECRET"] = secret;

    const auth = (await import("@/server/auth/session")) as typeof import("@/server/auth/session");
    const enrol = async (label: string): Promise<Person> => {
      const marker = `${label}-${randomUUID().slice(0, 8)}`;
      const { sessionToken } = await auth.signUp({
        email: `inc300a-${marker}@cubit.test`,
        password: "correct horse battery staple",
        tenantName: `Documents ${marker}`,
        deviceLabel: "acceptance",
        origin: "https://cubit.example",
        requestId: randomUUID(),
      });
      return { userId: sysScalar(`select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`), token: sessionToken };
    };

    const member = await enrol("member");
    const outsider = await enrol("outsider");
    const tenantId = sysScalar(`select tenant_id::text from memberships where user_id = ${lit(member.userId)} limit 1;`);
    const projectId = sysScalar(`insert into projects (tenant_id, name) values (${lit(tenantId)}, 'Document door acceptance') returning project_id::text;`);

    const app = (await import("@/core/storage/app")) as typeof import("@/core/storage/app");
    const storage = app.appStorage();
    const store = await productModule<StoreModule>("src/core/documents/store.ts");

    const bytes = new Uint8Array(Buffer.from(`%PDF-1.7\nthe document ${randomUUID()}\n%%EOF\n`, "utf8"));
    const rendered: RenderedDocument = {
      kind: KIND,
      pdf: bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      payloadDigest: createHash("sha256").update("payload").digest("hex"),
      rendererPin: `typst 0.15.1 ${"a".repeat(64)}`,
      fontHashes: { "spline-sans-regular.ttf": "b".repeat(64) },
    };
    const row = await forTenant({ tenantId }).transaction(async (tx) =>
      store.storeDocument({ tx, storage }, rendered, { tenantId, projectId, issuedBy: member.userId, taxonomyVersion: "taxonomy-2026-03", actIds: [] }),
    );

    const route = (await productModule<Route>("src/app/api/documents/[id]/route.ts")) as Route;
    return { tenantId, projectId, member, outsider, store, storage, route, sessionCookie: auth.SESSION_COOKIE, row: { ...row, tenantId, kind: KIND }, bytes, root, secret };
  })());

afterAll(async () => {
  await closePools();
  await scratch?.drop();
});

/** The request a browser makes: the signed path, with whatever cookie jar the case is testing. */
async function ask(scene: Scene, path: string, token: string | null): Promise<Response> {
  const url = new URL(path, "http://localhost");
  const id = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  const headers: Record<string, string> = token === null ? {} : { cookie: `${scene.sessionCookie}=${token}` };
  return scene.route.GET(new Request(url, { headers }), { params: Promise.resolve({ id }) });
}

/** The refusal an answer carries, as the tier writes one. */
async function refusalOf(answer: Response): Promise<{ code?: string } | undefined> {
  return ((await answer.json()) as { refusal?: { code?: string } }).refusal;
}

/** The live link for the staged document. */
const liveUrl = (scene: Scene): string => scene.store.documentDownloadUrl(scene.storage, scene.row, { expiresInSeconds: LIVE_SECONDS });

describe("AC-5: the document download door", () => {
  it("AC-5: the link is the document's own address, signed by the storage seam", async () => {
    const scene = await staged();
    const url = new URL(liveUrl(scene), "http://localhost");
    expect(url.pathname, "the document is named by its row id").toBe(`/api/documents/${scene.row.id}`);
    expect(url.searchParams.get("tenant"), "the workspace the bytes are stored under").toBe(scene.tenantId);
    expect(Number(url.searchParams.get("expires")), "the link expires (Q-12)").toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(url.searchParams.get("signature"), "the signature is hex, and SEAM-STORAGE is the only signer").toMatch(/^[0-9a-f]+$/u);
  });

  it("AC-5: a request with no session is refused 401 SIGNED_OUT", async () => {
    const scene = await staged();
    const answer = await ask(scene, liveUrl(scene), null);
    expect(answer.status).toBe(401);
    expect(await refusalOf(answer), "the registered refusal, whole, as the tier answers one").toEqual(REFUSALS.SIGNED_OUT);
  });

  it("AC-5: a signed-in outsider is refused 403 WORKSPACE_PERMISSION_NOT_HELD, the guard having been asked", async () => {
    const scene = await staged();
    const { authorize } = (await import("@/server/authorize")) as typeof import("@/server/authorize");
    vi.mocked(authorize).mockClear();

    const answer = await ask(scene, liveUrl(scene), scene.outsider.token);

    expect(answer.status).toBe(403);
    expect((await refusalOf(answer))?.code).toBe("WORKSPACE_PERMISSION_NOT_HELD");
    const asked = vi.mocked(authorize).mock.calls.map(([question]) => ({ userId: question.userId, tenantId: question.tenantId }));
    expect(asked, "the door asks the one authorize() about this caller and the link's workspace (AM-11 §2)").toContainEqual({
      userId: scene.outsider.userId,
      tenantId: scene.tenantId,
    });
  });

  it("AC-5: a member whose signature does not verify is refused 403 DOCUMENT_URL_INVALID", async () => {
    const scene = await staged();
    const url = new URL(liveUrl(scene), "http://localhost");
    const signature = url.searchParams.get("signature") ?? "";
    // One hex digit of the signature changed: everything else about the link is what was minted.
    url.searchParams.set("signature", `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`);

    const answer = await ask(scene, `${url.pathname}${url.search}`, scene.member.token);
    expect(answer.status).toBe(403);
    expect((await refusalOf(answer))?.code).toBe("DOCUMENT_URL_INVALID");
  });

  it("AC-5: a member whose link has aged out is refused 410 DOCUMENT_URL_EXPIRED", async () => {
    const scene = await staged();
    // Genuinely signed, genuinely past: the same root and the same secret, an hour ago.
    const anHourAgo = makeStorage({ root: scene.root, signingSecret: scene.secret, now: () => new Date(Date.now() - 60 * 60 * 1000) });
    const stale = scene.store.documentDownloadUrl(anHourAgo, scene.row, { expiresInSeconds: LIVE_SECONDS });

    const answer = await ask(scene, stale, scene.member.token);
    expect(answer.status).toBe(410);
    expect((await refusalOf(answer))?.code).toBe("DOCUMENT_URL_EXPIRED");
  });

  it("AC-5: a member asking for a document this workspace does not hold is answered 404 DOCUMENT_NOT_FOUND", async () => {
    const scene = await staged();
    const url = new URL(liveUrl(scene), "http://localhost");
    const unknown = `${url.pathname.slice(0, url.pathname.lastIndexOf("/"))}/${randomUUID()}${url.search}`;

    const answer = await ask(scene, unknown, scene.member.token);
    expect(answer.status).toBe(404);
    expect((await refusalOf(answer))?.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("AC-5: the member is served the stored bytes, whole, under the document's own headers", async () => {
    const scene = await staged();
    const answer = await ask(scene, liveUrl(scene), scene.member.token);

    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-type")).toBe("application/pdf");
    expect(answer.headers.get("cache-control"), "one workspace's document is never cached by anything in between").toBe("private, no-store");
    expect(answer.headers.get("content-disposition"), "the file is named for the kind and the issue it is").toContain(`${scene.row.kind}-${scene.row.id}.pdf`);
    expect(new Uint8Array(await answer.arrayBuffer()), "the body is what storage holds at the row's address, byte for byte").toEqual(scene.bytes);
  });

  it("AC-5: a statement the door cannot read is 400 REQUEST_MALFORMED, never a 500", async () => {
    const scene = await staged();
    const url = new URL(liveUrl(scene), "http://localhost");

    const notAUuid = await ask(scene, `/api/documents/not-a-uuid${url.search}`, scene.member.token);
    expect(notAUuid.status, "an id that is not an id is the caller's statement, not our outage").toBe(400);
    expect((await refusalOf(notAUuid))?.code).toBe("REQUEST_MALFORMED");

    url.searchParams.set("signature", "zzzz");
    const notHex = await ask(scene, `${url.pathname}${url.search}`, scene.member.token);
    expect(notHex.status, "a signature that is not hex is unreadable, not unverifiable").toBe(400);
    expect((await refusalOf(notHex))?.code).toBe("REQUEST_MALFORMED");
  });
});
