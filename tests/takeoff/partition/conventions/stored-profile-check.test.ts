/**
 * AC-5(c) — what a stored convention profile is read back as, and which method wrote it.
 *
 * The stored profile is cast to `ConventionProfile` on the way out and its `rule_version` is never
 * compared with the method that reads it (debt-src-modules-11b7m5l): a row written by an older
 * reading of the method is handed to placement as if this method had written it, and a stored value
 * that is not a profile at all is only discovered when something dereferences it. So the row says
 * whether it is CURRENT, and the value is judged by the type's own predicate before it is trusted.
 *
 * Driven over a really recorded ingest partitioned by the shipped job — what is graded is what the
 * store answers with afterwards.
 */
import { afterAll, expect, test } from "vitest";
import {
  PRINCIPAL,
  closeStage,
  grantRole,
  openSheetsStage,
  productModule,
  sql,
  stagePerson,
  tempFixtureRoot,
  withFixtureRoot,
  type Person,
} from "../support/partition-stage";
import { RULE_ID, RULE_VERSION, resolveDoor, runConventionPartition, stageConventionIngest, type StagedConventionIngest } from "../support/conventions-stage";

/** How long a staged case may take: a database provisioned, a drawing ingested, a partition run. */
const BUDGET_MS = 600_000;

const STORE_MODULE = "src/modules/takeoff/partition/store.ts";
const RESOLVE_MODULE = "src/core/rulesets/methods/conventions/resolve.ts";

/** One stored reading, as the store answers with it once it judges what it read. */
type StoredConventions = { ingestId: string; ruleId: string; ruleVersion: string; current: boolean; profile: unknown; census: unknown };

interface Staged {
  person: Person;
  projectId: string;
  ingested: StagedConventionIngest;
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("stored-profile-check");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingested = await stageConventionIngest(person, projectId, { salt: 73, dimensioned: true }, "stored-profile-check");
    await withFixtureRoot(tempFixtureRoot("stored-profile-check"), async () => runConventionPartition(person, ingested, "stored-profile-check"));
    return { person, projectId, ingested };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The store's door onto a stored profile, or a loud absence naming what it owes. */
async function storedConventionsOf(): Promise<(tenantId: string, ingestId: string) => Promise<StoredConventions | null>> {
  const store = await productModule<Record<string, unknown>>(STORE_MODULE);
  expect(typeof store["storedConventionsOf"], `${STORE_MODULE} publishes storedConventionsOf`).toBe("function");
  return store["storedConventionsOf"] as (tenantId: string, ingestId: string) => Promise<StoredConventions | null>;
}

/** Set one column of the stored row to a value the store did not write. */
function rewriteStored(ingestId: string, column: string, value: string): void {
  sql(`update convention_profiles set ${column} = ${value} where ingest_id = '${ingestId}'::uuid;`);
}

test(
  "AC-5(c): the profile type carries its own predicate, and the resolver's answer satisfies it",
  async () => {
    const resolve = await resolveDoor();
    const module = await productModule<Record<string, unknown>>(RESOLVE_MODULE);
    expect(typeof module["isConventionProfile"], `${RESOLVE_MODULE} publishes isConventionProfile beside the type it judges (ARCH-02)`).toBe("function");
    const isConventionProfile = module["isConventionProfile"] as (value: unknown) => boolean;

    const profile = resolve.resolve({ layers: [], grammars: [] });

    expect(isConventionProfile(profile), "what the method answers is what the predicate admits — one shape, one judgement").toBe(true);
    expect(isConventionProfile({ roles: "nonsense" }), "a value shaped like nothing the method ever answered is not a profile").toBe(false);
    expect(isConventionProfile(null), "nothing is not a profile").toBe(false);
  },
  BUDGET_MS,
);

test(
  "AC-5(c): a row written by the method that reads it stands as current",
  async () => {
    const stage = await staged();
    const stored = await (await storedConventionsOf())(stage.person.tenantId, stage.ingested.ingestId);

    expect(stored, "the rebuilt partition left a profile for its ingest").not.toBeNull();
    expect(stored?.ruleId, "the row names the method that wrote it").toBe(RULE_ID);
    expect(stored?.ruleVersion, "at the version that wrote it").toBe(RULE_VERSION);
    expect(stored?.current, "written by this method at this version — the reader may take it as its own").toBe(true);
  },
  BUDGET_MS,
);

test(
  "AC-5(c): a row an older version of the method wrote is not current",
  async () => {
    const stage = await staged();
    const read = await storedConventionsOf();

    rewriteStored(stage.ingested.ingestId, "rule_version", `'${RULE_VERSION}-earlier'`);
    try {
      const stored = await read(stage.person.tenantId, stage.ingested.ingestId);
      expect(stored?.current, "a reading taken by another version of the method is a record, not this method's answer").toBe(false);
    } finally {
      rewriteStored(stage.ingested.ingestId, "rule_version", `'${RULE_VERSION}'`);
    }
  },
  BUDGET_MS,
);

test(
  "AC-5(c): a stored value that is no profile is refused by name, not cast",
  async () => {
    const stage = await staged();
    const read = await storedConventionsOf();

    rewriteStored(stage.ingested.ingestId, "profile", `'{"roles":"nonsense"}'::json`);

    await expect(
      read(stage.person.tenantId, stage.ingested.ingestId),
      "the row is judged where it is read, and the failure names the ingest whose row it is",
    ).rejects.toThrow(stage.ingested.ingestId);
  },
  BUDGET_MS,
);
