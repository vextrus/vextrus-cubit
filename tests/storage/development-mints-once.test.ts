/**
 * AC-2 — in development, with no secret stated, one secret is minted for the whole process and the
 * operator is told about it exactly once.
 *
 * A developer keeps signed downloads without stating a name, and the cost of that convenience — the
 * links do not survive a restart — is a fact only the fault seam can carry (ARCH-03, B-21, Q-12). It
 * is carried once per process, not once per call and not once per storage root: the minted secret is
 * the process's, which is what makes a URL minted before `STORAGE_ROOT` moved verify after it.
 *
 * This file holds ONE case, and it is the file's first development-without-secret call, so the count
 * below is the process's own answer rather than an artefact of what ran before it.
 */
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { appStorage } from "../../src/core/storage/app";
import { addressOf, aTenant, collectFaults, freshRoot, MODE_VAR, ROOT_VAR, SECRET_VAR, SIGNING_ROUTE, STORAGE_ACTOR, STORAGE_REQUEST_ID, WARNING_PREFIX } from "./support/storage-stage";

const BYTES = new Uint8Array([2, 3, 5, 7, 11]);

/** The sink is swapped once, at file start, and put back when the file is done. */
const sink = collectFaults();

afterAll(() => {
  sink.restore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("AC-2: development mints one signing secret per process and warns about it exactly once", async () => {
  const firstRoot = await freshRoot();
  vi.stubEnv(MODE_VAR, "development");
  vi.stubEnv(SECRET_VAR, "");
  vi.stubEnv(ROOT_VAR, firstRoot);

  const sha256 = addressOf(BYTES);
  const firstTenant = aTenant();
  const first = appStorage();
  const firstUrl = first.sign(firstTenant, sha256, { expiresInSeconds: 60 });
  expect(appStorage().verify(firstUrl), "a development box still signs, and vouches for what it signed").toEqual({ ok: true, tenantId: firstTenant, sha256 });

  // The machine names a different root: a second storage, over a second directory, on the ONE
  // secret this process minted.
  const secondRoot = await freshRoot();
  vi.stubEnv(ROOT_VAR, secondRoot);
  const second = appStorage();
  const secondTenant = aTenant();
  const secondUrl = second.sign(secondTenant, sha256, { expiresInSeconds: 60 });
  expect(second.verify(firstUrl), "the minted secret belongs to the process, not to the root it was first read beside").toEqual({ ok: true, tenantId: firstTenant, sha256 });
  expect(first.verify(secondUrl), "and the other way round, which is the same fact").toEqual({ ok: true, tenantId: secondTenant, sha256 });

  const warnings = sink.signingWarnings();
  expect(warnings, `minting is reported once through the fault seam under ${SIGNING_ROUTE}`).toHaveLength(1);
  const [warning] = warnings;
  expect(warning?.actor, "the instance is every module's, so the outage is filed against storage itself").toBe(STORAGE_ACTOR);
  expect(warning?.requestId).toBe(STORAGE_REQUEST_ID);
  expect(warning?.cause.startsWith(WARNING_PREFIX), "a minted secret is a warning, not a failure of the operation").toBe(true);
  expect(warning?.cause, "the operator is told which variable to go and set (B-21)").toContain(SECRET_VAR);
});
