/**
 * Public acceptance for the identity/key grammar (L-REG-02, L-REG-04, L-REG-05): AC-1's key
 * composition, AC-4's canonical sort and content signature, AC-5's order-normalised semantic.
 *
 * The grammar is judged as rules, never as today's spelling. Not one case asserts what a key looks
 * like: the format is the Builder's to choose. What is asserted is what the law actually promises —
 * a key is a function of its named parts and of nothing else, two different identities never
 * compose to one key, coordinates reduce to the 0.1 step before they key, the sort is UTF-16 code
 * units, and the semantic is invariant under key order and sensitive to content.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { QUANTUM, REPO_ROOT, UNREGISTERED_PREFIX, codeUnitCompare, loadIdentity, loadRegister, sign, type Authored } from "./support/wire";

/* ------------------------------------------------------------------ *
 * AC-1: the four content-derived key builders, composed as the law writes them.
 * ------------------------------------------------------------------ */

describe("AC-1: keys compose through src/core/identity exactly as L-REG-04 writes them", () => {
  test("AC-1: every builder is a pure function of its named parts — same parts, same key, always", async () => {
    const identity = await loadIdentity();

    const view = { viewClass: "plan", captionAnchorSourceKey: "sheet-s101#caption-1" };
    const viewKey = identity.viewKey(view);
    expect(typeof viewKey, "viewKey answers a string key").toBe("string");
    expect(viewKey.length, "an empty key identifies nothing").toBeGreaterThan(0);
    expect(identity.viewKey({ ...view }), "viewKey of the same view class and caption anchor is the same key").toBe(viewKey);

    const placement = { viewKey, mark: "C1", x: 3.42, y: 7.85 };
    const placementKey = identity.placementKey(placement);
    expect(identity.placementKey({ ...placement }), "placementKey of the same view, mark and place is the same key").toBe(placementKey);

    const instance = { placementKey, levelSlot: "level-surrogate-1" };
    const instanceKey = identity.instanceRowKey(instance);
    expect(identity.instanceRowKey({ ...instance }), "instanceRowKey of the same placement and slot is the same key").toBe(instanceKey);

    const bar = { memberKey: instanceKey, role: "main", diameter: 16, sequence: 3 };
    const barKey = identity.barRowKey(bar);
    expect(typeof barKey, "barRowKey answers a string key").toBe("string");
    expect(identity.barRowKey({ ...bar }), "barRowKey of the same member, role, diameter and sequence is the same key").toBe(barKey);
  });

  test("AC-1: each named part is load-bearing — changing one part changes the key it composes", async () => {
    const identity = await loadIdentity();

    const view = { viewClass: "plan", captionAnchorSourceKey: "sheet-s101#caption-1" };
    const viewKey = identity.viewKey(view);
    expect(identity.viewKey({ ...view, viewClass: "section" }), "L-REG-04: view key = view class + caption-anchor source key — the view class keys").not.toBe(viewKey);
    expect(identity.viewKey({ ...view, captionAnchorSourceKey: "sheet-s101#caption-2" }), "L-REG-04: the caption-anchor source key keys").not.toBe(viewKey);

    const otherView = identity.viewKey({ ...view, viewClass: "section" });
    const placement = { viewKey, mark: "C1", x: 3.42, y: 7.85 };
    const placementKey = identity.placementKey(placement);
    expect(identity.placementKey({ ...placement, viewKey: otherView }), "L-REG-04: placement key = view key + mark + world coordinates — the view key keys").not.toBe(placementKey);
    expect(identity.placementKey({ ...placement, mark: "C2" }), "L-REG-04: the mark keys").not.toBe(placementKey);
    expect(identity.placementKey({ ...placement, x: 9.42 }), "L-REG-04: the world x keys").not.toBe(placementKey);
    expect(identity.placementKey({ ...placement, y: 9.85 }), "L-REG-04: the world y keys").not.toBe(placementKey);

    const instance = { placementKey, levelSlot: "level-surrogate-1" };
    const instanceKey = identity.instanceRowKey(instance);
    expect(identity.instanceRowKey({ ...instance, placementKey: identity.placementKey({ ...placement, mark: "C2" }) }), "L-REG-04: instance row key = placement key + level slot — the placement keys").not.toBe(instanceKey);
    expect(identity.instanceRowKey({ ...instance, levelSlot: "level-surrogate-2" }), "L-REG-04: the level surrogate id keys").not.toBe(instanceKey);

    const bar = { memberKey: instanceKey, role: "main", diameter: 16, sequence: 3 };
    const barKey = identity.barRowKey(bar);
    expect(identity.barRowKey({ ...bar, memberKey: `${instanceKey}x` }), "L-REG-04: bar row key = member key + role + diameter + sequence — the member keys").not.toBe(barKey);
    expect(identity.barRowKey({ ...bar, role: "link" }), "L-REG-04: the bar role keys").not.toBe(barKey);
    expect(identity.barRowKey({ ...bar, diameter: 20 }), "L-REG-04: the bar diameter keys").not.toBe(barKey);
    expect(identity.barRowKey({ ...bar, sequence: 4 }), "L-REG-04: the bar sequence keys").not.toBe(barKey);
  });

  test("AC-1: two different identities never compose to one key — the parts cannot bleed into each other", async () => {
    const identity = await loadIdentity();

    // A caption-anchor source key and a view class are both free text a drawing supplies. A key
    // that simply glues the two together reads the same string for two different views — and a
    // collision is a spurious DUPLICATE_IDENTITY at the door (L-REG-03) or a silently lost quantity.
    // Each pair below is one string split at a different point, so a bare join collides on every one.
    const separators = ["", ":", "|", "/", "#", "-", "@", "."];
    for (const separator of separators) {
      const left = identity.viewKey({ viewClass: `plan${separator}a`, captionAnchorSourceKey: "b" });
      const right = identity.viewKey({ viewClass: "plan", captionAnchorSourceKey: `a${separator}b` });
      expect(
        left,
        `viewKey must not collide across "${separator}": ("plan${separator}a", "b") and ("plan", "a${separator}b") are different views`,
      ).not.toBe(right);
    }
  });

  test("AC-1: world coordinates are quantised to 0.1 drawing unit before they key", async () => {
    const identity = await loadIdentity();
    const viewKey = identity.viewKey({ viewClass: "plan", captionAnchorSourceKey: "anchor" });
    const at = (x: number, y: number): string => identity.placementKey({ viewKey, mark: "C1", x, y });

    // Both of these fall inside the same 0.1 step whether the step is taken by flooring or by
    // rounding, so the case judges the quantisation and never the rounding rule chosen for it.
    expect(at(1.21, 4.02), `L-REG-04 quantises to ${QUANTUM} drawing unit: 1.21 and 1.24 are the same place`).toBe(at(1.24, 4.02));
    expect(at(1.21, 4.02), `${QUANTUM} apart in y is a different place`).not.toBe(at(1.21, 4.12));

    // One full step apart, in x and in y: distinct under either rounding rule.
    expect(at(1.21, 4.02), `${QUANTUM} apart in x is a different place`).not.toBe(at(1.31, 4.02));

    // Quantisation is not truncation to a coarser grid: a whole unit apart is still distinct.
    expect(at(1.21, 4.02), "a whole drawing unit apart is a different place").not.toBe(at(2.21, 4.02));
  });

  test("AC-1: the level slot is a surrogate id, a lawful null, or an unregistered label — never a level's own name", async () => {
    const identity = await loadIdentity();

    const slots = identity.levelSlot;
    expect(typeof slots.foundation, "levelSlot.foundation is the lawful-null slot for a foundation-level instance").toBe("string");
    expect(typeof slots.unresolved, "levelSlot.unresolved is the lawful-null slot for an instance whose level is not resolved").toBe("string");
    expect(slots.foundation, "the two lawful-null slots are different slots").not.toBe(slots.unresolved);

    const rendered = identity.unregisteredLevelSlot("2F");
    expect(rendered, `unregisteredLevelSlot renders \`${UNREGISTERED_PREFIX}<label>\` (L-REG-04)`).toBe(`${UNREGISTERED_PREFIX}2F`);
    expect(identity.unregisteredLevelSlot("Roof"), "a different label renders a different slot").toBe(`${UNREGISTERED_PREFIX}Roof`);

    const viewKey = identity.viewKey({ viewClass: "plan", captionAnchorSourceKey: "anchor" });
    const placementKey = identity.placementKey({ viewKey, mark: "C1", x: 1, y: 2 });
    const composed = [slots.foundation, slots.unresolved, rendered, "level-surrogate-1"].map((levelSlot) => identity.instanceRowKey({ placementKey, levelSlot }));
    expect(new Set(composed).size, "each of the four lawful slots gives the same placement a distinct instance row key").toBe(composed.length);
  });
});

/* ------------------------------------------------------------------ *
 * AC-4: compareCanonical and contentSignature (L-REG-02, L-REG-05).
 * ------------------------------------------------------------------ */

describe("AC-4: the canonical sort is UTF-16 code units, and the content signature reads authored inputs only", () => {
  test("AC-4: compareCanonical orders by code unit — \"Z\" before \"a\" — and agrees with the rule on every pair", async () => {
    const { compareCanonical } = await loadIdentity();

    expect(sign(compareCanonical("Z", "a")), 'L-REG-05 sorts by code units: "Z" (U+005A) sorts before "a" (U+0061)').toBe(-1);
    expect(sign(compareCanonical("a", "B")), 'by code units "a" (U+0061) sorts after "B" (U+0042) — a collator would say the opposite').toBe(1);
    expect(sign(compareCanonical("a", "a")), "a string compares equal to itself").toBe(0);

    // A roster wide enough that a collator and a code-unit comparator disagree in several places:
    // case, digits against letters, a combining form, a replacement character and an astral pair.
    const roster = [
      "",
      "A",
      "B",
      "Z",
      "a",
      "b",
      "z",
      "9",
      "10",
      "2",
      "C1",
      "C10",
      "C2",
      "co-op",
      "coop",
      String.fromCharCode(0x00c4),
      String.fromCharCode(0x0041, 0x0308),
      String.fromCharCode(0xfffd),
      String.fromCodePoint(0x1f600),
    ];
    for (const left of roster) {
      for (const right of roster) {
        expect(
          sign(compareCanonical(left, right)),
          `compareCanonical(${JSON.stringify(left)}, ${JSON.stringify(right)}) must answer the UTF-16 code-unit order (L-REG-05); localeCompare is a lint error`,
        ).toBe(sign(codeUnitCompare(left, right)));
      }
    }

    const sorted = [...roster].sort(compareCanonical);
    expect(sorted, "sorting a roster through compareCanonical is the code-unit sort").toEqual([...roster].sort(codeUnitCompare));
  });

  test("AC-4: contentSignature is a function of the authored inputs, each of them load-bearing and none confusable", async () => {
    const { contentSignature } = await loadIdentity();

    const authored: Authored = { mark: "C1", length: "3.000", breadth: "0.300", count: "1" };
    const signature = contentSignature(authored);
    expect(typeof signature, "contentSignature answers a string").toBe("string");
    expect(signature.length, "an empty signature orders nothing").toBeGreaterThan(0);
    expect(contentSignature({ ...authored }), "the same authored inputs sign the same").toBe(signature);

    for (const field of ["mark", "length", "breadth", "count"] as const) {
      const changed: Authored = { ...authored, [field]: `${authored[field]}9` };
      expect(contentSignature(changed), `L-REG-05 signs mark, length, breadth and count — ${field} is load-bearing`).not.toBe(signature);
    }

    // The fields must not run together: two different sets of authored inputs whose concatenation is
    // the same string are different content, and a signature that cannot tell them apart puts two
    // different rows at the same place in the family sort.
    expect(
      contentSignature({ mark: "C", length: "1", breadth: "23", count: "4" }),
      "authored fields must not be confusable by concatenation — (1, 23) and (12, 3) are different rows",
    ).not.toBe(contentSignature({ mark: "C", length: "12", breadth: "3", count: "4" }));
  });

  test("AC-4: the collator appears nowhere in the identity grammar or the register module", async () => {
    // The banned name is assembled rather than written out, so this file — which lives inside one of
    // the two directories it scans — cannot be its own finding, and so the scan cannot be made to
    // pass by a Builder deleting the acceptance instead of the call.
    // The two modules have to be there before "the collator is not called in them" says anything.
    await loadIdentity();
    await loadRegister();

    const banned = `locale${"Compare"}`;
    const homes = [join(REPO_ROOT, "src", "core", "identity"), join(REPO_ROOT, "src", "modules", "takeoff", "register")];
    const offenders: string[] = [];

    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        // Test scaffolding is not the product; a `__tests__` segment names it as plainly as a
        // `.test.` basename does (the Q-07 scan draws the same line).
        if (entry.name === "__tests__" || entry.name.includes(".test.")) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) && readFileSync(path, "utf8").includes(banned)) offenders.push(relative(REPO_ROOT, path));
      }
    };

    for (const home of homes) {
      expect(existsSync(home), `${relative(REPO_ROOT, home)} is missing from the checkout — the product does not provide it yet`).toBe(true);
      walk(home);
    }
    expect(offenders, `L-REG-05: rows sort by code units through compareCanonical; the collator is a lint error wherever it is called`).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * AC-5: the order-normalised semantic (L-REG-04).
 * ------------------------------------------------------------------ */

describe("AC-5: canonicalSemantic normalises order and answers to content", () => {
  test("AC-5: the same content with its object keys in a different order yields an identical semantic", async () => {
    const { canonicalSemantic } = await loadIdentity();

    const one = { mark: "C1", authored: { length: "3.000", breadth: "0.300" }, evidence: ["sheet-s101#dim-12"], attributes: { concreteGrade: "C30", cover: "40" } };
    const other = { evidence: ["sheet-s101#dim-12"], attributes: { cover: "40", concreteGrade: "C30" }, authored: { breadth: "0.300", length: "3.000" }, mark: "C1" };

    const semantic = canonicalSemantic(one);
    expect(typeof semantic, "canonicalSemantic answers a string").toBe("string");
    expect(semantic.length, "an empty semantic invalidates nothing").toBeGreaterThan(0);
    expect(canonicalSemantic(other), "L-REG-04: the semantic is order-normalised — key order is typography, not content").toBe(semantic);
    expect(canonicalSemantic(one), "the same value read twice signs the same").toBe(semantic);
  });

  test("AC-5: changed content changes the semantic, at every depth the row carries", async () => {
    const { canonicalSemantic } = await loadIdentity();

    const base = { mark: "C1", authored: { length: "3.000", breadth: "0.300" }, evidence: ["sheet-s101#dim-12"], attributes: { concreteGrade: "C30" } };
    const semantic = canonicalSemantic(base);

    expect(canonicalSemantic({ ...base, mark: "C2" }), "a changed top-level value changes the semantic").not.toBe(semantic);
    expect(canonicalSemantic({ ...base, authored: { length: "3.500", breadth: "0.300" } }), "a changed authored value changes the semantic").not.toBe(semantic);
    expect(canonicalSemantic({ ...base, attributes: { concreteGrade: "C35" } }), "L-REG-04: an attribute edit re-presents the row — the semantic must move").not.toBe(semantic);
    expect(canonicalSemantic({ ...base, evidence: ["sheet-s102#dim-4"] }), "L-REG-04: a moved evidence citation changes the semantic — cited source keys are part of it").not.toBe(semantic);
    expect(canonicalSemantic({ ...base, attributes: { concreteGrade: "C30", cover: "40" } }), "an added attribute changes the semantic").not.toBe(semantic);

    // A semantic that dropped a field would make two different rows look unchanged to each other.
    expect(canonicalSemantic({ mark: "C1" }), "a value missing a field is not the same content as one carrying it").not.toBe(semantic);
  });
});
