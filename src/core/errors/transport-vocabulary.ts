// Q-07: refusal-shaped names that are not refusals are declared once, here, so the register scan
// can tell "foreign, declared" from "orphan" — and so the alternative, assembling such a name from
// parts to slip past the scan, buys nothing and never becomes an idiom.
//
// A vocabulary is somebody else's closed set that this product spells verbatim: a transport's error
// codes, a vendor's auth codes, a rule-set's names, the machine's environment variables. Declaring
// one is a statement about ownership — these names are read and written at a seam, and none of them
// is ever answered to a user (R-SPINE-062, B-17: the taxonomy in `../errors.ts` is the one home for
// names the product does own).

/** One foreign vocabulary: who owns the names, and which of them this tree spells. */
export type TransportVocabulary = {
  vocabulary: string;
  codes: readonly string[];
};

export const TRANSPORT_VOCABULARY: ReadonlyArray<TransportVocabulary> = Object.freeze([
  Object.freeze({
    // The transport's own error codes (ARCH-03: the tRPC handler maps a fault to one of these after
    // the fault seam has recorded it — the code the wire carries, never the answer the user reads).
    vocabulary: "tRPC transport error codes",
    codes: Object.freeze([
      "PARSE_ERROR",
      "BAD_REQUEST",
      "INTERNAL_SERVER_ERROR",
      "NOT_IMPLEMENTED",
      "BAD_GATEWAY",
      "SERVICE_UNAVAILABLE",
      "GATEWAY_TIMEOUT",
      "UNAUTHORIZED",
      "PAYMENT_REQUIRED",
      "FORBIDDEN",
      "NOT_FOUND",
      "METHOD_NOT_SUPPORTED",
      "UNSUPPORTED_MEDIA_TYPE",
      "TIMEOUT",
      "CONFLICT",
      "PRECONDITION_FAILED",
      "PAYLOAD_TOO_LARGE",
      "UNPROCESSABLE_CONTENT",
      "TOO_MANY_REQUESTS",
      "CLIENT_CLOSED_REQUEST",
    ]),
  }),
  Object.freeze({
    // The machine's environment (AS-01), read at the seams that need it — `DATABASE_URL` in the
    // database seam above all. An environment name is a key, never a code answered to anyone.
    vocabulary: "environment variable names",
    codes: Object.freeze(["DATABASE_URL", "STORAGE_ROOT", "NODE_ENV"]),
  }),
]);
