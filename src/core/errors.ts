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
  | "SHEET_NOT_INGESTABLE"
  | "RASTER_NOT_AVAILABLE"
  | "MANIFEST_NOT_RENDERABLE"
  | "CAPTION_UNCLASSIFIABLE"
  | "PARTITION_NOT_AVAILABLE"
  | "CONVENTION_ROLE_UNRESOLVED"
  | "GRID_NO_BUBBLE_EVIDENCE"
  | "SCHEDULE_NONE_RECONSTRUCTED"
  | "SCHEDULE_VIEW_CONTRIBUTED_NOTHING"
  | "TYPICAL_RANGE_UNSTATED"
  | "LEVEL_RANGE_ENDPOINT_UNMAPPED"
  | "GROUP_NOT_OFFERED"
  | "SET_NOT_PINNABLE"
  | "SET_NAME_NOT_USABLE"
  | "SET_MEMBER_NOT_IN_PROJECT"
  | "DOWNLOAD_NOT_SIGNABLE"
  | "SCALE_NO_EVIDENCE"
  | "SCALE_UNIT_UNMAPPED"
  | "SCALE_OBSERVATION_UNCITED"
  | "SCALE_OBSERVATION_OBLIQUE"
  | "SCALE_OBSERVATION_UNVERIFIED"
  | "DIMENSION_MISMATCH"
  | "PRODUCT_FACTOR_MISSING"
  | "DUPLICATE_IDENTITY"
  | "LEVEL_ORDINAL_UNMAPPED"
  | "STOREY_HEIGHT_UNSTATED"
  | "STOREY_HEIGHT_CONTESTED"
  | "METHOD_NOT_IN_EDITION"
  | "METHOD_IMPLEMENTATION_MISSING"
  | "UNIT_UNMAPPED"
  | "OFFER_NOT_TO_CONTRACT"
  | "INTERPRETED_UNCORROBORATED"
  | "VIEW_SCALE_UNAFFIRMED"
  | "MEMBER_TYPE_UNKNOWN"
  | "SECTION_BAND_UNCOVERED"
  | "SECTION_UNIT_UNSTATED"
  | "PIN_STALE"
  | "CAMPAIGN_NOT_FOUND"
  | "READING_NOT_NUMERIC"
  | "NOT_ESTABLISHED"
  | "INGESTION_TRUNCATED"
  | "NOT_IN_PROJECT_SCOPE"
  | "NO_BEARER_SIGHTED"
  | "KIND_NOT_YET_SEEDED"
  | "NOT_IN_THIS_BILL";

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
  // R-SPINE-022's answer when a drawing's sheets have never been rendered: rasters are taken from an
  // ingest record's artifact, so a drawing nothing was ever extracted from has no sheets to render.
  RASTER_NOT_AVAILABLE: Object.freeze({
    code: "RASTER_NOT_AVAILABLE",
    message: "This drawing has no sheet rasters yet, because it has not been ingested.",
    remedy: "Ingest the drawing first, then ask for its rasters again.",
    severity: "error",
    surface: "inline",
  }),
  // R-UI-043's answer when a sheet cannot be drawn: the bytes an ingest record names are not an
  // EntityGraph the one mirror parses, so there is no geometry to build a manifest from. The reading
  // is what is damaged, not the drawing, so the remedy is another reading of it.
  MANIFEST_NOT_RENDERABLE: Object.freeze({
    code: "MANIFEST_NOT_RENDERABLE",
    message: "The reading of this drawing is damaged, so the sheet cannot be drawn.",
    remedy: "Upload the drawing again to have it read afresh.",
    severity: "error",
    surface: "banner",
  }),
  // L-CAD-06's answer for a view caption the deterministic grammar reads nothing in: the view stands
  // untyped and says why, because a grammar that guessed would put a class in front of a person as
  // though it had been read off the drawing.
  CAPTION_UNCLASSIFIABLE: Object.freeze({
    code: "CAPTION_UNCLASSIFIABLE",
    message: "This view's caption says nothing the classification grammar reads, so the view is untyped.",
    remedy: "Confirm what the view is yourself, or re-caption it in the drawing and ingest it again.",
    severity: "info",
    surface: "inline",
  }),
  // R-TO-030's answer when a drawing has no partition to rebuild: the partition is a reading of an
  // ingest record, so a drawing nothing has ever been extracted from has nothing to classify.
  PARTITION_NOT_AVAILABLE: Object.freeze({
    code: "PARTITION_NOT_AVAILABLE",
    message: "This drawing has no stored partition, because it has not been ingested.",
    remedy: "Ingest the drawing first, then ask for its partition again.",
    severity: "error",
    surface: "inline",
  }),
  // L-CAD-08's answer where a drawing's own geometry does not say which layer carries a role: the
  // profile defers the role rather than defaulting one, because a defaulted convention would be a
  // reading nobody made (L-QTY-04).
  CONVENTION_ROLE_UNRESOLVED: Object.freeze({
    code: "CONVENTION_ROLE_UNRESOLVED",
    message: "No layer of this drawing carries this role plainly enough to resolve it, so the convention profile leaves it unresolved.",
    remedy: "Say which layer carries it yourself, or draw the role on a layer of its own and ingest the drawing again.",
    severity: "info",
    surface: "inline",
  }),
  // L-CAD-07's answer where a layout plan offered no lawful bubble evidence — no family of round
  // rings enclosing bare labels with two distinct labels between them: the view georeferences as
  // deferred rather than as a grid guessed off gridlines and loose letters (L-QTY-04).
  GRID_NO_BUBBLE_EVIDENCE: Object.freeze({
    code: "GRID_NO_BUBBLE_EVIDENCE",
    message: "This layout plan shows no grid bubbles to read a grid from, so its grid is left unresolved rather than guessed.",
    remedy: "Draw the grid bubbles as circles around their letters and numbers, then ingest the drawing again.",
    severity: "info",
    surface: "inline",
  }),
  // L-CAD-08's answer where a schedule-titled view yielded no table at all — no band of it holds a
  // name or mark cell, so there is no header to take columns from and a table reconstructed without
  // one would be columns nobody drew (R-TO-031).
  SCHEDULE_NONE_RECONSTRUCTED: Object.freeze({
    code: "SCHEDULE_NONE_RECONSTRUCTED",
    message: "This schedule shows no header row naming its members, so no table was rebuilt from it.",
    remedy: "Add a heading such as MARK over the column of member names, then ingest the drawing again.",
    severity: "info",
    surface: "inline",
  }),
  // R-TO-031's other answer: the table rebuilt, and not one of its rows names a member — a schedule
  // of notes and dashes registers no member type rather than a family invented from noise (L-QTY-04).
  SCHEDULE_VIEW_CONTRIBUTED_NOTHING: Object.freeze({
    code: "SCHEDULE_VIEW_CONTRIBUTED_NOTHING",
    message: "This schedule's rows name no member, so it added no member types.",
    remedy: "Check that the mark column holds member names such as C1, then ingest the drawing again.",
    severity: "info",
    surface: "inline",
  }),
  // L-CAD-07's answer where a typical plan states no range at all: "a bare typical caption states no
  // membership and registers UNRESOLVED rows with no line (`TYPICAL_RANGE_UNSTATED`)". The columns
  // are read and stand in the unresolved slot; which levels they repeat over is nobody's guess.
  TYPICAL_RANGE_UNSTATED: Object.freeze({
    code: "TYPICAL_RANGE_UNSTATED",
    message: "This typical plan does not say which floors it is typical of, so what stands on it is not spread over any of them.",
    remedy: "State the range of floors this plan is typical of, which registers the members on every floor of it.",
    severity: "info",
    surface: "inline",
  }),
  // L-CAD-07's other expansion answer: "a stated range whose endpoint the stack lacks refuses
  // `LEVEL_RANGE_ENDPOINT_UNMAPPED`". Answered by the expansion where a caption names the endpoint,
  // and by the authoring act where a person does.
  LEVEL_RANGE_ENDPOINT_UNMAPPED: Object.freeze({
    code: "LEVEL_RANGE_ENDPOINT_UNMAPPED",
    message: "The level stack carries no level at one end of this range, so the range reaches past the building that was authored.",
    remedy: "Author the level this range runs to, then state the range again.",
    severity: "error",
    surface: "inline",
  }),
  // L-ACT-02's answer when a caller names a group the machine is not offering: "bulk is offered,
  // never assembled", so the membership a commit would move is the machine's own — a key whose
  // membership resolves empty names nothing this project is waiting to have confirmed.
  GROUP_NOT_OFFERED: Object.freeze({
    code: "GROUP_NOT_OFFERED",
    message: "This group is not one the project offers now, so nothing was confirmed.",
    remedy: "Reload the sheet index and confirm from a group it offers.",
    severity: "error",
    surface: "inline",
  }),
  // L-REG-06's manifest is the citation list of a set's members, so a set naming none of this
  // project's drawings has nothing to be content-addressed: the pin answers by name rather than
  // recording an empty revision nobody could measure against.
  SET_NOT_PINNABLE: Object.freeze({
    code: "SET_NOT_PINNABLE",
    message: "This set names no members of this project, so no revision was pinned.",
    remedy: "Add at least one drawing to the set, then pin it.",
    severity: "error",
    surface: "inline",
  }),
  // R-TO-005: a project tells its sets apart by their names, so a blank name names nothing and a
  // name the project already carries names no new set.
  SET_NAME_NOT_USABLE: Object.freeze({
    code: "SET_NAME_NOT_USABLE",
    message: "The set name is blank or already names a set of this project, so no set was created.",
    remedy: "Give the set a name no other set of this project carries.",
    severity: "error",
    surface: "inline",
  }),
  // A membership is a draft over the project's own drawings (R-TO-005): a drawing the project does
  // not hold is one this set could never cite, so the toggle changes nothing and says so.
  SET_MEMBER_NOT_IN_PROJECT: Object.freeze({
    code: "SET_MEMBER_NOT_IN_PROJECT",
    message: "That drawing is not one of this project's, so the set was not changed.",
    remedy: "Reload the set and toggle a drawing the project holds.",
    severity: "error",
    surface: "inline",
  }),
  // Q-12's signed download URLs: an installation that has not been given a signing key signs
  // nothing rather than minting a key of its own — a minted key dies at the next restart, and a box
  // that mints one is effectively unsigned. Storing and serving evidence is untouched; only the
  // link is refused.
  DOWNLOAD_NOT_SIGNABLE: Object.freeze({
    code: "DOWNLOAD_NOT_SIGNABLE",
    message: "No download link was created, because this installation has not been given the key its links are signed with.",
    remedy: "Ask an operator to give this installation its signing key, then ask for the download again.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-05: scale membership is positive, never residual — a view no affirmation act names has no
  // scale and says so, rather than measuring at a scale nobody affirmed.
  SCALE_NO_EVIDENCE: Object.freeze({
    code: "SCALE_NO_EVIDENCE",
    message: "No affirmation names this view, so it has no scale and measures nothing.",
    remedy: "Affirm a scale for the view from a proposal or a two-point calibration, then measure it.",
    severity: "info",
    surface: "inline",
  }),
  // L-MEA-05's strict unit lane: an unmapped or unitless header yields no factor, never a guessed one,
  // so the machine can propose nothing for the view and only a two-point calibration can scale it.
  SCALE_UNIT_UNMAPPED: Object.freeze({
    code: "SCALE_UNIT_UNMAPPED",
    message: "The drawing's units header names no length unit, so no scale can be read from the file.",
    remedy: "Calibrate the view with two cited points and an entered distance, or set the units in the drawing and ingest it again.",
    severity: "info",
    surface: "inline",
  }),
  // L-MEA-05: "each point cites a source key + world coordinate quantised to 0.1 unit; a free click
  // refuses SCALE_OBSERVATION_UNCITED; the stated distance is ENTERED".
  SCALE_OBSERVATION_UNCITED: Object.freeze({
    code: "SCALE_OBSERVATION_UNCITED",
    message: "A calibration point does not cite a drawn entity at a quantised coordinate, or the distance was not entered, so the observation was not taken.",
    remedy: "Snap both points to drawn entities and enter the distance between them with its unit.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-05: X and Y derive independently, so a pair of points that differ along both axes — or
  // along neither — observes no axis at all.
  SCALE_OBSERVATION_OBLIQUE: Object.freeze({
    code: "SCALE_OBSERVATION_OBLIQUE",
    message: "The two calibration points do not lie on one axis, so they observe neither the X nor the Y scale.",
    remedy: "Choose two points that differ along exactly one axis — horizontally or vertically.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-05: "a single-observation scale is verified at ±1% or rejected".
  SCALE_OBSERVATION_UNVERIFIED: Object.freeze({
    code: "SCALE_OBSERVATION_UNVERIFIED",
    message: "The observed scale along this axis is not verified within tolerance by a second observation or by the drawing's own evidence, so it was not affirmed.",
    remedy: "Add a second observation along the same axis, or check the entered distance against the drawing.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-06: the two tiers of the unit canon are not interchangeable — a volume is not an area, and
  // there is no factor between them to take.
  DIMENSION_MISMATCH: Object.freeze({
    code: "DIMENSION_MISMATCH",
    message: "These two units measure different kinds of quantity, so there is no factor between them and no conversion exists.",
    remedy: "Choose a unit that measures the same thing as the quantity, such as its own dimension's canonical unit.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-06: a packaging unit holds whatever the product it packages holds, so converting one
  // without that property would be inventing a factor — "never a silent 1.0".
  PRODUCT_FACTOR_MISSING: Object.freeze({
    code: "PRODUCT_FACTOR_MISSING",
    message: "A bag, drum or coil holds what its product says it holds, and this product states no such property, so the quantity was not converted.",
    remedy: "State the product's packaged quantity — how much one bag, drum or coil holds — and convert again.",
    severity: "error",
    surface: "inline",
  }),
  // L-REG-03's double-count guard: "a second measured sighting of the same physical scope inside one
  // drawing-set revision is refused at the door (`DUPLICATE_IDENTITY`) and kept as unpriceable
  // evidence". Nothing is lost by the refusal, so the sentence says where the sighting went.
  DUPLICATE_IDENTITY: Object.freeze({
    code: "DUPLICATE_IDENTITY",
    message: "This physical scope is already registered in this drawing-set revision, so measuring it again would count it twice; the sighting was kept as evidence instead.",
    remedy: "Open the registered object to compare the two sightings, or measure the scope this drawing shows that is not yet registered.",
    severity: "warning",
    surface: "inline",
  }),
  // L-MEA-07: "the floor-multiplier scheme keys to the ordinal — a scheme with no row for an ordinal
  // throws `LEVEL_ORDINAL_UNMAPPED`". Nothing at that level can be priced until the scheme says what
  // its ordinal multiplies by, so the sentence points at the scheme rather than at the level.
  LEVEL_ORDINAL_UNMAPPED: Object.freeze({
    code: "LEVEL_ORDINAL_UNMAPPED",
    message: "The floor-multiplier scheme has no row for this level's ordinal, so nothing standing on it can be multiplied.",
    remedy: "Add a row for this ordinal to the workspace's floor-multiplier scheme, then derive again.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-07: a storey height nobody stated is unstated, never defaulted. Answered for a level no
  // reading stands on, and for an act that would record one on a basis nobody read it on.
  STOREY_HEIGHT_UNSTATED: Object.freeze({
    code: "STOREY_HEIGHT_UNSTATED",
    message: "Nobody has stated this level's storey height, and a height the system invented would be priced as though somebody had.",
    remedy: "Enter the storey height for this level, or transcribe it from the drawing that states it.",
    severity: "error",
    surface: "inline",
  }),
  // L-REG-03: "disagreement is declared, never resolved silently". Two people read the level and got
  // two heights, so it stands at none until one of them re-affirms.
  STOREY_HEIGHT_CONTESTED: Object.freeze({
    code: "STOREY_HEIGHT_CONTESTED",
    message: "This level's storey height has been read two different ways, so it stands at no height until the readings agree.",
    remedy: "Compare the competing readings and re-affirm the one that is right, which supersedes that reader's earlier figure.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-08: the gate resolves an offer's method version from the project's pinned edition. An
  // edition that cites no version of the rule the offer names cannot say which method is in force,
  // so the offer is refused rather than measured under a version nobody pinned.
  METHOD_NOT_IN_EDITION: Object.freeze({
    code: "METHOD_NOT_IN_EDITION",
    message: "The rule-set edition this project is pinned to cites no version of the measurement rule this offer names.",
    remedy: "Pin an edition that cites this rule, or measure under a rule the pinned edition holds.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-01: a method is versioned CODE, keyed (rule id, version). An edition citing a pair the
  // tree implements nothing for keys content nothing can compute, and the gate says so by name.
  METHOD_IMPLEMENTATION_MISSING: Object.freeze({
    code: "METHOD_IMPLEMENTATION_MISSING",
    message: "The version of this measurement rule the edition cites has no implementation in this release.",
    remedy: "Pin an edition citing a version this release implements, or upgrade to the release that carries it.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-06 / L-MEA-08: a reading in a unit the canon carries no factor for cannot be normalised,
  // and a figure the machine guessed a factor for would be priced as though somebody had read it.
  UNIT_UNMAPPED: Object.freeze({
    code: "UNIT_UNMAPPED",
    message: "This reading is stated in a unit the canon carries no conversion factor for.",
    remedy: "State the reading in a unit the canon holds, or add the factor to the unit canon before measuring again.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-08: "the refused arm is for contract violations only" — an offer missing a binding the
  // method declares, or carrying a deduction candidate in a channel it does not, is not measurable.
  OFFER_NOT_TO_CONTRACT: Object.freeze({
    code: "OFFER_NOT_TO_CONTRACT",
    message: "This offer does not carry what the measurement rule declares, so nothing can be derived from it.",
    remedy: "Correct the rail so the offer binds every declared variable and deducts only through the channels the rule names.",
    severity: "error",
    surface: "inline",
  }),
  // L-QTY-04: "interpreted geometry uncorroborated → declared exclusion + queue item, never a line".
  // The same taxonomy serves machine refusals and human deferrals, so the queue item's cause is a
  // registered code and this is it.
  INTERPRETED_UNCORROBORATED: Object.freeze({
    code: "INTERPRETED_UNCORROBORATED",
    message: "This outline was interpreted rather than read, and nothing corroborates it, so it is excluded rather than measured.",
    remedy: "Corroborate the outline against the drawing and agree it, or measure the scope from geometry the drawing states.",
    severity: "warning",
    surface: "inline",
  }),
  // L-MEA-08's rail-local codes, keyed (column × rcc.concrete). A rail cannot mint a calibration
  // reference it does not hold and never invents a section, so what it could not read is REPORTED
  // as an observation — evidence in the residue — rather than offered and refused (riskNotes (3)).
  VIEW_SCALE_UNAFFIRMED: Object.freeze({
    code: "VIEW_SCALE_UNAFFIRMED",
    message: "Nobody has affirmed the scale of the view these members were placed in, so their measurements cannot stand on one.",
    remedy: "Open the drawing's scale panel and affirm the view's scale, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  MEMBER_TYPE_UNKNOWN: Object.freeze({
    code: "MEMBER_TYPE_UNKNOWN",
    message: "The schedules hold no member type for this mark, so there is no section to measure it by.",
    remedy: "Check the drawing's schedules for the mark, then rebuild the drawing's partition.",
    severity: "warning",
    surface: "inline",
  }),
  SECTION_BAND_UNCOVERED: Object.freeze({
    code: "SECTION_BAND_UNCOVERED",
    message: "No band of this member's schedule covers the level it stands on, so no section applies there.",
    remedy: "Extend the schedule's floor bands over the level, or state the level's own band, then measure again.",
    severity: "warning",
    surface: "inline",
  }),
  SECTION_UNIT_UNSTATED: Object.freeze({
    code: "SECTION_UNIT_UNSTATED",
    message: "This member's section was read without the unit it was written in, so its size cannot be carried.",
    remedy: "Re-read the schedule's section cell so it states its unit, then measure again.",
    severity: "warning",
    surface: "inline",
  }),
  // L-REG-07: a campaign's snapshot diverged from what is in force is stale, and stale blocks
  // SIGNING while measuring goes on — a signature over a measurement taken against something else.
  PIN_STALE: Object.freeze({
    code: "PIN_STALE",
    message: "What this campaign was opened against has moved since, so its measurements cannot be signed for.",
    remedy: "Open a campaign against what is in force now, then sign for the measurements it takes.",
    severity: "warning",
    surface: "banner",
  }),
  // The address named no campaign of this project — an answer, never a fault: a measure asked for a
  // campaign this workspace does not hold has nothing to measure (L-REG-07).
  CAMPAIGN_NOT_FOUND: Object.freeze({
    code: "CAMPAIGN_NOT_FOUND",
    message: "This project holds no measurement campaign at that address.",
    remedy: "Open the project's campaigns and choose one, or pin a drawing set to open a campaign.",
    severity: "error",
    surface: "inline",
  }),
  // L-REG-01: "a convert of no input is no output, never a zero". A cell that said "N/A", or said
  // nothing at all, carries no reading to a canonical unit — and a zero written down in its place is
  // a quantity somebody would measure with. The refusal is answered beside the cell that said it.
  READING_NOT_NUMERIC: Object.freeze({
    code: "READING_NOT_NUMERIC",
    message: "This cell does not state a number, so there is no reading to record against the attribute.",
    remedy: "Type the value the drawing states for this attribute, or leave the attribute unread.",
    severity: "error",
    surface: "inline",
  }),
  // L-QTY-05's six causes: why a cell of the residue stands as it does. They are registered here
  // with every other code because a cause is read exactly as a refusal is read — one home for the
  // words, one remedy per cause (X-3, R-SPINE-062) — and because the coverage grid's legend and its
  // inspector must say the same sentence about a cell that a certificate will (L-QTY-07, B-17).
  // Their severity is what paints a cell's temperature; the cause itself is carried by the mark and
  // by the accessible name, never by the colour (R-UI-060, s-coverage I-188).
  NOT_ESTABLISHED: Object.freeze({
    code: "NOT_ESTABLISHED",
    message: "No line has been published for this kind on this class and level, and nothing explains the absence.",
    remedy: "Measure this kind on this class and level, or declare it out of the project scope so the certificate can state why it is unmeasured.",
    severity: "warning",
    surface: "inline",
  }),
  INGESTION_TRUNCATED: Object.freeze({
    code: "INGESTION_TRUNCATED",
    message: "Every sighting of this cell stands on a sheet that was read only in part, so nothing can be measured from it.",
    remedy: "Upload the sheet again from its source file, then measure the campaign once it has been read whole.",
    severity: "error",
    surface: "inline",
  }),
  NOT_IN_PROJECT_SCOPE: Object.freeze({
    code: "NOT_IN_PROJECT_SCOPE",
    message: "A person declared this kind out of the project scope on this class and level.",
    remedy: "Measure this kind to bring it back: published lines take precedence, and the declaration is then shown as contradicted.",
    severity: "info",
    surface: "inline",
  }),
  NO_BEARER_SIGHTED: Object.freeze({
    code: "NO_BEARER_SIGHTED",
    message: "No class sighted in this campaign bears this kind, so the residue holds no cell for it.",
    remedy: "Pin a revision whose drawings show a class that bears this kind, then measure the campaign.",
    severity: "warning",
    surface: "inline",
  }),
  KIND_NOT_YET_SEEDED: Object.freeze({
    code: "KIND_NOT_YET_SEEDED",
    message: "This work item is in the catalogue, but no class has been recorded as bearing it.",
    remedy: "Record the class that bears this work item in the ruleset, then measure the campaign.",
    severity: "info",
    surface: "inline",
  }),
  NOT_IN_THIS_BILL: Object.freeze({
    code: "NOT_IN_THIS_BILL",
    message: "A person held this kind out of this bill on this class and level.",
    remedy: "Measure this kind to bring it back into the bill: published lines take precedence, and the hold is then shown as contradicted.",
    severity: "info",
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

/**
 * Why a schedule view defers: the codes of this register a SCHEDULE view stands under when it yielded
 * no table, or a table naming no member. One list, read by the store's CHECK and published by the
 * partition's door alike — a vocabulary written twice drifts (B-17, Q-07).
 *
 * It stands with the codes rather than with the table because the seam is not a module's to import
 * (SEAM-TENANT), and a roster its readers cannot reach is a roster they would copy.
 */
export const SCHEDULE_DEFERRAL_REASONS = ["SCHEDULE_NONE_RECONSTRUCTED", "SCHEDULE_VIEW_CONTRIBUTED_NOTHING"] as const satisfies readonly RefusalCode[];

/** One of the two. */
export type ScheduleDeferralReason = (typeof SCHEDULE_DEFERRAL_REASONS)[number];

/**
 * Why a view's vertical members expand over no level: the codes of this register the expansion stage
 * stands a view under (L-CAD-07). One list, read by the store's CHECK and published by the
 * partition's door alike — a vocabulary written twice drifts (B-17, Q-07).
 *
 * It stands with the codes for the reason the schedule list does: the seam is not a module's to
 * import (SEAM-TENANT), and a roster its readers cannot reach is a roster they would copy.
 */
export const EXPANSION_DEFERRAL_REASONS = ["TYPICAL_RANGE_UNSTATED", "LEVEL_RANGE_ENDPOINT_UNMAPPED"] as const satisfies readonly RefusalCode[];

/** One of the two. */
export type ExpansionDeferralReason = (typeof EXPANSION_DEFERRAL_REASONS)[number];

/**
 * The two causes a PERSON may declare a cell of the residue under — one per axis of L-QTY-05's
 * orthogonal pair. The machine's causes are read off the campaign and never written by anyone, so
 * they are not in this list: the store's CHECK is written from it, and a row under any other cause
 * is refused by the database as well as by the act (R-TO-052, L-ACT-01).
 *
 * It stands with the codes rather than with the table for the reason the two lists above do: the
 * seam is not a module's to import (SEAM-TENANT), and a roster its readers cannot reach is a roster
 * they would copy (B-17, Q-07).
 */
export const SCOPE_DECLARATION_CAUSES = ["NOT_IN_PROJECT_SCOPE", "NOT_IN_THIS_BILL"] as const satisfies readonly RefusalCode[];

/** One of the two. */
export type ScopeDeclarationCause = (typeof SCOPE_DECLARATION_CAUSES)[number];
