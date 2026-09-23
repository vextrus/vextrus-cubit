/**
 * F-ARCH (session 8) as the partition reads it: the architect's set of the Bashundhara G+6, read by
 * the SHIPPED `cad/` CLI (L-CAD-01) and put through the same pure stages the rebuild runs — the one
 * spelling `./bnbc-stages` keeps for every fixture (B-17) — with the generator's OWN model beside it,
 * so a suite grades what the product read against what the generator authored and never against
 * what the product said last time (AM-01).
 *
 * Mechanics only, and no database: what a schedule of the drawing IS comes from `fixtures/arch/
 * model.json` (the authored marks, sizes, placements, wall types and finish types) and the trap
 * registry's live handles; nothing here reads product source.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stagesOver, type StagesRead } from "./bnbc-stages";

/** The drawing, the generator's model of it, and its registered traps (DECISIONS.md A-04). */
export const ARCH_DXF = "fixtures/arch/arch.dxf";
const ARCH_MODEL = "fixtures/arch/model.json";
const ARCH_TRAPS = "fixtures/arch/traps.json";

let held: Promise<StagesRead> | undefined;

/** F-ARCH read once per suite — lazily, so a refusal fails the case that needed it. */
export function archStages(): Promise<StagesRead> {
  held ??= stagesOver(ARCH_DXF);
  return held;
}

/** One opening type as the generator authors it: its type name, width and height in millimetres. */
type AuthoredMark = { readonly type: string; readonly w: string; readonly h: string; readonly group: string };

/** One wall type: its mark, its thickness in millimetres (null where the structure states it), and its words. */
type AuthoredWallType = { readonly mark: string; readonly t: string | null; readonly spec: string; readonly where: string };

/** One finish type: the room group it keys, and what each face of those rooms is finished with. */
type AuthoredFinish = {
  readonly rooms: string;
  readonly floor: string;
  readonly skirting: string | null;
  readonly wall: string | null;
  readonly dado_spec?: string;
  readonly ceiling: string | null;
};

/** The generator's model, as far as its schedules draw it. */
export type ArchModel = {
  readonly marks: Readonly<Record<string, AuthoredMark>>;
  readonly levels: Readonly<Record<string, { readonly openings: readonly { readonly mark: string }[] }>>;
  readonly printed_nos_override: Readonly<Record<string, number>>;
  readonly wall_types: readonly AuthoredWallType[];
  readonly finish_types: Readonly<Record<string, AuthoredFinish>>;
};

/** The model the generator minted the drawing from. */
export function archModel(): ArchModel {
  return JSON.parse(readFileSync(join(process.cwd(), ARCH_MODEL), "utf8")) as ArchModel;
}

/** A trap's live handle, as the source key the extractor gives the entity it stands on. */
export function trapKey(id: string): string {
  const traps = (JSON.parse(readFileSync(join(process.cwd(), ARCH_TRAPS), "utf8")) as { traps: { id: string; handle: string }[] }).traps;
  const trap = traps.find((one) => one.id === id);
  if (trap === undefined) throw new Error(`F-ARCH registers no trap ${id}`);
  return `DXF_HANDLE:${trap.handle}`;
}

/**
 * The two floor groups the generator draws a door and window schedule for (DECISIONS.md A-04): the
 * ground floor, and the typical floors whose one plan stands for 1ST..6TH — the level each group's
 * openings are authored on, the caption its schedule is titled by, and the variant its floors key.
 */
export const OPENING_GROUPS = Object.freeze([
  { group: "GF", level: "GF", caption: "DOOR & WINDOW SCHEDULE (GROUND FLOOR)", plan: "GROUND FLOOR PLAN", variant: "GF-GF" },
  { group: "TYP", level: "1F", caption: "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)", plan: "TYPICAL FLOOR PLAN (1ST TO 6TH)", variant: "1ST-6TH" },
] as const);

/** One row a group's schedule draws, as the generator authors it. */
export type AuthoredRow = {
  readonly mark: string;
  /** The mark as the schedule spells it — hyphenated before its number (T-MARK-SPELLING). */
  readonly spelled: string;
  readonly type: string;
  readonly widthMm: number;
  readonly heightMm: number;
  /** How many the generator places on the group's level. */
  readonly placed: number;
  /** What the schedule prints: the placements, unless the generator overrides it (T-OPENING-NOS). */
  readonly printed: number;
};

/** The schedule's own spelling of a mark: its letters, a hyphen, its number (the generator's convention). */
function spelled(mark: string): string {
  const head = mark.replace(/\d+$/u, "");
  return head === mark ? mark : `${head}-${mark.slice(head.length)}`;
}

/** Every row a group's schedule draws, one per mark its level places. */
export function authoredRows(model: ArchModel, group: (typeof OPENING_GROUPS)[number]): AuthoredRow[] {
  const placed = new Map<string, number>();
  for (const opening of model.levels[group.level]?.openings ?? []) placed.set(opening.mark, (placed.get(opening.mark) ?? 0) + 1);
  return [...placed.entries()].map(([mark, count]) => {
    const authored = model.marks[mark];
    if (authored === undefined) throw new Error(`F-ARCH places ${mark}, which its model does not author`);
    return {
      mark,
      spelled: spelled(mark),
      type: authored.type,
      widthMm: Number(authored.w),
      heightMm: Number(authored.h),
      placed: count,
      printed: model.printed_nos_override[`${group.group}:${mark}`] ?? count,
    };
  });
}
