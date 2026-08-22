/**
 * SEAM-STORAGE — `storageForTenant(ctx).put/get/sign`: the only module that touches objects.
 *
 * SEAM-STORAGE: "`storage.put/get/sign` — local FS in dev, S3-compatible in prod; every
 * stored object content-addressed with its sha256." R-SPINE-021 adds the rest of the shape:
 * per-tenant prefixes, signed download URLs, and "retention of every revision forever
 * (drawings are evidence)".
 *
 * Three decisions carry that:
 *
 *   1. The address is the content. `put` hashes the bytes and files them under
 *      `t/{tenantId}/sha256/{sha256}` — `objectKey`, spelled once, here. The same bytes put
 *      twice are one object, and no caller ever chooses a name.
 *   2. There is no delete and no overwrite. Retention forever is a property of the surface,
 *      not a policy somebody remembers: this module exports nothing that removes an object,
 *      and the local driver writes with an exclusive flag so a second put of the same address
 *      leaves the first bytes exactly where they are.
 *   3. A download URL is signed and short-lived (Q-12: "signed URLs expire"), and the
 *      signature is checked before the expiry. That order is what makes a forged `exp` a
 *      refused URL rather than an extended one — the expiry is part of what was signed.
 *
 * The driver is read from the environment at every call, never at import: a process that
 * reads `CUBIT_STORAGE_DRIVER` once at module load cannot be pointed at a temp directory by a
 * test, and a seam that only holds under one driver is not a seam.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** The refusal a caller reads when nothing is stored under an address. */
const STORAGE_OBJECT_MISSING = 'STORAGE_OBJECT_MISSING';

/** The refusal a caller reads when a signed URL has outlived its TTL. */
const STORAGE_URL_EXPIRED = 'STORAGE_URL_EXPIRED';

/** The refusal a caller reads when a signed URL is not the URL that was signed. */
const STORAGE_URL_INVALID = 'STORAGE_URL_INVALID';

/** The refusal a caller reads when the local driver has no secret to sign or check with. */
const STORAGE_SECRET_MISSING = 'STORAGE_SECRET_MISSING';

/** The spine's code, reused: a handle is tenant-scoped before it is anything else. */
const TENANT_ID_INVALID = 'TENANT_ID_INVALID';

/** The same shape SEAM-TENANT holds a tenant id to. An object store has no NULL scope. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A content address, as this seam writes and reads it: 64 lowercase hex digits. */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Where the local driver keeps objects when the environment names no directory. */
const DEFAULT_STORAGE_DIR = 'var/storage';

/** The path a signed local URL is served from; a later increment mounts the route. */
const STORAGE_PATH = '/storage/';

/** A base for parsing the local driver's relative URLs. Never fetched, never sent. */
const RELATIVE_BASE = 'http://storage.invalid';

/** Seconds are the unit both drivers sign in; named so the divisor is not read as a factor. */
const MILLIS_PER_SECOND = 1_000;

/** What S3 says when a presigned URL has outlived its `X-Amz-Expires`. */
const S3_EXPIRED = 'Request has expired';

/** A tenant's view of the object store: the three verbs SEAM-STORAGE names, and no more. */
export interface TenantStorage {
  /** Store bytes under their own sha256, and say where they went. */
  put(bytes: Uint8Array): Promise<{ sha256: string; key: string }>;
  /** The bytes stored under an address, or `STORAGE_OBJECT_MISSING`. */
  get(sha256: string): Promise<Uint8Array>;
  /** A download URL that stops working when its TTL runs out (Q-12). */
  sign(sha256: string, opts: { expiresInSeconds: number }): Promise<string>;
}

/** The object store's address for one tenant's object. The one place the scheme is spelled. */
export function objectKey(tenantId: string, sha256: string): string {
  return `t/${tenantId}/sha256/${sha256}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / MILLIS_PER_SECOND);
}

/**
 * Whether the moment a URL dies at — a unix second — is behind us. The comparison is made in
 * milliseconds on purpose: a URL minted for one second is signed at a whole second and dies
 * at the next one, so a check that also rounds down to whole seconds would keep serving it
 * for most of the second after it expired. "Expires in one second" means one second.
 */
function hasExpired(expiresAtSeconds: number): boolean {
  if (!Number.isFinite(expiresAtSeconds)) return true;
  return Date.now() > expiresAtSeconds * MILLIS_PER_SECOND;
}

/** `YYYYMMDDTHHMMSSZ`, the form SigV4 signs a date in, as unix seconds. */
function amzDateSeconds(amzDate: string): number | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate);
  if (match === null) return undefined;
  const [, year = '', month = '', day = '', hour = '', minute = '', second = ''] = match;
  const millis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Math.floor(millis / MILLIS_PER_SECOND);
}

/**
 * The unix second a presigned S3 URL dies at, from the two parameters it carries: the moment
 * it was signed plus the seconds it was minted for. `undefined` when the URL carries neither,
 * which is not this seam's URL and is left for the bucket to judge.
 */
function s3ExpiresAt(url: string): number | undefined {
  const params = new URL(url, RELATIVE_BASE).searchParams;
  const signedAt = amzDateSeconds(params.get('X-Amz-Date') ?? '');
  const expiresIn = Number(params.get('X-Amz-Expires') ?? '');
  if (signedAt === undefined || !Number.isFinite(expiresIn)) return undefined;
  return signedAt + expiresIn;
}

function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Whether the driver in the environment is the S3-compatible one; local is the default. */
function isS3(): boolean {
  return process.env['CUBIT_STORAGE_DRIVER'] === 's3';
}

/** The local driver's root, read at the call and never remembered between calls. */
function storageDir(): string {
  const dir = process.env['CUBIT_STORAGE_DIR'];
  return dir === undefined || dir.trim() === '' ? DEFAULT_STORAGE_DIR : dir;
}

/**
 * The local driver's signing secret. Its absence is a refusal rather than an unsigned URL:
 * an object store that hands out links nobody can forge, and one that hands out links
 * everybody can, are not the same store with a setting between them.
 */
function storageSecret(): string {
  const secret = process.env['CUBIT_STORAGE_SECRET'];
  if (secret === undefined || secret === '') {
    throw new Error(
      `${STORAGE_SECRET_MISSING}: the fs storage driver needs CUBIT_STORAGE_SECRET to sign or check a download URL.`,
    );
  }
  return secret;
}

/** The local driver's signature over exactly what the URL carries: its key and its expiry. */
function fsSignature(key: string, exp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${key}\n${exp}`).digest('hex');
}

/**
 * A signature comparison that does not leak how much of a forgery was right. Lengths are
 * compared first because `timingSafeEqual` throws on buffers of different sizes, and a
 * wrong-length signature is a forgery like any other.
 */
function signatureEquals(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Whether a rejected read was a missing file rather than a broken one. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

/** Whether S3 answered "no such key" — the SDK spells it as a name or as a 404. */
function isMissingObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const named = (error as { name?: unknown }).name;
  const status = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata?.httpStatusCode;
  return named === 'NoSuchKey' || named === 'NotFound' || status === 404;
}

function missing(sha256: string): Error {
  return new Error(`${STORAGE_OBJECT_MISSING}: nothing is stored under sha256 ${sha256}.`);
}

/** The S3 client, built per call from the environment the call reads. */
function s3Client(): S3Client {
  const endpoint = process.env['CUBIT_S3_ENDPOINT'];
  const configured = endpoint !== undefined && endpoint !== '';
  return new S3Client({
    region: process.env['CUBIT_S3_REGION'] ?? 'us-east-1',
    // A path-style endpoint is what an S3-compatible store answers on; a virtual-hosted
    // bucket name in front of a loopback host resolves to nothing.
    ...(configured ? { endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env['CUBIT_S3_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: process.env['CUBIT_S3_SECRET_ACCESS_KEY'] ?? '',
    },
  });
}

function s3Bucket(): string {
  return process.env['CUBIT_S3_BUCKET'] ?? '';
}

async function s3Put(key: string, bytes: Uint8Array): Promise<void> {
  const client = s3Client();
  await client.send(new PutObjectCommand({ Bucket: s3Bucket(), Key: key, Body: bytes }));
  client.destroy();
}

async function s3Get(key: string, sha256: string): Promise<Uint8Array> {
  const client = s3Client();
  try {
    const answer = await client.send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key }));
    const body = answer.Body;
    if (body === undefined) throw missing(sha256);
    return await body.transformToByteArray();
  } catch (error: unknown) {
    if (isMissingObject(error)) throw missing(sha256);
    throw error;
  } finally {
    client.destroy();
  }
}

async function s3Sign(key: string, expiresInSeconds: number): Promise<string> {
  const client = s3Client();
  try {
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: s3Bucket(), Key: key }), {
      expiresIn: expiresInSeconds,
    });
  } finally {
    client.destroy();
  }
}

function fsPath(key: string): string {
  return join(storageDir(), key);
}

async function fsPut(key: string, bytes: Uint8Array): Promise<void> {
  const path = fsPath(key);
  await mkdir(dirname(path), { recursive: true });
  try {
    // Exclusive: the address is the content, so an object already at this address holds
    // exactly these bytes. R-SPINE-021 keeps every revision — nothing here overwrites one.
    await writeFile(path, bytes, { flag: 'wx' });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      if (code === 'EEXIST') return;
    }
    throw error;
  }
}

async function fsGet(key: string, sha256: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(fsPath(key)));
  } catch (error: unknown) {
    if (isNotFound(error)) throw missing(sha256);
    throw error;
  }
}

/**
 * A tenant-scoped handle. The id is checked here, before any object is addressed: an id that
 * could never be a uuid would otherwise become a prefix in the bucket, and a typo would quietly
 * found a tenant nobody has.
 */
export function storageForTenant(ctx: { tenantId: string }): TenantStorage {
  if (!UUID.test(ctx.tenantId)) {
    throw new Error(
      `${TENANT_ID_INVALID}: storageForTenant({ tenantId }) takes a uuid, not ${JSON.stringify(ctx.tenantId)}.`,
    );
  }
  const { tenantId } = ctx;

  return {
    async put(bytes: Uint8Array): Promise<{ sha256: string; key: string }> {
      const sha256 = sha256Of(bytes);
      const key = objectKey(tenantId, sha256);
      if (isS3()) await s3Put(key, bytes);
      else await fsPut(key, bytes);
      return { sha256, key };
    },

    async get(sha256: string): Promise<Uint8Array> {
      const key = objectKey(tenantId, sha256);
      return isS3() ? s3Get(key, sha256) : fsGet(key, sha256);
    },

    async sign(sha256: string, opts: { expiresInSeconds: number }): Promise<string> {
      const key = objectKey(tenantId, sha256);
      if (isS3()) return s3Sign(key, opts.expiresInSeconds);
      const secret = storageSecret();
      const exp = String(nowSeconds() + opts.expiresInSeconds);
      return `${STORAGE_PATH}${key}?exp=${exp}&sig=${fsSignature(key, exp, secret)}`;
    },
  };
}

/**
 * Resolve a signed URL to the bytes it names, or refuse it by name.
 *
 * Under the local driver this is the check a mounted `/storage/<key>` route will make: the
 * signature first — over the key and the expiry the URL actually carries — and only then the
 * expiry. Under S3 the bucket makes the same two checks in the same order, and this maps what
 * it said back into the taxonomy: a miss is a miss, an expired link is expired, and any other
 * refusal of a signature is an invalid link.
 */
export async function serveSigned(url: string): Promise<Uint8Array> {
  return isS3() ? serveSignedS3(url) : serveSignedFs(url);
}

async function serveSignedS3(url: string): Promise<Uint8Array> {
  const answer = await fetch(url);
  if (answer.ok) {
    // The bucket judges the signature, and it judges it first — a URL that got this far was
    // signed as it stands. What the bucket rounds to whole seconds, the seam does not: a
    // link minted for one second is dead a second later, on both drivers alike.
    const expiresAt = s3ExpiresAt(url);
    if (expiresAt !== undefined && hasExpired(expiresAt)) {
      throw new Error(`${STORAGE_URL_EXPIRED}: the signed download URL has passed its expiry.`);
    }
    return new Uint8Array(await answer.arrayBuffer());
  }

  const said = await answer.text();
  if (answer.status === 404) {
    throw new Error(`${STORAGE_OBJECT_MISSING}: the bucket holds no object at ${pathOf(url)}.`);
  }
  if (answer.status === 403 && said.includes(S3_EXPIRED)) {
    throw new Error(`${STORAGE_URL_EXPIRED}: the signed download URL has passed its expiry.`);
  }
  throw new Error(
    `${STORAGE_URL_INVALID}: the bucket refused the signed download URL (${String(answer.status)}).`,
  );
}

/** The path a URL names, for a refusal that says which object without quoting a signature. */
function pathOf(url: string): string {
  return new URL(url, RELATIVE_BASE).pathname;
}

async function serveSignedFs(url: string): Promise<Uint8Array> {
  const secret = storageSecret();
  const parsed = new URL(url, RELATIVE_BASE);
  const key = parsed.pathname.startsWith(STORAGE_PATH)
    ? parsed.pathname.slice(STORAGE_PATH.length)
    : '';
  const exp = parsed.searchParams.get('exp') ?? '';
  const sig = parsed.searchParams.get('sig') ?? '';

  // Signature before expiry (Q-12, AC-2): the expiry is part of what was signed, so a URL
  // whose `exp` has been rewritten is a forgery rather than a longer-lived link.
  if (key === '' || !signatureEquals(sig, fsSignature(key, exp, secret))) {
    throw new Error(`${STORAGE_URL_INVALID}: the signed download URL does not match its signature.`);
  }
  if (hasExpired(Number(exp))) {
    throw new Error(`${STORAGE_URL_EXPIRED}: the signed download URL expired at ${exp}.`);
  }

  const sha256 = key.slice(key.lastIndexOf('/') + 1);
  if (!SHA256_HEX.test(sha256)) {
    throw new Error(`${STORAGE_URL_INVALID}: the signed download URL names no content address.`);
  }
  return fsGet(key, sha256);
}
