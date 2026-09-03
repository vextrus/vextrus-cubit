// The codes an ingest can be refused with, drawn out of the closed taxonomy rather than re-spelled
// beside it (Q-07, R-SPINE-062): `Extract` keeps these bound to the register, so a code renamed
// there is a compile error here rather than a string that quietly means nothing.
import type { RefusalCode } from "../../../core/errors";

/** A sheet the extractor took no geometry from — the only way one invocation can be refused. */
export type SheetNotIngestable = Extract<RefusalCode, "SHEET_NOT_INGESTABLE">;

/** What the door answers with: the sheet's own refusal, or a drawing this workspace cannot see. */
export type IngestRefusalCode = SheetNotIngestable | Extract<RefusalCode, "WORKSPACE_PERMISSION_NOT_HELD">;
