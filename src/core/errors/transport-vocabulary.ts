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
    // `CUBIT_PUBLIC_ORIGIN` is the deployment's statement of the address it answers at, read in
    // `src/server/context.ts`: a mailed link may not be pointed by the caller's own Host header
    // (R-SPINE-001), so the origin comes from the machine rather than from the request.
    // `WORKER_HEALTH_PORT` is where the worker process answers about its own health, read in
    // `src/worker/main.ts`: the machine says which port it may bind, because the process that runs
    // the queues is a service the host supervises (R-SPINE-031).
    // `CUBIT_MODEL_FIXTURE_ROOT` and `ANTHROPIC_API_KEY` are read in `src/core/model`: the first
    // names the directory recorded model answers are replayed from and, by being non-blank, selects the
    // fixture transport; the second is the live provider's credential (L-AI-01, B-23).
    codes: Object.freeze(["DATABASE_URL", "STORAGE_ROOT", "NODE_ENV", "CUBIT_PUBLIC_ORIGIN", "WORKER_HEALTH_PORT", "CUBIT_MODEL_FIXTURE_ROOT", "ANTHROPIC_API_KEY"]),
  }),
  Object.freeze({
    // L-ACT-02's act-type enum, spelled as the law spells it. An act type names what a human did; it
    // is written to the act log and read by the seam's map, and no user is ever answered with one.
    // Its home is `../acts/law.ts` (ARCH-02) — this declaration is what tells a name belonging to
    // that closed set apart from a refusal nobody registered.
    vocabulary: "act types (L-ACT-02)",
    codes: Object.freeze(["ASSIGN_PARTICIPANT_ROLE"]),
  }),
  Object.freeze({
    // L-CAD-02's closed source-key scheme set, spelled by the extractor that mints the keys and by
    // the EntityGraph mirror that parses them. A scheme names who read the file bytes; it rides on
    // an artifact key at the `cad/` seam and is never answered to a user. Only the scheme this tree
    // actually spells is declared — a declaration answering for nobody is dead amnesty, not a
    // vocabulary (Q-07).
    vocabulary: "EntityGraph source-key schemes (L-CAD-02)",
    codes: Object.freeze(["DXF_HANDLE"]),
  }),
  Object.freeze({
    // L-ACT-03's closed permission enum and the roles that bundle it. A permission is what an act
    // moves and a role is what a human picks; both are checked at the act seam, and a person is
    // answered with the registered refusal above, never with one of these names.
    vocabulary: "act permissions and roles (L-ACT-03)",
    codes: Object.freeze([
      "PIN_SET",
      "AUTHOR_LEVEL_STACK",
      "AUTHOR_PROJECT_FACT",
      "MEASURE",
      "SET_BILL_BOUNDARY",
      "ADMINISTER_SAMPLE",
      "ENTER_BLIND_FIGURE",
      "REVIEW",
      "SIGN",
      "ADMINISTER_PROJECT",
      "ADMINISTER_BOOK",
      "PRICE",
      "BID",
      "MEASURER",
      "REVIEWER",
      "LEAD",
      "ESTIMATOR",
      "BID_MANAGER",
      "PRINCIPAL",
    ]),
  }),
  Object.freeze({
    // L-MEA-01's rule-set names, spelled as the law spells them. `IS1200_IN` is the name half of an
    // edition's identity (scope, name, version) — data held in the store and shown on the settings
    // screen, never an answer given to anybody. Its home is `../rulesets/seed` (ARCH-02).
    vocabulary: "rule-set edition names (L-MEA-01)",
    codes: Object.freeze(["IS1200_IN"]),
  }),
]);
