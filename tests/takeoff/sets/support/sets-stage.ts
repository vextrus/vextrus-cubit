/**
 * The mechanics this increment's acceptance runs on (R-TO-005, L-REG-06, L-ACT-01/02/03, inc-109).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts,
 * the projects and the roles come from the sheet index's own stage (`tests/takeoff/support/
 * sheets-stage.ts`), which itself inherits the upload seam's: one invariant, one home (B-17,
 * ARCH-02). What this file adds is what a drawing LINEAGE needs beyond a stored drawing — rows of
 * one project under one presented name, laid down in an order a reader can name — plus the doors
 * the criteria drive and the audit reads they check the store with.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance.
 *
 * Nothing here reads product source: every name below is one the increment's interface list, its
 * test contract or the committed Design Decision publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { dxfLike, sql, sqlValue, type Person } from "../../../spine/uploads/support/upload-stage";
import { ACTS_MODULE, ERRORS_MODULE, REPO_ROOT, actRows, productModule, type ActorCtx, type ErrorsSeam, type RefusalEntryShape } from "../../support/sheets-stage";

export {
  ACTS_MODULE,
  ERRORS_MODULE,
  PRINCIPAL,
  REPO_ROOT,
  actRows,
  actorOf,
  byCodePoint,
  closeStage,
  grantRole,
  joinWorkspace,
  openSheetsStage,
  productModule,
  rejection,
  rowCount,
  stagePerson,
  stageProject,
  unique,
} from "../../support/sheets-stage";
export { dxfLike } from "../../../spine/uploads/support/upload-stage";
export type { ActorCtx, ErrorsSeam, Person, RefusalEntryShape };

/* ------------------------------------------------------------------ the homes the spec names */

/** The module doors this increment publishes (increment interfaces). */
export const SETS_MODULE = "src/modules/takeoff/sets/index.ts";
export const CORE_SETS_MODULE = "src/core/sets/index.ts";
export const PIN_ACT_MODULE = "src/core/acts/pin-drawing-set.ts";
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
export const REFUSAL_ENTRIES_MODULE = "src/ui/screen-states/refusal-entries.ts";
export const SCREEN_STATES_MODULE = "src/ui/screen-states/index.ts";

/** The route directory the ownership list and the Design Decision spell (S-Drawings-Sets §1). */
export const SETS_DIR = "src/app/(app)/t/[tenant]/p/[project]/drawings/sets";
export const SETS_INDEX_COMPONENT = `${SETS_DIR}/sets-index.tsx`;
export const SET_BROWSER_COMPONENT = `${SETS_DIR}/[set]/set-browser.tsx`;
export const SETS_ACTIONS_MODULE = `${SETS_DIR}/actions.ts`;
export const SETS_ROUTE_ADDRESS_MODULE = `${SETS_DIR}/route-address.ts`;
export const SETS_STRINGS_MODULE = `${SETS_DIR}/strings.ts`;

/** The cookie jar a server action reads the presented session through (the shell's one door). */
export const SESSION_MODULE = "src/server/shell/session.ts";

/** The two route keys the screen-states matrix files these screens under (Design Decision §2). */
export const SETS_ROUTE_KEY = "/t/[tenant]/p/[project]/drawings/sets";
export const SET_ROUTE_KEY = "/t/[tenant]/p/[project]/drawings/sets/[set]";

/** The act this increment renders, the permission L-ACT-03 makes it move, and the roles that bundle it. */
export const PIN_DRAWING_SET = "PIN_DRAWING_SET";
export const PIN_SET = "PIN_SET";
export const MEASURER = "MEASURER";

/** The codes the test contract names — the three this increment registers, and the ones it meets. */
export const SET_NOT_PINNABLE = "SET_NOT_PINNABLE";
export const SET_NAME_NOT_USABLE = "SET_NAME_NOT_USABLE";
export const SET_MEMBER_NOT_IN_PROJECT = "SET_MEMBER_NOT_IN_PROJECT";
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const ACT_CHANGES_NOTHING = "ACT_CHANGES_NOTHING";

/** The three codes this increment appends to both registries, as one list (Q-07). */
export const REGISTERED_CODES: readonly string[] = [SET_NOT_PINNABLE, SET_NAME_NOT_USABLE, SET_MEMBER_NOT_IN_PROJECT];

/** The tables this increment lands, named where an audit read needs them. */
export const SETS_TABLE = "drawing_sets";
export const SET_MEMBERS_TABLE = "drawing_set_members";
export const SET_REVISIONS_TABLE = "drawing_set_revisions";

/** The format a staged `.dxf` is recorded under. */
export const DXF = "dxf";

/* ------------------------------------------------------------------ the shapes the seams answer in */

/** One revision of a drawing (increment interfaces: `DrawingRevision`). */
export type DrawingRevision = { revisionId: string; sha256: string; ordinal: number; createdAt: string | Date };

/** One drawing, as the lineage of rows a project stores under one presented name (I-95, I-A). */
export type DrawingLineage = { drawingId: string; name: string; format: string; revisions: DrawingRevision[]; current: DrawingRevision };

/** One citation of a pinned manifest (increment interfaces: `ManifestMember`). */
export type ManifestMember = { drawingId: string; revisionId: string; sha256: string; name: string };

/** One pinned set revision, as the browser is given one (increment interfaces: `SetRevision`). */
export type SetRevision = {
  setRevisionId: string;
  digest: string;
  actId: string;
  pinnedAt: string | Date;
  current: boolean;
  manifest: readonly ManifestMember[];
};

/** One row of the sets index (increment interfaces: `DrawingSetSummary`). */
export type DrawingSetSummary = { setId: string; name: string; memberCount: number; revisionCount: number; currentDigest: string | null };

/** One set, whole (increment interfaces: `DrawingSetView`). */
export type DrawingSetView = { setId: string; name: string; members: readonly string[]; revisions: SetRevision[] };

/** Which workspace and project a call is scoped to (increment interfaces: `SetScope`). */
export type SetScope = { tenantId: string; projectId: string };

/** What `createSet` and `toggleMember` answer (increment interfaces). */
export type CreatedSet = { created: true; setId: string } | { created: false; refusal: string };
export type ToggledMember = { toggled: true; member: boolean } | { toggled: false; refusal: string };

/** The door src/modules/takeoff/sets publishes. */
export type SetsSeam = {
  drawingLineagesOf: (scope: SetScope) => Promise<DrawingLineage[]>;
  setsOf: (scope: SetScope) => Promise<DrawingSetSummary[]>;
  setOf: (scope: SetScope, setId: string) => Promise<DrawingSetView | null>;
  createSet: (scope: SetScope, actor: { userId: string }, name: string) => Promise<CreatedSet>;
  toggleMember: (scope: SetScope, setId: string, drawingId: string) => Promise<ToggledMember>;
  canonicalManifest: (members: readonly ManifestMember[]) => string;
  manifestDigest: (members: readonly ManifestMember[]) => string;
};

/** The pure core the manifest and its address live in (increment interfaces: src/core/sets). */
export type CoreSetsSeam = {
  canonicalManifest: (members: readonly ManifestMember[]) => string;
  manifestDigest: (members: readonly ManifestMember[]) => string;
};

/** L-ACT-02's Consequence, as a caller of the seam reads one. */
export type ConsequenceLike = {
  actType: string;
  tenantId: string;
  projectId: string;
  rendering: string;
  subjects: { subjectId: string; subjectLabel?: string; before: readonly string[]; after: readonly string[] }[];
};

/** What a pin asks for (increment interfaces: `PinDrawingSetInput`). */
export type PinDrawingSetInput = { type: string; projectId: string; setId: string };

/** SEAM-ACT through the surface this acceptance drives it by. */
export type SetActsSeam = {
  ACT_TYPES: readonly string[];
  ACT_PERMISSION: Record<string, string>;
  consequenceDigest: (consequence: ConsequenceLike) => string;
  preview: (ctx: ActorCtx, input: PinDrawingSetInput) => Promise<ConsequenceLike>;
  commit: (ctx: ActorCtx, input: PinDrawingSetInput, carriedDigest: string) => Promise<{ actId: string; consequenceDigest: string; consequence: ConsequenceLike }>;
};

/** The two addresses these screens are reached at (increment interfaces: `route-address.ts`). */
export type RouteAddressSeam = {
  setsRoute: (tenantId: string, projectId: string) => string;
  setRoute: (tenantId: string, projectId: string, setId: string) => string;
};

/** What the four server actions answer (test contract: sets/actions.ts). */
export type SetsActionsSeam = {
  createSet: (request: { tenantId: string; projectId: string; name: string }) => Promise<{ created: boolean; refusal?: string; setId?: string }>;
  toggleMember: (request: { tenantId: string; projectId: string; setId: string; drawingId: string }) => Promise<{ toggled: boolean; refusal?: string; member?: boolean }>;
  previewPin: (request: { tenantId: string; projectId: string; setId: string }) => Promise<{ previewed: boolean; refusal?: string; consequence?: ConsequenceLike; consequenceDigest?: string }>;
  commitPin: (request: { tenantId: string; projectId: string; setId: string; consequenceDigest: string }) => Promise<{ committed: boolean; refusal?: string; actId?: string; setRevisionId?: string; digest?: string }>;
};

/* ------------------------------------------------------------------ the doors, loaded by name */

/** One door, with the calls this stage makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly (keyof T & string)[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) {
    expect(typeof door[call], `${home} publishes \`${call}\` — a door this increment's interfaces name`).toBe("function");
  }
  return door as T;
}

/** The takeoff module's sets door. */
export async function setsSeam(): Promise<SetsSeam> {
  return doorOf<SetsSeam>(SETS_MODULE, ["drawingLineagesOf", "setsOf", "setOf", "createSet", "toggleMember", "canonicalManifest", "manifestDigest"]);
}

/** The pure core the manifest's canonical order and its address live in (B-17: the one home). */
export async function coreSetsSeam(): Promise<CoreSetsSeam> {
  return doorOf<CoreSetsSeam>(CORE_SETS_MODULE, ["canonicalManifest", "manifestDigest"]);
}

/** SEAM-ACT, with the pin's rendering behind it. */
export async function actsSeam(): Promise<SetActsSeam> {
  const seam = await productModule<SetActsSeam>(ACTS_MODULE);
  expect(typeof seam.preview, `${ACTS_MODULE} publishes \`preview\` (SEAM-ACT)`).toBe("function");
  expect(typeof seam.commit, `${ACTS_MODULE} publishes \`commit\` (SEAM-ACT)`).toBe("function");
  return seam;
}

/** The two addresses these screens stand at. */
export async function routeAddresses(): Promise<RouteAddressSeam> {
  return doorOf<RouteAddressSeam>(SETS_ROUTE_ADDRESS_MODULE, ["setsRoute", "setRoute"]);
}

/** The register, read from its one home so nothing re-spells a code (ARCH-02, Q-07). */
export async function refusals(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<ErrorsSeam>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/** The refusal code a failure carries, whether it arrived bare or wrapped by a transport. */
export async function codeOf(failure: unknown): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf: (thrown: unknown) => string | null }>(REFUSAL_MARKER_MODULE);
  return refusalCodeOf(failure);
}

/** What one pin asks for, as the seam is given it. */
export function pinning(projectId: string, setId: string): PinDrawingSetInput {
  return { type: PIN_DRAWING_SET, projectId, setId };
}

/* ------------------------------------------------------------------ staging a lineage */

/** A drawing row the store holds, as this acceptance stages one. */
export type StagedRow = { drawingId: string; sha256: string; name: string; createdAt: string };

/** The reason every statement this stage makes is recorded under — attributable, like any other. */
const STAGE_REASON = "test: stage a drawing lineage for the sets acceptance";

/**
 * A uuid whose ordering against another is decided here rather than by chance.
 *
 * The lineage's order is `created_at` asc, `drawing_id` asc (increment interfaces), and a lineage
 * staged with random ids would agree with a reading that sorted by id alone about half the time.
 * Staging the ids so that the two orders DISAGREE is what makes the criterion decidable: `low` and
 * `high` name where a row sits in id order, never how old it is.
 */
function orderedUuid(where: "low" | "high"): string {
  const tail = randomUUID().slice(24);
  return where === "low" ? `00000000-0000-4000-8000-${tail}` : `ffffffff-ffff-4fff-bfff-${tail}`;
}

/** A monotonic clock for the staged rows, so "the first row" is a fact and not a coin toss. */
let stagedRows = 0;

/**
 * One `drawings` row of a project under a presented name — the atom a lineage is made of.
 *
 * Seeded through the store rather than through the shipped upload seam on purpose: what a revision
 * IS is a property of the rows one project holds under one name, and a module-level criterion must
 * be able to lay those rows down in an order it can name. The journey drives the same thing through
 * the real Dropzone end to end (AC-6), so both readings are covered.
 */
export async function stageRow(
  person: Person,
  projectId: string,
  options: { name: string; bytes: Uint8Array; idOrder?: "low" | "high"; secondsApart?: number },
): Promise<StagedRow> {
  const uploads = await productModule<{ uploadStorage: () => { put: (tenantId: string, bytes: Uint8Array) => Promise<{ sha256: string }> } }>("src/modules/spine/uploads/index.ts");
  const { sha256 } = await uploads.uploadStorage().put(person.tenantId, options.bytes);

  sql(
    `insert into ${ident("files")} (${ident(TENANT_COLUMN)}, sha256, byte_length, format, scan_verdict)
       values (${lit(person.tenantId)}::uuid, ${lit(sha256)}, ${options.bytes.length}, ${lit(DXF)}, 'skipped')
       on conflict do nothing;`,
  );

  const drawingId = options.idOrder === undefined ? randomUUID() : orderedUuid(options.idOrder);
  stagedRows += 1;
  const seconds = options.secondsApart ?? stagedRows;
  const createdAt = sqlValue(
    `insert into ${ident("drawings")} (${ident(TENANT_COLUMN)}, drawing_id, project_id, sha256, name, format, uploaded_by, created_at)
       values (${lit(person.tenantId)}::uuid, ${lit(drawingId)}::uuid, ${lit(projectId)}::uuid, ${lit(sha256)}, ${lit(options.name)}, ${lit(DXF)}, ${lit(person.userId)}::uuid,
               timestamptz '2026-01-01 00:00:00+00' + (${seconds} * interval '1 second'))
       returning created_at::text;`,
  );
  expect(createdAt, `staging ${options.name} recorded no drawing (${STAGE_REASON})`).not.toBe("");
  return { drawingId, sha256, name: options.name, createdAt };
}

/**
 * A whole lineage: one presented name, one row per content given, oldest first.
 *
 * The ids are staged against the clock (the first row takes the HIGHEST id), so a reading that
 * ordered a lineage by surrogate id rather than by when the rows arrived answers the wrong drawing
 * every time rather than half the time.
 */
export async function stageLineage(person: Person, projectId: string, name: string, contents: readonly string[]): Promise<StagedRow[]> {
  const rows: StagedRow[] = [];
  for (const [at, label] of contents.entries()) {
    rows.push(await stageRow(person, projectId, { name, bytes: dxfLike(label), idOrder: at === 0 ? "high" : "low" }));
  }
  return rows;
}

/**
 * Put a person on somebody else's workspace as their EARLIEST membership.
 *
 * Sign-up mints a personal workspace for every account, and both the shell and the tenancy module
 * resolve a person's acting workspace as the earliest membership they hold — so a joiner staged
 * without this acts in, and is framed by, their own workspace, and every door answers a refusal the
 * staging caused rather than the one under test.
 */
export function joinWorkspaceEarlier(tenantId: string, userId: string, role = "MEMBER"): void {
  sql(
    `insert into ${ident("memberships")} (${ident(TENANT_COLUMN)}, user_id, ${ident("workspace_role")}, created_at)
       values (${lit(tenantId)}::uuid, ${lit(userId)}::uuid, ${lit(role)}, now() - interval '30 days') on conflict do nothing;`,
  );
}

/* ------------------------------------------------------------------ reading the store */

/** Every set this project holds, as the acceptance's own audit read. */
export function setRows(tenantId: string, projectId: string): { setId: string; name: string }[] {
  return sql(
    `select set_id::text, name from ${ident(SETS_TABLE)}
       where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and project_id = ${lit(projectId)}::uuid
       order by created_at;`,
  ).map((row) => ({ setId: row[0] ?? "", name: row[1] ?? "" }));
}

/** Every pinned revision of one set, oldest first, straight out of the ledger. */
export function setRevisionRows(tenantId: string, setId: string): { setRevisionId: string; digest: string; actId: string; manifest: string }[] {
  return sql(
    `select set_revision_id::text, digest, act_id::text, manifest::text from ${ident(SET_REVISIONS_TABLE)}
       where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and set_id = ${lit(setId)}::uuid
       order by created_at;`,
  ).map((row) => ({ setRevisionId: row[0] ?? "", digest: row[1] ?? "", actId: row[2] ?? "", manifest: row[3] ?? "" }));
}

/** How many acts of one type this project's log holds — the "nothing was written" reading. */
export function actsOfType(tenantId: string, projectId: string, actType: string): { actId: string; subjects: string[] }[] {
  return actRows(tenantId, projectId)
    .filter((act) => act.actType === actType)
    .map((act) => ({ actId: act.actId, subjects: act.subjects }));
}

/* ------------------------------------------------------------------ small helpers */

/** The sha256 of some text, lowercase hex — the address a manifest is content-addressed by. */
export function sha256OfText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/* ------------------------------------------------------------------ the server actions, as a person */

/**
 * Run `body` with the shipped cookie jar answering with this person's session token, so a server
 * action resolves the real session out of the real store and every guard past it is the product's
 * own. Only the presented cookie is stood in for — there is no request scope in a suite, and a
 * transport that cannot be dialled is not a guard anybody is judging here.
 *
 * The module registry is reset either side, so the actions module is loaded fresh over the swap and
 * put back afterwards for whatever runs next.
 */
export async function actionsAs<T>(person: Person | null, body: (actions: SetsActionsSeam) => Promise<T>): Promise<T> {
  const sessionHome = join(REPO_ROOT, SESSION_MODULE);
  const token = person === null ? null : person.cookie.slice(person.cookie.indexOf("=") + 1);

  vi.resetModules();
  vi.doMock(sessionHome, async () => {
    const actual = (await vi.importActual(sessionHome)) as Record<string, unknown>;
    return { ...actual, presentedSessionToken: async (): Promise<string | null> => token };
  });
  try {
    const actions = await productModule<SetsActionsSeam>(SETS_ACTIONS_MODULE);
    expect(typeof actions.createSet, `${SETS_ACTIONS_MODULE} publishes \`createSet\` (test contract)`).toBe("function");
    expect(typeof actions.toggleMember, `${SETS_ACTIONS_MODULE} publishes \`toggleMember\` (test contract)`).toBe("function");
    return await body(actions);
  } finally {
    vi.doUnmock(sessionHome);
    vi.resetModules();
  }
}
