// SEAM-STORAGE, R-SPINE-021: object storage as a factory over injected configuration — a root, a
// signing secret and a clock. The module reads no environment and holds no singleton, so the same
// code answers a scratch directory in a test and a mounted volume in a deployment (ARCH-02: the
// storage contract has one home, and this is it).
//
// Every object is addressed by the lowercase-hex sha256 of its own bytes, under a per-tenant
// prefix: `<root>/<tenantId>/<sha256>`. That address is why the seam offers no way to remove or
// replace an object — drawings are evidence, so every revision is retained forever. `put` is
// idempotent because identical bytes have one address, and a second put links nothing new.
//
// Q-12: a download URL is signed and expires. The signature is an HMAC over the address and the
// expiry, so the secret never travels in the artefact a browser carries, and expiry is judged
// against an injected clock rather than the wall.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

/** A tenant prefix as the tenancy seam mints its ids: a canonical lowercase UUID and nothing else. */
const TENANT_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** An address as the contract spells it: exactly 64 lowercase hex characters. */
const ADDRESS_SHAPE = /^[0-9a-f]{64}$/;

/** The path a signed URL is minted under, and the only prefix `verify` will read one from. */
const URL_PREFIX = "/storage/v1/";

/**
 * A signed URL as it comes back in: the path, the expiry and the signature, with an optional
 * origin the signature deliberately does not cover. Anything else is not a URL this seam minted.
 */
const SIGNED_URL_SHAPE = new RegExp(`^(?:[a-z][a-z0-9+.-]*://[^/]*)?${URL_PREFIX}([^/?#]+)/([^/?#]+)\\?expires=(\\d+)&signature=([0-9a-f]+)$`);

/** Everything a storage seam is configured with — injected, never read from the environment. */
export interface StorageOptions {
  /** The directory tenant prefixes are laid down under. */
  root: string;
  /** The key signed download URLs are minted with; it never appears in a minted URL. */
  signingSecret: string;
  /** The clock `sign` reads for the expiry it mints, and `verify` for the moment it judges. */
  now?: () => Date;
}

/** What `verify` answers: an address it vouches for, or the reason it will not. */
export type SignVerification = { ok: true; tenantId: string; sha256: string } | { ok: false; reason: "expired" | "invalid" };

/**
 * The seam's surface (SEAM-STORAGE). There is no delete and no overwrite: retention is a property
 * of the surface, not a policy applied to it (R-SPINE-021).
 */
export interface Storage {
  /** Stores bytes under a tenant and answers their address. Idempotent on identical bytes. */
  put(tenantId: string, bytes: Uint8Array): Promise<{ sha256: string }>;
  /** The bytes at an address under a tenant, or `null` when that tenant stored no such object. */
  get(tenantId: string, sha256: string): Promise<Uint8Array | null>;
  /** An expiring signed download URL for an address (Q-12). */
  sign(tenantId: string, sha256: string, opts: { expiresInSeconds: number }): string;
  /** Reads a signed URL back, judged at `at` — or at the injected clock when none is given. */
  verify(url: string, at?: Date): SignVerification;
}

/**
 * A tenant id the seam will touch the filesystem for. A prefix comes from the tenancy seam, so
 * anything that is not a canonical lowercase UUID is a caller error, and it is refused before a
 * path is built from it — `..`, a nested segment and an absolute path all fail this one check.
 */
function tenantPrefix(tenantId: unknown): string {
  if (typeof tenantId !== "string" || !TENANT_SHAPE.test(tenantId)) {
    throw new TypeError("storage: tenantId must be a canonical lowercase UUID");
  }
  return tenantId;
}

/** An address the seam will touch the filesystem for: 64 lowercase hex characters, exactly. */
function address(sha256: unknown): string {
  if (typeof sha256 !== "string" || !ADDRESS_SHAPE.test(sha256)) {
    throw new TypeError("storage: sha256 must be exactly 64 lowercase hex characters");
  }
  return sha256;
}

/** An expiry a URL can actually carry: whole seconds into the future, so a signed URL expires. */
function lifetime(expiresInSeconds: unknown): number {
  if (typeof expiresInSeconds !== "number" || !Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new TypeError("storage: expiresInSeconds must be a positive whole number of seconds");
  }
  return expiresInSeconds;
}

/** The bytes a caller may store: a real byte view, never a string the platform would coerce. */
function payload(bytes: unknown): Uint8Array {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("storage: bytes must be a Uint8Array");
  return bytes;
}

/**
 * The file an address names, proven to stay inside its tenant prefix. The shape checks above
 * already exclude every separator and parent segment; this is the second lock on the same door,
 * so a future spelling of an id can never resolve outside the root.
 */
function objectPath(root: string, tenantId: string, sha256: string): string {
  const prefix = resolve(root, tenantId);
  const file = resolve(prefix, sha256);
  if (!file.startsWith(prefix + sep)) throw new RangeError("storage: the address does not resolve inside its tenant prefix");
  return file;
}

/** Whole seconds, the unit `expires` is written in. */
const unixSeconds = (at: Date): number => Math.floor(at.getTime() / 1000);

/** Was this filesystem answer simply "nothing is stored there"? */
const isMissing = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR";
};

/**
 * The seam over a local filesystem root. Every knob is a value on `options`, so two seams over the
 * same root with different secrets are two independent signers — which is exactly what makes a URL
 * minted elsewhere unverifiable here.
 */
export function makeStorage(options: StorageOptions): Storage {
  const { root, signingSecret } = options;
  const clock = options.now ?? ((): Date => new Date());

  /**
   * The signature over an address and its expiry. The signed message names its own fields with a
   * separator none of them can contain, so no two different addresses share a message (Q-12).
   */
  const signatureOf = (tenantId: string, sha256: string, expires: number): string =>
    createHmac("sha256", signingSecret).update(`storage.v1\n${tenantId}\n${sha256}\n${expires}`).digest("hex");

  return {
    async put(tenantId: string, bytes: Uint8Array): Promise<{ sha256: string }> {
      const prefix = tenantPrefix(tenantId);
      const content = payload(bytes);
      const sha256 = createHash("sha256").update(content).digest("hex");
      const file = objectPath(root, prefix, sha256);

      await mkdir(join(root, prefix), { recursive: true });
      // The object is written aside and then linked into place: `link` fails when the address is
      // already taken, so an object that exists is never rewritten and a reader never sees a
      // half-written file at a settled address (R-SPINE-021).
      const staging = `${file}.staging-${createHash("sha256").update(`${process.pid}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 16)}`;
      await writeFile(staging, content, { flag: "wx" });
      try {
        await link(staging, file);
      } catch (error) {
        if ((error as { code?: unknown }).code !== "EEXIST") throw error;
      } finally {
        await unlink(staging);
      }
      return { sha256 };
    },

    async get(tenantId: string, sha256: string): Promise<Uint8Array | null> {
      const file = objectPath(root, tenantPrefix(tenantId), address(sha256));
      try {
        return new Uint8Array(await readFile(file));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    sign(tenantId: string, sha256: string, opts: { expiresInSeconds: number }): string {
      const prefix = tenantPrefix(tenantId);
      const at = address(sha256);
      const expires = unixSeconds(clock()) + lifetime(opts?.expiresInSeconds);
      return `${URL_PREFIX}${prefix}/${at}?expires=${expires}&signature=${signatureOf(prefix, at, expires)}`;
    },

    verify(url: string, at?: Date): SignVerification {
      // A URL is caller input from the far side of a browser, so nothing here throws: an argument
      // this seam did not mint is simply not vouched for.
      const parts = typeof url === "string" ? SIGNED_URL_SHAPE.exec(url) : null;
      if (parts === null) return { ok: false, reason: "invalid" };
      const [, tenantId, sha256, expiresText, signature] = parts;
      if (tenantId === undefined || sha256 === undefined || expiresText === undefined || signature === undefined) return { ok: false, reason: "invalid" };
      if (!TENANT_SHAPE.test(tenantId) || !ADDRESS_SHAPE.test(sha256)) return { ok: false, reason: "invalid" };

      const expires = Number(expiresText);
      if (!Number.isSafeInteger(expires)) return { ok: false, reason: "invalid" };

      const expected = Buffer.from(signatureOf(tenantId, sha256, expires), "hex");
      const presented = Buffer.from(signature, "hex");
      // The comparison is constant time, and a length that cannot match is answered without one.
      if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return { ok: false, reason: "invalid" };

      const moment = at instanceof Date && Number.isFinite(at.getTime()) ? at : clock();
      // The URL is good up to its expiry and refused at it — an expiry that has arrived has passed.
      if (unixSeconds(moment) >= expires) return { ok: false, reason: "expired" };

      return { ok: true, tenantId, sha256 };
    },
  };
}
