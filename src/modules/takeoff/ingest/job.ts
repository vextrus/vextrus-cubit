// SEAM-CAD's job door: what the worker's composition root imports, and nothing else does
// (ARCH-01: src/worker imports modules; the app never reaches this file). It is the only export of
// the CLI client, so the process boundary lives in the worker's module graph alone — a bundled app
// that held it once traced the whole checkout from the client's own path and died on `cad/.venv`,
// an interpreter symlink uv leaves behind that points outside the root. The request half, the
// records and the facts stay behind ./index for every other caller.
export { CAD_COMMAND_VAR, ingestDrawing, type IngestOutcome } from "./cli";
export { runIngestJob } from "./pipeline";
export { INGEST_KIND } from "./request";
