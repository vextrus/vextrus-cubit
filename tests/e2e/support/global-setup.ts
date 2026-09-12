// V-E2E's setup: the journeys' database exists and carries the committed schema before the first
// journey runs. The web server is started by the config's `webServer` and reads the same URL; it
// opens no connection until a journey asks it to, which is what lets the two agree by name.
//
// Under the picture lane (the default since the re-baseline lease) it also installs the PICTURE TENANT — a workspace, a project and an
// account whose ids, names and clock are literals, so a still taken of them needs no magenta mask
// (AM-09 §4, Design Direction 00 §9.3). Installed only under that flag: with the flag off this file
// does exactly what it did, and no existing journey meets a row it did not meet before.
import { journeyWorkers } from "../../../scripts/lib/box.mjs";
import { detectGpu, launchEnvFor, pictureLane } from "./capture-geometry";
// The renderer read lives in the probe script, which is its one home: a flag set is a request and
// the renderer string is the answer, and both the probe's table and this line must ask the same way.
import { readRenderer } from "../../../scripts/gpu-probe.mjs";
import { ROLE_MIGRATE } from "../../../db/__tests__/support/fixtures";
import { PICTURE_CLOCK, PICTURE_TENANT, seedPictureTenant } from "./picture-tenant";
import { e2eDatabaseUrl, migrateUrlForPictureTenant, provisionE2eDatabase } from "./scratch-db";
import { SEEDED_FIXTURE, seedWorkerTenants, seededTenant, seededTenantCount } from "./seeded-tenant";
import { journeyStorageRoot } from "./worker";

/**
 * How many worker tenants this run needs: the worker count it was asked for, in the one spelling
 * the config and `scripts/e2e.mjs` have already made agree (P4b §6) — and the box's own number when
 * nobody has said (scripts/lib/box.mjs).
 */
function workerCount(): number {
  const stated = Number(process.env["CUBIT_E2E_WORKERS"] ?? "");
  return seededTenantCount(Number.isInteger(stated) && stated >= 1 ? stated : journeyWorkers());
}

export default async function globalSetup(): Promise<void> {
  provisionE2eDatabase();
  // ONE LINE PER RUN, AND IT IS ASKED RATHER THAN CLAIMED. About a second of one browser launch,
  // under EXACTLY the options every journey will get, so a reader of a log never has to infer which
  // rasteriser painted the pictures in front of them (v22 speed-gpu).
  const gpu = detectGpu();
  const renderer = await readRenderer({ channel: gpu.hardware ? "chromium" : undefined, headless: gpu.headless, args: gpu.args, env: launchEnvFor(gpu) });
  process.stdout.write(`gpu: ${renderer} [${gpu.why}]\n`);


  // THE WORKER TENANTS (v22 speed, the founder's second decision). One per Playwright worker, seeded
  // the way the picture tenant is — SQL through the harness's own `run`, ids that are literals of
  // the index — so a journey that needs a signed-in owner with a workspace and a project signs in
  // (a second) instead of walking nine screens for it. The DRAWING is opt-in and nothing asks for
  // it: seeded-tenant.ts's header records the two journeys that refuted a fixture ingest.
  // J-000 still walks every one of those screens: the golden path IS the prologue.
  const workers = workerCount();
  seedWorkerTenants(migrateUrlForPictureTenant(), { root: process.cwd(), storageRoot: journeyStorageRoot(), count: workers });
  process.stdout.write(
    `SEEDED TENANTS ${workers} (${seededTenant(0).email} … ${seededTenant(workers - 1).email}), each owning a workspace and a project (no drawing — ${SEEDED_FIXTURE.path} is opt-in)\n`,
  );

  if (!pictureLane()) return;
  seedPictureTenant(migrateUrlForPictureTenant());
  process.stdout.write(`PICTURE TENANT ${PICTURE_TENANT.tenantId} at ${PICTURE_CLOCK} (${ROLE_MIGRATE} on ${new URL(e2eDatabaseUrl()).pathname.slice(1)})\n`);
}
