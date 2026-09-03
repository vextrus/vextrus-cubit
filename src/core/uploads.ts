// R-SPINE-020's upload domain facts that are law rather than storage: the drawing formats the
// product reads, and the three states an upload session can stand in.
//
// They live here, apart from `./db`, for the reason `./projects` states of the building types
// (ARCH-01): the schema writes each column's CHECK from these rosters, the upload seam types its
// answers by them, and the transfer's own ceiling is the same number in all three places. One home,
// read by all of them (ARCH-02, B-17).

/** R-SPINE-020's roster, in the order the accepts line names them. */
export const ACCEPTED_FORMATS = ["dwg", "dxf", "pdf", "png", "jpg", "tiff"] as const;

/** One of the six formats a drawing arrives in, as a type. */
export type AcceptedFormat = (typeof ACCEPTED_FORMATS)[number];

/** Is this one of the six? Asked wherever a format arrives as text — a stored row, a query answer. */
export function isAcceptedFormat(value: string): value is AcceptedFormat {
  return (ACCEPTED_FORMATS as readonly string[]).includes(value);
}

/**
 * Where an upload session stands: taking bytes, ended with its content stored, or ended refused.
 * The set is closed because the column's CHECK is written from it — a session in no state at all is
 * a session nothing can answer for.
 */
export const UPLOAD_STATES = ["open", "stored", "refused"] as const;

/** One of the three, as a type. */
export type UploadState = (typeof UPLOAD_STATES)[number];

/**
 * What a scanner said about some bytes (R-SPINE-020's hook point). `skipped` is the honest answer of
 * an installation with no scanner wired: it is recorded on the stored file so nothing unscanned is
 * ever read back as clean.
 */
export const SCAN_VERDICTS = ["clean", "infected", "skipped"] as const;

/** One verdict, as a type. */
export type ScanVerdict = (typeof SCAN_VERDICTS)[number];

/** R-SPINE-020's ceiling: 500 MB per file, in bytes. */
export const UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

/** The chunk an upload session takes at a time, in bytes. */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
