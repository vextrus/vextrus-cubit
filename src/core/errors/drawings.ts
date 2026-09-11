// R-SPINE-020's upload seam: what a transfer is refused for, between the ceiling a file has to fit
// under and the bytes a scanner will not pass. Copy fixed by docs/design/dropzone.md § 3.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type DrawingsRefusalCode =
  | "FILE_TOO_LARGE"
  | "FORMAT_NOT_ACCEPTED"
  | "DIGEST_MISMATCH"
  | "UPLOAD_NOT_RESUMABLE"
  | "SCAN_REJECTED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const DRAWINGS_REFUSALS: RefusalGroup<DrawingsRefusalCode> = Object.freeze({
  // R-SPINE-020's upload seam: what a transfer is refused for, between the ceiling a file has to fit
  // under and the bytes a scanner will not pass. Copy fixed by docs/design/dropzone.md § 3.
  FILE_TOO_LARGE: Object.freeze({
    code: "FILE_TOO_LARGE",
    message: "This file is larger than the 500 MB an upload carries.",
    remedy: "Send the drawing on its own, or split the set into files of 500 MB or less.",
    severity: "error",
    surface: "inline",
  }),
  FORMAT_NOT_ACCEPTED: Object.freeze({
    code: "FORMAT_NOT_ACCEPTED",
    message: "This file is not one of the drawing formats the product reads.",
    remedy: "Upload a DWG, DXF, PDF, PNG, JPG or TIFF — the name and the contents both have to say the same format.",
    severity: "error",
    surface: "inline",
  }),
  DIGEST_MISMATCH: Object.freeze({
    code: "DIGEST_MISMATCH",
    message: "The bytes that arrived do not match the checksum the browser took of this file, so nothing was stored.",
    remedy: "Upload the file again — a file that changes while it is being read is the usual cause.",
    severity: "error",
    surface: "inline",
  }),
  // Expected and recoverable in stride — a client that asks where to resume from carries on from
  // there, which is why this one is a warning rather than an error.
  UPLOAD_NOT_RESUMABLE: Object.freeze({
    code: "UPLOAD_NOT_RESUMABLE",
    message: "This upload continued from a different point than the one already received, so nothing was added.",
    remedy: "Resume from the point the server reports, or upload the file again from the start.",
    severity: "warning",
    surface: "inline",
  }),
  SCAN_REJECTED: Object.freeze({
    code: "SCAN_REJECTED",
    message: "The virus scan rejected this file, so it was not stored.",
    remedy: "Check the file on your own machine, then upload a clean copy.",
    severity: "error",
    surface: "inline",
  }),
});
