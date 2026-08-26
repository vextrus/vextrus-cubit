// Breaker acceptance for the act seam (SEAM-ACT, L-ACT-02, L-ACT-03, V-DB): what the seam answers
// when the state write its Consequence promised is one the database will not take.
//
// L-ACT-02 makes an act type a pair: `preview(input) → Consequence` and `commit(input, digest)`,
// and it names exactly one outcome for a commit the state has moved under — `CONSEQUENCES_NOT_CARRIED`.
// A commit carrying the digest the current state *does* produce is therefore either performed or
// refused by name; a driver fault reaching the caller is neither, and the fault seam reads it as a
// fault rather than an answer (B-21: a refusal is an answer, not a fault — `refusalCodeOf` is the
// one reader of that difference, ARCH-02).
//
// Two inputs whose commit the database refuses, both previewed as ordinary Consequences:
//   · a role the subject already holds — `participant_roles`' uniqueness answers 23505;
//   · a subject who is not a participant — the composite participation FK answers 23503.
// L-ACT-03 puts the participation link in the log as a backstop and the permission read at the seam;
// a backstop that fires first, as an unmarked driver error, is the belt doing the guard's work.
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
// rest of the tree, and the seam itself is loaded by absolute path so a missing module fails as an
// assertion naming the file instead of killing collection at transform time.
//
// B-19: nothing here freezes a roster. The act type is asserted to be a member of the seam's own
// ACT_TYPES, and the role granted is derived from ROLE_PERMISSIONS as one whose bundle does not
// carry the act's own permission — so a tree that renames either is judged by the same file.
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, SEED_REASON, TENANT_ALPHA, TENANT_COLUMN } from "./support/fixtures";
import { ident, lit, run, seedTenants, withSession } from "./support/live-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The seam's barrel — the sole entry point other increments import (SEAM-ACT). */
const ACTS_MODULE = "src/core/acts/index.ts";

/** The tables this increment ships, named by the increment's interfaces rather than by inspection. */
const PARTICIPANTS = "participants";
const PARTICIPANT_ROLES = "participant_roles";
const ACTS = "acts";

/**
 * The act type this file exercises, declared once as a fixture identity (B-19) and asserted below to
 * be a member of the seam's own ACT_TYPES — so a tree that spells it otherwise fails here by name
 * rather than passing on a case that never ran.
 */
const ASSIGN_PARTICIPANT_ROLE = "ASSIGN_PARTICIPANT_ROLE";

/** The reason this file's own system-scoped seeding is attributable by (SEAM-TENANT). */
const READ_REASON = "test: read the act tables back for comparison";

type ActorKind = "human" | "machine" | "model";
type ActorCtx = { tenantId: string; userId: string; actorKind: ActorKind };
type AssignInput = { type: string; projectId: string; subjectUserId: string; role: string };

type ActSeam = {
  preview?: (ctx: ActorCtx, input: AssignInput) => Promise<unknown>;
  commit?: (ctx: ActorCtx, input: AssignInput, consequenceDigest: string) => Promise<unknown>;
  consequenceDigest?: (consequence: unknown) => string;
  ACT_TYPES?: readonly string[];
  ACT_PERMISSION?: Record<string, string>;
  ROLE_PERMISSIONS?: Record<string, readonly string[]>;
};

async function loadActSeam(databaseUrl: string): Promise<ActSeam> {
  process.env["DATABASE_URL"] = databaseUrl;
  const abs = join(REPO_ROOT, ACTS_MODULE);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${ACTS_MODULE} is missing from the checkout — SEAM-ACT names it the sole writer of the act log`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as ActSeam;
}

function seamFunction<K extends "preview" | "commit" | "consequenceDigest">(seam: ActSeam, name: K): NonNullable<ActSeam[K]> {
  const fn = seam[name];
  if (typeof fn !== "function") {
    throw new Error(`${ACTS_MODULE} exports no ${name} — L-ACT-02 makes every act type a (preview, commit) pair digested in one home (ARCH-02)`);
  }
  return fn as NonNullable<ActSeam[K]>;
}

/**
 * A role whose bundle does not carry the permission the act moves, read off the seam's own law: the
 * subject of the assignment gains a role, never the permission that let the actor assign it, so the
 * scenario cannot pass by accident on a bundle that happens to hold ADMINISTER_PROJECT (L-ACT-03).
 */
function assignableRole(seam: ActSeam): string {
  const bundles = seam.ROLE_PERMISSIONS;
  const permission = seam.ACT_PERMISSION?.[ASSIGN_PARTICIPANT_ROLE];
  if (typeof bundles !== "object" || bundles === null || typeof permission !== "string") {
    throw new Error(`${ACTS_MODULE} exports no ROLE_PERMISSIONS and ACT_PERMISSION pair — L-ACT-03's bundles and its act→permission map sit beside the act map`);
  }
  const candidates = Object.keys(bundles)
    .filter((role) => !(bundles[role] ?? []).includes(permission))
    .sort();
  const role = candidates[0];
  expect(role, `L-ACT-03 makes ${permission} PRINCIPAL-only, so ROLE_PERMISSIONS must name roles that lack it`).toBeDefined();
  return role ?? "";
}

/** The role the actor must hold for the act: the one role whose bundle carries every permission. */
function administeringRole(seam: ActSeam): string {
  const bundles = seam.ROLE_PERMISSIONS ?? {};
  const permission = seam.ACT_PERMISSION?.[ASSIGN_PARTICIPANT_ROLE] ?? "";
  const holders = Object.keys(bundles)
    .filter((role) => (bundles[role] ?? []).includes(permission))
    .sort();
  const role = holders[0];
  expect(role, `no role in ROLE_PERMISSIONS carries ${permission} — L-ACT-03 gives it to PRINCIPAL, and an act nobody may perform is not an act`).toBeDefined();
  return role ?? "";
}

/* ------------------------------------------------------------------ *
 * Reading and seeding, through the system channel psql speaks.
 * ------------------------------------------------------------------ */

function seedParticipant(url: string, tenantId: string, projectId: string, userId: string): void {
  run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: SEED_REASON },
      `insert into ${ident(PARTICIPANTS)} (${ident(TENANT_COLUMN)}, ${ident("project_id")}, ${ident("user_id")})
       values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)});`,
    ),
  );
}

function seedRoleGrant(url: string, tenantId: string, projectId: string, userId: string, role: string): void {
  run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: SEED_REASON },
      `insert into ${ident(PARTICIPANT_ROLES)} (${ident(TENANT_COLUMN)}, ${ident("project_id")}, ${ident("user_id")}, ${ident("role")})
       values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)}, ${lit(role)});`,
    ),
  );
}

function grantsHeld(url: string, tenantId: string, projectId: string, userId: string): string[] {
  return run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: READ_REASON },
      `select ${ident("role")}::text from ${ident(PARTICIPANT_ROLES)}
        where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and ${ident("project_id")} = ${lit(projectId)} and ${ident("user_id")} = ${lit(userId)}
        order by 1;`,
    ),
  ).map((row) => row[0] ?? "");
}

function actsOnProject(url: string, tenantId: string, projectId: string): string[] {
  return run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: READ_REASON },
      `select ${ident("act_type")}::text from ${ident(ACTS)}
        where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and ${ident("project_id")} = ${lit(projectId)};`,
    ),
  ).map((row) => row[0] ?? "");
}

/* ------------------------------------------------------------------ *
 * The assertion this file makes.
 * ------------------------------------------------------------------ */

type Outcome = { performed: boolean; thrown: unknown };

async function outcomeOf(work: () => Promise<unknown>): Promise<Outcome> {
  try {
    await work();
    return { performed: true, thrown: undefined };
  } catch (error) {
    return { performed: false, thrown: error };
  }
}

/**
 * The seam answers: it performs the act, or it refuses with a code the closed register holds. A
 * failure carrying no registered code is a fault — the door that was to be provably one door hands
 * its caller the driver's own error instead of an answer (B-21, R-SPINE-062, SEAM-ACT).
 */
function answeredOrRefused(outcome: Outcome, what: string): void {
  if (outcome.performed) return;
  const code = refusalCodeOf(outcome.thrown);
  const detail = String((outcome.thrown as Error | undefined)?.message ?? outcome.thrown).slice(0, 400);
  expect(code, `${what} — the seam answered with an unmarked fault instead of a refusal: ${detail}`).not.toBeNull();
  expect(
    Object.hasOwn(REFUSALS, code ?? ""),
    `${what} — a refusal must carry a code the closed register in src/core/errors.ts holds, not ${JSON.stringify(code)}`,
  ).toBe(true);
}

/* ------------------------------------------------------------------ *
 * Staging.
 * ------------------------------------------------------------------ */

let scratch: Awaited<ReturnType<typeof provisionScratchDb>> | undefined;

afterAll(async () => {
  await scratch?.drop();
});

type Stage = { seam: ActSeam; url: string; tenantId: string; granted: string; administering: string };

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const tenantId = tenantIds[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    const seam = await loadActSeam(provisioned.urlApp);
    expect(
      seam.ACT_TYPES ?? [],
      `${ACTS_MODULE} declares no ${ASSIGN_PARTICIPANT_ROLE} in ACT_TYPES — this file exercises the act type the increment ships`,
    ).toContain(ASSIGN_PARTICIPANT_ROLE);
    return { seam, url: provisioned.urlMigrate, tenantId, granted: assignableRole(seam), administering: administeringRole(seam) };
  })());

/** One project with an actor who may administer it, and a subject who is already a participant. */
async function scenario(): Promise<{ projectId: string; actor: string; subject: string }> {
  const { url, tenantId, administering } = await staged();
  const projectId = randomUUID();
  const actor = randomUUID();
  const subject = randomUUID();
  seedParticipant(url, tenantId, projectId, actor);
  seedRoleGrant(url, tenantId, projectId, actor, administering);
  seedParticipant(url, tenantId, projectId, subject);
  return { projectId, actor, subject };
}

const assign = (projectId: string, subjectUserId: string, role: string): AssignInput => ({
  type: ASSIGN_PARTICIPANT_ROLE,
  projectId,
  subjectUserId,
  role,
});

/* ------------------------------------------------------------------ *
 * The cases.
 * ------------------------------------------------------------------ */

describe("breaker: a Consequence the state write will not take", () => {
  it("a commit carrying the digest current state produces is answered, not faulted, when the subject already holds the role", async () => {
    const { seam, url, tenantId, granted } = await staged();
    const scene = await scenario();
    const ctx: ActorCtx = { tenantId, userId: scene.actor, actorKind: "human" };
    const input = assign(scene.projectId, scene.subject, granted);

    // The state the second assignment would move: the subject already holds the role, so the
    // Consequence the seam computes is the one current state produces and the digest is carried
    // whole — L-ACT-02's stale-digest refusal has nothing to fire on.
    seedRoleGrant(url, tenantId, scene.projectId, scene.subject, granted);

    const consequence = await seamFunction(seam, "preview")(ctx, input);
    expect(consequence === null || consequence === undefined, "preview(ctx, input) must answer a typed Consequence (L-ACT-02)").toBe(false);
    const digest = seamFunction(seam, "consequenceDigest")(consequence);

    const outcome = await outcomeOf(() => seamFunction(seam, "commit")(ctx, input, digest));
    answeredOrRefused(outcome, `committing ${ASSIGN_PARTICIPANT_ROLE} for a subject who already holds ${granted}`);

    // Whichever way it is answered, the ledger says one thing: the role is held once, and the log
    // holds an act only if one was performed (L-ACT-01, "act row and state change in one
    // transaction or neither").
    expect(grantsHeld(url, tenantId, scene.projectId, scene.subject), `${granted} is held or it is not — a second grant row says the same thing twice (L-ACT-03)`).toEqual([granted]);
    expect(actsOnProject(url, tenantId, scene.projectId).length, "a refused act writes no act row (L-ACT-01)").toBe(outcome.performed ? 1 : 0);
  });

  it("a commit for a subject who is not a participant is answered, not faulted", async () => {
    const { seam, url, tenantId, granted } = await staged();
    const scene = await scenario();
    const ctx: ActorCtx = { tenantId, userId: scene.actor, actorKind: "human" };
    // Somebody with no participation on this project: L-ACT-03 makes participation mandatory and
    // the log's composite FK its backstop, so this is an input the state write cannot take as it
    // stands.
    const outsider = randomUUID();
    const input = assign(scene.projectId, outsider, granted);

    const consequence = await outcomeOf(() => seamFunction(seam, "preview")(ctx, input));
    answeredOrRefused(consequence, `previewing ${ASSIGN_PARTICIPANT_ROLE} for someone who does not participate in the project`);
    if (!consequence.performed) return;

    const digest = seamFunction(seam, "consequenceDigest")(await seamFunction(seam, "preview")(ctx, input));
    const outcome = await outcomeOf(() => seamFunction(seam, "commit")(ctx, input, digest));
    answeredOrRefused(outcome, `committing ${ASSIGN_PARTICIPANT_ROLE} for someone who does not participate in the project`);
    expect(actsOnProject(url, tenantId, scene.projectId).length, "a refused act writes no act row (L-ACT-01)").toBe(outcome.performed ? 1 : 0);
  });
});
