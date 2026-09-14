/**
 * AC-3, the other half of the door's closed status table: the four answers a MEMBER's request can
 * still earn once membership is settled — 403 EXPORT_URL_INVALID, 410 EXPORT_URL_EXPIRED, 404
 * EXPORT_NOT_FOUND and 400 REQUEST_MALFORMED — driven over `Request`/`Response` through the shipped
 * `GET` of src/app/api/exports/[id]/route.ts.
 *
 * The seam's own suite already exercises the three EXPORT_* codes where they are DECIDED
 * (`readSignedExport`, src/core/exports/__tests__/download-link.test.ts). What is proved here is the
 * only thing this route adds to them: the HTTP status each is spoken under. Without it the door's
 * table could transpose 410 and 404, or lose a key and answer `undefined`, and every suite would
 * stay green.
 *
 * One real account is enrolled through the product's own sign-up door, so the workspace and the
 * membership are written by R-SPINE-002 rather than by a row placed here; raw SQL is spoken through
 * psql (SEAM-TENANT), and product modules are imported after DATABASE_URL, STORAGE_ROOT and the
 * signing secret name the scratch world, exactly as db/__tests__/authz/authorize.live.test.ts does.
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "./support/fixtures";
import { lit, scalar } from "./support/live-sql";

/** The artefact this door is asked for: a CSV the seam itself writes, stored at its own address. */
const SAMPLE = {
  name: "Bill",
  freezeHeader: true,
  columns: [
    { key: "item", header: "Item", kind: "text" },
    { key: "rate", header: "Rate", kind: "money" },
  ],
  rows: [["Concrete M25", "8500.00"]],
} as const;

/** An address of the right shape that nothing was ever stored at — 64 hex characters of nobody. */
const NOWHERE = "b".repeat(64);

type Seam = {
  buildWorkbook: (spec: { sheets: readonly unknown[] }) => Promise<Uint8Array>;
  writeCsv: (sheet: unknown) => Uint8Array;
  storeExport: (storage: unknown, tenantId: string, bytes: Uint8Array) => Promise<{ sha256: string }>;
  exportDownloadUrl: (storage: unknown, address: { tenantId: string; sha256: string; kind: string; expiresInSeconds: number }) => string;
};

type Route = { GET: (request: Request, address?: { params: Promise<Record<string, string>> }) => Promise<Response> };

let scratch: ScratchDb | undefined;
let seam: Seam;
let route: Route;
let storage: unknown;
let sessionCookie: string;

const scene = { tenantId: "", token: "", csv: "", xlsx: "" };

/** A staging read, spoken under the system reason the seam's own writes record (SEAM-TENANT). */
const sysScalar = (sql: string): string => scalar(scratch?.urlMigrate ?? "", `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);

/** The request a browser makes: the path as written, carrying the member's cookie jar. */
const ask = async (path: string): Promise<Response> => {
  const url = new URL(path, "http://localhost");
  const id = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  return route.GET(new Request(url, { headers: { cookie: `${sessionCookie}=${scene.token}` } }), { params: Promise.resolve({ id }) });
};

const refusalCodeOf = async (answer: Response): Promise<unknown> => ((await answer.json()) as { refusal?: { code?: unknown } }).refusal?.code;

/** A link for a stored artefact, minted from the storage seam's own signer. */
const linkTo = (sha256: string, kind: string, expiresInSeconds = 900): string =>
  seam.exportDownloadUrl(storage, { tenantId: scene.tenantId, sha256, kind, expiresInSeconds });

let staging: Promise<void> | undefined;

/** The scene, staged once and awaited by every case — lazy, so a missing door fails each case. */
const staged = (): Promise<void> => (staging ??= stage());

async function stage(): Promise<void> {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;
  process.env["STORAGE_ROOT"] = mkdtempSync(join(tmpdir(), "cubit-exports-door-"));
  process.env["CUBIT_STORAGE_SIGNING_SECRET"] = `door-${randomUUID()}`;

  const auth = (await import("../../src/server/auth/session")) as typeof import("../../src/server/auth/session");
  sessionCookie = auth.SESSION_COOKIE;

  const marker = `member-${randomUUID().slice(0, 8)}`;
  const { sessionToken } = await auth.signUp({
    email: `inc301-door-${marker}@cubit.test`,
    password: "correct horse battery staple",
    tenantName: `Exports ${marker}`,
    deviceLabel: "acceptance",
    origin: "https://cubit.example",
    requestId: randomUUID(),
  });
  scene.token = sessionToken;
  // The identity seam stores a FOLDED address, so the account is found by its marker (R-SPINE-007).
  const userId = sysScalar(`select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
  scene.tenantId = sysScalar(`select tenant_id::text from memberships where user_id = ${lit(userId)} limit 1;`);

  seam = (await import("../../src/core/exports")) as unknown as Seam;
  const app = (await import("../../src/core/storage/app")) as typeof import("../../src/core/storage/app");
  storage = app.appStorage();

  ({ sha256: scene.csv } = await seam.storeExport(storage, scene.tenantId, seam.writeCsv(SAMPLE)));
  ({ sha256: scene.xlsx } = await seam.storeExport(storage, scene.tenantId, await seam.buildWorkbook({ sheets: [SAMPLE] })));

  route = (await import("../../src/app/api/exports/[id]/route")) as unknown as Route;
}

afterAll(async () => {
  if (scratch === undefined) return;
  const { closePools } = (await import("../../src/core/db")) as typeof import("../../src/core/db");
  await closePools();
  await scratch.drop();
});

describe("AC-3: the door's closed status table, spoken over HTTP", () => {
  it("answers 403 EXPORT_URL_INVALID a link whose signature was rewritten", async () => {
    await staged();
    const url = new URL(linkTo(scene.csv, "csv"), "http://localhost");
    const signature = url.searchParams.get("signature") ?? "";
    url.searchParams.set("signature", signature.replace(/^./u, (first) => (first === "0" ? "1" : "0")));

    const answer = await ask(`${url.pathname}${url.search}`);
    expect(answer.status, "a link this product did not mint is the same 'not yours' as a refused guard (Q-12)").toBe(403);
    expect(await refusalCodeOf(answer)).toBe("EXPORT_URL_INVALID");
  });

  it("answers 410 EXPORT_URL_EXPIRED a link that has aged out", async () => {
    await staged();
    // The shortest lifetime the storage seam mints, then lived through: the door reads the real
    // clock (`appStorage()`), and a link that expires is a fact about time passing rather than about
    // a timer somebody moved. A second is what "expires" costs to prove honestly (Q-12).
    const link = linkTo(scene.csv, "csv", 1);
    await new Promise((resolve) => setTimeout(resolve, 1_500));

    const answer = await ask(link);
    expect(answer.status, "gone, and known to have been here").toBe(410);
    expect(await refusalCodeOf(answer)).toBe("EXPORT_URL_EXPIRED");
  });

  it("answers 404 EXPORT_NOT_FOUND a good link to an address nothing stands at", async () => {
    await staged();
    const answer = await ask(linkTo(NOWHERE, "csv"));
    expect(answer.status).toBe(404);
    expect(await refusalCodeOf(answer)).toBe("EXPORT_NOT_FOUND");
  });

  it("answers 400 REQUEST_MALFORMED a statement this door cannot read", async () => {
    await staged();
    // Each part is judged as the text it travels as, so each is a sentence this door cannot read:
    // an address that is not a digest, a workspace that is not an id, a kind this seam never wrote,
    // and an expiry that is not a number.
    const good = new URL(linkTo(scene.csv, "csv"), "http://localhost");
    const mangled = [
      `/api/exports/NOT_A_LINK${good.search}`,
      `${good.pathname}?${new URLSearchParams({ ...Object.fromEntries(good.searchParams), tenant: "not-a-uuid" }).toString()}`,
      `${good.pathname}?${new URLSearchParams({ ...Object.fromEntries(good.searchParams), kind: "pdf" }).toString()}`,
      `${good.pathname}?${new URLSearchParams({ ...Object.fromEntries(good.searchParams), expires: "" }).toString()}`,
    ];

    for (const path of mangled) {
      const answer = await ask(path);
      expect(answer.status, `${path} is not a statement this door reads`).toBe(400);
      expect(await refusalCodeOf(answer), `${path} is refused as unreadable, never as a fault`).toBe("REQUEST_MALFORMED");
    }
  });

  it("refuses a link whose kind disagrees with the artefact stored at the address (Q-12)", async () => {
    await staged();
    // `kind` rides the query outside the signature, so a holder of a good link can rewrite it. The
    // door checks it against the bytes rather than repeating the claim in Content-Type.
    for (const [sha256, claimed] of [
      [scene.csv, "xlsx"],
      [scene.xlsx, "csv"],
    ] as const) {
      const answer = await ask(linkTo(sha256, claimed));
      expect(answer.status, `a ${claimed} claim over the other artefact is not a link this seam minted`).toBe(403);
      expect(await refusalCodeOf(answer)).toBe("EXPORT_URL_INVALID");
    }
  });

  it("serves the artefact when the link and the stored bytes agree", async () => {
    await staged();
    for (const [sha256, kind] of [
      [scene.csv, "csv"],
      [scene.xlsx, "xlsx"],
    ] as const) {
      const answer = await ask(linkTo(sha256, kind));
      expect(answer.status, `${kind} is what is stored at ${sha256}`).toBe(200);
      expect(answer.headers.get("content-disposition")).toBe(`attachment; filename="${sha256}.${kind}"`);
    }
  });
});
