/**
 * Public acceptance for inc-011-projects AC-2 (the creation transaction) and AC-4 (the lifecycle
 * guard), driven live against a scratch database the committed migrations built (V-DB).
 *
 * AC-2's all-or-nothing NEGATIVE lives in its own file — `projects-atomicity.live.test.ts` — because
 * it needs a database whose platform seed is absent, and the database handle a process opens is the
 * one it keeps (SEAM-TENANT: `forTenant` reads DATABASE_URL when it first reaches the store).
 *
 * B-19: the read model is never transcribed. Which key a field wears is discovered from the answer
 * the product gives, and only the FIELDS R-SPINE-010 names are required to be covered — a later
 * increment adding a quick stat or a landing route must not redden this file.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, TENANT_ALPHA } from "./support/fixtures";
import { lit, run, seedTenants } from "./support/live-sql";
import {
  ARCHIVED_MARKER,
  BUILDING_TYPES,
  EDITIONS_MODULE,
  PERMISSION_NOT_HELD,
  PRINCIPAL,
  PROJECTS_MODULE,
  RSPINE010_FIELDS,
  callDoor,
  productModule,
  projectRows,
  refusalFrom,
  rowFor,
  seamFunction,
  type SeamFn,
} from "./projects-support";

/** This suite's own attribution for the rows it plants — as named as any other write. */
const SEED_REASON = "test: enrol the two accounts inc-011's lifecycle guard is judged with";

type Actor = { tenantId: string; userId: string; actorKind: "human" };

type Stage = {
  bootstrapUrl: string;
  tenantId: string;
  /** The account that creates the projects, and therefore the one L-ACT-03 installs as PRINCIPAL. */
  creator: Actor;
  /** A signed-in member of the same workspace who is not a participant on anything. */
  outsider: Actor;
  seam: Record<string, unknown>;
  view: (input: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>>;
};

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");

    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    const bootstrapUrl = url.toString();

    const enrol = (email: string): Actor => {
      const userId = run(
        bootstrapUrl,
        `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};
         insert into users (email, password_hash) values (${lit(email)}, ${lit("not-a-real-hash")}) returning user_id;`,
      )[0]?.[0];
      expect(userId, `planting the account ${email} produced no user row`).toBeTruthy();
      run(
        bootstrapUrl,
        `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};
         insert into memberships (tenant_id, user_id) values (${lit(tenantId)}, ${lit(userId ?? "")});`,
      );
      return { tenantId, userId: userId ?? "", actorKind: "human" };
    };

    const creator = enrol(`creator-${randomUUID()}@cubit.test`);
    const outsider = enrol(`outsider-${randomUUID()}@cubit.test`);

    // The seam reads DATABASE_URL when it first reaches the store, so the scratch deployment is
    // named before any product module is loaded.
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const seam = await productModule<Record<string, unknown>>(PROJECTS_MODULE);
    const editions = await productModule<Record<string, unknown>>(EDITIONS_MODULE);
    return {
      bootstrapUrl,
      tenantId,
      creator,
      outsider,
      seam,
      view: editions["projectRulesetView"] as Stage["view"],
    };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/* ------------------------------------------------------------------ reading the store raw */

/** Every row of a table for this tenant, whole, so a column no case named is still in hand. */
async function storedRows(table: string, where = "true"): Promise<Record<string, unknown>[]> {
  const { bootstrapUrl, tenantId } = await staged();
  const text = run(
    bootstrapUrl,
    `select replace(coalesce(json_agg(t)::text, '[]'), chr(10), ' ')
       from ${table} t where t.tenant_id = ${lit(tenantId)} and ${where};`,
  )[0]?.[0];
  return JSON.parse(text ?? "[]") as Record<string, unknown>[];
}

/** The stored project row carrying this id, found by the id's value rather than by a column name. */
async function storedProject(projectId: string): Promise<Record<string, unknown> | undefined> {
  return (await storedRows("projects")).find((row) => Object.values(row).includes(projectId));
}

interface Created {
  projectId: string;
  pin: { editionId: string; digest: string };
}

/** Create a project as the creator, through the seam's declared `createProject(ctx, draft)`. */
async function create(name: string, buildingType: string = BUILDING_TYPES[0]): Promise<Created> {
  const { seam, creator } = await staged();
  const createProject = seamFunction(seam, "createProject") as unknown as (ctx: unknown, draft: unknown) => Promise<Created>;
  return createProject(creator, { name, buildingType });
}

async function door(name: string): Promise<SeamFn> {
  return seamFunction((await staged()).seam, name);
}

/* ------------------------------------------------------------------ AC-2 */

describe("AC-2: createProject commits the project, its pin, the participant and the PRINCIPAL role in one transaction", () => {
  it("AC-2: the answer names the project and the edition it pinned, and the shipped read path agrees", async () => {
    const { tenantId, view } = await staged();
    const created = await create("AC-2 the creation transaction");

    expect(typeof created.projectId, "createProject answers with the id of the project it wrote").toBe("string");
    expect(typeof created.pin?.editionId, "createProject answers with the pin it made — { editionId, digest } (L-REG-07)").toBe("string");
    expect(typeof created.pin?.digest, "createProject answers with the pin's digest").toBe("string");

    const pinned = await view({ tenantId, projectId: created.projectId });
    expect(
      pinned["pinned"],
      `the settings/ruleset read path answers no pin for ${created.projectId} — L-REG-07 makes an unpinned project unrepresentable (R-SPINE-012)`,
    ).toBe(true);
    expect(pinned["digest"], "the digest the creation answered with is the digest the screen reads back").toBe(created.pin.digest);

    expect(await storedProject(created.projectId), "the project row is in the store the workspace reads").toBeTruthy();
  });

  it("AC-2: the creator is installed as a participant holding PRINCIPAL, with act_id null", async () => {
    const { creator } = await staged();
    const created = await create("AC-2 the creator becomes PRINCIPAL");

    const participants = await storedRows("participants", `t.project_id = ${lit(created.projectId)}`);
    expect(participants.map((row) => row["user_id"]), "L-ACT-03: project creation inserts its creator as a participant, in the same transaction").toStrictEqual([
      creator.userId,
    ]);

    const roles = await storedRows("participant_roles", `t.project_id = ${lit(created.projectId)}`);
    expect(roles.map((row) => row["role"]), "L-ACT-03: the creator is installed as PRINCIPAL").toStrictEqual([PRINCIPAL]);
    expect(
      roles[0]?.["act_id"],
      "the bootstrap grant carries no act: the schema's own comment says a project's first PRINCIPAL is installed by creation, which is not an act somebody performed",
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ AC-4 */

describe("AC-4: field edits, archive and restore go through the seam, behind L-ACT-03's lifecycle guard", () => {
  it("AC-4: a participant on the project may edit, archive and restore it", async () => {
    const { creator } = await staged();
    const created = await create("AC-4 the participant's own project");

    const fresh = (await storedProject(created.projectId)) ?? {};
    const marker = Object.keys(fresh).find((key) => ARCHIVED_MARKER.test(key)) ?? "";
    expect(marker, `the stored project carries no archived marker; its columns are ${Object.keys(fresh).join(", ")}`).not.toBe("");

    const edited = "AC-4 edited by its principal";
    await callDoor(await door("updateProject"), creator, created.projectId, { name: edited });
    expect(Object.values((await storedProject(created.projectId)) ?? {}), "an edit through updateProject reaches the store").toContain(edited);

    await callDoor(await door("archiveProject"), creator, created.projectId);
    const archived = (await storedProject(created.projectId)) ?? {};
    expect(archived[marker], `archiving moves ${marker}: a boolean set true, or the moment it was archived at`).not.toStrictEqual(fresh[marker]);

    await callDoor(await door("restoreProject"), creator, created.projectId);
    const restored = (await storedProject(created.projectId)) ?? {};
    expect(restored[marker], "restoring puts the marker back where archiving found it").toStrictEqual(fresh[marker]);
  });

  it("AC-4: archiving deletes nothing — the row, its participant, its role and its pin all stand", async () => {
    const { tenantId, view } = await staged();
    const created = await create("AC-4 archiving deletes nothing");
    const before = await view({ tenantId, projectId: created.projectId });

    await callDoor(await door("archiveProject"), (await staged()).creator, created.projectId);

    expect(await storedProject(created.projectId), "an archived project is still a project (AC-4: the marker flips, nothing is deleted)").toBeTruthy();
    expect((await storedRows("participants", `t.project_id = ${lit(created.projectId)}`)).length, "its participant stands").toBe(1);
    expect((await storedRows("participant_roles", `t.project_id = ${lit(created.projectId)}`)).length, "its PRINCIPAL grant stands").toBe(1);
    expect((await view({ tenantId, projectId: created.projectId }))["digest"], "its pin stands (L-REG-07)").toBe(before["digest"]);
  });

  it("AC-4: a signed-in member who is neither OWNER/ADMIN nor a participant is refused PERMISSION_NOT_HELD", async () => {
    const { outsider } = await staged();
    const created = await create("AC-4 the outsider's refusal");

    for (const name of ["updateProject", "archiveProject", "restoreProject"]) {
      const call = callDoor(await door(name), outsider, created.projectId, name === "updateProject" ? { name: "AC-4 not this one's to rename" } : {});
      const refusal = await refusalFrom(call, `${name} by a member who holds no participation on the project`);
      expect(refusal.refusalCode, `L-ACT-03 refuses lifecycle by a non-participant with the registered code`).toBe(PERMISSION_NOT_HELD);
    }
  });

  it("AC-4: projectsForHome answers the workspace's projects, covering every field R-SPINE-010 names", async () => {
    const { creator } = await staged();
    const created = await create("AC-4 what the home screen reads");

    const forHome = seamFunction((await staged()).seam, "projectsForHome") as (ctx: unknown) => Promise<unknown>;
    const row = rowFor(projectRows(await forHome(creator)), created.projectId);
    const keys = Object.keys(row);

    for (const { field, column } of RSPINE010_FIELDS) {
      const flattened = keys.map((key) => key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase());
      expect(
        flattened.some((key) => column.test(key)),
        `S-Home reads a project through projectsForHome, and R-SPINE-010's "${field}" is not among the keys it answers with: ${keys.join(", ")}`,
      ).toBe(true);
    }
  });
});
