/**
 * The removal belt on `memberships`, both arms, driven live (AC-2, SEAM-TENANT, V-DB).
 *
 * 0009's appended SQL closes the third way a roster moves. A DELETE is decided by USING alone, so a
 * row a tenant-scoped session may not delete is a row it deletes none of — "DELETE 0", success with
 * nothing done, which is silence rather than a refusal. The migration therefore keeps the row
 * VISIBLE to its own workspace and puts the refusal in an owner-proof trigger, exactly as the act
 * log's append-only belt does. A belt has two arms and both are proved here:
 *
 *   * a tenant-scoped DELETE of a row the session can plainly see is refused SQLSTATE 42501 — not
 *     admitted, and not silently zero-row;
 *   * the seam's own removal still lands: under a named system reason the same statement is
 *     admitted, and the product's `removeMember` — the one door that takes a member off a workspace
 *     — takes one off, all the way to the row being gone.
 *
 * Without the second arm a tightening that broke removal altogether would stay green, which is the
 * defect this file exists against.
 *
 * Raw SQL is spoken through psql, never a driver import (SEAM-TENANT binds this suite like the rest
 * of the tree). Nothing is transcribed: the workspace, its people and its roster are read back from
 * the database the committed migrations built (B-19).
 *
 * NOTE: product modules are loaded by absolute path, so the `@/*` alias is never resolved inside
 * them — imports between `src/` files stay relative.
 */
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { count, ident, lit, psql, run, scalar, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The door an account arrives through, and the module that holds the one removal (R-SPINE-002). */
const AUTH_MODULE = "src/server/auth/session.ts";
const TENANCY_MODULE = "src/modules/spine/tenancy";

const MEMBERSHIPS = "memberships";
const ROLE_COLUMN = "workspace_role";
const MEMBER = "MEMBER";

/** What Postgres answers when a statement is refused by a table's policies or by an owner's belt. */
const RLS_REFUSAL = "42501";

/** The reason this suite's own system-scoped statements run under — attributable, like any other. */
const PROBE_REASON = "test: probe the memberships removal belt, both arms";

/* ------------------------------------------------------------------ loading the product */

async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  let abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  if (statSync(abs).isDirectory()) {
    const barrel = ["index.ts", "index.tsx", "index.mts"].map((file) => join(abs, file)).find((file) => existsSync(file));
    expect(barrel, `${relative} is a directory with no index barrel`).toBeTruthy();
    abs = barrel ?? abs;
  }
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

type AnyFn = (...args: never[]) => unknown;

function exported(bag: Record<string, unknown>, name: string, home: string): AnyFn {
  expect(typeof bag[name], `${home} must export ${name} — the increment's declared interface`).toBe("function");
  return bag[name] as AnyFn;
}

const callFn = (fn: AnyFn, ...args: unknown[]): unknown => (fn as unknown as (...rest: unknown[]) => unknown)(...args);

/* ------------------------------------------------------------------ the database */

let scratch: ScratchDb | undefined;

afterAll(async () => {
  await scratch?.drop();
});

const sysRun = (url: string, script: string): string[][] => run(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));
const sysScalar = (url: string, script: string): string => scalar(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));
const sysCount = (url: string, script: string): number => count(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));

/* ------------------------------------------------------------------ staging: real people, one workspace */

type Person = { userId: string; email: string };

type Stage = {
  /** The scratch database as the migrate role — under FORCE RLS, so every read names a scope. */
  url: string;
  /** The same database as the runtime role, which is who the refusal arm speaks as. */
  appUrl: string;
  tenantId: string;
  owner: Person;
  /** A MEMBER of the owner's workspace — the subject both arms move. */
  joiner: Person;
  /** A second MEMBER, so the successful removal has a subject of its own to take away. */
  leaver: Person;
  tenancy: () => Promise<Record<string, unknown>>;
};

let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const url = provisioned.urlMigrate;

    const auth = await productModule<Record<string, unknown>>(AUTH_MODULE);
    const signUp = exported(auth, "signUp", AUTH_MODULE);

    /** One real account and its personal workspace, through the shipped door. */
    const enrol = async (label: string): Promise<Person> => {
      const marker = `${label}-${randomUUID().slice(0, 8)}`.toLowerCase();
      const email = `${marker}@cubit.test`;
      const answer = (await callFn(signUp, {
        email,
        password: "correct horse battery staple",
        tenantName: `Removal ${marker}`,
        deviceLabel: "acceptance",
        origin: "https://cubit.example",
        requestId: randomUUID(),
      })) as { sessionToken?: string };
      expect(typeof answer?.sessionToken, "the sign-up door answers with a session token (R-SPINE-002)").toBe("string");
      const userId = sysScalar(url, `select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
      return { userId, email };
    };

    const owner = await enrol("removal-owner");
    const tenantId = sysScalar(url, `select ${ident(TENANT_COLUMN)}::text from ${ident(MEMBERSHIPS)} where user_id = ${lit(owner.userId)} limit 1;`);

    const join = async (label: string): Promise<Person> => {
      const person = await enrol(label);
      sysRun(
        url,
        `insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id, ${ident(ROLE_COLUMN)})
           values (${lit(tenantId)}, ${lit(person.userId)}, ${lit(MEMBER)}) on conflict do nothing;`,
      );
      return person;
    };

    const joiner = await join("removal-joiner");
    const leaver = await join("removal-leaver");

    let tenancyModule: Promise<Record<string, unknown>> | undefined;
    return {
      url,
      appUrl: provisioned.urlApp,
      tenantId,
      owner,
      joiner,
      leaver,
      tenancy: () => (tenancyModule ??= productModule<Record<string, unknown>>(TENANCY_MODULE)),
    };
  })());

/** Is this membership still on the workspace? Read back live, so no case believes its own staging. */
const membershipCount = (stage: Stage, userId: string): number =>
  sysCount(stage.url, `select count(*) from ${ident(MEMBERSHIPS)} where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)} and user_id = ${lit(userId)};`);

/* ------------------------------------------------------------------ the two arms */

describe("AC-2: a membership is removed under a recorded system reason and by nothing else", () => {
  it("AC-2: under tenant scope the app role may not delete a membership it can see, and under a named system scope it may", async () => {
    const stage = await staged();
    expect(membershipCount(stage, stage.joiner.userId), "the subject of this probe is on the workspace before it runs").toBe(1);

    // The row is one the scoped session can plainly SEE — the case below proves it — so a refusal
    // here is the belt refusing and not invisibility answering nothing.
    const scoped = psql(
      stage.appUrl,
      withSession(
        { [GUC_TENANT]: stage.tenantId },
        `select count(*) from ${ident(MEMBERSHIPS)} where user_id = ${lit(stage.joiner.userId)};`,
      ),
    );
    expect(scoped.ok, `${ROLE_APP}, scoped to the workspace, could not read its own roster at all:\n${scoped.stderr.slice(-800)}`).toBe(true);
    expect(scoped.rows[0]?.[0], "the row the DELETE below names is visible to the workspace's own handle, so silence would not be invisibility").toBe("1");

    const remove = `begin;
       delete from ${ident(MEMBERSHIPS)} where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)} and user_id = ${lit(stage.joiner.userId)} returning user_id::text;
       rollback;`;

    const tenantScoped = psql(stage.appUrl, withSession({ [GUC_TENANT]: stage.tenantId }, remove));
    expect(
      tenantScoped.ok,
      `${ROLE_APP}, scoped to the workspace, took a member off its roster — a membership is removed by the seam under a recorded system reason and by nothing else (R-SPINE-006, SEAM-TENANT)`,
    ).toBe(false);
    expect(
      tenantScoped.sqlstate,
      `that DELETE failed, but not as a refusal (${RLS_REFUSAL}). A tenant-scoped session must be REFUSED rather than answered "DELETE 0", which is success with nothing done:\n${tenantScoped.stderr.slice(-800)}`,
    ).toBe(RLS_REFUSAL);

    const system = psql(stage.appUrl, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, remove));
    expect(
      system.ok,
      `${ROLE_APP} under a named system scope could not delete a membership at all — the belt above refuses the seam's own removal too, and the door the product ships would be dead:\n${system.stderr.slice(-800)}`,
    ).toBe(true);
    expect(system.rows.some((row) => row[0] === stage.joiner.userId), "the system-scoped DELETE took the row it named").toBe(true);

    expect(membershipCount(stage, stage.joiner.userId), "both probes rolled back, so the roster is as it was").toBe(1);
  }, 300_000);

  it("AC-2: the shipped removal takes a member off the workspace, through the same belt", async () => {
    const stage = await staged();
    const removeMember = exported(await stage.tenancy(), "removeMember", `${TENANCY_MODULE}/index.ts`);

    expect(membershipCount(stage, stage.leaver.userId), "the member this case removes is on the workspace before it runs").toBe(1);
    await callFn(removeMember, { tenantId: stage.tenantId, userId: stage.owner.userId }, { subjectUserId: stage.leaver.userId });

    expect(
      membershipCount(stage, stage.leaver.userId),
      "an OWNER removing a MEMBER leaves the workspace without that membership — the removal the product ships passes the belt the case above proves",
    ).toBe(0);
    expect(membershipCount(stage, stage.owner.userId), "and it takes nobody else's membership away").toBe(1);
  }, 300_000);
});
