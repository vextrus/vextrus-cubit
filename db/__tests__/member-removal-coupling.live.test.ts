/**
 * AC-1(c) — the coupling between the act log and a membership, read where the removal is written.
 *
 * "A membership the log names may not be taken away underneath the record it made" is read in one
 * transaction and acted on in another (debt-src-modules-hq8v1h): between the read and the write an
 * act can land, and the membership goes anyway. The read moves inside the role move's own
 * transaction — `RoleMoveScope` answers it under the role lock — and core's `actsHeldBy` gains the
 * tenant scope that makes it askable there, because the move runs on the system handle, which reads
 * past row-level security.
 *
 * Which means the scope must be stated: an act the subject holds in ANOTHER workspace is no reason
 * to keep them in this one.
 */
import { afterAll, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REPO_ROOT,
  actRows,
  closeStage,
  productModule,
  sql,
  stageSetRevision,
  type StagedRevision,
} from "../../tests/takeoff/register/support/register-stage";

const BUDGET_MS = 900_000;

const HELD_MODULE = "src/core/acts/held.ts";
const DB_MODULE = "src/core/db.ts";
const TENANCY_MODULE = "src/modules/spine/tenancy/index.ts";
const REMOVAL_MODULE = "src/modules/spine/tenancy/removal/index.ts";

type Tx = unknown;
type HeldSeam = { actsHeldBy: (tx: Tx, userId: string, scope?: { tenantId: string }) => Promise<readonly string[]> };
type DbSeam = { runAsSystem: (reason: string) => { transaction: <T>(work: (tx: Tx) => Promise<T>) => Promise<T> } };
type TenancySeam = { removeMember: (actor: { tenantId: string; userId: string }, request: { subjectUserId: string }) => Promise<unknown> };

interface Staged {
  here: StagedRevision;
  elsewhere: StagedRevision;
  held: HeldSeam;
  db: DbSeam;
  tenancy: TenancySeam;
}

let staging: Promise<Staged> | undefined;

/**
 * Two workspaces, each with a pinned drawing set — so each holds acts its own owner is named in.
 * The owner of the second is then made a member of the first, holding acts in neither of it.
 */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const here = await stageSetRevision("removal-here");
    const elsewhere = await stageSetRevision("removal-elsewhere");
    expect(actRows(elsewhere.person.tenantId, elsewhere.projectId).length, "the other workspace's owner is named in its own act log").toBeGreaterThan(0);

    sql(
      `insert into memberships (tenant_id, user_id, workspace_role)
       select '${here.person.tenantId}'::uuid, '${elsewhere.person.userId}'::uuid, workspace_role
         from memberships where tenant_id = '${here.person.tenantId}'::uuid limit 1
       on conflict do nothing;`,
    );

    return {
      here,
      elsewhere,
      held: await productModule<HeldSeam>(HELD_MODULE),
      db: await productModule<DbSeam>(DB_MODULE),
      tenancy: await productModule<TenancySeam>(TENANCY_MODULE),
    };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

test(
  "AC-1(c): what a person holds is askable of one workspace, on a handle that sees them all",
  async () => {
    const stage = await staged();
    const subject = stage.elsewhere.person.userId;

    const [everywhere, hereOnly, theirOwn] = await stage.db.runAsSystem("test: what this person holds, workspace by workspace").transaction(async (tx) => [
      await stage.held.actsHeldBy(tx, subject),
      await stage.held.actsHeldBy(tx, subject, { tenantId: stage.here.person.tenantId }),
      await stage.held.actsHeldBy(tx, subject, { tenantId: stage.elsewhere.person.tenantId }),
    ]);

    expect(everywhere.length, "unscoped, the system handle sees every act the log names them in").toBeGreaterThan(0);
    expect(theirOwn.length, "scoped to their own workspace, it sees the acts they performed there").toBeGreaterThan(0);
    expect(hereOnly, "scoped to a workspace they have performed nothing in, it sees none of them").toEqual([]);
  },
  BUDGET_MS,
);

test(
  "AC-1(c): an act held in another workspace does not keep a member in this one",
  async () => {
    const stage = await staged();

    await stage.tenancy.removeMember({ tenantId: stage.here.person.tenantId, userId: stage.here.person.userId }, { subjectUserId: stage.elsewhere.person.userId });

    const left = sql(
      `select user_id::text from memberships where tenant_id = '${stage.here.person.tenantId}'::uuid and user_id = '${stage.elsewhere.person.userId}'::uuid;`,
    );
    expect(left.length, "the membership is gone: nothing in this workspace's log named them").toBe(0);
  },
  BUDGET_MS,
);

// white-box: AC-1(c) — a check-then-act window is a race, and a race cannot be observed by a test
// without deciding a scheduler. That the coupling is read INSIDE the role move's own transaction,
// rather than in a transaction of the removal's own, is a property of the text.
test("AC-1(c): the removal reads the coupling inside the role move, not in a transaction of its own", () => {
  // white-box: AC-1(c) — a check-then-act window is a race, and a race cannot be observed without
  // deciding a scheduler; that the coupling is read inside the move's own transaction is textual.
  const removal = readFileSync(join(REPO_ROOT, REMOVAL_MODULE), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  expect(removal.includes("movingWorkspaceRoles"), "the coupling is asked under the same lock the move is written under").toBe(true);
  expect(/\.transaction\(/.test(removal), `${REMOVAL_MODULE} opens no transaction of its own — that second transaction is the window`).toBe(false);
});
