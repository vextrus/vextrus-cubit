/**
 * The register's door and its identity core, attacked (inc-208, breaker lane).
 *
 * Every case below reproduces a defect observed against the tree as it stands: the door is driven
 * through its published seam and the store is read back with the acceptance stage's own helpers, so
 * nothing here asserts an implementation detail — each case names a promise the increment makes and
 * shows an input that breaks it.
 *
 * Nothing here contradicts a passing acceptance criterion: AC-4's guard, AC-5's precedence ladder
 * and AC-1's quantisation examples all keep answering exactly what they answer today. These are the
 * edges beside them.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  COLUMN_C1,
  closeStage,
  identitySeam,
  registerSeam,
  rowsOf,
  sql,
  stageSetRevision,
  type IdentitySeam,
  type RegisterSeam,
  type StagedRevision,
} from "./support/register-stage";

const BUDGET_MS = 300_000;

interface Staged {
  register: RegisterSeam;
  mine: StagedRevision;
  theirs: StagedRevision;
}

let staging: Promise<Staged> | undefined;

/** Two pinned set revisions in two different workspaces — the ground a scope is attacked on. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const register = await registerSeam();
    const mine = await stageSetRevision("breaker-mine");
    const theirs = await stageSetRevision("breaker-theirs");
    return { register, mine, theirs };
  })());
}

let identity: Promise<IdentitySeam> | undefined;

function core(): Promise<IdentitySeam> {
  return (identity ??= identitySeam());
}

/** What a call did, whether it answered or threw — an attack reads both the same way. */
async function outcome<T>(run: () => Promise<T>): Promise<{ answered: T } | { threw: string }> {
  try {
    return { answered: await run() };
  } catch (error) {
    return { threw: error instanceof Error ? error.message : String(error) };
  }
}

afterAll(() => closeStage());

describe("the door's scope is never proved against the revision it names", () => {
  /**
   * L-REG-01, SEAM-TENANT. `registerSighting` takes the tenant, the project and the pinned set
   * revision from its caller and cross-checks none of them. A scope naming ANOTHER workspace's set
   * revision registers, and the row lands under the caller's tenant carrying a foreign revision id
   * — a cross-tenant reference the store then holds forever (the foreign key is `no action`).
   */
  test("a sighting scoped to another workspace's set revision does not register", async () => {
    const { register, mine, theirs } = await staged();
    const trespass = { tenantId: mine.person.tenantId, projectId: mine.projectId, setRevisionId: theirs.setRevisionId };

    const said = await outcome(() => register.registerSighting(trespass, { ...COLUMN_C1, mark: "TRESPASS" }));
    const landed = rowsOf("register_objects", mine.person.tenantId).filter((row) => row["set_revision_id"] === theirs.setRevisionId);

    expect(landed, `a scope naming another workspace's set revision (${theirs.setRevisionId}) wrote a register object into this workspace: ${JSON.stringify(said)}`).toEqual([]);
  }, BUDGET_MS);

  /**
   * L-REG-02 puts the project in the identity of a register object, and the door writes
   * `project_id` from whatever the caller passed. A scope naming this workspace's OTHER project
   * stamps that project onto scope belonging to the revision's project — every later "the objects
   * of project X" read is then wrong in both directions.
   */
  test("no register object disagrees with its set revision about the project it belongs to", async () => {
    const { register, mine, theirs } = await staged();
    // The two staged revisions share no project; the tenant is the attacker's own, so RLS is not
    // what is being tested here — only whether the door proves the pairing it is handed.
    const mismatched = { tenantId: mine.person.tenantId, projectId: theirs.projectId, setRevisionId: mine.setRevisionId };
    const said = await outcome(() => register.registerSighting(mismatched, { ...COLUMN_C1, mark: "WRONG-PROJECT" }));

    const disagreeing = sql(
      `select o.object_key, o.project_id, r.project_id
         from register_objects o
         join drawing_set_revisions r on r.set_revision_id = o.set_revision_id
        where o.tenant_id = '${mine.person.tenantId}'::uuid
          and (o.project_id <> r.project_id or o.tenant_id <> r.tenant_id);`,
    );

    expect(disagreeing, `a register object stands under a project its set revision does not belong to: ${JSON.stringify(said)}`).toEqual([]);
  }, BUDGET_MS);
});

describe("the door's readability guard and the canon's arithmetic read one grammar", () => {
  /**
   * L-REG-01, ARCH-03. `appendObservation` asks whether a value "reads as a number" with JavaScript's
   * own `Number()`, which trims whitespace, and then hands the untrimmed spelling to the canon's
   * exact decimals, which do not. So a transcription carrying a space or a newline — the ordinary
   * shape of a value read off a drawing — passes the guard and dies inside the arithmetic, escaping
   * the door as a decimal-library error rather than as a reading, a registered refusal, or the
   * door's own named answer.
   */
  test("a reading spelled with surrounding whitespace does not escape as a decimal-library error", async () => {
    const { register, mine } = await staged();
    const seeded = await register.registerSighting(mine.scope, { ...COLUMN_C1, mark: "WHITESPACE" });
    const objectKey = String(seeded["objectKey"]);

    const spellings = [" 10 ", "10 ", "\t10", "10\n"];
    const escaped: string[] = [];
    for (const [at, valueAsWritten] of spellings.entries()) {
      const said = await outcome(() =>
        register.appendObservation(mine.scope, {
          objectKey,
          attribute: `padded_${at}`,
          valueAsWritten,
          unitAsWritten: "ft",
          basis: "TRANSCRIBED",
          sourceKey: "S-101:t:12",
          precedence: 1,
          actId: null,
        }),
      );
      if ("threw" in said && said.threw.includes("DecimalError")) escaped.push(`${JSON.stringify(valueAsWritten)} → ${said.threw}`);
    }

    expect(escaped, "the door admitted a value its own arithmetic cannot read, and the decimal library's error escaped the seam").toEqual([]);
  }, BUDGET_MS);

  /**
   * ARCH-03, as this very module states it: a value outside a closed roster "says so at its call
   * site instead of reaching the store as a CHECK violation nobody registered". `precedence` is
   * closed by the store (`register_observations_precedence_not_negative`, and the column is an
   * integer), and the door passes it through unread — so a negative, a fractional and an oversized
   * precedence all arrive as a raw driver failure naming the INSERT.
   */
  test("a precedence the store's own CHECK forbids is answered by the door, not by the driver", async () => {
    const { register, mine } = await staged();
    const seeded = await register.registerSighting(mine.scope, { ...COLUMN_C1, mark: "PRECEDENCE" });
    const objectKey = String(seeded["objectKey"]);

    const leaked: string[] = [];
    for (const [at, precedence] of [-1, 1.5, 2 ** 40].entries()) {
      const said = await outcome(() =>
        register.appendObservation(mine.scope, {
          objectKey,
          attribute: `precedence_${at}`,
          valueAsWritten: "10",
          unitAsWritten: "ft",
          basis: "TRANSCRIBED",
          sourceKey: "S-101:t:12",
          precedence,
          actId: null,
        }),
      );
      if ("threw" in said && said.threw.includes("Failed query")) leaked.push(`${precedence} → ${said.threw.slice(0, 80)}`);
    }

    expect(leaked, "a precedence outside what the store accepts reached the store as a raw query failure").toEqual([]);
  }, BUDGET_MS);
});

describe("the store holds the level discipline its own constraint is named for", () => {
  /**
   * L-REG-04: a sighting whose level is not a level stands in a NAMED slot — `FOUNDATION` or
   * `UNRESOLVED` — rather than under a null, "so the key says which absence it is". The store's
   * `register_objects_level_stated_once` check is written `num_nonnulls(...) <= 1`, which states the
   * level at most once and therefore admits stating it no times at all: a register object with no
   * level, no slot and no placeholder.
   */
  test("a register object with no level, no slot and no placeholder is refused by the store", async () => {
    const { mine } = await staged();
    const objectKey = "breaker:no-level";

    const said = await outcome(async () =>
      sql(
        `insert into register_objects
           (tenant_id, set_revision_id, object_key, project_id, discipline, element_type, mark, view_key, placement_key, standing, semantic)
         values
           ('${mine.person.tenantId}'::uuid, '${mine.setRevisionId}'::uuid, '${objectKey}', '${mine.projectId}'::uuid,
            'STRUCTURAL', 'column', 'NOLEVEL', 'v:PLAN:S-101:t:12', 'v:PLAN:S-101:t:12|NOLEVEL|0.0,0.0', 'MEASURED', 'breaker');`,
      ),
    );

    const landed = rowsOf("register_objects", mine.person.tenantId).filter((row) => row["object_key"] === objectKey);
    expect(landed, `the store kept a register object standing on no level at all: ${JSON.stringify(said)}`).toEqual([]);
  }, BUDGET_MS);
});

describe("the identity core answers a lattice point or nothing", () => {
  /**
   * L-REG-04. `quantise` refuses a coordinate that is not finite, but takes the product `n × 10`
   * without asking whether THAT is finite, and spells the result with `String`. So a large finite
   * coordinate answers `"Infinity.NaN"` or `"1e+21.0"` — neither of which is a point of the 0.1
   * lattice, and the first of which two DIFFERENT coordinates share, collapsing two placements into
   * one identity that the double-count guard then refuses as a duplicate.
   */
  test("every coordinate quantises to a lattice point or refuses", async () => {
    const core_ = await core();
    const wild: string[] = [];
    const LATTICE = /^-?\d+\.\d$/;
    for (const n of [1e21, 1e308, -1e308, Number.MAX_VALUE]) {
      const said = await outcome(async () => core_.quantise(n));
      if ("answered" in said && !LATTICE.test(said.answered)) wild.push(`${n} → ${JSON.stringify(said.answered)}`);
    }
    expect(wild, "a finite coordinate quantised to something that is not a point of the 0.1 lattice").toEqual([]);

    const collided = await outcome(async () => [core_.quantise(1e308), core_.quantise(1.5e308)]);
    if ("answered" in collided) {
      expect(collided.answered[0], "two coordinates half the world apart quantised to one lattice point, so two placements derive one identity").not.toBe(collided.answered[1]);
    }
  }, BUDGET_MS);

  /**
   * L-REG-04: "changed [semantic] → the row re-presents for disposition". `canonicalSemantic` walks
   * anything whose `typeof` is `object` as a bag of its own enumerable keys, and a Date, a Map and a
   * Set have none — so every one of them spells `{}`. Two contents that say different things spell
   * one semantic, and a person's disposition of the OLD content is carried silently onto the new one,
   * which is the one thing the clause forbids.
   */
  test("two contents that say different things do not carry one disposition", async () => {
    const core_ = await core();
    const prior = { evidence: ["S-101:t:12"], sightedAt: new Date("2020-01-01T00:00:00.000Z") };
    const next = { evidence: ["S-101:t:12"], sightedAt: new Date("2030-06-30T00:00:00.000Z") };

    const said = await outcome(async () => ({
      prior: core_.canonicalSemantic(prior),
      next: core_.canonicalSemantic(next),
      carry: core_.dispositionsCarry(prior, next),
    }));

    // The core may read this content or refuse it; what it may not do is read it as the same content.
    if ("answered" in said) {
      expect(said.answered.carry, `two contents ten years apart spell one semantic (${said.answered.prior}), so a stale disposition carries`).toBe(false);
    }
  }, BUDGET_MS);
});
