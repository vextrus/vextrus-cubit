/**
 * Public acceptance for the Quantity Register's pure derivation (L-REG-02, L-REG-04, L-REG-05):
 * AC-1's reproducible key multisets, AC-4's ordinal freeze, AC-5's invalidating semantic.
 *
 * Everything here is derivation, so nothing here touches a database — the door is judged live in
 * `db/__tests__/register-door.live.test.ts`. The support module these cases share lives with the
 * identity grammar they are built on (`src/core/identity/__tests__/support/wire.ts`): one loader,
 * one set of declared shapes, one place a shape-tolerant reader is written (ARCH-02).
 *
 * B-19: no case transcribes a key or an ordering. Expected keys are re-composed from the tree's own
 * key builders and expected orderings re-derived from its own contentSignature and compareCanonical,
 * so a Builder who spells a key differently is judged by the same rule as one who spells it this way.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../../../core/errors";
import {
  CARRIED,
  DUPLICATE_IDENTITY,
  RE_PRESENTS,
  asLookup,
  codeUnitCompare,
  composedRowKey,
  entriesOf,
  keyOf,
  laterMoment,
  loadIdentity,
  loadRegister,
  multiset,
  sightingOf,
  tagOf,
  type IdentityModule,
  type RegisterRow,
  type Sighting,
} from "../../../../core/identity/__tests__/support/wire";

/** A family of sightings that differ in the ways identity cares about. */
function scene(): Sighting[] {
  return [
    sightingOf({ mark: "C1", x: 1.21, y: 4.02, authored: { length: "3.000", breadth: "0.300", count: "1" } }),
    sightingOf({ mark: "C1", x: 5.61, y: 4.02, authored: { length: "3.000", breadth: "0.450", count: "1" } }),
    sightingOf({ mark: "C2", x: 9.11, y: 4.02, captionAnchorSourceKey: "sheet-s102#caption-3" }),
    sightingOf({ mark: "B1", x: 1.21, y: 8.44, viewClass: "section", elementType: "beam" }),
  ];
}

const keysOf = (rows: readonly RegisterRow[]): string[] => rows.map((row) => row.rowKey);

/** Every derived row, checked for the four things the contract says a RegisterRow carries. */
function wellFormed(rows: unknown, what: string): RegisterRow[] {
  expect(Array.isArray(rows), `${what} must answer an array of RegisterRow`).toBe(true);
  const list = rows as RegisterRow[];
  for (const row of list) {
    expect(typeof row?.rowKey, `${what}: every row carries a string rowKey`).toBe("string");
    expect(typeof row?.mark, `${what}: every row carries its mark`).toBe("string");
    expect(typeof row?.semantic, `${what}: every row carries a semantic (L-REG-04)`).toBe("string");
    expect(row?.sighting, `${what}: every row carries the sighting it was derived from`).toBeTypeOf("object");
  }
  return list;
}

/* ------------------------------------------------------------------ *
 * AC-1: content-derived keys, reproducible multisets.
 * ------------------------------------------------------------------ */

describe("AC-1: deriveRegisterRows reproduces an identical key multiset, with zero minted ids", () => {
  test("AC-1: two invocations at different wall-clock moments yield byte-identical key multisets", async () => {
    const { deriveRegisterRows } = await loadRegister();

    const first = wellFormed(deriveRegisterRows(scene()), "deriveRegisterRows");
    expect(first.length, "the derivation must answer one row per sighting").toBe(scene().length);

    await laterMoment();
    const second = wellFormed(deriveRegisterRows(scene()), "deriveRegisterRows, re-run");

    expect(multiset(keysOf(second)), "L-REG-04: an identical re-derivation reproduces the identical key multiset — no UUID, sequence or timestamp may enter a key").toEqual(multiset(keysOf(first)));
  });

  test("AC-1: a key is a function of its sighting alone — position in the batch and batch size do not enter it", async () => {
    const { deriveRegisterRows } = await loadRegister();
    const sightings = scene();
    const target = sightings[1];
    expect(target, "the scene must carry the sighting this case moves").toBeDefined();
    if (target === undefined) return;

    const inBatch = wellFormed(deriveRegisterRows(sightings), "deriveRegisterRows over the whole batch");
    const alone = wellFormed(deriveRegisterRows([target]), "deriveRegisterRows over one sighting");
    const reversed = wellFormed(deriveRegisterRows([...sightings].reverse()), "deriveRegisterRows over the reversed batch");

    const inBatchKey = inBatch[1]?.rowKey;
    expect(alone[0]?.rowKey, "L-REG-04 mints no sequence numbers: the same sighting keys the same alone as it does in a batch").toBe(inBatchKey);
    expect(multiset(keysOf(reversed)), "the multiset does not depend on the order the sightings arrive in").toEqual(multiset(keysOf(inBatch)));
  });

  test("AC-1: no key carries a minted id — nothing UUID-shaped appears that the input did not supply", async () => {
    const { deriveRegisterRows } = await loadRegister();
    const sightings = scene();
    const rows = wellFormed(deriveRegisterRows(sightings), "deriveRegisterRows");
    const supplied = JSON.stringify(sightings);
    const uuidShape = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

    for (const row of rows) {
      for (const minted of row.rowKey.match(uuidShape) ?? []) {
        expect(supplied.includes(minted), `L-REG-04: zero minted ids — the key ${row.rowKey} carries a UUID the sighting never supplied`).toBe(true);
      }
      expect(row.rowKey.length, "an empty key identifies nothing").toBeGreaterThan(0);
    }
    expect(new Set(keysOf(rows)).size, "four different identities derive four different keys").toBe(rows.length);
  });

  test("AC-1: each row key is exactly instanceRowKey(placementKey(viewKey(...)), level slot)", async () => {
    const identity = await loadIdentity();
    const { deriveRegisterRows } = await loadRegister();
    const sightings = scene();
    const rows = wellFormed(deriveRegisterRows(sightings), "deriveRegisterRows");

    for (const [index, sighting] of sightings.entries()) {
      expect(
        rows[index]?.rowKey,
        `L-REG-04 composes the instance row key as instanceRowKey(placementKey(viewKey(view class, caption anchor), mark, x, y), level slot) — the derivation must use the same grammar for sighting ${index}`,
      ).toBe(composedRowKey(identity, sighting));
      expect(rows[index]?.mark, "the derived row carries the sighting's mark").toBe(sighting.mark);
    }
  });

  test("AC-1: a level slot rendered by unregisteredLevelSlot keys through the same grammar every slot does", async () => {
    const identity = await loadIdentity();
    const { deriveRegisterRows } = await loadRegister();

    const slots = [identity.levelSlot.foundation, identity.levelSlot.unresolved, identity.unregisteredLevelSlot("2F"), "level-surrogate-9"];
    const sightings = slots.map((levelSlot) => sightingOf({ levelSlot }));
    const rows = wellFormed(deriveRegisterRows(sightings), "deriveRegisterRows over the four lawful slots");

    for (const [index, sighting] of sightings.entries()) {
      expect(rows[index]?.rowKey, `the level slot ${sighting.levelSlot} keys through instanceRowKey like any other slot`).toBe(composedRowKey(identity, sighting));
    }
    expect(new Set(keysOf(rows)).size, "L-REG-04's four lawful slots are four distinct identities for one placement").toBe(slots.length);
  });
});

/* ------------------------------------------------------------------ *
 * AC-4: ordinals sort by content signature and freeze at first registration.
 * ------------------------------------------------------------------ */

/** The order L-REG-05 puts a family in: by content signature, tie-broken by row key, code units. */
function lawfulOrder(identity: IdentityModule, rows: readonly RegisterRow[]): RegisterRow[] {
  return [...rows].sort((left, right) => {
    const authored = (row: RegisterRow) => ({ mark: row.sighting.mark, ...row.sighting.authored });
    const bySignature = identity.compareCanonical(identity.contentSignature(authored(left)), identity.contentSignature(authored(right)));
    return bySignature !== 0 ? bySignature : identity.compareCanonical(left.rowKey, right.rowKey);
  });
}

describe("AC-4: ordinal keys sort by authored content and freeze at first registration", () => {
  test("AC-4: a mark family is keyed mark#i in content-signature order, correctable attributes excluded", async () => {
    const identity = await loadIdentity();
    const { deriveRegisterRows, assignOrdinals } = await loadRegister();

    // One family, four members whose authored content differs, deliberately supplied out of order.
    const family = ["0.450", "0.300", "0.600", "0.375"].map((breadth, index) =>
      sightingOf({ mark: "C1", x: 1.21 + index, authored: { length: "3.000", breadth, count: "1" }, attributes: { concreteGrade: "C30" } }),
    );
    const rows = wellFormed(deriveRegisterRows(family), "deriveRegisterRows");
    const ordinals = asLookup(assignOrdinals(rows), "assignOrdinals");

    const expected = lawfulOrder(identity, rows);
    for (const [index, row] of expected.entries()) {
      expect(
        ordinals.get(row.rowKey),
        `L-REG-05 sorts a mark family by the content signature of its authored inputs under compareCanonical and keys it mark#i — row ${index + 1} of the family`,
      ).toBe(`C1#${index + 1}`);
    }
    expect(new Set(ordinals.values()).size, "no two members of a family share an ordinal key").toBe(family.length);
  });

  test("AC-4: a singleton keeps the bare mark, and members of different marks are different families", async () => {
    const { deriveRegisterRows, assignOrdinals } = await loadRegister();

    const rows = wellFormed(deriveRegisterRows([sightingOf({ mark: "C7", x: 1.21 }), sightingOf({ mark: "B3", x: 5.61 })]), "deriveRegisterRows");
    const ordinals = asLookup(assignOrdinals(rows), "assignOrdinals");

    expect(ordinals.get(rows[0]?.rowKey ?? ""), "L-REG-05: a singleton keeps the bare mark").toBe("C7");
    expect(ordinals.get(rows[1]?.rowKey ?? ""), "a different mark is a different family, and its singleton keeps its bare mark too").toBe("B3");
  });

  test("AC-4: ties in the content signature break by row key, in code-unit order", async () => {
    const identity = await loadIdentity();
    const { deriveRegisterRows, assignOrdinals } = await loadRegister();

    // Identical authored content, different placements: the signature ties, so only the row key can
    // order them — and L-REG-02 excludes correctable attributes from identity, so the differing
    // attributes below must not enter the sort either.
    const tied = [
      sightingOf({ mark: "C1", x: 7.31, attributes: { concreteGrade: "C35" } }),
      sightingOf({ mark: "C1", x: 1.21, attributes: { concreteGrade: "C25" } }),
      sightingOf({ mark: "C1", x: 4.51, attributes: { concreteGrade: "C30" } }),
    ];
    const rows = wellFormed(deriveRegisterRows(tied), "deriveRegisterRows");
    const signatures = new Set(rows.map((row) => identity.contentSignature({ mark: row.sighting.mark, ...row.sighting.authored })));
    expect(signatures.size, "the scene is built so the three rows' authored content signatures tie — correctable attributes are excluded from the signature").toBe(1);

    const ordinals = asLookup(assignOrdinals(rows), "assignOrdinals");
    const byRowKey = [...rows].sort((left, right) => codeUnitCompare(left.rowKey, right.rowKey));
    for (const [index, row] of byRowKey.entries()) {
      expect(ordinals.get(row.rowKey), "L-REG-05 breaks a signature tie by row id — the content-derived row key, in code-unit order").toBe(`C1#${index + 1}`);
    }
  });

  test("AC-4: a correctable attribute edit moves no ordinal key", async () => {
    const { deriveRegisterRows, assignOrdinals } = await loadRegister();

    const family = ["0.450", "0.300", "0.600"].map((breadth, index) =>
      sightingOf({ mark: "C1", x: 1.21 + index, authored: { length: "3.000", breadth, count: "1" }, attributes: { concreteGrade: "C30", cover: "40" } }),
    );
    const before = asLookup(assignOrdinals(wellFormed(deriveRegisterRows(family), "deriveRegisterRows")), "assignOrdinals");

    const corrected = family.map((sighting) => ({ ...sighting, attributes: { concreteGrade: "C45", cover: "50", rebarSpec: "B500B" } }));
    const correctedRows = wellFormed(deriveRegisterRows(corrected), "deriveRegisterRows after a correction");
    const after = asLookup(assignOrdinals(correctedRows, before), "assignOrdinals with the frozen keys");

    expect([...after.entries()].sort(), "L-REG-02: storey height, concrete grade and rebar spec are correctable attributes — they participate in diffs, never in identity or the ordinal").toEqual([...before.entries()].sort());
  });

  test("AC-4: a member arriving later takes the next unfrozen ordinal, beside a frozen bare-mark singleton", async () => {
    const { deriveRegisterRows, assignOrdinals } = await loadRegister();

    // The first registration: one member, keyed bare.
    const firstSighting = sightingOf({ mark: "C1", x: 5.61, authored: { length: "3.000", breadth: "0.600", count: "1" } });
    const firstRows = wellFormed(deriveRegisterRows([firstSighting]), "deriveRegisterRows");
    const frozen = assignOrdinals(firstRows);
    const frozenKeys = asLookup(frozen, "assignOrdinals at first registration");
    const firstKey = firstRows[0]?.rowKey ?? "";
    expect(frozenKeys.get(firstKey), "the first registration keys the singleton bare").toBe("C1");

    // A sibling arrives. Whichever way the two sort against each other, the frozen member keeps the
    // BARE mark — an unfrozen re-sort would give it "C1#1" or "C1#2", never "C1" (L-REG-02).
    const siblingSighting = sightingOf({ mark: "C1", x: 1.21, authored: { length: "3.000", breadth: "0.300", count: "1" } });
    const bothRows = wellFormed(deriveRegisterRows([firstSighting, siblingSighting]), "deriveRegisterRows over the widened family");

    const widened = asLookup(assignOrdinals(bothRows, frozen), "assignOrdinals with the frozen keys");
    const siblingKey = bothRows.find((row) => row.rowKey !== firstKey)?.rowKey ?? "";
    expect(widened.get(firstKey), "L-REG-02: the ordinal is frozen at first registration — a frozen bare-mark singleton keeps its bare key when a sibling arrives").toBe("C1");
    expect(widened.get(siblingKey), "a member added later takes the next unfrozen ordinal").toBe("C1#2");

    // And a third arrival takes #3, still moving nothing already frozen.
    const thirdSighting = sightingOf({ mark: "C1", x: 9.11, authored: { length: "3.000", breadth: "0.375", count: "1" } });
    const threeRows = wellFormed(deriveRegisterRows([firstSighting, siblingSighting, thirdSighting]), "deriveRegisterRows over three");
    const settled = asLookup(assignOrdinals(threeRows, widened), "assignOrdinals with two frozen keys");
    const thirdKey = threeRows.find((row) => row.rowKey !== firstKey && row.rowKey !== siblingKey)?.rowKey ?? "";
    expect(settled.get(firstKey), "no frozen key ever changes").toBe("C1");
    expect(settled.get(siblingKey), "no frozen key ever changes").toBe("C1#2");
    expect(settled.get(thirdKey), "the third member takes the next unfrozen ordinal").toBe("C1#3");
  });
});

/* ------------------------------------------------------------------ *
 * AC-5: the semantic invalidates, never keys.
 * ------------------------------------------------------------------ */

describe("AC-5: every row carries an order-normalised semantic that invalidates without keying", () => {
  test("AC-5: the semantic is canonicalSemantic over content including the cited evidence source keys", async () => {
    const identity = await loadIdentity();
    const { deriveRegisterRows } = await loadRegister();

    const sighting = sightingOf({ evidence: ["sheet-s101#dim-12", "sheet-s101#note-3"] });
    const rows = wellFormed(deriveRegisterRows([sighting]), "deriveRegisterRows");
    const semantic = rows[0]?.semantic ?? "";

    let parsed: unknown;
    expect(() => {
      parsed = JSON.parse(semantic) as unknown;
    }, "L-REG-04: the semantic is canonical JSON of the row's content").not.toThrow();
    expect(semantic, "the semantic is what canonicalSemantic answers for that content, so re-canonicalising it changes nothing").toBe(identity.canonicalSemantic(parsed));

    for (const cited of sighting.evidence) {
      expect(semantic.includes(cited), `L-REG-04: the semantic is canonical JSON of the row's content INCLUDING its cited evidence source keys — ${cited} is missing`).toBe(true);
    }
  });

  test("AC-5: object key order is typography — the same content in any order derives one semantic and one key", async () => {
    const { deriveRegisterRows } = await loadRegister();

    const one = sightingOf({ attributes: { concreteGrade: "C30", cover: "40" } });
    // Exactly the same content, written with its keys in a different order at both depths.
    const other: Sighting = {
      evidence: [...one.evidence],
      attributes: { cover: "40", concreteGrade: "C30" },
      authored: { count: one.authored.count, breadth: one.authored.breadth, length: one.authored.length },
      levelSlot: one.levelSlot,
      y: one.y,
      x: one.x,
      captionAnchorSourceKey: one.captionAnchorSourceKey,
      viewClass: one.viewClass,
      mark: one.mark,
      elementType: one.elementType,
      discipline: one.discipline,
      setRevisionKey: one.setRevisionKey,
    };

    const [left] = wellFormed(deriveRegisterRows([one]), "deriveRegisterRows");
    const [right] = wellFormed(deriveRegisterRows([other]), "deriveRegisterRows over the same content, keys reordered");
    expect(right?.semantic, "L-REG-04: the semantic is order-normalised").toBe(left?.semantic);
    expect(right?.rowKey, "the same content keys the same however it is written").toBe(left?.rowKey);
  });

  test("AC-5: changed content changes the semantic and leaves the key alone", async () => {
    const { deriveRegisterRows } = await loadRegister();

    const base = sightingOf({ attributes: { concreteGrade: "C30" }, evidence: ["sheet-s101#dim-12"] });
    const [original] = wellFormed(deriveRegisterRows([base]), "deriveRegisterRows");

    const edited = { ...base, attributes: { concreteGrade: "C45" } };
    const [afterEdit] = wellFormed(deriveRegisterRows([edited]), "deriveRegisterRows after a correctable-attribute edit");
    expect(afterEdit?.rowKey, "L-REG-02: a correctable attribute never enters identity — the key must not move").toBe(original?.rowKey);
    expect(afterEdit?.semantic, "L-REG-04: a changed row re-presents for disposition — the semantic must move").not.toBe(original?.semantic);

    const resheeted = { ...base, evidence: ["sheet-s102#dim-4"] };
    const [afterMove] = wellFormed(deriveRegisterRows([resheeted]), "deriveRegisterRows after the cited evidence moved");
    expect(afterMove?.rowKey, "L-REG-05: a re-sheeted member keeps identity — the key must not move").toBe(original?.rowKey);
    expect(afterMove?.semantic, "L-REG-05: it re-presents because its cited evidence moved — the semantic must move").not.toBe(original?.semantic);
  });

  test("AC-5: reconcileRows carries a key-matched row whose semantic is unchanged and re-presents one whose semantic moved", async () => {
    const { deriveRegisterRows, reconcileRows } = await loadRegister();

    const sightings = scene();
    const prior = wellFormed(deriveRegisterRows(sightings), "deriveRegisterRows");

    const unchanged = wellFormed(deriveRegisterRows(sightings.map((sighting) => ({ ...sighting }))), "deriveRegisterRows, rebuilt from unchanged content");
    const known = new Set([...keysOf(prior), ...keysOf(unchanged)]);
    const carried = entriesOf(reconcileRows(prior, unchanged), "reconcileRows over an unchanged rebuild");
    expect(carried.length, "reconciliation answers for every key-matched row").toBe(prior.length);
    for (const entry of carried) {
      expect(tagOf(entry, "an unchanged row's reconciliation entry"), `L-REG-04: unchanged semantic → human dispositions carry across a rebuild, so the entry is tagged "${CARRIED}"`).toBe(CARRIED);
      expect(known.has(keyOf(entry, known, "an unchanged row's reconciliation entry")), "reconciliation never emits a changed key for an unchanged identity").toBe(true);
    }

    const moved = sightings.map((sighting) => ({ ...sighting, attributes: { ...sighting.attributes, cover: "55" } }));
    const next = wellFormed(deriveRegisterRows(moved), "deriveRegisterRows after an attribute edit");
    expect(multiset(keysOf(next)), "an attribute edit changes no identity, so the key multiset is unchanged").toEqual(multiset(keysOf(prior)));

    const represented = entriesOf(reconcileRows(prior, next), "reconcileRows over an edited rebuild");
    expect(represented.length, "reconciliation answers for every key-matched row").toBe(prior.length);
    for (const entry of represented) {
      expect(tagOf(entry, "an edited row's reconciliation entry"), `L-REG-04: changed semantic → the row re-presents for disposition, so the entry is tagged "${RE_PRESENTS}"`).toBe(RE_PRESENTS);
    }
    const reconciledKeys = represented.map((entry) => keyOf(entry, new Set(keysOf(prior)), "an edited row's reconciliation entry"));
    expect(multiset(reconciledKeys), "L-REG-04: the semantic invalidates; it never keys — reconciliation emits no changed key for an unchanged identity").toEqual(multiset(keysOf(prior)));
  });
});

/* ------------------------------------------------------------------ *
 * AC-2's tree-side half: the refusal this increment registers.
 * (The door itself is judged live in db/__tests__/register-door.live.test.ts.)
 * ------------------------------------------------------------------ */

describe("AC-2: the duplicate-identity refusal is registered in the closed taxonomy", () => {
  test("AC-2: src/core/errors.ts registers DUPLICATE_IDENTITY as a whole refusal entry", () => {
    expect(Object.hasOwn(REFUSALS, DUPLICATE_IDENTITY), `L-REG-03 refuses a second measured sighting at the door with ${DUPLICATE_IDENTITY}; R-SPINE-062 keeps the taxonomy closed, so it is registered in src/core/errors.ts or it does not exist`).toBe(true);

    const entry = (REFUSALS as unknown as Record<string, Record<string, unknown> | undefined>)[DUPLICATE_IDENTITY];
    expect(entry?.["code"], "each entry's code is its own key — the seam's failure arm reads the value out of the register rather than re-spelling it (Q-07)").toBe(DUPLICATE_IDENTITY);
    for (const field of ["message", "remedy"]) {
      expect(typeof entry?.[field], `the entry carries a ${field} — docs/design/refusal-state.md § 3 binds every entry`).toBe("string");
      expect(String(entry?.[field]).trim(), `the entry's ${field} says something`).not.toBe("");
    }
    expect(["error", "warning", "info"], "the entry carries one of the three registered severities").toContain(entry?.["severity"]);
    expect(["inline", "banner", "dialog"], "the entry carries one of the three registered surfaces").toContain(entry?.["surface"]);
  });
});
