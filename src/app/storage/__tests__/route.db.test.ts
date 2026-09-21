/**
 * THE SIGNED OBJECT DOOR — `GET /storage/v1/<tenant>/<sha256>?expires=&signature=` (R-SPINE-021,
 * R-SPINE-022, Q-12, AM-11 §2).
 *
 * WHY THIS EXISTS. SEAM-STORAGE mints signed download URLs under `/storage/v1/…` and the thumbnail
 * pipeline hands one to every sheet card (`sheet-card-thumbnail`'s `src`), the viewer's raster
 * background is to be drawn from the same tiers — and until 2026-09-21 nothing in the tree answered
 * that address. Every card's thumbnail was a 404 in the built product, and no lane saw it: the J-010
 * baseline masks the thumbnail, the settle marker treats a broken `<img>` as settled, and the
 * journey asserted only that `src` was non-empty. Found by the session-3 probe reading the console
 * and the network of the served drawings screen.
 *
 * The door is the document door's shape (src/app/api/documents/[id]/route.ts): a session, the one
 * authorize() for the workspace the link names, the storage seam's own verification of the link,
 * and the bytes whole under the object's content type — never a listing, never a path.
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "../../../../db/__tests__/support/fixtures";
import { lit, scalar } from "../../../../db/__tests__/support/live-sql";
import { productModule } from "../../../../tests/docs/support/product";
import { closePools } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import { makeStorage, type Storage } from "@/core/storage/index";

vi.mock("@/server/authorize", async (importOriginal) => {
  const real = (await importOriginal()) as typeof import("@/server/authorize");
  return { ...real, authorize: vi.fn(real.authorize) };
});

type Route = { GET: (request: Request, address?: { params: Promise<Record<string, string>> }) => Promise<Response> };
type Person = { userId: string; token: string };

const LIVE_SECONDS = 900;

/** A PNG by its signature: the eight bytes every PNG opens with, then whatever the tier drew. */
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...Buffer.from(`a raster ${randomUUID()}`, "utf8")]);

let scratch: ScratchDb | undefined;
let staging: Promise<Scene> | undefined;

type Scene = {
  tenantId: string;
  member: Person;
  outsider: Person;
  storage: Storage;
  route: Route;
  sessionCookie: string;
  sha256: string;
  root: string;
  secret: string;
};

const sysScalar = (sql: string): string => scalar(scratch?.urlMigrate ?? "", `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);

const staged = (): Promise<Scene> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const root = mkdtempSync(join(tmpdir(), "cubit-storage-door-"));
    const secret = `storage-door-${randomUUID()}`;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    process.env["STORAGE_ROOT"] = root;
    process.env["CUBIT_STORAGE_SIGNING_SECRET"] = secret;

    const auth = (await import("@/server/auth/session")) as typeof import("@/server/auth/session");
    const enrol = async (label: string): Promise<Person> => {
      const marker = `${label}-${randomUUID().slice(0, 8)}`;
      const { sessionToken } = await auth.signUp({
        email: `storage-door-${marker}@cubit.test`,
        password: "correct horse battery staple",
        tenantName: `Storage door ${marker}`,
        deviceLabel: "acceptance",
        origin: "https://cubit.example",
        requestId: randomUUID(),
      });
      return { userId: sysScalar(`select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`), token: sessionToken };
    };

    const member = await enrol("member");
    const outsider = await enrol("outsider");
    const tenantId = sysScalar(`select tenant_id::text from memberships where user_id = ${lit(member.userId)} limit 1;`);

    const app = (await import("@/core/storage/app")) as typeof import("@/core/storage/app");
    const storage = app.appStorage();
    const { sha256 } = await storage.put(tenantId, PNG);

    const route = (await productModule<Route>("src/app/storage/v1/[tenant]/[address]/route.ts")) as Route;
    return { tenantId, member, outsider, storage, route, sessionCookie: auth.SESSION_COOKIE, sha256, root, secret };
  })());

afterAll(async () => {
  await closePools();
  await scratch?.drop();
});

async function ask(scene: Scene, path: string, token: string | null): Promise<Response> {
  const url = new URL(path, "http://localhost");
  const [, , , tenant, address] = url.pathname.split("/");
  const headers: Record<string, string> = token === null ? {} : { cookie: `${scene.sessionCookie}=${token}` };
  return scene.route.GET(new Request(url, { headers }), { params: Promise.resolve({ tenant: tenant ?? "", address: address ?? "" }) });
}

async function refusalOf(answer: Response): Promise<{ code?: string } | undefined> {
  return ((await answer.json()) as { refusal?: { code?: string } }).refusal;
}

const liveUrl = (scene: Scene): string => scene.storage.sign(scene.tenantId, scene.sha256, { expiresInSeconds: LIVE_SECONDS });

describe("the signed object door: what SEAM-STORAGE mints, the product serves", () => {
  it("the link is the object's own address under /storage/v1, signed by the storage seam", async () => {
    const scene = await staged();
    const url = new URL(liveUrl(scene), "http://localhost");
    expect(url.pathname).toBe(`/storage/v1/${scene.tenantId}/${scene.sha256}`);
    expect(Number(url.searchParams.get("expires")), "the link expires (Q-12)").toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(url.searchParams.get("signature")).toMatch(/^[0-9a-f]+$/u);
  });

  it("a request with no session is refused 401 SIGNED_OUT", async () => {
    const scene = await staged();
    const answer = await ask(scene, liveUrl(scene), null);
    expect(answer.status).toBe(401);
    expect(await refusalOf(answer)).toEqual(REFUSALS.SIGNED_OUT);
  });

  it("a signed-in outsider is refused 403 WORKSPACE_PERMISSION_NOT_HELD, the one authorize() having been asked (AM-11 §2)", async () => {
    const scene = await staged();
    const { authorize } = (await import("@/server/authorize")) as typeof import("@/server/authorize");
    vi.mocked(authorize).mockClear();

    const answer = await ask(scene, liveUrl(scene), scene.outsider.token);
    expect(answer.status).toBe(403);
    expect((await refusalOf(answer))?.code).toBe("WORKSPACE_PERMISSION_NOT_HELD");
    const asked = vi.mocked(authorize).mock.calls.map(([question]) => ({ userId: question.userId, tenantId: question.tenantId }));
    expect(asked).toContainEqual({ userId: scene.outsider.userId, tenantId: scene.tenantId });
  });

  it("a member whose signature does not verify is refused 403 RASTER_URL_INVALID", async () => {
    const scene = await staged();
    const url = new URL(liveUrl(scene), "http://localhost");
    const signature = url.searchParams.get("signature") ?? "";
    url.searchParams.set("signature", `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`);
    const answer = await ask(scene, `${url.pathname}${url.search}`, scene.member.token);
    expect(answer.status).toBe(403);
    expect((await refusalOf(answer))?.code).toBe("RASTER_URL_INVALID");
  });

  it("a member whose link has aged out is refused 410 RASTER_URL_EXPIRED", async () => {
    const scene = await staged();
    const anHourAgo = makeStorage({ root: scene.root, signingSecret: scene.secret, now: () => new Date(Date.now() - 60 * 60 * 1000) });
    const stale = anHourAgo.sign(scene.tenantId, scene.sha256, { expiresInSeconds: LIVE_SECONDS });
    const answer = await ask(scene, stale, scene.member.token);
    expect(answer.status).toBe(410);
    expect((await refusalOf(answer))?.code).toBe("RASTER_URL_EXPIRED");
  });

  it("a member asking for an address the store does not hold is answered 404 RASTER_NOT_FOUND", async () => {
    const scene = await staged();
    const absent = "0".repeat(64);
    const answer = await ask(scene, scene.storage.sign(scene.tenantId, absent, { expiresInSeconds: LIVE_SECONDS }), scene.member.token);
    expect(answer.status).toBe(404);
    expect((await refusalOf(answer))?.code).toBe("RASTER_NOT_FOUND");
  });

  it("the member is served the stored bytes, whole, as the image they are, never cached in between", async () => {
    const scene = await staged();
    const answer = await ask(scene, liveUrl(scene), scene.member.token);
    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-type"), "a PNG is served as one — the bytes say what they are").toBe("image/png");
    expect(answer.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await answer.arrayBuffer())).toEqual(PNG);
  });

  it("a statement the door cannot read is 400 REQUEST_MALFORMED, never a 500", async () => {
    const scene = await staged();
    const url = new URL(liveUrl(scene), "http://localhost");
    const notAnAddress = await ask(scene, `/storage/v1/${scene.tenantId}/not-a-digest${url.search}`, scene.member.token);
    expect(notAnAddress.status).toBe(400);
    expect((await refusalOf(notAnAddress))?.code).toBe("REQUEST_MALFORMED");
    url.searchParams.set("signature", "zzzz");
    const notHex = await ask(scene, `${url.pathname}${url.search}`, scene.member.token);
    expect(notHex.status).toBe(400);
    expect((await refusalOf(notHex))?.code).toBe("REQUEST_MALFORMED");
  });
});
