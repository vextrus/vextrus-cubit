// SEAM-CAD's one door (ARCH-02): the request that starts an ingest, the invocation that crosses the
// CLI seam, the job that carries it, the facts it pins and the records it leaves. A caller — a
// screen's server action, a route, the worker's composition root — speaks to the pipeline through
// this file and never reaches past it.
export { CAD_COMMAND_VAR, ingestDrawing, type IngestFormat, type IngestOutcome } from "./cli";
export { factsOf, type IngestCounterFact, type IngestFacts, type IngestLayoutFact } from "./facts";
export { ingestRecordOf, ingestRecordOfJob, ingestRecords, type IngestIdentity, type IngestRecord, type IngestScope } from "./records";
export { INGEST_KIND, ingestJobKey, requestIngest, runIngestJob, type IngestRefused, type IngestRequest, type IngestRequested } from "./pipeline";
export type { IngestRefusalCode, SheetNotIngestable } from "./refusals";
