/**
 * Public acceptance for SEAM-STORAGE (R-SPINE-021, Q-12): AC-1 … AC-3.
 *
 * The seam is loaded by absolute path rather than by a static specifier, exactly as
 * `src/core/format.test.ts` loads SEAM-FORMAT: a module the product does not provide yet must fail
 * as an assertion naming the file, never as an unreadable resolution error.
 *
 * Every root this file writes under is an `mkdtemp` directory inside the operating system's
 * temporary directory — nothing here writes into the repository, and `storage/` (the committed
 * runtime root) is untouched.
 *
 * Configuration is injected, so the clock is a value this file owns: expiry is proven by moving an
 * injected `now`, never by sleeping.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const STORAGE_MODULE = "src/core/storage/index.ts";

/** The four procedures the seam names (SEAM-STORAGE: `storage.put/get/sign`, plus `verify`). */
const REQUIRED_PROCEDURES = ["put", "get", "sign", "verify"] as const;

/**
 * Names a storage seam may not answer to. R-SPINE-021 retains every revision forever, so the
 * surface offers no way to remove or replace a stored object. This is a ban list — a rule about
 * what may never appear — not a roster of what the seam exports, which later work may extend.
 */
const DESTRUCTIVE_NAMES = ["delete", "del", "remove", "rm", "unlink", "destroy", "purge", "clear", "truncate", "drop", "overwrite", "replace", "evict"];

/** A sha256 address as the contract spells it: exactly 64 lowercase hex characters. */
const ADDRESS_SHAPE = /^[0-9a-f]{64}$/;

interface Signed {
  expiresInSeconds: number;
}

type Verification = { ok: true; tenantId: string; sha256: string } | { ok: false; reason: string };

interface Storage {
  put(tenantId: string, bytes: Uint8Array): Promise<{ sha256: string }>;
  get(tenantId: string, sha256: string): Promise<Uint8Array | null>;
  sign(tenantId: string, sha256: string, opts: Signed): string;
  verify(url: string, at?: Date): Verification;
}

interface StorageOptions {
  root: string;
  signingSecret: string;
  now?: () => Date;
}

interface StorageModule {
  makeStorage(options: StorageOptions): Storage;
}

let pending: Promise<StorageModule> | undefined;

/** The seam, loaded once and memoised — a failure here is every test's failure, never a skip. */
const seam = (): Promise<StorageModule> =>
  (pending ??= (async (): Promise<StorageModule> => {
    const absolute = join(REPO_ROOT, STORAGE_MODULE);
    expect(existsSync(absolute), `${STORAGE_MODULE} is missing from the checkout — the product does not provide SEAM-STORAGE yet`).toBe(true);
    const specifier: string = absolute;
    const loaded = (await import(specifier)) as StorageModule;
    expect(loaded.makeStorage, `${STORAGE_MODULE} must export \`makeStorage\` (SEAM-STORAGE's declared interface)`).toBeTypeOf("function");
    return loaded;
  })());

const scratchRoots: string[] = [];

/** A private root outside the repository; removed when the file is done with it. */
async function scratchRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "cubit-storage-"));
  scratchRoots.push(root);
  return root;
}

/** A seam over a fresh scratch root, with every knob injected. */
async function storageOver(options: { root: string; signingSecret?: string; now?: () => Date }): Promise<Storage> {
  const { makeStorage } = await seam();
  const made = makeStorage({
    root: options.root,
    signingSecret: options.signingSecret ?? testSecret(),
    ...(options.now ? { now: options.now } : {}),
  });
  for (const name of REQUIRED_PROCEDURES) {
    expect(made[name], `makeStorage(...) must answer to \`${name}\` (SEAM-STORAGE)`).toBeTypeOf("function");
  }
  return made;
}

/** A signing secret nobody shares: it is minted per call, so "the URL never contains it" has teeth. */
const testSecret = (): string => `acceptance-signing-secret-${randomUUID()}`;

/** The lowercase-hex SHA-256 of some bytes — the address the contract defines, computed from it. */
const addressOf = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Content comparison that reads as content, and shows `null` for what it is. */
const contentOf = (value: Uint8Array | null): string => (value === null ? "«null»" : Buffer.from(value).toString("base64"));

/** Did this call fail, and with what? Answers for a synchronous throw and a rejected promise alike. */
async function outcomeOf(call: () => unknown): Promise<{ threw: boolean; error: unknown; answer: unknown }> {
  try {
    const answer = await call();
    return { threw: false, error: undefined, answer };
  } catch (error) {
    return { threw: true, error, answer: undefined };
  }
}

/** Every entry the seam has laid down anywhere under a root, as repo-free relative paths. */
function entriesUnder(root: string): string[] {
  const walk = (dir: string, prefix: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const here = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      return entry.isDirectory() ? walk(join(dir, entry.name), here) : [here];
    });
  return walk(root, "").sort();
}

afterAll(async () => {
  for (const root of scratchRoots) await rm(root, { recursive: true, force: true });
});

describe("SEAM-STORAGE", () => {
  test("AC-1: put content-addresses its bytes, lands them at <root>/<tenantId>/<sha256>, and is idempotent", async () => {
    const root = await scratchRoot();
    const storage = await storageOver({ root });
    const tenantId = randomUUID();
    const bytes = new Uint8Array(randomBytes(256));

    const stored = await storage.put(tenantId, bytes);

    expect(stored.sha256, "put answers the lowercase-hex sha256 of the bytes").toBe(addressOf(bytes));
    expect(stored.sha256).toMatch(ADDRESS_SHAPE);

    const onDisk = join(root, tenantId, stored.sha256);
    expect(existsSync(onDisk), `the object must exist at <root>/<tenantId>/<sha256> (${onDisk})`).toBe(true);
    expect(statSync(onDisk).isFile(), "the address names a file, not a directory").toBe(true);
    expect(Buffer.from(readFileSync(onDisk)).toString("base64"), "the stored file holds the bytes as given").toBe(contentOf(bytes));

    const read = await storage.get(tenantId, stored.sha256);
    expect(read, "get answers bytes").toBeInstanceOf(Uint8Array);
    expect(contentOf(read), "get answers byte-identical content").toBe(contentOf(bytes));

    const again = await storage.put(tenantId, bytes);
    expect(again.sha256, "a second put of identical bytes is the same address").toBe(stored.sha256);
    // Exactly one object is not a frozen count: it IS idempotence — a second copy of the same bytes
    // under the same tenant would be the duplicate content addressing exists to prevent.
    expect(entriesUnder(join(root, tenantId)), "the tenant prefix holds exactly the one stored object").toEqual([stored.sha256]);
    expect(contentOf(await storage.get(tenantId, stored.sha256)), "the re-put object still reads back as the original bytes").toBe(contentOf(bytes));
  });

  test("AC-2: sign mints an expiring URL that hides the secret, and verify answers it with injected time", async () => {
    const root = await scratchRoot();
    const signingSecret = testSecret();
    // An exact second, so `expires` cannot be read as a rounding choice.
    let clock = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
    const storage = await storageOver({ root, signingSecret, now: () => clock });
    const tenantId = randomUUID();
    const bytes = new Uint8Array(randomBytes(64));
    const { sha256 } = await storage.put(tenantId, bytes);

    const expiresInSeconds = 900;
    const url = storage.sign(tenantId, sha256, { expiresInSeconds });

    const shape = new RegExp(`^/storage/v1/${tenantId}/${sha256}\\?expires=(\\d+)&signature=([0-9a-fA-F]+)$`);
    const parts = shape.exec(url);
    expect(parts, `sign must answer /storage/v1/{tenantId}/{sha256}?expires={unixSeconds}&signature={hex} — got ${url}`).not.toBeNull();
    const expires = Number(parts?.[1]);
    const signature = String(parts?.[2]);
    expect(expires, "expires is the injected now plus expiresInSeconds, in whole seconds").toBe(Math.floor(clock.getTime() / 1000) + expiresInSeconds);

    // Q-12: no secrets leak into the artefact a browser will carry.
    expect(url, "the signed URL must not carry the signing secret").not.toContain(signingSecret);
    expect(url).not.toContain(Buffer.from(signingSecret, "utf8").toString("hex"));
    expect(url).not.toContain(Buffer.from(signingSecret, "utf8").toString("base64url"));

    const before = new Date((expires - 1) * 1000);
    const after = new Date((expires + 60) * 1000);
    expect(storage.verify(url, before), "a URL verified strictly before expiry names its address").toMatchObject({ ok: true, tenantId, sha256 });
    expect(storage.verify(url, after), "a URL verified after expiry is refused as expired").toMatchObject({ ok: false, reason: "expired" });

    // `at` defaults to the injected now, so the same URL answers differently as the clock moves.
    clock = before;
    expect(storage.verify(url), "verify with no `at` reads the injected clock").toMatchObject({ ok: true, tenantId, sha256 });
    clock = after;
    expect(storage.verify(url), "verify with no `at` sees the clock past expiry").toMatchObject({ ok: false, reason: "expired" });
    clock = before;

    // Every tampered field is altered in a direction that leaves the URL unexpired at `before`, so
    // "invalid" is the only answer a working verifier can give.
    const otherTenantId = randomUUID();
    const otherSha256 = addressOf(new Uint8Array(randomBytes(64)));
    const flipped = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;
    const tampered: Record<string, string> = {
      "a substituted tenantId": url.replace(tenantId, otherTenantId),
      "a substituted sha256": url.replace(sha256, otherSha256),
      "a stretched expires value": url.replace(`expires=${expires}`, `expires=${expires + 3600}`),
      "an altered signature": url.replace(`signature=${signature}`, `signature=${flipped}`),
    };
    for (const [what, candidate] of Object.entries(tampered)) {
      expect(candidate, `${what} must actually change the URL`).not.toBe(url);
      expect(storage.verify(candidate, before), `${what} must verify as invalid`).toMatchObject({ ok: false, reason: "invalid" });
    }

    const stranger = await storageOver({ root, signingSecret: testSecret(), now: () => clock });
    expect(stranger.verify(url, before), "a URL signed under a different secret is invalid").toMatchObject({ ok: false, reason: "invalid" });
  });

  test("AC-3: prefixes are per tenant, every revision is retained, and malformed addresses throw before any filesystem touch", async () => {
    const root = await scratchRoot();
    const storage = await storageOver({ root });
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    const first = new Uint8Array(randomBytes(128));
    const { sha256 } = await storage.put(tenantA, first);

    expect(await storage.get(tenantB, sha256), "another tenant's id must not reach tenant A's object").toBeNull();

    for (const name of DESTRUCTIVE_NAMES) {
      const surface = storage as unknown as Record<string, unknown>;
      expect(typeof surface[name], `the storage surface must expose no \`${name}\` — every revision is retained forever (R-SPINE-021)`).not.toBe("function");
    }

    // Retention, proven behaviourally: later puts never disturb an address already handed out.
    const kept = new Map<string, Uint8Array>([[sha256, first]]);
    for (let revision = 0; revision < 4; revision += 1) {
      const bytes = new Uint8Array(randomBytes(96 + revision));
      const address = await storage.put(tenantA, bytes);
      kept.set(address.sha256, bytes);
    }
    for (const [address, bytes] of kept) {
      expect(contentOf(await storage.get(tenantA, address)), `the address ${address} must still read back its original bytes`).toBe(contentOf(bytes));
    }

    const clean = await scratchRoot();
    const guarded = await storageOver({ root: clean });
    const validTenant = randomUUID();
    const validAddress = addressOf(new Uint8Array(randomBytes(8)));
    const badTenants: Record<string, string> = {
      empty: "",
      "not a uuid": "tenant-one",
      "an uppercase uuid": randomUUID().toUpperCase(),
      "a uuid without its dashes": randomUUID().replaceAll("-", ""),
      "a bare parent segment": "..",
      "a traversal prefix": `../${randomUUID()}`,
      "a traversal suffix": `${randomUUID()}/..`,
      "a nested path": `${randomUUID()}/nested`,
      "an absolute path": `/${randomUUID()}`,
    };
    const badAddresses: Record<string, string> = {
      empty: "",
      "63 hex characters": validAddress.slice(0, 63),
      "65 hex characters": `${validAddress}0`,
      "uppercase hex": validAddress.toUpperCase(),
      "a non-hex character": `g${validAddress.slice(1)}`,
      "a traversal of the right length": `../${validAddress.slice(3)}`,
      "a separator inside the address": `${validAddress.slice(0, 63)}/`,
      "a traversal path": "../../etc/passwd",
    };

    for (const [what, tenantId] of Object.entries(badTenants)) {
      for (const [procedure, call] of [
        ["put", (): unknown => guarded.put(tenantId, first)],
        ["get", (): unknown => guarded.get(tenantId, validAddress)],
        ["sign", (): unknown => guarded.sign(tenantId, validAddress, { expiresInSeconds: 60 })],
      ] as const) {
        const outcome = await outcomeOf(call);
        expect(outcome.threw, `${procedure} must throw for a tenantId that is ${what} — it answered ${String(outcome.answer)}`).toBe(true);
        expect(outcome.error, `${procedure}'s refusal of a tenantId that is ${what} is an Error`).toBeInstanceOf(Error);
      }
    }

    for (const [what, address] of Object.entries(badAddresses)) {
      for (const [procedure, call] of [
        ["get", (): unknown => guarded.get(validTenant, address)],
        ["sign", (): unknown => guarded.sign(validTenant, address, { expiresInSeconds: 60 })],
      ] as const) {
        const outcome = await outcomeOf(call);
        expect(outcome.threw, `${procedure} must throw for a sha256 that is ${what} — it answered ${String(outcome.answer)}`).toBe(true);
        expect(outcome.error, `${procedure}'s refusal of a sha256 that is ${what} is an Error`).toBeInstanceOf(Error);
      }
    }

    expect(entriesUnder(clean), "a rejected address must be refused before anything is written").toEqual([]);
  });
});
