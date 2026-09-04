// SEAM-CAD's door (ARCH-02): the request that starts an ingest, the facts it pins and the records
// it leaves. A caller — a screen's server action, a route, another takeoff module — speaks to the
// seam through this file and never reaches past it.
//
// What is NOT here, on purpose: the job (`runIngestJob`) and the CLI client it crosses the process
// boundary with. Those stand behind ./job, which the worker's composition root alone imports — a
// bundler follows a barrel's every re-export, so a barrel that named the client would put the spawn
// into every screen's module graph, and the tracer that follows a server module's filesystem reach
// once walked the whole checkout from it and died on `cad/.venv` (an interpreter symlink uv leaves
// behind that points outside the root). A screen that asks for an ingest reaches the queue and the
// database and nothing on disk.
export { factsOf, type IngestCounterFact, type IngestFacts, type IngestLayoutFact } from "./facts";
export { ingestRecordOf, ingestRecords, type IngestIdentity, type IngestRecord, type IngestScope } from "./records";
export { INGEST_KIND, drawingInScope, ingestJobKey, requestIngest, type IngestFormat, type IngestRefused, type IngestRequest, type IngestRequested } from "./request";
export type { IngestRefusalCode, SheetNotIngestable } from "./refusals";
