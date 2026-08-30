/**
 * The last-PRINCIPAL database backstop, driven where it is the only thing standing (L-ACT-03:
 * "'a project holds at least one PRINCIPAL at every moment' is load-bearing law with a database
 * backstop (an owner-installed trigger) beside the seam's advisory-locked guard").
 *
 * The seam's own guard is proved by the public acceptance, through `preview` and `commit`. This
 * file proves the OTHER belt: rows are inserted into `participant_role_withdrawals` directly, past
 * the seam entirely, the way a migration, a console session or a future writer would reach the
 * ledger — and the trigger is what refuses them. A guard no test drives is a guard nothing knows
 * still works.
 *
 * Three things are judged, each a way the backstop could be hollow:
 *   1. the last effective PRINCIPAL cannot be withdrawn, and the failure names the registered code;
 *   2. the refusal is decided from the GRANT the row countermands, not from the tenant/project/role
 *      columns the writer wrote beside it — those are the writer's word, and `effectiveGrants`
 *      subtracts by `grant_id` regardless of what they say;
 *   3. two withdrawals racing for a project's two PRINCIPALs cannot both land.
 *
 * Raw SQL is spoken through psql, never a driver import — SEAM-TENANT's ban binds this file like
 * the rest of the tree. Nothing here is transcribed from the product: the code the message must
 * carry is read out of the shipped registry (B-19).
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, GUC_TENANT, SEED_REASON } from "./support/fixtures";
import { ident, lit, psql, run, scalar, withSession } from "./support/live-sql";

/** The registered code the raised message must carry, read from the registry rather than spelled. */
const PROJECT_WOULD_HAVE_NO_PRINCIPAL = REFUSALS.PROJECT_WOULD_HAVE_NO_PRINCIPAL.code;

const PARTICIPANT_ROLES = "participant_roles";
const WITHDRAWALS = "participant_role_withdrawals";
const PRINCIPAL = "PRINCIPAL";
const MEASURER = "MEASURER";

let scratch: ScratchDb | undefined;
let url = "";
let tenantId = "";

const seed = (script: string): string[][] => run(url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, script));
const seedScalar = (script: string): string => scalar(url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, script));

beforeAll(async () => {
  scratch = await provisionScratchDb();
  url = scratch.urlMigrate;
  tenantId = seedScalar(`insert into tenants (name) values ('Participants backstop') returning tenant_id::text;`);
}, 240_000);

afterAll(async () => {
  await scratch?.drop();
});

/** A project of the scratch workspace, with one PRINCIPAL grant per given person. */
function scene(holders: readonly string[]): { projectId: string; grants: string[] } {
  const projectId = seedScalar(`insert into projects (tenant_id, name) values (${lit(tenantId)}, 'Backstop scene') returning project_id::text;`);
  const grants = holders.map((userId) => {
    seed(`insert into participants (tenant_id, project_id, user_id) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)}) on conflict do nothing;`);
    return seedScalar(
      `insert into ${ident(PARTICIPANT_ROLES)} (tenant_id, project_id, user_id, role)
         values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)}, ${lit(PRINCIPAL)}) returning grant_id::text;`,
    );
  });
  return { projectId, grants };
}

/**
 * An act row to hang a withdrawal on: the ledger's `act_id` is a foreign key, so even a write that
 * bypasses the seam has to point at something the log holds.
 */
function actOf(projectId: string, actorId: string): string {
  return seedScalar(
    `insert into acts (tenant_id, project_id, actor_id, act_type, subjects, consequence_digest)
       values (${lit(tenantId)}, ${lit(projectId)}, ${lit(actorId)}, 'ASSIGN_PARTICIPANT_ROLE', ${lit(JSON.stringify([actorId]))}::jsonb, ${lit("0".repeat(64))})
       returning act_id::text;`,
  );
}

/** The statement the trigger judges: one withdrawal row, written straight at the ledger. */
function withdrawal(row: { grantId: string; projectId: string; userId: string; role: string; actId: string }): string {
  return `insert into ${ident(WITHDRAWALS)} (tenant_id, grant_id, project_id, user_id, role, act_id)
     values (${lit(tenantId)}, ${lit(row.grantId)}, ${lit(row.projectId)}, ${lit(row.userId)}, ${lit(row.role)}, ${lit(row.actId)});`;
}

/** How many withdrawals the ledger holds for a project — the number a refusal must not move. */
function withdrawalsFor(projectId: string): number {
  return Number(seedScalar(`select count(*) from ${ident(WITHDRAWALS)} where project_id = ${lit(projectId)};`));
}

/** One psql session, run without blocking the other one — the concurrency case needs two at once. */
function psqlAsync(script: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("psql", [url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("close", (status) => resolve({ ok: status === 0, stderr }));
    child.stdin.end(`${script}\n`);
  });
}

/**
 * Wait until some transaction holds an advisory lock in this database — the project state lock the
 * trigger takes before it counts standing PRINCIPALs. A wall clock cannot order two psql processes:
 * a slow spawn would let the second transaction count first, and the case would then assert the
 * opposite of what happened. The lock is the handshake: it appears exactly when the first INSERT has
 * reached the guard, and the scratch database is this file's alone, so nothing else takes one.
 */
async function firstWithdrawalReachedTheGuard(alreadyFinished: () => boolean): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    // Either the guard is standing on the lock now, or the whole transaction came and went while
    // this loop slept — both mean the first withdrawal was judged before the second one starts.
    if (alreadyFinished()) return;
    const holders = Number(
      seedScalar(`select count(*) from pg_locks where locktype = 'advisory' and granted and database = (select oid from pg_database where datname = current_database());`),
    );
    if (holders > 0) return;
    await new Promise((wake) => setTimeout(wake, 25));
  }
  throw new Error("the first withdrawal never took the project's state lock, so the race was never staged");
}

describe("the owner-installed last-PRINCIPAL trigger, driven past the seam", () => {
  it("refuses a withdrawal of the project's only effective PRINCIPAL, naming the registered code", () => {
    const person = randomUUID();
    const { projectId, grants } = scene([person]);
    const grantId = grants[0] ?? "";
    const attempt = psql(
      url,
      withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, withdrawal({ grantId, projectId, userId: person, role: PRINCIPAL, actId: actOf(projectId, person) })),
    );

    expect(attempt.ok, `the ledger took a withdrawal of the project's only PRINCIPAL — the backstop did not fire:\n${attempt.stderr}`).toBe(false);
    expect(attempt.stderr, `the raised message carries ${PROJECT_WOULD_HAVE_NO_PRINCIPAL} so a machine reading the failure knows which law stopped it`).toContain(
      PROJECT_WOULD_HAVE_NO_PRINCIPAL,
    );
    expect(withdrawalsFor(projectId), "a refused withdrawal writes nothing").toBe(0);
  });

  it("judges the grant it countermands, not the columns the writer wrote beside it", () => {
    const person = randomUUID();
    const { projectId, grants } = scene([person]);
    const grantId = grants[0] ?? "";
    // Every column but `grant_id` disagrees with the grant: a different project, a different person,
    // a role that is not PRINCIPAL at all. The row still subtracts that PRINCIPAL grant, because a
    // withdrawal is read by `grant_id`, so the backstop still refuses it.
    const elsewhere = scene([randomUUID()]);
    const attempt = psql(
      url,
      withSession(
        { [GUC_SYSTEM_REASON]: SEED_REASON },
        withdrawal({ grantId, projectId: elsewhere.projectId, userId: randomUUID(), role: MEASURER, actId: actOf(projectId, person) }),
      ),
    );

    expect(attempt.ok, `the backstop believed the writer's own labels over the grant the row points at:\n${attempt.stderr}`).toBe(false);
    expect(attempt.stderr, "and refuses it by the registered code, exactly as it refuses an honestly labelled row").toContain(PROJECT_WOULD_HAVE_NO_PRINCIPAL);
    expect(withdrawalsFor(elsewhere.projectId), "a refused withdrawal writes nothing").toBe(0);
  });

  it("refuses a withdrawal whose countermanded grant the writing session's scope hides", () => {
    // A grant of another workspace, pointed at from a row this session may lawfully write. The
    // foreign key takes it — key checks bypass row security — so the key is not what stands between
    // the ledger and an unjudged subtraction of somebody else's last PRINCIPAL. The trigger reads
    // the grant under the scope the writer armed, sees nothing, and refuses on that.
    const stranger = randomUUID();
    const otherTenant = seedScalar(`insert into tenants (name) values ('Another workspace') returning tenant_id::text;`);
    const otherProject = seedScalar(`insert into projects (tenant_id, name) values (${lit(otherTenant)}, 'Their project') returning project_id::text;`);
    seed(`insert into participants (tenant_id, project_id, user_id) values (${lit(otherTenant)}, ${lit(otherProject)}, ${lit(stranger)}) on conflict do nothing;`);
    const hiddenGrant = seedScalar(
      `insert into ${ident(PARTICIPANT_ROLES)} (tenant_id, project_id, user_id, role)
         values (${lit(otherTenant)}, ${lit(otherProject)}, ${lit(stranger)}, ${lit(PRINCIPAL)}) returning grant_id::text;`,
    );

    const writer = randomUUID();
    const here = scene([writer]);
    const attempt = psql(
      url,
      withSession(
        { [GUC_TENANT]: tenantId },
        withdrawal({ grantId: hiddenGrant, projectId: here.projectId, userId: stranger, role: MEASURER, actId: actOf(here.projectId, writer) }),
      ),
    );

    expect(attempt.ok, `a withdrawal of a grant this session cannot read landed unjudged:\n${attempt.stderr}`).toBe(false);
    expect(attempt.sqlstate, "and is refused by the backstop's own check violation, not by the key it would have passed").toBe("23514");
    expect(withdrawalsFor(here.projectId), "a refused withdrawal writes nothing").toBe(0);
    expect(
      Number(seedScalar(`select count(*) from ${ident(WITHDRAWALS)} where grant_id = ${lit(hiddenGrant)};`)),
      "and the hidden grant keeps standing: nothing countermanded it",
    ).toBe(0);
  });

  it("admits a withdrawal while a second PRINCIPAL stands, and refuses the one that would empty the project", () => {
    const first = randomUUID();
    const second = randomUUID();
    const { projectId, grants } = scene([first, second]);
    const actId = actOf(projectId, first);

    const admitted = psql(
      url,
      withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, withdrawal({ grantId: grants[0] ?? "", projectId, userId: first, role: PRINCIPAL, actId })),
    );
    expect(admitted.ok, `a withdrawal leaving a second PRINCIPAL standing is lawful and must be taken:\n${admitted.stderr}`).toBe(true);

    const refused = psql(
      url,
      withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, withdrawal({ grantId: grants[1] ?? "", projectId, userId: second, role: PRINCIPAL, actId })),
    );
    expect(refused.ok, "the second withdrawal would leave the project with none — the count reads effective grants, not raw ones").toBe(false);
    expect(refused.stderr).toContain(PROJECT_WOULD_HAVE_NO_PRINCIPAL);
    expect(withdrawalsFor(projectId), "exactly the one lawful withdrawal stands").toBe(1);
  });

  it("cannot be raced: two withdrawals of one project's two PRINCIPALs, and only one lands", async () => {
    const first = randomUUID();
    const second = randomUUID();
    const { projectId, grants } = scene([first, second]);
    const actId = actOf(projectId, first);
    const session = `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};`;

    // The first transaction takes its turn and holds it open; the second arrives while it is still
    // uncommitted and must not be allowed to count the grant the first is taking away. Which one is
    // first is settled by the lock the first one takes, never by how fast either psql starts.
    let firstFinished = false;
    const held = psqlAsync(`begin; ${session} ${withdrawal({ grantId: grants[0] ?? "", projectId, userId: first, role: PRINCIPAL, actId })} select pg_sleep(2); commit;`).then((answer) => {
      firstFinished = true;
      return answer;
    });
    await firstWithdrawalReachedTheGuard(() => firstFinished);
    const racing = psqlAsync(`begin; ${session} ${withdrawal({ grantId: grants[1] ?? "", projectId, userId: second, role: PRINCIPAL, actId })} commit;`);

    const [firstAnswer, secondAnswer] = await Promise.all([held, racing]);
    expect(firstAnswer.ok, `the first withdrawal was lawful when it started and stays lawful:\n${firstAnswer.stderr}`).toBe(true);
    expect(secondAnswer.ok, "two withdrawals racing for the last two PRINCIPALs both landed — the backstop counted a state the other was leaving").toBe(false);
    expect(secondAnswer.stderr, "the loser of the race is refused by the registered code every last-PRINCIPAL withdrawal draws").toContain(PROJECT_WOULD_HAVE_NO_PRINCIPAL);
    expect(withdrawalsFor(projectId), "one PRINCIPAL stands, so exactly one withdrawal is on the ledger").toBe(1);
  }, 60_000);
});
