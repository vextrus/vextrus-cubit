// The codes a partition can be refused with, drawn out of the closed taxonomy rather than re-spelled
// beside it (Q-07, R-SPINE-062): `Extract` keeps these bound to the register, so a code renamed
// there is a compile error here rather than a string that quietly means nothing.
import type { RefusalCode } from "@/core/errors";

/** A drawing no ingest record names — there is no artifact to classify (R-TO-030). */
export type PartitionNotAvailable = Extract<RefusalCode, "PARTITION_NOT_AVAILABLE">;

/** What the door answers with: nothing to partition, or a drawing this workspace cannot see. */
export type PartitionRefusalCode = PartitionNotAvailable | Extract<RefusalCode, "WORKSPACE_PERMISSION_NOT_HELD">;
