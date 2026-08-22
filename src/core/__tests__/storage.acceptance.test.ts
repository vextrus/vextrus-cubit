/**
 * inc-100 acceptance — SEAM-STORAGE puts, gets and signs, the same way on both drivers.
 *
 * SEAM-STORAGE: "`storage.put/get/sign` — local FS in dev, S3-compatible in prod; every
 * stored object content-addressed with its sha256." R-SPINE-021 adds the per-tenant prefix,
 * the signed download URL and retention of every revision forever; Q-12 requires that a
 * signed URL expires.
 *
 * "The same way on both drivers" is the shape of this file rather than a remark in it: one
 * contract is written once and executed twice, against a temp directory and against the
 * loopback S3 fake the test contract declares. A behaviour that only holds under `fs` is not
 * a seam, it is a driver with a second implementation behind it — so every criterion below
 * runs under both, and the only lane-shaped assertions are the ones the spec itself makes
 * lane-shaped (the URL's spelling, and the fs signing secret).
 *
 * The seam is imported inside each test. A module that does not exist yet would otherwise
 * take the whole file down as one collection error, and a single red line says far less than
 * a list of the behaviours still missing.
 *
 * Every refusal code is written out in full and made to fire. Q-07 counts a code as
 * exercised when a test names it; a name with no firing behind it would be a code excused
 * rather than proved.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RefusalEntry } from '../errors';
import { startS3Fake } from './support/s3-fake';
import type { S3Fake } from './support/s3-fake';

/** The interface the Increment Spec pins, as a type this file can hold the module to. */
interface TenantStorage {
  put(bytes: Uint8Array): Promise<{ sha256: string; key: string }>;
  get(sha256: string): Promise<Uint8Array>;
  sign(sha256: string, opts: { expiresInSeconds: number }): Promise<string>;
}

interface StorageSeam {
  storageForTenant(ctx: { tenantId: string }): TenantStorage;
  serveSigned(url: string): Promise<Uint8Array>;
  objectKey(tenantId: string, sha256: string): string;
}

/** The seam, per test: a missing module then reads as the missing feature it is. */
const seam = async (): Promise<StorageSeam> => (await import('../storage')) as StorageSeam;

const TENANT_A = '11111111-2222-4333-8444-555555555555';

/** The fs driver's signing secret. Any string; what matters is that it is present. */
const FS_SECRET = 'cubit-fs-url-signing-secret-for-acceptance';

/** Every env var the seam reads, cleared before each test so a lane cannot inherit one. */
const STORAGE_ENV = [
  'CUBIT_STORAGE_DRIVER',
  'CUBIT_STORAGE_DIR',
  'CUBIT_STORAGE_SECRET',
  'CUBIT_S3_ENDPOINT',
  'CUBIT_S3_REGION',
  'CUBIT_S3_BUCKET',
  'CUBIT_S3_ACCESS_KEY_ID',
  'CUBIT_S3_SECRET_ACCESS_KEY',
] as const;

/** Milliseconds per second, named so the divisor is not read as a conversion factor. */
const MILLIS_PER_SECOND = 1_000;

/** Longer than one second of real time: AC-2's expiry is proven by waiting, not by a clock. */
const PAST_ONE_SECOND_MS = 1_400;

function applyEnv(env: Record<string, string>): void {
  for (const name of STORAGE_ENV) delete process.env[name];
  for (const [name, value] of Object.entries(env)) process.env[name] = value;
}

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function nowSeconds(): number {
  return Math.floor(Date.now() / MILLIS_PER_SECOND);
}

/** One lane of the contract: a driver, the env that selects it, and its resources. */
interface Lane {
  readonly driver: 'fs' | 's3';
  start(): Promise<void>;
  env(): Record<string, string>;
  stop(): Promise<void>;
}

function fsLane(): Lane {
  let dir = '';
  return {
    driver: 'fs',
    async start() {
      dir = await mkdtemp(join(tmpdir(), 'cubit-storage-fs-'));
    },
    env() {
      return {
        CUBIT_STORAGE_DRIVER: 'fs',
        CUBIT_STORAGE_DIR: dir,
        CUBIT_STORAGE_SECRET: FS_SECRET,
      };
    },
    async stop() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

function s3Lane(): Lane {
  let fake: S3Fake | undefined;
  return {
    driver: 's3',
    async start() {
      fake = await startS3Fake();
    },
    env() {
      return fake === undefined ? {} : { ...fake.env };
    },
    async stop() {
      await fake?.close();
    },
  };
}

/** The query parameter each driver carries its signature and its expiry in. */
const SIGNATURE_PARAM = { fs: 'sig', s3: 'X-Amz-Signature' } as const;
const EXPIRY_PARAM = { fs: 'exp', s3: 'X-Amz-Expires' } as const;

/**
 * Replace one query parameter's value, leaving every other byte of the URL exactly as the
 * seam wrote it. Re-serialising through `URL` would re-encode the whole query and make a
 * refusal ambiguous — was it the tamper, or the rewrite? This edits and nothing else.
 */
function withParam(url: string, name: string, value: string): string {
  const pattern = new RegExp(`([?&]${name}=)[^&]*`);
  expect(url, `the URL must carry ${name}`).toMatch(pattern);
  return url.replace(pattern, `$1${value}`);
}

/**
 * A day's worth of expiry, spelled the way its driver spells expiry: fs carries the unix
 * second the URL dies at, s3 carries the seconds it was minted for.
 */
function extendedExpiry(driver: 'fs' | 's3'): string {
  const oneDay = 86_400;
  return driver === 'fs' ? String(nowSeconds() + oneDay) : String(oneDay);
}

/** A signature of the right shape and the wrong value: one hex digit turned over. */
function tamperedSignature(signature: string): string {
  const head = signature.slice(0, 1);
  return `${head === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
}

function wait(millis: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, millis);
  });
}

describe.each([fsLane(), s3Lane()])('SEAM-STORAGE contract · $driver driver', (lane: Lane) => {
  beforeAll(async () => {
    await lane.start();
  });
  afterAll(async () => {
    await lane.stop();
  });
  beforeEach(() => {
    applyEnv(lane.env());
  });

  // AC-1 — the handle is tenant-scoped before it is anything else, and the spine's own
  // refusal is the one it raises (TENANT_ID_INVALID is reused, not re-invented).
  it('AC-1 · refuses a tenant id that could never be a uuid, including the empty one', async () => {
    const { storageForTenant } = await seam();
    for (const notATenant of ['', '   ', 'not-a-uuid', 'T-0001', '11111111-2222-4333-8444']) {
      expect(() => storageForTenant({ tenantId: notATenant })).toThrow(/^TENANT_ID_INVALID: /);
    }
    expect(() => storageForTenant({ tenantId: TENANT_A })).not.toThrow();
  });

  // AC-1 — content addressing: the address is the sha256 of the bytes, and the key is the
  // tenant's prefix over that address, spelled the one way `objectKey` spells it.
  it('AC-1 · content-addresses what it stores and gives the same bytes back', async () => {
    const { storageForTenant, objectKey } = await seam();
    const store = storageForTenant({ tenantId: TENANT_A });
    const bytes = bytesOf(`GA-01 rev A — a drawing is evidence (${lane.driver})`);

    const stored = await store.put(bytes);

    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.sha256).toBe(sha256Of(bytes));
    expect(stored.key).toBe(`t/${TENANT_A}/sha256/${stored.sha256}`);
    expect(stored.key).toBe(objectKey(TENANT_A, stored.sha256));

    const read = await store.get(stored.sha256);
    expect(read).toBeInstanceOf(Uint8Array);
    expect(Uint8Array.from(read)).toEqual(bytes);
  });

  // AC-1 — a correct-looking address nobody stored is a miss, by name.
  it('AC-1 · refuses a sha256 nobody put, as STORAGE_OBJECT_MISSING', async () => {
    const { storageForTenant } = await seam();
    const store = storageForTenant({ tenantId: TENANT_A });
    const neverStored = sha256Of(bytesOf('bytes that were never handed to the seam'));

    expect(neverStored).toMatch(/^[0-9a-f]{64}$/);
    await expect(store.get(neverStored)).rejects.toThrow(/^STORAGE_OBJECT_MISSING: /);
  });

  // AC-2 — the URL has the spelling its driver's criterion gives it, and it serves the bytes.
  it('AC-2 · signs a download URL that serves the object inside its TTL', async () => {
    const { storageForTenant, serveSigned } = await seam();
    const store = storageForTenant({ tenantId: TENANT_A });
    const bytes = bytesOf(`GA-02 rev B — signed download (${lane.driver})`);
    const stored = await store.put(bytes);

    const url = await store.sign(stored.sha256, { expiresInSeconds: 60 });
    expect(typeof url).toBe('string');

    if (lane.driver === 'fs') {
      // `/storage/<key>?exp=<unix-seconds>&sig=<hex>` — the path a later increment mounts.
      expect(url.startsWith(`/storage/${stored.key}?`)).toBe(true);
      const params = new URL(url, 'http://storage.invalid').searchParams;
      const exp = Number(params.get('exp'));
      expect(params.get('exp')).toMatch(/^\d+$/);
      expect(params.get('sig')).toMatch(/^[0-9a-f]+$/);
      expect(exp).toBeGreaterThan(nowSeconds());
      expect(exp).toBeLessThanOrEqual(nowSeconds() + 60);
    } else {
      const parsed = new URL(url);
      expect(parsed.protocol).toBe('http:');
      expect(parsed.pathname).toContain(stored.key);
      expect(parsed.searchParams.get('X-Amz-Expires')).toBe('60');
      expect(parsed.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]+$/);
    }

    expect(Uint8Array.from(await serveSigned(url))).toEqual(bytes);
  });

  // AC-2 (Q-12) — the signature is what authorises the URL, and it is checked first: an
  // edited key and a forged expiry are both refused as STORAGE_URL_INVALID, never served.
  it('AC-2 · refuses a tampered signature, key or expiry, as STORAGE_URL_INVALID', async () => {
    const { storageForTenant, serveSigned } = await seam();
    const store = storageForTenant({ tenantId: TENANT_A });
    const bytes = bytesOf(`GA-03 rev C — tamper (${lane.driver})`);
    const stored = await store.put(bytes);
    const other = await store.put(bytesOf(`GA-04 rev A — another object (${lane.driver})`));

    const url = await store.sign(stored.sha256, { expiresInSeconds: 60 });
    const signatureParam = SIGNATURE_PARAM[lane.driver];
    const expiryParam = EXPIRY_PARAM[lane.driver];
    const signature = new URL(url, 'http://storage.invalid').searchParams.get(signatureParam);
    expect(signature).toMatch(/^[0-9a-f]+$/);

    // Not vacuous: the untouched URL serves. Each refusal below is the edit, not the shape.
    expect(Uint8Array.from(await serveSigned(url))).toEqual(bytes);

    const forgedSignature = withParam(url, signatureParam, tamperedSignature(signature ?? ''));
    await expect(serveSigned(forgedSignature)).rejects.toThrow(/^STORAGE_URL_INVALID: /);

    // The key swapped for another object this same tenant really does hold: the signature is
    // left stale, so a URL cannot be pointed at a second object by editing its path.
    const swappedKey = url.replace(stored.sha256, other.sha256);
    expect(swappedKey).not.toBe(url);
    await expect(serveSigned(swappedKey)).rejects.toThrow(/^STORAGE_URL_INVALID: /);

    // A forged expiry, signature left stale: signature before expiry means this is invalid.
    const extended = withParam(url, expiryParam, extendedExpiry(lane.driver));
    await expect(serveSigned(extended)).rejects.toThrow(/^STORAGE_URL_INVALID: /);
  });

  // AC-2 (Q-12, R-SPINE-021) — the signature is REQUIRED, not merely checked when present.
  // Strip the query and what is left is the object's raw address; if that served, "signed
  // download URLs" would be a URL format over an open bucket and "signed URLs expire" would
  // gate nothing, since the expiring part could simply be dropped.
  it('AC-2 · refuses an unsigned URL for a stored object, as STORAGE_URL_INVALID', async () => {
    const { storageForTenant, serveSigned } = await seam();
    const store = storageForTenant({ tenantId: TENANT_A });
    const bytes = bytesOf(`GA-06 rev A — no signature at all (${lane.driver})`);
    const stored = await store.put(bytes);

    const url = await store.sign(stored.sha256, { expiresInSeconds: 60 });
    expect(url).toContain('?');
    const unsigned = url.slice(0, url.indexOf('?'));
    expect(unsigned).toContain(stored.sha256);

    await expect(serveSigned(unsigned)).rejects.toThrow(/^STORAGE_URL_INVALID: /);

    if (lane.driver === 's3') {
      // Proven by the store refusing, not by the seam recognising a URL shape: fetched raw,
      // the bucket itself answers 403 AccessDenied for an object it really does hold.
      const direct = await fetch(unsigned);
      expect(direct.status).toBe(403);
      expect(await direct.text()).toContain('AccessDenied');
    }
  });

  // AC-2 (Q-12) — expiry proven by real time: one second's TTL, and more than a second waited.
  //
  // Two URLs on purpose. `expiresInSeconds` is second-granular and S3-compatible: the expiry
  // is computed from a floored signing second, so a URL minted at X.999s holds ~0ms of real
  // life. Serving the one-second URL first would race a loopback round trip against a second
  // boundary — a flake on a correct seam. The comfortable TTL carries "serves while valid"
  // (R-SPINE-021) with no boundary in reach; the one-second URL is never served before the
  // wait, so its refusal is the expiry (Q-12) and nothing else.
  it('AC-2 · serves inside its TTL and refuses past it, as STORAGE_URL_EXPIRED', async () => {
    const { storageForTenant, serveSigned } = await seam();
    const store = storageForTenant({ tenantId: TENANT_A });
    const bytes = bytesOf(`GA-05 rev A — one second of life (${lane.driver})`);
    const stored = await store.put(bytes);

    const living = await store.sign(stored.sha256, { expiresInSeconds: 60 });
    expect(Uint8Array.from(await serveSigned(living))).toEqual(bytes);

    const url = await store.sign(stored.sha256, { expiresInSeconds: 1 });

    await wait(PAST_ONE_SECOND_MS);

    await expect(serveSigned(url)).rejects.toThrow(/^STORAGE_URL_EXPIRED: /);

    // And an expired URL cannot be revived by rewriting the expiry it carries: that edit
    // invalidates the signature, which is checked first.
    const revived = withParam(url, EXPIRY_PARAM[lane.driver], extendedExpiry(lane.driver));
    await expect(serveSigned(revived)).rejects.toThrow(/^STORAGE_URL_INVALID: /);
  });
});

/**
 * AC-2's fs half: the signing secret is what makes an fs URL unforgeable, so its absence is
 * a refusal rather than an unsigned URL. Both the minting side and the serving side read the
 * environment at call time, so both are asked with the secret taken away.
 */
describe('SEAM-STORAGE · the fs driver signs with a secret or refuses (AC-2)', () => {
  let dir = '';

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cubit-storage-secret-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  beforeEach(() => {
    applyEnv({ CUBIT_STORAGE_DRIVER: 'fs', CUBIT_STORAGE_DIR: dir, CUBIT_STORAGE_SECRET: FS_SECRET });
  });

  it('AC-2 · refuses to sign with no CUBIT_STORAGE_SECRET, as STORAGE_SECRET_MISSING', async () => {
    const { storageForTenant } = await seam();
    const stored = await storageForTenant({ tenantId: TENANT_A }).put(bytesOf('unsignable'));

    applyEnv({ CUBIT_STORAGE_DRIVER: 'fs', CUBIT_STORAGE_DIR: dir });
    const unsecured = storageForTenant({ tenantId: TENANT_A });

    await expect(unsecured.sign(stored.sha256, { expiresInSeconds: 60 })).rejects.toThrow(
      /^STORAGE_SECRET_MISSING: /,
    );
  });

  it('AC-2 · refuses to serve a signed URL with no CUBIT_STORAGE_SECRET', async () => {
    const { storageForTenant, serveSigned } = await seam();
    const store = storageForTenant({ tenantId: TENANT_A });
    const stored = await store.put(bytesOf('signed while the secret was there'));
    const url = await store.sign(stored.sha256, { expiresInSeconds: 60 });

    applyEnv({ CUBIT_STORAGE_DRIVER: 'fs', CUBIT_STORAGE_DIR: dir });

    await expect(serveSigned(url)).rejects.toThrow(/^STORAGE_SECRET_MISSING: /);
  });
});

/**
 * The four codes join the closed taxonomy rather than living as literals in the seam
 * (R-SPINE-062, Q-07). The registry file is the seam's own module registry; the barrel folds
 * it in and adds nothing, so a code is registered exactly when the barrel knows it.
 */
describe("SEAM-STORAGE's refusals are registered, not invented (R-SPINE-062, Q-07)", () => {
  const CODES = [
    'STORAGE_OBJECT_MISSING',
    'STORAGE_URL_EXPIRED',
    'STORAGE_URL_INVALID',
    'STORAGE_SECRET_MISSING',
  ] as const;

  it('registers its four codes in src/core/errors/storage.ts, folded into the barrel', async () => {
    const { STORAGE_REFUSALS } = (await import('../errors/storage')) as {
      STORAGE_REFUSALS: Readonly<Record<string, RefusalEntry | undefined>>;
    };
    const { REFUSALS, REFUSAL_CODES } = await import('../errors');
    const table: Readonly<Record<string, RefusalEntry | undefined>> = REFUSALS;

    // Containment, not closure: the criterion asks that these four are registered and folded
    // into the barrel. It does not freeze the key set, and Q-12's "uploads validated" plans a
    // later upload-validation refusal that would legitimately add a fifth.
    expect(Object.keys(STORAGE_REFUSALS)).toEqual(expect.arrayContaining([...CODES]));
    expect(Object.isFrozen(STORAGE_REFUSALS)).toBe(true);

    for (const code of CODES) {
      const entry = table[code];
      expect(REFUSAL_CODES).toContain(code);
      expect(entry?.code).toBe(code);
      expect(entry?.message.trim()).not.toBe('');
      expect(entry?.remedy.trim()).not.toBe('');
      expect(['block', 'defer', 'warn']).toContain(entry?.severity);
      expect(['field', 'toast', 'page', 'log']).toContain(entry?.surface);
      expect(Object.isFrozen(entry)).toBe(true);
    }

    // TENANT_ID_INVALID is the spine's, reused by this seam; a second registration of it
    // would be two rows for one code, which is what "closed" forbids.
    expect(Object.keys(STORAGE_REFUSALS)).not.toContain('TENANT_ID_INVALID');
    expect(REFUSAL_CODES).toContain('TENANT_ID_INVALID');
  });
});
