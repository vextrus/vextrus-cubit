/**
 * SEAM-STORAGE beside its module: the properties the seam claims that no criterion spells out
 * in a URL's shape — the tenant prefix as isolation, retention forever, and the env being read
 * at the call rather than at import (SEAM-STORAGE, R-SPINE-021).
 *
 * Everything here runs against the local driver, except the retention check, which runs
 * against the loopback fake as well: "every revision is kept" is a claim about both drivers or
 * it is a claim about neither.
 *
 * Q-07: each refusal this file makes fire is named in the assertion that catches it.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { objectKey, serveSigned, storageForTenant } from '../storage';
import { startS3Fake } from './support/s3-fake';
import type { S3Fake } from './support/s3-fake';

const TENANT_A = '11111111-2222-4333-8444-555555555555';
const TENANT_B = '99999999-8888-4777-8666-555555555555';

const SECRET = 'cubit-fs-url-signing-secret-for-the-builder-suite';

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('SEAM-STORAGE · the fs driver', () => {
  let dir = '';

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cubit-storage-unit-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  beforeEach(() => {
    delete process.env['CUBIT_STORAGE_DRIVER'];
    process.env['CUBIT_STORAGE_DIR'] = dir;
    process.env['CUBIT_STORAGE_SECRET'] = SECRET;
  });

  it('takes the fs driver when the environment names none', async () => {
    // 'fs' is the default because dev is where a machine has no bucket. An unset driver that
    // reached for S3 would make a developer's first upload a credential error.
    const stored = await storageForTenant({ tenantId: TENANT_A }).put(bytesOf('default driver'));
    const onDisk = await readFile(join(dir, stored.key));
    expect(Uint8Array.from(onDisk)).toEqual(bytesOf('default driver'));
  });

  it('keeps one tenant out of another tenant’s objects', async () => {
    // The prefix is the isolation: the same bytes stored by two tenants are two objects, and
    // an address one tenant holds is STORAGE_OBJECT_MISSING to the other.
    const bytes = bytesOf('GA-06 rev A — the same drawing, two tenants');
    const mine = await storageForTenant({ tenantId: TENANT_A }).put(bytes);

    expect(mine.key).toBe(objectKey(TENANT_A, mine.sha256));
    expect(objectKey(TENANT_B, mine.sha256)).not.toBe(mine.key);

    await expect(storageForTenant({ tenantId: TENANT_B }).get(mine.sha256)).rejects.toThrow(
      /^STORAGE_OBJECT_MISSING: /,
    );

    const theirs = await storageForTenant({ tenantId: TENANT_B }).put(bytes);
    expect(theirs.sha256).toBe(mine.sha256);
    expect(theirs.key).toBe(objectKey(TENANT_B, mine.sha256));
  });

  it('reads the environment at the call, so a second call can be pointed elsewhere', async () => {
    const elsewhere = await mkdtemp(join(tmpdir(), 'cubit-storage-elsewhere-'));
    try {
      const stored = await storageForTenant({ tenantId: TENANT_A }).put(bytesOf('here, then there'));

      process.env['CUBIT_STORAGE_DIR'] = elsewhere;
      await expect(storageForTenant({ tenantId: TENANT_A }).get(stored.sha256)).rejects.toThrow(
        /^STORAGE_OBJECT_MISSING: /,
      );

      process.env['CUBIT_STORAGE_DIR'] = dir;
      const read = await storageForTenant({ tenantId: TENANT_A }).get(stored.sha256);
      expect(Uint8Array.from(read)).toEqual(bytesOf('here, then there'));
    } finally {
      await rm(elsewhere, { recursive: true, force: true });
    }
  });

  it('refuses a signed URL that names no object, as STORAGE_OBJECT_MISSING', async () => {
    // The signature is good and the URL is alive; what is missing is the object. A seam that
    // called this STORAGE_URL_INVALID would send a reader looking for a forgery.
    const store = storageForTenant({ tenantId: TENANT_A });
    const stored = await store.put(bytesOf('signed, then read from a different root'));
    const url = await store.sign(stored.sha256, { expiresInSeconds: 60 });

    const empty = await mkdtemp(join(tmpdir(), 'cubit-storage-empty-'));
    try {
      process.env['CUBIT_STORAGE_DIR'] = empty;
      await expect(serveSigned(url)).rejects.toThrow(/^STORAGE_OBJECT_MISSING: /);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('refuses a URL that was never signed at all, as STORAGE_URL_INVALID', async () => {
    const store = storageForTenant({ tenantId: TENANT_A });
    const stored = await store.put(bytesOf('unsigned'));
    const bare = `/storage/${stored.key}?exp=${String(2_000_000_000)}&sig=`;

    await expect(serveSigned(bare)).rejects.toThrow(/^STORAGE_URL_INVALID: /);
  });

  it('refuses an address that is not an address, as STORAGE_OBJECT_MISSING', async () => {
    // The prefix is the isolation (R-SPINE-021), and `path.join` normalises away a `..`: an
    // address carrying one would otherwise read another tenant's object — or a file that is
    // no object at all — through a seam whose whole surface is one tenant's objects.
    const mine = storageForTenant({ tenantId: TENANT_A });
    const theirs = storageForTenant({ tenantId: TENANT_B });
    const secret = await theirs.put(bytesOf('tenant B secret drawing'));

    const escape = `../../${TENANT_B}/sha256/${secret.sha256}`;
    await expect(mine.get(escape)).rejects.toThrow(/^STORAGE_OBJECT_MISSING: /);
    await expect(mine.sign(escape, { expiresInSeconds: 60 })).rejects.toThrow(
      /^STORAGE_OBJECT_MISSING: /,
    );

    // And the same for a path that leaves the storage root altogether.
    const outside = '../'.repeat(8) + 'etc/passwd';
    await expect(mine.get(outside)).rejects.toThrow(/^STORAGE_OBJECT_MISSING: /);
    await expect(mine.sign(outside, { expiresInSeconds: 60 })).rejects.toThrow(
      /^STORAGE_OBJECT_MISSING: /,
    );

    // The address B really does hold still reads for B: the guard is on the shape, not on
    // reading at all.
    expect(Uint8Array.from(await theirs.get(secret.sha256))).toEqual(
      bytesOf('tenant B secret drawing'),
    );
  });

  it('refuses a tenant id that could never be a uuid, as TENANT_ID_INVALID', () => {
    // The spine's code, reused: the storage seam does not invent a second name for it.
    expect(() => storageForTenant({ tenantId: 'T-0001' })).toThrow(/^TENANT_ID_INVALID: /);
  });
});

/**
 * R-SPINE-021: "retention of every revision forever (drawings are evidence)". Two things make
 * that structural rather than a promise — the seam exports nothing that removes an object, and
 * storing the same address twice leaves the first bytes where they are.
 */
describe('SEAM-STORAGE · every revision is kept, on both drivers', () => {
  let fake: S3Fake | undefined;
  let dir = '';

  beforeAll(async () => {
    fake = await startS3Fake();
    dir = await mkdtemp(join(tmpdir(), 'cubit-storage-retention-'));
  });
  afterAll(async () => {
    await fake?.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('exports no verb that removes an object', async () => {
    // Deletion is not a path this module has and then guards; it is a path it does not have.
    // The module's own namespace, not a literal assembled here from three named imports: a
    // list this test wrote could never grow a `remove` the seam had grown.
    const seam = await import('../storage');
    expect(Object.keys(seam).sort()).toEqual(['objectKey', 'serveSigned', 'storageForTenant']);

    const store = storageForTenant({ tenantId: TENANT_A });
    expect(Object.keys(store).sort()).toEqual(['get', 'put', 'sign']);
  });

  it.each(['fs', 's3'])('keeps the bytes when the same address is put again (%s)', async (driver) => {
    for (const name of ['CUBIT_STORAGE_DRIVER', 'CUBIT_STORAGE_DIR', 'CUBIT_STORAGE_SECRET']) {
      delete process.env[name];
    }
    if (driver === 'fs') {
      process.env['CUBIT_STORAGE_DRIVER'] = 'fs';
      process.env['CUBIT_STORAGE_DIR'] = dir;
      process.env['CUBIT_STORAGE_SECRET'] = SECRET;
    } else {
      for (const [name, value] of Object.entries(fake?.env ?? {})) process.env[name] = value;
    }

    const store = storageForTenant({ tenantId: TENANT_A });
    const bytes = bytesOf(`GA-07 rev A — evidence (${driver})`);

    const first = await store.put(bytes);
    const again = await store.put(bytes);

    expect(again).toEqual(first);
    expect(Uint8Array.from(await store.get(first.sha256))).toEqual(bytes);
  });
});

/**
 * `serveSigned` is a seam verb, not a fetch. Under the S3 driver the bytes come back over the
 * network, so the URL it is handed is checked to be one this seam could have minted — the
 * configured endpoint, this bucket — before anything leaves the process. A seam that fetched
 * whatever string it was given would be an open proxy the day a route passed a request
 * parameter through it (Q-12).
 */
describe('SEAM-STORAGE · serveSigned fetches this seam’s bucket and nothing else', () => {
  let fake: S3Fake | undefined;
  let elsewhere: S3Fake | undefined;

  beforeAll(async () => {
    fake = await startS3Fake();
    elsewhere = await startS3Fake();
  });
  afterAll(async () => {
    await fake?.close();
    await elsewhere?.close();
  });
  beforeEach(() => {
    for (const [name, value] of Object.entries(fake?.env ?? {})) process.env[name] = value;
  });

  it('refuses a URL on another origin, as STORAGE_URL_INVALID', async () => {
    // The bytes exist and are readable — on a host that is not this seam's bucket. Whether
    // that host would have answered is exactly the question the seam must not ask.
    for (const [name, value] of Object.entries(elsewhere?.env ?? {})) process.env[name] = value;
    const store = storageForTenant({ tenantId: TENANT_A });
    const stored = await store.put(bytesOf('bytes on somebody else’s server'));
    const foreign = await store.sign(stored.sha256, { expiresInSeconds: 60 });

    for (const [name, value] of Object.entries(fake?.env ?? {})) process.env[name] = value;
    await expect(serveSigned(foreign)).rejects.toThrow(/^STORAGE_URL_INVALID: /);
  });

  it('refuses an arbitrary URL that is not a bucket URL at all, as STORAGE_URL_INVALID', async () => {
    await expect(serveSigned('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /^STORAGE_URL_INVALID: /,
    );
    await expect(serveSigned(`${fake?.endpoint ?? ''}/other-bucket/t/x`)).rejects.toThrow(
      /^STORAGE_URL_INVALID: /,
    );
  });

  it('refuses an fs-shaped URL under the s3 driver by name, not as a TypeError', async () => {
    // A stale URL kept across a driver migration is a misconfiguration, and this seam answers
    // a misconfiguration in its own taxonomy rather than letting undici's parse error escape.
    await expect(
      serveSigned(`/storage/${objectKey(TENANT_A, 'a'.repeat(64))}?exp=2000000000&sig=abcd`),
    ).rejects.toThrow(/^STORAGE_URL_INVALID: /);
  });

  it('still serves a URL it minted itself', async () => {
    const store = storageForTenant({ tenantId: TENANT_A });
    const bytes = bytesOf('a URL this seam minted');
    const stored = await store.put(bytes);
    const url = await store.sign(stored.sha256, { expiresInSeconds: 60 });

    expect(Uint8Array.from(await serveSigned(url))).toEqual(bytes);
  });
});

/**
 * Minting a URL is a read: it hands out bytes to whoever holds the link. So `sign` answers an
 * address the tenant does not hold exactly as `get` does — with STORAGE_OBJECT_MISSING, on both
 * drivers (SEAM-STORAGE's per-tenant prefixes, Q-12's expiring links).
 */
describe('SEAM-STORAGE · sign mints nothing for an object the tenant has not got', () => {
  let fake: S3Fake | undefined;
  let dir = '';

  beforeAll(async () => {
    fake = await startS3Fake();
    dir = await mkdtemp(join(tmpdir(), 'cubit-storage-sign-'));
  });
  afterAll(async () => {
    await fake?.close();
    await rm(dir, { recursive: true, force: true });
  });

  it.each(['fs', 's3'])('refuses to sign another tenant’s address (%s)', async (driver) => {
    for (const name of ['CUBIT_STORAGE_DRIVER', 'CUBIT_STORAGE_DIR', 'CUBIT_STORAGE_SECRET']) {
      delete process.env[name];
    }
    if (driver === 'fs') {
      process.env['CUBIT_STORAGE_DRIVER'] = 'fs';
      process.env['CUBIT_STORAGE_DIR'] = dir;
      process.env['CUBIT_STORAGE_SECRET'] = SECRET;
    } else {
      for (const [name, value] of Object.entries(fake?.env ?? {})) process.env[name] = value;
    }

    const a = storageForTenant({ tenantId: TENANT_A });
    const b = storageForTenant({ tenantId: TENANT_B });

    const unstored = 'a'.repeat(64);
    await expect(a.sign(unstored, { expiresInSeconds: 60 })).rejects.toThrow(
      /^STORAGE_OBJECT_MISSING: /,
    );

    const { sha256 } = await a.put(bytesOf(`a signable revision (${driver})`));
    // The address is right and the bytes exist — under A's prefix, which is not B's.
    await expect(b.sign(sha256, { expiresInSeconds: 60 })).rejects.toThrow(
      /^STORAGE_OBJECT_MISSING: /,
    );
    await expect(a.sign(sha256, { expiresInSeconds: 60 })).resolves.toEqual(expect.any(String));
  });
});
