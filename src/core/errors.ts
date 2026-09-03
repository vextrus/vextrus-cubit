// R-SPINE-062: the closed refusal taxonomy, and its one home (ARCH-02, B-17). Every code carries
// an English message, a remedy hint, a severity and a surface hint; every transport and every
// screen reads a refusal from here rather than writing one of its own.
//
// The taxonomy is closed in the strong sense B-06 asks for: a code is registered here or it does
// not exist. `refusalOf` throws on a code the registry lacks rather than inventing an entry, so a
// mistyped code fails loudly at its call site instead of reaching a user as an empty answer.
//
// The copy is fixed by docs/design/refusal-state.md § 3, whose rules bind every entry here: the
// message is one present-tense sentence saying what was refused and why, the remedy one sentence
// beginning with the verb that resolves it. Operator detail — the internal "why" a seam carries
// alongside the code — never appears here; it travels with the thrown marker instead.

/**
 * How urgently a refusal reads. Presentation only: the meaning of a refusal travels in its text,
 * never in its colour (R-UI-060). `error` — refused and needing correction; `warning` — refused
 * but expected and recoverable in stride; `info` — nothing was refused of the user, the system is
 * explaining an absence.
 */
export type RefusalSeverity = "error" | "warning" | "info";

/** Where the one renderer places the answer (R-UI-020). */
export type RefusalSurface = "inline" | "banner" | "dialog";

/** Every code the taxonomy holds. The union is the registry's key set — the two cannot drift. */
export type RefusalCode =
  | "PRECISION_NOT_APPLIED"
  | "CHARACTER_NOT_COVERED"
  | "SIGNED_OUT"
  | "CONSEQUENCES_NOT_CARRIED"
  | "PERMISSION_NOT_HELD"
  | "ACTOR_NOT_HUMAN"
  | "ACT_CHANGES_NOTHING"
  | "PROJECT_WOULD_HAVE_NO_PRINCIPAL"
  | "CREDENTIALS_NOT_VALID"
  | "TOKEN_NOT_VALID"
  | "RATE_LIMITED"
  | "ACCOUNT_ALREADY_EXISTS"
  | "LINK_NOT_SENDABLE"
  | "DIMENSION_MISMATCH"
  | "PRODUCT_FACTOR_MISSING"
  | "UNIT_UNKNOWN"
  | "WORKSPACE_PERMISSION_NOT_HELD"
  | "SELF_REMOVAL_NOT_ALLOWED"
  | "WORKSPACE_WOULD_HAVE_NO_OWNER"
  | "ORIGIN_NOT_VERIFIED"
  | "MEMBER_HAS_ACTS"
  | "INVITATION_NOT_CLAIMABLE"
  | "FIXTURE_MISSING"
  | "UNSOURCED"
  | "SOURCE_UNRESOLVED"
  | "MALFORMED"
  | "FILE_TOO_LARGE"
  | "FORMAT_NOT_ACCEPTED"
  | "DIGEST_MISMATCH"
  | "UPLOAD_NOT_RESUMABLE"
  | "SCAN_REJECTED"
  | "SHEET_NOT_INGESTABLE";

/** One registered refusal, whole: what it is, what happened, what resolves it, how it renders. */
export type RefusalEntry = {
  readonly code: RefusalCode;
  readonly message: string;
  readonly remedy: string;
  readonly severity: RefusalSeverity;
  readonly surface: RefusalSurface;
};

/**
 * The registry, keyed by the code itself and frozen entry by entry — a refusal read at a transport
 * or a screen is the registered answer, never a mutated one. Each entry's `code` keeps the type of
 * its own key, so a seam that answers with a narrow set of codes can read the value out of the
 * register instead of re-spelling it as a literal beside it (Q-07).
 */
export const REFUSALS: Readonly<{ [C in RefusalCode]: RefusalEntry & { code: C } }> = Object.freeze({
  PRECISION_NOT_APPLIED: Object.freeze({
    code: "PRECISION_NOT_APPLIED",
    message: "The value is not at the exact precision this document requires.",
    remedy: "Enter the value at the stated precision — nothing is rounded or padded on your behalf.",
    severity: "error",
    surface: "inline",
  }),
  CHARACTER_NOT_COVERED: Object.freeze({
    code: "CHARACTER_NOT_COVERED",
    message: "The text contains a character the document font cannot print.",
    remedy: "Replace or remove the unsupported character — a document never prints a blank box in its place.",
    severity: "error",
    surface: "inline",
  }),
  SIGNED_OUT: Object.freeze({
    code: "SIGNED_OUT",
    message: "Your session has ended, so this request was not carried out.",
    remedy: "Sign in again to continue.",
    severity: "warning",
    surface: "banner",
  }),
  CONSEQUENCES_NOT_CARRIED: Object.freeze({
    code: "CONSEQUENCES_NOT_CARRIED",
    message: "This change was reviewed against an earlier state of the project, which has moved since.",
    remedy: "Review the change again — what it would do now is not what was shown.",
    severity: "warning",
    surface: "dialog",
  }),
  PERMISSION_NOT_HELD: Object.freeze({
    code: "PERMISSION_NOT_HELD",
    message: "Your roles on this project do not carry the permission this action needs.",
    remedy: "Ask a principal of the project to give you a role that carries it.",
    severity: "error",
    surface: "banner",
  }),
  ACTOR_NOT_HUMAN: Object.freeze({
    code: "ACTOR_NOT_HUMAN",
    message: "This action is recorded as a human act, so only a person may perform it.",
    remedy: "Perform the action as a signed-in person.",
    severity: "error",
    surface: "banner",
  }),
  ACT_CHANGES_NOTHING: Object.freeze({
    code: "ACT_CHANGES_NOTHING",
    message: "This action would leave the project exactly as it is, so nothing was recorded.",
    remedy: "Choose a change that moves something — what you asked for is already the case.",
    severity: "info",
    surface: "dialog",
  }),
  PROJECT_WOULD_HAVE_NO_PRINCIPAL: Object.freeze({
    code: "PROJECT_WOULD_HAVE_NO_PRINCIPAL",
    message: "This withdrawal would leave the project with no principal, so it was not carried out.",
    remedy: "Make another member a principal first, then withdraw this one.",
    severity: "error",
    surface: "inline",
  }),
  CREDENTIALS_NOT_VALID: Object.freeze({
    code: "CREDENTIALS_NOT_VALID",
    message: "The email and password do not match an account.",
    remedy: "Check both and try again, or reset your password.",
    severity: "error",
    surface: "inline",
  }),
  TOKEN_NOT_VALID: Object.freeze({
    code: "TOKEN_NOT_VALID",
    message: "This link is no longer valid — it may have expired or already been used.",
    remedy: "Request a fresh link and use the newest email.",
    severity: "error",
    surface: "inline",
  }),
  RATE_LIMITED: Object.freeze({
    code: "RATE_LIMITED",
    message: "Too many attempts in a short time, so this one was not tried.",
    remedy: "Wait a minute, then try again.",
    severity: "warning",
    surface: "inline",
  }),
  ACCOUNT_ALREADY_EXISTS: Object.freeze({
    code: "ACCOUNT_ALREADY_EXISTS",
    message: "An account with this email already exists.",
    remedy: "Sign in instead, or reset the password if you have lost it.",
    severity: "error",
    surface: "inline",
  }),
  LINK_NOT_SENDABLE: Object.freeze({
    code: "LINK_NOT_SENDABLE",
    message: "No link was sent, because this installation has not been given the web address its links point back to.",
    remedy: "Ask an operator to set the address this installation answers at, then ask for the link again.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-06's three structural conversion refusals. Each is the answer where a conversion has no
  // meaning rather than no result: the failure arm at the seam carries one of these codes and no
  // value, so nothing downstream can read a number that was never derived.
  DIMENSION_MISMATCH: Object.freeze({
    code: "DIMENSION_MISMATCH",
    message: "These two units measure different things, so the quantity was not converted.",
    remedy: "Give the quantity in a unit that measures the same thing — a weight never becomes a volume.",
    severity: "error",
    surface: "inline",
  }),
  PRODUCT_FACTOR_MISSING: Object.freeze({
    code: "PRODUCT_FACTOR_MISSING",
    message: "The quantity is in a packaging unit, and this product does not state how much one of them holds.",
    remedy: "Record what one unit of this product's packaging holds, then enter the quantity again.",
    severity: "error",
    surface: "inline",
  }),
  UNIT_UNKNOWN: Object.freeze({
    code: "UNIT_UNKNOWN",
    message: "This unit is not one the measurement canon knows, so the quantity was not converted.",
    remedy: "Use a unit the canon lists — nothing is converted through a unit nobody defined.",
    severity: "error",
    surface: "inline",
  }),
  WORKSPACE_PERMISSION_NOT_HELD: Object.freeze({
    code: "WORKSPACE_PERMISSION_NOT_HELD",
    message: "Your role in this workspace does not carry the permission this action needs.",
    remedy: "Ask an owner of the workspace to carry it out, or to give you a role that carries it.",
    severity: "error",
    surface: "banner",
  }),
  SELF_REMOVAL_NOT_ALLOWED: Object.freeze({
    code: "SELF_REMOVAL_NOT_ALLOWED",
    message: "You cannot remove yourself from a workspace.",
    remedy: "Ask another owner to remove you, so somebody is left who can undo it.",
    severity: "error",
    surface: "inline",
  }),
  WORKSPACE_WOULD_HAVE_NO_OWNER: Object.freeze({
    code: "WORKSPACE_WOULD_HAVE_NO_OWNER",
    message: "This would leave the workspace with no owner, so it was not carried out.",
    remedy: "Make another member an owner first, then try again.",
    severity: "error",
    surface: "inline",
  }),
  ORIGIN_NOT_VERIFIED: Object.freeze({
    code: "ORIGIN_NOT_VERIFIED",
    message: "This request came from a page this deployment does not serve, so it was not carried out.",
    remedy: "Return to the workspace in your browser and try the action again from there.",
    severity: "error",
    surface: "banner",
  }),
  // SEAM-ACT's coupling: tenant administration sits outside the act log's writ, so a membership the
  // log names as an author is not taken away underneath the record it made (R-SPINE-003).
  MEMBER_HAS_ACTS: Object.freeze({
    code: "MEMBER_HAS_ACTS",
    message: "This member holds recorded acts on open campaigns, so their membership was not removed.",
    remedy: "Remove them once those campaigns close — the record keeps its author until then.",
    severity: "error",
    surface: "inline",
  }),
  // R-SPINE-003's ACCEPT flow: the four ways a mailed invitation stops being spendable answer as
  // one code, because an answer that told them apart would tell the holder of a token which of them
  // it is — and a stranger's probe would learn whether an address was ever invited.
  INVITATION_NOT_CLAIMABLE: Object.freeze({
    code: "INVITATION_NOT_CLAIMABLE",
    message: "This invitation cannot be accepted — it was never issued, has already been accepted, or was withdrawn.",
    remedy: "Ask an owner of that workspace to send a fresh invitation to the address you are signed in with.",
    severity: "error",
    surface: "inline",
  }),
  // L-AI-01: under the fixture transport a request nobody recorded an answer for is refused, never
  // sent to a provider — verify is network-free, and the refusal is a ledger row like any other.
  FIXTURE_MISSING: Object.freeze({
    code: "FIXTURE_MISSING",
    message: "No recorded model answer exists for this request, so it was not carried out.",
    remedy: "Record the model's answer for this request, then try it again.",
    severity: "error",
    surface: "inline",
  }),
  // L-AI-02: a model's answer is a proposal only once every source it cites is resolved against the
  // artifact; the three ways it fails that are refusals, each recorded in the ledger as a refused
  // call that still keeps the tokens the transport spent.
  UNSOURCED: Object.freeze({
    code: "UNSOURCED",
    message: "The model's answer names no source entity in the drawing, so it was not accepted as a proposal.",
    remedy: "Request the answer again with the entities it rests on cited — nothing uncited is carried forward.",
    severity: "error",
    surface: "inline",
  }),
  SOURCE_UNRESOLVED: Object.freeze({
    code: "SOURCE_UNRESOLVED",
    message: "The model's answer cites a source entity the drawing does not contain, so it was not accepted as a proposal.",
    remedy: "Request the answer again against the drawing as ingested — a citation must name an entity that exists in it.",
    severity: "error",
    surface: "inline",
  }),
  MALFORMED: Object.freeze({
    code: "MALFORMED",
    message: "The model's answer is not in the shape a proposal takes, so it was not accepted.",
    remedy: "Request the answer again — an answer that cannot be read as a proposal is never guessed at.",
    severity: "error",
    surface: "inline",
  }),
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
  // SEAM-CAD's answer when the extractor took no geometry from a sheet (L-CAD-04): a sheet nothing
  // could be read from is an answer the operator acts on, never a fault of the product's.
  SHEET_NOT_INGESTABLE: Object.freeze({
    code: "SHEET_NOT_INGESTABLE",
    message: "The extractor could not read this sheet, so no geometry was taken from it.",
    remedy: "Export the drawing again as DXF (R2000 or later) and upload the new file.",
    severity: "error",
    surface: "inline",
  }),
} satisfies Record<RefusalCode, RefusalEntry>);

/**
 * The registered entry for a code. An unregistered code is a mistake in the caller, not a refusal
 * the product can answer with, so it throws rather than guessing one (B-06, R-SPINE-062).
 */
export function refusalOf(code: RefusalCode): RefusalEntry {
  if (!Object.hasOwn(REFUSALS, code)) {
    throw new Error(`"${code}" is not a registered refusal — the taxonomy is closed (R-SPINE-062, B-06)`);
  }
  return REFUSALS[code];
}
