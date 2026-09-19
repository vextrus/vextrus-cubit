/**
 * PUBLIC ACCEPTANCE — AC-1 (inc-304b-site-facts-panel): AUTHOR_SITE_FACT is minted as L-ACT-02's
 * pair and enters under the EXISTING AUTHOR_PROJECT_FACT permission.
 *
 * Nothing here opens a database: every claim is about the law's own values and about the guard the
 * seam answers with before it reads anything (SEAM-ACT, the unit lane's rule).
 *
 * WHAT IS DERIVED AND WHAT IS PINNED (B-19). The act-type enum grows increment by increment, so it
 * is asserted to CONTAIN this increment's member and is otherwise the denominator of every
 * derivation below — a later act type passes this file unchanged. The permission enum is the other
 * kind: L-ACT-03 calls it closed and this increment's goal is that it did not move, so the claim is
 * stated as a derivation over the bundles rather than as a transcription of the list — every
 * permission is bundled by some shipped role, every act's permission is a member of it, no member
 * spells SITE, and the roles that hold AUTHOR_PROJECT_FACT are exactly the two that held it before.
 *
 * The seam's barrel and the new rendering are loaded by ABSOLUTE PATH, the idiom
 * `src/core/acts/__tests__/act-map.acceptance.test.ts` already uses: a module the product does not
 * provide yet fails as an assertion naming the file, never as a resolution error that kills
 * collection.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ACT_PERMISSION, ACT_TYPES, PERMISSIONS, ROLES, ROLE_PERMISSIONS } from "../../../src/core/acts/law";
import { TRANSPORT_VOCABULARY } from "../../../src/core/errors/transport-vocabulary";
import { refusalCodeOf } from "../../../src/core/faults/refusal-marker";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The two modules this increment adds to the seam, by the paths the spec names. */
const ACTS_BARREL = "src/core/acts/index.ts";
const AUTHOR_SITE_FACT_MODULE = "src/core/acts/author-site-fact.ts";

/** The act this increment mints, and the permission L-ACT-03 already cuts for project facts. */
const AUTHOR_SITE_FACT = "AUTHOR_SITE_FACT";
const AUTHOR_PROJECT_FACT = "AUTHOR_PROJECT_FACT";

/** The roles L-ACT-03 bundles AUTHOR_PROJECT_FACT into today — MEASURER, and PRINCIPAL by holding all. */
const FACT_AUTHORS = ["MEASURER", "PRINCIPAL"];

/** Load a module of the product by path, so a file the Builder has not written names itself here. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing — the act this increment mints has no rendering yet`).toBe(true);
  return (await import(absolute)) as T;
}

/** A record read by a key the compiler does not yet know is a member — the enum is the product's. */
const byName = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

describe("AC-1: the act type, and the permission it enters under (L-ACT-02, L-ACT-03, AM-06 §1)", () => {
  test("AC-1: ACT_TYPES carries AUTHOR_SITE_FACT and ACT_PERMISSION cuts it on AUTHOR_PROJECT_FACT", () => {
    expect(ACT_TYPES as readonly string[], "the act type the panel performs belongs to the closed enum").toContain(AUTHOR_SITE_FACT);
    expect(byName(ACT_PERMISSION)[AUTHOR_SITE_FACT], "AM-06 §1: the act enters under the EXISTING permission, and mints none").toBe(AUTHOR_PROJECT_FACT);
  });

  test("AC-1: PERMISSIONS is the closed set it already held — no new member, and none named SITE", () => {
    const bundled = new Set<string>();
    for (const role of ROLES) for (const permission of ROLE_PERMISSIONS[role]) bundled.add(permission);

    expect([...bundled].sort(), "every permission a shipped role bundles is a member of the enum, and every member is bundled by some role").toEqual(
      [...PERMISSIONS].sort(),
    );
    expect(
      (PERMISSIONS as readonly string[]).filter((permission) => permission.includes("SITE")),
      "a site fact is a project fact: the enum gains no member of its own for it (AM-06 §1)",
    ).toEqual([]);

    const cut = new Set(Object.values(ACT_PERMISSION as Readonly<Record<string, string>>));
    expect(
      [...cut].filter((permission) => !(PERMISSIONS as readonly string[]).includes(permission)),
      "every act moves a permission the closed enum declares",
    ).toEqual([]);
  });

  test("AC-1: ROLE_PERMISSIONS did not move — AUTHOR_PROJECT_FACT is held by exactly MEASURER and PRINCIPAL", () => {
    const holders = ROLES.filter((role) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(AUTHOR_PROJECT_FACT));
    expect([...holders].sort(), "the bundles this increment inherits are the bundles it leaves behind (L-ACT-03)").toEqual([...FACT_AUTHORS].sort());
  });

  test("AC-1: ACT_MAP carries AUTHOR_SITE_FACT: authorSiteFact — the pair L-ACT-02 makes total", async () => {
    const barrel = await productModule<{ ACT_MAP: unknown }>(ACTS_BARREL);
    const rendering = byName(byName(barrel).ACT_MAP)[AUTHOR_SITE_FACT];
    expect(rendering, "a type without a rendering is no act at all (L-ACT-02)").toBeDefined();

    const authored = await productModule<{ authorSiteFact: unknown }>(AUTHOR_SITE_FACT_MODULE);
    expect(rendering, "the map carries the rendering this increment ships, not a second one beside it (B-17)").toBe(byName(authored).authorSiteFact);
    expect(typeof byName(rendering).preview, "the rendering is a pair: preview(input) → Consequence").toBe("function");
    expect(typeof byName(rendering).commit, "…and commit(input, consequenceDigest)").toBe("function");
  });

  test("AC-1: `preview` dispatches an input of type AUTHOR_SITE_FACT to it, before any state is read", async () => {
    const barrel = await productModule<{ preview: (ctx: unknown, input: unknown) => Promise<unknown> }>(ACTS_BARREL);

    // A machine actor is turned away BY TYPE (L-ACT-01, SEAM-ACT) — which is the one probe of the
    // dispatch that opens no database: the seam has to recognise the act type before it can name it
    // in that refusal, so an input this map does not carry fails here as something else entirely.
    const thrown: unknown = await barrel
      .preview({ tenantId: "00000000-0000-4000-8000-0000000000ff", userId: "00000000-0000-4000-8000-000000000003", actorKind: "machine" }, {
        type: AUTHOR_SITE_FACT,
        projectId: "00000000-0000-4000-8000-000000000001",
        fact: "GROUND_LEVEL",
        valueAsWritten: "-1.2",
        unitAsWritten: "m",
        sourceNote: "Survey sheet S-01",
      })
      .then(
        () => undefined,
        (error: unknown) => error,
      );

    expect(refusalCodeOf(thrown), "the seam answers the act by name, so the type reached its rendering").toBe("ACTOR_NOT_HUMAN");
    expect(byName(thrown)["actType"], "…and the refusal names the act that was attempted").toBe(AUTHOR_SITE_FACT);
  });

  test("AC-1: the transport vocabulary's ACT_TYPES-derived line carries it with no edit", () => {
    const declared = TRANSPORT_VOCABULARY.filter((entry) => (ACT_TYPES as readonly string[]).every((type) => entry.codes.includes(type)));
    expect(declared.length, "one declaration covers the act-type enum (its home is acts/law.ts, and it is READ from there)").toBe(1);
    expect(
      [...(declared[0]?.codes ?? [])].sort(),
      "the line is derived from the enum, so an act type minted today is declared with no edit (B-19)",
    ).toEqual([...ACT_TYPES].sort());
    expect(declared[0]?.codes as readonly string[], "…and this increment's act type is among the names that declaration covers").toContain(AUTHOR_SITE_FACT);
  });
});
