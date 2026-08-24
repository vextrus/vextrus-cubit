/**
 * Projects, and the people on them (R-SPINE-010, R-SPINE-011, L-ACT-03, L-REG-07).
 *
 * The module every route and journey reads a project through. Three things decide its shape:
 *
 *   - **The founding is one transaction.** L-ACT-03: "project creation inserts its creator as
 *     PRINCIPAL in the same transaction". So `createProject` opens one transaction and does
 *     all three writes inside it — the pinned project (`createPinnedProject`, L-REG-07), the
 *     R-SPINE-010 fields, and the founding grant through the act seam (`foundPrincipal`). A
 *     composition that created the project first and granted afterwards would leave a project
 *     with no principal behind any failure of the grant, which is the state the clause forbids.
 *     `ScopedPool.connect()` pins one connection for a drizzle transaction (src/core/db.ts), so
 *     every statement below travels on it under the same tenant scope.
 *
 *   - **Edit and archive are not acts** (docs/design/s-project-settings-… Interpretation 1).
 *     Project metadata moves nothing the machine derives, so `updateProject` and
 *     `archiveProject` write the row directly: no ConsequenceDialog, no act row, and no
 *     permission check outside the seam. Row-level security and the membership guard above are
 *     the whole gate.
 *
 *   - **The act log is read, never written, from here.** L-ACT-01 makes `src/core/acts` the
 *     sole writer of `acts`, `participants` and `participant_roles`, and this module holds none
 *     of the three table objects: the roster and the history are SELECTs, and the one write
 *     that touches them goes through `foundPrincipal`.
 *
 * The addresses behind a participation are `users` rows, which carry no tenant at all
 * (R-SPINE-002), so the email join is done here on a system handle with its reason stated —
 * the shape `src/modules/spine/members/members.ts` uses, for the same reason.
 */
import { forTenant, runAsSystem } from '../../../core/db';
import type { ScopedDb } from '../../../core/db';
import { foundPrincipal } from '../../../core/acts';
import type { ActCtx } from '../../../core/acts';
import { createPinnedProject } from '../../../core/rulesets/seed';
import { BUILDING_TYPES } from './building-types';
import type { BuildingType } from './building-types';
import { operators, rowsOf, sqlTag } from './operators';

/** The same handle, seen from inside a transaction (the members module's own spelling). */
type ScopedTx = Parameters<Parameters<ScopedDb['transaction']>[0]>[0];

/** Who is asking, on behalf of which workspace — the act seam's context, unchanged. */
export type ProjectCtx = ActCtx;

/** Every R-SPINE-010 field a caller may set, past the two a project cannot exist without. */
export interface ProjectFields {
  readonly client?: string | null;
  readonly siteAddress?: string | null;
  readonly district?: string | null;
  readonly buildingType?: string | null;
  readonly storeys?: number | string | null;
  readonly targetGfaM2?: number | string | null;
  readonly notes?: string | null;
}

export interface NewProjectInput extends ProjectFields {
  readonly name: string;
  readonly code: string;
}

/** How every function past the creator names the project it is about. */
export interface ProjectRef {
  readonly projectId?: string;
  readonly id?: string;
}

/** A project as S-Home's grid and the fields pane read one. */
export interface ProjectView {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly client: string | null;
  readonly siteAddress: string | null;
  readonly district: string | null;
  readonly buildingType: string | null;
  readonly storeys: number | null;
  /** The exact decimal string the column holds, never a float (B-07). */
  readonly targetGfaM2: string | null;
  readonly notes: string | null;
  readonly archived: boolean;
  /** ISO instants, so a client component can render them in the reader's own zone. */
  readonly createdAt: string;
  /** The act log's newest row for this project (s-home Interpretation 4). */
  readonly lastActivityAt: string;
}

/** One row of the participants roster (panes file §4). */
export interface ParticipantView {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

/** One grant, as the role history renders it (panes file §5). */
export interface RoleGrantView {
  readonly actId: string;
  readonly userId: string;
  readonly email: string;
  readonly actorId: string;
  readonly actorEmail: string;
  readonly role: string;
  readonly at: string;
}

/* ──────────────────────────────── reading what a caller said ─────────────────────────── */

/** A project id, as every function past the creator takes one. */
function projectOf(ref: ProjectRef): string {
  const named = (ref.projectId ?? ref.id ?? '').trim();
  if (named === '') throw new TypeError('this call names no project');
  return named;
}

/** A required line of text — a project is citable by name and code from birth. */
function required(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') throw new TypeError(`a project needs a ${field}`);
  return text;
}

/** An optional line of text: blank and absent are the same thing, and both are null. */
function optional(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * R-SPINE-010's closed enum, checked here as well as by the column's CHECK.
 *
 * Here, because a refusal that arrives from the database has already opened a transaction and
 * says `23514` rather than what was wrong; and in the column, because a closed set the schema
 * does not hold is a set some other caller can widen.
 */
function buildingTypeOf(value: unknown): BuildingType | null {
  const named = optional(value);
  if (named === null) return null;
  const found = BUILDING_TYPES.find((type) => type === named);
  if (found === undefined) {
    throw new TypeError(
      `${JSON.stringify(named)} is not one of the building types a project may have: ${BUILDING_TYPES.join(', ')}`,
    );
  }
  return found;
}

/** A whole, non-negative storey count, or null. */
function storeysOf(value: unknown): number | null {
  const named = optional(value);
  if (named === null) return null;
  if (!/^\d+$/.test(named)) {
    throw new TypeError(`a storey count is a whole number, not ${JSON.stringify(named)}`);
  }
  return Number(named);
}

/**
 * A target GFA, as the exact decimal string the `numeric` column holds.
 *
 * It is never parsed into a binary float on the way (B-07): what a caller wrote is what is
 * checked, and what is checked is what is written.
 */
function gfaOf(value: unknown): string | null {
  const named = optional(value);
  if (named === null) return null;
  if (!/^\d+(\.\d+)?$/.test(named)) {
    throw new TypeError(`a target GFA is a decimal quantity, not ${JSON.stringify(named)}`);
  }
  return named;
}

/** The R-SPINE-010 remainder, read out of whatever a caller handed over. */
function fieldsOf(input: ProjectFields): {
  client: string | null;
  siteAddress: string | null;
  district: string | null;
  buildingType: string | null;
  storeys: number | null;
  targetGfaM2: string | null;
  notes: string | null;
} {
  return {
    client: optional(input.client),
    siteAddress: optional(input.siteAddress),
    district: optional(input.district),
    buildingType: buildingTypeOf(input.buildingType),
    storeys: storeysOf(input.storeys),
    targetGfaM2: gfaOf(input.targetGfaM2),
    notes: optional(input.notes),
  };
}

/* ─────────────────────────────────────── the founding ───────────────────────────────── */

/**
 * Create a project, pinned and principled, in one transaction (R-SPINE-010, L-ACT-03,
 * L-REG-07).
 *
 * Every input is checked before the transaction opens, so a building type outside the closed
 * enum costs no connection and leaves no row anywhere. Inside, the order is the law's: the
 * pinned project first — an unpinned project cannot be written at all — then its own fields,
 * then the founding grant, which is a real act with a row in the log like any other. A failure
 * anywhere in that sequence takes the whole of it with it.
 */
export async function createProject(
  ctx: ProjectCtx,
  input: NewProjectInput,
): Promise<{ projectId: string }> {
  const name = required(input.name, 'name');
  const code = required(input.code, 'code');
  const fields = fieldsOf(input);

  return ctx.db.transaction(async (tx: ScopedTx): Promise<{ projectId: string }> => {
    const pinned = await createPinnedProject(tx, { tenantId: ctx.tenantId, name, code });
    const { eq } = operators(ctx.db);
    const table = tx._.fullSchema.projects;
    await tx.update(table).set(fields).where(eq(table.id, pinned.projectId));
    await foundPrincipal({ ...ctx, db: tx as unknown as ScopedDb }, pinned.projectId);
    return { projectId: pinned.projectId };
  });
}

/**
 * Persist an edit (R-SPINE-010's "edit"). Not an act: a metadata change moves nothing the
 * machine derives, so the write is direct and any member of the workspace who reaches the pane
 * may make it (Interpretation 1). Row-level security keeps it inside the tenant.
 *
 * Only the fields a caller named are written — a pane that shows one field must not blank the
 * eight it does not.
 */
export async function updateProject(
  ctx: ProjectCtx,
  input: ProjectRef & Partial<NewProjectInput>,
): Promise<void> {
  const projectId = projectOf(input);
  const changes: Record<string, unknown> = {};
  if (input.name !== undefined) changes['name'] = required(input.name, 'name');
  if (input.code !== undefined) changes['code'] = required(input.code, 'code');
  if (input.client !== undefined) changes['client'] = optional(input.client);
  if (input.siteAddress !== undefined) changes['siteAddress'] = optional(input.siteAddress);
  if (input.district !== undefined) changes['district'] = optional(input.district);
  if (input.buildingType !== undefined) changes['buildingType'] = buildingTypeOf(input.buildingType);
  if (input.storeys !== undefined) changes['storeys'] = storeysOf(input.storeys);
  if (input.targetGfaM2 !== undefined) changes['targetGfaM2'] = gfaOf(input.targetGfaM2);
  if (input.notes !== undefined) changes['notes'] = optional(input.notes);
  if (Object.keys(changes).length === 0) return;

  const { eq } = operators(ctx.db);
  const table = ctx.db._.fullSchema.projects;
  await ctx.db.update(table).set(changes).where(eq(table.id, projectId));
}

/**
 * Archive a project, or restore it (Interpretation 10).
 *
 * Archiving changes visibility on S-Home, never existence or writability: the row stays, the
 * pane stays editable, and the same control puts it back. "When" answers "whether" and says
 * more, so the state is a timestamp.
 */
export async function archiveProject(
  ctx: ProjectCtx,
  input: ProjectRef & { readonly archived?: boolean },
): Promise<void> {
  const projectId = projectOf(input);
  const archiving = input.archived !== false;
  const { eq } = operators(ctx.db);
  const table = ctx.db._.fullSchema.projects;
  await ctx.db
    .update(table)
    .set({ archivedAt: archiving ? new Date() : null })
    .where(eq(table.id, projectId));
}

/* ─────────────────────────────────────── the readers ────────────────────────────────── */

const text = (row: Record<string, unknown>, column: string): string => String(row[column] ?? '');

const maybe = (row: Record<string, unknown>, column: string): string | null => {
  const held = row[column];
  return held === null || held === undefined ? null : String(held);
};

const instant = (held: unknown): string =>
  held instanceof Date ? held.toISOString() : new Date(String(held)).toISOString();

function projectViewOf(row: Record<string, unknown>): ProjectView {
  const storeys = row['storeys'];
  const activity = row['last_activity_at'] ?? row['created_at'];
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    code: text(row, 'code'),
    client: maybe(row, 'client'),
    siteAddress: maybe(row, 'site_address'),
    district: maybe(row, 'district'),
    buildingType: maybe(row, 'building_type'),
    storeys: storeys === null || storeys === undefined ? null : Number(storeys),
    targetGfaM2: maybe(row, 'target_gfa_m2'),
    notes: maybe(row, 'notes'),
    archived: row['archived_at'] !== null && row['archived_at'] !== undefined,
    createdAt: instant(row['created_at']),
    lastActivityAt: instant(activity),
  };
}

/**
 * The workspace's projects, newest activity first (s-home §2).
 *
 * Unarchived only unless a caller asks otherwise: AC-3's "it leaves the default S-Home grid" is
 * exactly this answer, and `?archived=1` is the pane that asks for the rest. Last activity is
 * the act log's newest row for the project, which every project has at least one of — its own
 * founding grant (Interpretation 4).
 */
export async function listProjects(
  ctx: ProjectCtx,
  options: { readonly archived?: boolean } = {},
): Promise<readonly ProjectView[]> {
  const sql = sqlTag(ctx.db);
  const showArchived = options.archived === true;
  const rows = await rowsOf(
    ctx.db,
    sql`select p.*,
               (select max(a.created_at) from acts a where a.project_id = p.id) as last_activity_at
          from projects p
         where p.archived_at is null or ${showArchived}::boolean
         order by coalesce(
                    (select max(a.created_at) from acts a where a.project_id = p.id),
                    p.created_at
                  ) desc,
                  p.created_at desc`,
  );
  return rows.map(projectViewOf);
}

/** One project, or null when this workspace holds no such row (Interpretation 6 — a 404). */
export async function readProject(ctx: ProjectCtx, input: ProjectRef): Promise<ProjectView | null> {
  const projectId = projectOf(input);
  const sql = sqlTag(ctx.db);
  const rows = await rowsOf(
    ctx.db,
    sql`select p.*,
               (select max(a.created_at) from acts a where a.project_id = p.id) as last_activity_at
          from projects p
         where p.id = ${projectId}::uuid`,
  );
  const row = rows[0];
  return row === undefined ? null : projectViewOf(row);
}

/**
 * The addresses behind a set of user ids.
 *
 * `users` carries no tenant, so it has only the system arm of a policy and the join is done
 * here rather than in SQL across two scopes — `listMembers`' shape, with its reason stated.
 */
async function emailsOf(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const wanted = [...new Set(userIds)];
  if (wanted.length === 0) return new Map();
  const people = await runAsSystem(
    'a project’s roster joins each participation to the address it is about',
  ).query.users.findMany({
    columns: { id: true, email: true },
    where: (row, { inArray }) => inArray(row.id, wanted),
  });
  return new Map(people.map((person) => [person.id, person.email]));
}

/**
 * Who takes part in this project and what they hold now (R-SPINE-011).
 *
 * The current role of a (project, user) is the *last* row of its append-only history, which is
 * what `distinct on` with the history ordered newest-first answers; `created_at` defaults to
 * the transaction's timestamp, so the tie-break has to be the order the rows were written in
 * (`seq`) and never the random uuid. Rows come back in first-grant order, so the founder reads
 * first and the list never reshuffles under the reader (panes file §4).
 */
export async function participantRoster(
  ctx: ProjectCtx,
  input: ProjectRef,
): Promise<readonly ParticipantView[]> {
  const projectId = projectOf(input);
  const sql = sqlTag(ctx.db);
  const rows = await rowsOf(
    ctx.db,
    sql`select distinct on (g.user_id)
               g.user_id,
               g.role,
               min(g.created_at) over (partition by g.user_id) as joined_at
          from participant_roles g
         where g.project_id = ${projectId}::uuid
         order by g.user_id, g.created_at desc, g.seq desc`,
  );
  const byEmail = await emailsOf(rows.map((row) => text(row, 'user_id')));
  return rows
    .slice()
    .sort((left, right) => text(left, 'joined_at').localeCompare(text(right, 'joined_at')))
    .map((row) => ({
      userId: text(row, 'user_id'),
      email: byEmail.get(text(row, 'user_id')) ?? '',
      role: text(row, 'role'),
    }));
}

/**
 * Every role grant this project has made, newest first (R-SPINE-011: "role history visible").
 *
 * The history names the *actor*, not only the person it was about, so it is read here as a join
 * of the grant onto the act that made it rather than through the seam's `ParticipantGrant` —
 * which carries the grantee and not the granter. Nothing is written; L-ACT-01 binds the write
 * path, and this is a read.
 */
export async function roleHistory(
  ctx: ProjectCtx,
  input: ProjectRef,
): Promise<readonly RoleGrantView[]> {
  const projectId = projectOf(input);
  const sql = sqlTag(ctx.db);
  const rows = await rowsOf(
    ctx.db,
    sql`select g.user_id, g.role, g.act_id, g.created_at, performed.actor_id
          from participant_roles g
          join acts performed on performed.id = g.act_id
         where g.project_id = ${projectId}::uuid
         order by g.created_at desc, g.seq desc`,
  );
  const byEmail = await emailsOf(
    rows.flatMap((row) => [text(row, 'user_id'), text(row, 'actor_id')]),
  );
  return rows.map((row) => ({
    actId: text(row, 'act_id'),
    userId: text(row, 'user_id'),
    email: byEmail.get(text(row, 'user_id')) ?? '',
    actorId: text(row, 'actor_id'),
    actorEmail: byEmail.get(text(row, 'actor_id')) ?? '',
    role: text(row, 'role'),
    at: instant(row['created_at']),
  }));
}

/** A tenant-scoped handle for a caller that holds only the ids (the routes' own shape). */
export function projectContext(ctx: { tenantId: string; userId: string }): ProjectCtx {
  return { db: forTenant({ tenantId: ctx.tenantId }), tenantId: ctx.tenantId, actorId: ctx.userId };
}
