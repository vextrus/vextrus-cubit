/**
 * AC-1 — with no signing secret stated, an installation that is not development signs nothing.
 *
 * A box that names no `CUBIT_STORAGE_SIGNING_SECRET` used to be handed a secret minted per process:
 * every download link died at the next restart, and a production box was effectively unsigned
 * (Q-12). The seam now fails closed there — `sign` refuses with a registered code, `verify` vouches
 * for nothing, and put/get stay the ordinary seam over the root, because storing and serving
 * evidence is not what the missing secret takes away (R-SPINE-021, SEAM-STORAGE).
 *
 * Everything is judged through the doors the increment publishes: `appStorage`, the refusal marker's
 * one reader, the register, and the fault sink. No product source is read.
 */
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { appStorage } from "../../src/core/storage/app";
import { makeStorage } from "../../src/core/storage/index";
import { addressOf, aTenant, collectFaults, freshRoot, MODE_VAR, ROOT_VAR, SECRET_VAR, thrownBy } from "./support/storage-stage";

/** The code this increment registers, read out of the register below rather than only spelled (Q-07). */
const DOWNLOAD_NOT_SIGNABLE = "DOWNLOAD_NOT_SIGNABLE";

/** The deployment modes AC-1 names: everything that is not development. */
const NOT_DEVELOPMENT = ["production", "test"] as const;

/** Bytes to store, and the seam's own address for them. */
const BYTES = new Uint8Array([7, 8, 9, 10, 11]);

/** The sink is swapped once, at file start, and put back when the file is done. */
const sink = collectFaults();

afterAll(() => {
  sink.restore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AC-1 — no stated secret, outside development", () => {
  test.each(NOT_DEVELOPMENT)("AC-1: under NODE_ENV %s, sign refuses with DOWNLOAD_NOT_SIGNABLE while put and get carry on", async (mode) => {
    const root = await freshRoot();
    vi.stubEnv(MODE_VAR, mode);
    // A blank value is how a shell says nothing, which is what "unset" means to this product.
    vi.stubEnv(SECRET_VAR, "");
    vi.stubEnv(ROOT_VAR, root);

    const storage = appStorage();
    const tenantId = aTenant();
    const sha256 = addressOf(BYTES);

    const refused = thrownBy(() => storage.sign(tenantId, sha256, { expiresInSeconds: 60 }));
    expect(refused, "a refusal is an Error carrying the marker (ARCH-03)").toBeInstanceOf(Error);
    expect(refusalCodeOf(refused), "the refusal is marked with the registered code, not left as a plain failure").toBe(DOWNLOAD_NOT_SIGNABLE);
    expect(Object.hasOwn(REFUSALS, DOWNLOAD_NOT_SIGNABLE), "the code is registered in the closed taxonomy (R-SPINE-062, Q-07)").toBe(true);

    const stored = await storage.put(tenantId, BYTES);
    expect(stored.sha256, "an object is addressed by the sha256 of its own bytes (SEAM-STORAGE)").toBe(sha256);
    expect(await storage.get(tenantId, sha256), "storing and serving evidence is not what the missing secret takes away").toEqual(BYTES);

    // `verify` vouches for nothing: not for a string that is no URL, and not for a well-formed one
    // another signer minted over this very root.
    const elsewhere = makeStorage({ root, signingSecret: "a-secret-this-installation-does-not-state" });
    const wellFormed = elsewhere.sign(tenantId, sha256, { expiresInSeconds: 60 });
    expect(storage.verify(wellFormed), "a URL another signer minted is not this one's").toEqual({ ok: false, reason: "invalid" });
    expect(storage.verify("not-a-signed-url")).toEqual({ ok: false, reason: "invalid" });
    expect(storage.verify(""), "far-side input never throws — it is simply not vouched for").toEqual({ ok: false, reason: "invalid" });

    expect(sink.signingWarnings(), "no secret was minted, so the operator was told of none").toEqual([]);
  });
});
