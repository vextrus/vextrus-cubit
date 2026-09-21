// THE JOURNEYS' STAGE STATES ITS OWN ENVIRONMENT — one home for the two roots every process of the
// lane must agree on (ARCH-02, V-E2E).
//
// Three processes share one run: the served product (`next start`, started by playwright.config.ts's
// `webServer`), the shipped worker a journey spawns (tests/e2e/support/worker.ts), and the global
// setup that seeds the worker tenants' objects. Every stored object lives at
// `<STORAGE_ROOT>/<tenantId>/<sha256>`, so a raster the worker writes is readable by the server only
// if both resolved the same root — and until 2026-09-21 only the Playwright side was told which one.
// `next start` loads the checkout's untracked `.env`, and a `.env` that names `STORAGE_ROOT=storage/dev`
// (the dev lane's, as `.env.example` suggests) sent the server to one directory while the seed and
// the worker wrote to another: every sheet came back "the store holds no object" and J-011 and J-020
// were red unless the shell exported the root by hand. A deployment states its own address, its own
// database and its own signing key here already; it states its storage root the same way.
//
// The model transport is the second root. V-E2E: "Model calls use fixture transport" — a journey
// never reaches a provider (L-AI-01, AS-05). The seam replays fixtures when `CUBIT_MODEL_FIXTURE_ROOT`
// names a directory or the process runs under NODE_ENV=test; a served product runs under
// `production`, so without this the journeys' server and worker were on the LIVE transport and
// every model question ended in a thrown fault the ledger never saw. Stated here, a question the
// corpus does not hold is refused `FIXTURE_MISSING` and recorded, which is the answer the law wants.
//
// Pure on purpose: no import reaches a database or a driver, so this module is readable by the
// Playwright config at load, by the worker, by the global setup and by a unit test alike.
import { join } from "node:path";

/**
 * Where the SERVED product keeps its objects, which is the only root a worker of this lane may
 * write to: `src/core/storage/app.ts` reads `STORAGE_ROOT` or falls back to `<cwd>/storage`. The
 * environment's own reading wins where it states one, so a run under a repointed root still agrees
 * with its server — and the config hands this same value to that server.
 */
export function journeyStorageRoot(): string {
  return process.env["STORAGE_ROOT"] ?? join(process.cwd(), "storage");
}

/**
 * The recorded model answers the lane replays from: the corpus's default home, `fixtures/model`
 * (fixtures/model/README.md), unless the environment points the seam at another root.
 */
export function journeyModelFixtureRoot(): string {
  const configured = process.env["CUBIT_MODEL_FIXTURE_ROOT"];
  return configured !== undefined && configured.trim() !== "" ? configured : join(process.cwd(), "fixtures", "model");
}

/** The environment every process of the lane is handed, over whatever it inherits. */
export function journeyProcessEnv(): { STORAGE_ROOT: string; CUBIT_MODEL_FIXTURE_ROOT: string } {
  return { STORAGE_ROOT: journeyStorageRoot(), CUBIT_MODEL_FIXTURE_ROOT: journeyModelFixtureRoot() };
}
