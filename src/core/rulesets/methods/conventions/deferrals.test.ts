/**
 * A role no layer carries is deferred by name, never defaulted to a layer (L-CAD-08, L-QTY-04).
 *
 * Exercised here because Q-07's register admits a refusal code only where an EXECUTED test names it:
 * the deferral is the one code this method answers with, and the register is what makes naming it
 * an obligation rather than a nicety. The census below is data — the layer names mean nothing to the
 * resolver, and the drawing it stands for is simply one nobody dimensioned.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { CONVENTION_ROLES, resolve, type EntityCensus } from "./resolve";

/** A drawing of linework, outlines and notes that carries no dimension at all. */
const UNDIMENSIONED: EntityCensus = {
  layers: [
    { layer: "GRID", paths: 12, rings: 0, texts: 0, dimensions: 0 },
    { layer: "WALLS", paths: 1, rings: 9, texts: 0, dimensions: 0 },
    { layer: "NOTES", paths: 0, rings: 0, texts: 7, dimensions: 0 },
  ],
  grammars: [],
};

describe("L-CAD-08: a role the census does not resolve is deferred", () => {
  test("a role no layer carries is CONVENTION_ROLE_UNRESOLVED, and the role holds no layer", () => {
    const profile = resolve(UNDIMENSIONED);
    expect(profile.deferrals, "the role nothing was drawn for is deferred by the register's own code, and the roles the census resolved are not").toEqual([
      { code: REFUSALS.CONVENTION_ROLE_UNRESOLVED.code, role: "dimensions" },
    ]);
    expect(profile.roles.dimensions, "and no layer is defaulted into it — a defaulted convention is a reading nobody made (L-QTY-04)").toEqual([]);
    for (const role of CONVENTION_ROLES) {
      const deferred = profile.deferrals.some((deferral) => deferral.role === role);
      expect(deferred, `\`${role}\` is deferred exactly where no layer carries it`).toBe(profile.roles[role].length === 0);
    }
  });
});
