// The codes an upload can be refused with, drawn out of the closed taxonomy rather than re-spelled
// beside it (Q-07, R-SPINE-062): `Extract` keeps this union bound to the register, so a code renamed
// there is a compile error here rather than a string that quietly means nothing.
//
// The seam answers one of these and no other, which is what lets the transport map every one of them
// to a status without a fallback nobody chose.
import type { RefusalCode } from "../../../core/errors";

export type UploadRefusalCode = Extract<
  RefusalCode,
  "SIGNED_OUT" | "WORKSPACE_PERMISSION_NOT_HELD" | "FILE_TOO_LARGE" | "FORMAT_NOT_ACCEPTED" | "DIGEST_MISMATCH" | "UPLOAD_NOT_RESUMABLE" | "SCAN_REJECTED"
>;
