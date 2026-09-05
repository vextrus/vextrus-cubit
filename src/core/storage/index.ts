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
import { access, link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { isUuid } from "../db";

/** An address as the contract spells it: exactly 64 lowercase hex characters. */
const ADDRESS_SHAPE = /^[0-9a-f]{64}$/;

/** The path a signed URL is minted under, and the only prefix `verify` will read one from. */
const URL_PREFIX = "/storage/v1/";

/**
 * A signed URL as it comes back in: the path, the expiry and the signature, with an optional
 * origin the signature deliberately does not cover. Anything else is not a URL this seam minted.
 *
 * A scheme is case-insensitive (RFC 3986), so `HTTPS://` carries the same URL as `https://` — the
 * signature covers neither, and refusing the one spelling would refuse an artefact this seam minted.
 * Everything the signature does cover stays case-sensitive: the path, the address and the expiry.
 */
const SIGNED_URL_SHAPE = new RegExp(`^(?:[A-Za-z][A-Za-z0-9+.-]*://[^/]*)?${URL_PREFIX}([^/?#]+)/([^/?#]+)\\?expires=(\\d+)&signature=([0-9a-f]+)$`);

/** Everything a storage seam is configured with — injected, never read from the environment. */
export interface StorageOptions {
  /** The directory tenant prefixes are laid down under. */
  root: string;
  /** The key signed download URLs are minted with; it never appears in a minted URL. */
  signingSecret: string;
  /** The clock `sign` reads for the expiry it mints, and `verify` for the moment it judges. */
  now?: () => Date;
  /**
   * Where a staging copy that could not be removed is reported. Cleanup is not the operation — a put
   * whose bytes are stored has done what it was asked — but a volume that will not let go of a file
   * is a fact only an operator can act on, and a discarding catch tells nobody (ARCH-03, B-21). It is
   * an injected hook rather than a call into the fault sink because this module reads no environment
   * and holds no singleton, which is what lets a test run it over a scratch directory.
   */
  onCleanupFailure?: (error: unknown) => void;
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
  if (!isTenantPrefix(tenantId)) {
    throw new TypeError("storage: tenantId must be a canonical lowercase UUID");
  }
  return tenantId;
}

/**
 * Is this a prefix the seam lays a directory down under? Two questions, and only one of them is
 * storage's own. Whether a uuid column can hold the value is the tenancy seam's answer and is asked
 * of it (ARCH-02, B-05) — a second copy of that shape spelled here would agree with the seam's until
 * the day the two drift apart. Whether it is spelled canonically is storage's own, because a path is
 * case-sensitive: two spellings of one id would be two prefixes over the same tenant's evidence.
 */
function isTenantPrefix(value: unknown): value is string {
  return typeof value === "string" && value === value.toLowerCase() && isUuid(value);
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

/**
 * Was this filesystem answer simply "nothing is stored there"? Only `ENOENT` says that. A directory
 * standing at an address (`EISDIR`), or a file standing where a tenant prefix belongs (`ENOTDIR`),
 * is a corrupt volume, and a corrupt volume must not read as an ordinary miss (ARCH-03, B-21).
 */
const isMissing = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === "ENOENT";

/**
 * Is the address settled — does a file stand at it? Asked of the volume rather than inferred from a
 * race, so "somebody else already stored these bytes" is never assumed on a volume where nothing is
 * stored at all. Only `ENOENT` is an answer of "nothing is stored here": a denied prefix (`EACCES`),
 * a symlink loop (`ELOOP`) or a failing device (`EIO`) is the volume declining to answer the
 * question at all, and a predicate about existence must not report that as an existence answer
 * (ARCH-03, B-21) — it is raised, and it is the caller of the probe that decides what the story is.
 */
const isStored = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    (error: unknown) => {
      if (isMissing(error)) return false;
      throw error;
    },
  );

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
      //
      // The staging copy's address is derived from the object's own, not from a clock and a random
      // suffix: a path nothing can name is a path nothing can clean up after a crash, and it leaves
      // the volume growing a stranded file per interrupted put. Two puts that race here are two puts
      // of the SAME bytes — the address is the digest of the content — so the copy each writes is
      // byte-identical, and whichever links first settles the address for both.
      const staging = `${file}.staging`;
      // R-SPINE-021 retains every revision forever, and bytes that are only in the page cache are a
      // promise the module cannot keep on its own: the copy is flushed before it is linked into
      // place, and the tenant prefix DIRECTORY is flushed after the link — so both halves of the
      // address a caller is handed, the bytes and the entry that names them, are durable. Flushing
      // the file alone leaves the entry in the directory's own cache: a crash then loses the name,
      // and an object nothing can name is an object R-SPINE-021 did not retain.
      const handle = await open(staging, "w");
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await link(staging, file);
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        // EEXIST is the ordinary race: another put of these same bytes settled the address first,
        // and an object that exists is never rewritten. ENOENT is that same race one step further
        // on — `link` resolves its source first, so a concurrent put that linked the SHARED staging
        // copy into place and then removed it leaves this one's source gone, with the address it was
        // about to settle already settled. Both are absorbed only against the volume's own answer:
        // the address is asked about, never assumed, so an ENOENT with nothing at the address is a
        // story the caller still hears (ARCH-03, B-21).
        // The probe is asked in service of THIS error's story, so a volume that cannot answer it
        // changes nothing: without proof that the address is settled, the caller is owed the `link`
        // failure it already has, and that original error — never the probe's — is what is raised.
        const settled = code === "ENOENT" && (await isStored(file).catch(() => false));
        if (code !== "EEXIST" && !settled) throw error;
      } finally {
        // Removing the staging copy is cleanup, not the operation: if it fails, the caller still
        // owes the story of what went wrong with `link`, so its rejection never replaces that one —
        // it goes to the operator's hook instead of into a catch that tells nobody.
        await unlink(staging).catch((failure: unknown) => {
          // A staging copy that is already gone is cleanup that HAPPENED, not cleanup that failed:
          // the copy's address is shared by every put of the same bytes, so a concurrent put removes
          // the very file this one was about to. Reporting that would name an operator to a put in
          // which nothing went wrong.
          if (isMissing(failure)) return;
          options.onCleanupFailure?.(failure);
        });
      }
      // The directory entry, made durable in its own right (R-SPINE-021). It is flushed after the
      // link and after the staging copy is gone, so what the volume is told to hold is the settled
      // listing rather than a listing with a half-finished put still in it.
      const directory = await open(join(root, prefix), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
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
      // A moment to judge against is the caller's OWN argument, not far-side input, so it is judged
      // first: an unusable Date is a caller error whatever the URL turns out to say, and answering
      // "invalid" for it would report the caller's broken clock as somebody else's bad URL (B-21).
      // Falling back to this seam's clock would be worse still — an expiring URL judged against a
      // time the caller never asked for.
      if (at !== undefined && (!(at instanceof Date) || !Number.isFinite(at.getTime()))) {
        throw new TypeError("storage: at must be a valid Date");
      }
      // A URL is caller input from the far side of a browser, so no shape of one throws: a string
      // this seam did not mint is simply not vouched for.
      const parts = typeof url === "string" ? SIGNED_URL_SHAPE.exec(url) : null;
      if (parts === null) return { ok: false, reason: "invalid" };
      const [, tenantId, sha256, expiresText, signature] = parts;
      if (tenantId === undefined || sha256 === undefined || expiresText === undefined || signature === undefined) return { ok: false, reason: "invalid" };
      if (!isTenantPrefix(tenantId) || !ADDRESS_SHAPE.test(sha256)) return { ok: false, reason: "invalid" };

      const expires = Number(expiresText);
      // One expiry, one spelling: `0000000900` reads as 900 but is not the text that was signed,
      // so the artefact stays canonical and a padded copy is not a URL this seam minted.
      if (!Number.isSafeInteger(expires) || String(expires) !== expiresText) return { ok: false, reason: "invalid" };

      // The signature is compared as the text it travels as, never as decoded bytes: hex decoding
      // drops a trailing unpaired nibble without complaining, so a signature with a character
      // appended would decode to the minted bytes and vouch for a URL nobody signed.
      const expected = Buffer.from(signatureOf(tenantId, sha256, expires), "utf8");
      const presented = Buffer.from(signature, "utf8");
      // The comparison is constant time, and a length that cannot match is answered without one.
      if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return { ok: false, reason: "invalid" };

      const moment = at ?? clock();
      // The URL is good up to its expiry and refused at it — an expiry that has arrived has passed.
      if (unixSeconds(moment) >= expires) return { ok: false, reason: "expired" };

      return { ok: true, tenantId, sha256 };
    },
  };
}
