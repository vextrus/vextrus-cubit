/**
 * The condition chest's three doors, in memory, with the route's own answer shapes
 * (`measure-actions.ts`): what a jsdom mount of the viewer or of the chest reads and writes instead of
 * a server. It keeps the one rule a mount can see — one standing condition per name — and answers
 * the catalogue `MANUAL_RULES` holds today (the slab's blinding, by area, owing a thickness), spelled
 * here because the live catalogue is read off the method registry on the server.
 *
 * Mechanics only — the chest's judgement is proved live in `../conditions.db.test.ts`.
 */
import { vi } from "vitest";
import type { AuthorableCatalogue, ChestCondition, ConditionStatement } from "@/core/manual/conditions";
import type { ChestDoors } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/measure-chest";

export const CHEST_CATALOGUE: AuthorableCatalogue = [
  { geometry: "POLYGON", classes: [{ elementClass: "slab", colour: "slab", kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding.area", readings: [{ attribute: "t", dimension: "LENGTH", units: ["mm", "m", "ft", "in"] }] }] }] },
];

/** One condition as the chest lists it, from a statement — hotkey by place. */
export function listed(statement: ConditionStatement, conditionId: string, place: number, over: Partial<ChestCondition> = {}): ChestCondition {
  return {
    conditionId,
    name: statement.name.trim(),
    geometry: statement.geometry,
    elementClass: statement.elementClass,
    kinds: statement.kinds.map((kind) => ({ kind, ruleId: "pcc.blinding.area" })),
    readings: statement.readings.map((reading) => ({ ...reading, basis: "ENTERED" as const, sourceKey: null })),
    colour: statement.colour,
    hatch: statement.hatch,
    hotkey: place < 9 ? place + 1 : null,
    measured: 0,
    billed: 0,
    totals: [],
    ...over,
  };
}

/** The condition the QS outcome names. */
export const BLINDING: ConditionStatement = {
  name: "75 CC blinding under SOG",
  geometry: "POLYGON",
  elementClass: "slab",
  kinds: ["pcc.blinding"],
  readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm" }],
  colour: "slab",
  hatch: "diagonal",
};

/** A chest in memory: the doors, spied, and what it holds. */
export function memoryChest(o: { conditions?: readonly ChestCondition[]; canAuthor?: boolean } = {}): ChestDoors & { held: ChestCondition[] } {
  const held: ChestCondition[] = [...(o.conditions ?? [])];
  let minted = 0;
  const read = vi.fn(async () => ({ read: true as const, conditions: held.map((condition, place) => ({ ...condition, hotkey: place < 9 ? place + 1 : null })), catalogue: CHEST_CATALOGUE, canAuthor: o.canAuthor ?? true }));
  const author = vi.fn(async ({ condition }: { projectId: string; condition: ConditionStatement }) => {
    if (held.some((standing) => standing.name === condition.name.trim())) return { authored: false as const, refusal: "CONDITION_NAME_TAKEN" as const };
    minted += 1;
    const conditionId = `00000000-0000-4000-8000-${String(minted).padStart(12, "0")}`;
    held.push(listed(condition, conditionId, held.length));
    return { authored: true as const, conditionId };
  });
  const retire = vi.fn(async ({ conditionId }: { projectId: string; conditionId: string }) => {
    const at = held.findIndex((condition) => condition.conditionId === conditionId);
    if (at < 0) return { retired: false as const, refusal: "CONDITION_NOT_IN_CHEST" as const };
    held.splice(at, 1);
    return { retired: true as const };
  });
  return { read, author, retire, held };
}
