/**
 * The two building sections AM-01's fixtures state their storeys in, read out of the COMMITTED DXF
 * and handed to the product's own seventh stage (`proposeLevelStack`). Each section is identified by
 * the handles the product's partition assigns to its view.
 *
 * F-RCC6-BNBC's S-25 (`MEMBER_SECTION:DXF_HANDLE:1D96`) holds 13 texts of 78 entities. F-RCC6's
 * section A-A (`MEMBER_SECTION:DXF_HANDLE:669`) holds 11 of 86. Both were measured over the cad
 * CLI's EntityGraph. The texts keep their strings and insertion points exactly as drawn. The
 * one-view assignment is staged here because the partition is its own stage with its own proof.
 * What `inside` guards is that no model-space text inside the section's own extent was left out.
 *
 * Mechanics only, and no database: the unit lane reads these bytes (D-001's proposal proof) and so
 * does the database lane (the offered stack confirmed through its door). One spelling of each
 * section serves both (L-CAD-03, B-19).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { proposeLevelStack, type ProposedLevelRow, type ProposedLevelStack } from "@/modules/takeoff/partition/levels-proposal/propose";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** One model-space TEXT of a committed DXF: its handle, its string, and its insertion point. */
export type DrawnText = { readonly handle: string; readonly text: string; readonly x: number; readonly y: number };

/**
 * Every model-space TEXT the ENTITIES section of a committed DXF carries. A DXF is group-code/value
 * line pairs; a TEXT states its handle under 5, its insertion under 10/20 (the first pair — 11/21 is
 * its alignment point) and its string under 1, and a paper-space one says so under 67.
 */
export function modelTexts(relative: string): DrawnText[] {
  const lines = readFileSync(join(REPO_ROOT, relative), "utf8").split(/\r?\n/);
  const texts: DrawnText[] = [];
  let section: string | null = null;
  let entity: { type: string; codes: Map<string, string> } | null = null;
  const close = (): void => {
    if (entity === null || entity.type !== "TEXT" || entity.codes.get("67") === "1") return;
    const [handle, text, x, y] = ["5", "1", "10", "20"].map((code) => entity?.codes.get(code));
    if (handle !== undefined && text !== undefined && x !== undefined && y !== undefined) texts.push({ handle, text, x: Number(x), y: Number(y) });
  };
  for (let at = 0; at + 1 < lines.length; at += 2) {
    const code = (lines[at] as string).trim();
    const value = lines[at + 1] as string;
    if (code === "0") {
      if (section === "ENTITIES") close();
      entity = { type: value, codes: new Map() };
      if (value === "ENDSEC") section = null;
    } else if (code === "2" && entity?.type === "SECTION") {
      section = value;
    } else if (entity !== null && !entity.codes.has(code)) {
      entity.codes.set(code, value);
    }
  }
  return texts;
}

/**
 * One section as the partition cuts it: the view, what the seventh stage proposes off it (the rows
 * and the stack whole, as a rebuild hands it to the store), the texts it holds, and every text in
 * its extent.
 */
export type Section = {
  readonly view: PartitionedView;
  readonly stack: ProposedLevelStack;
  readonly proposed: ProposedLevelRow[];
  readonly handles: readonly string[];
  readonly inside: readonly string[];
};

/** A section as the partition cuts it: the texts it holds, read off the DXF, in one view. */
export function sectionOf(relative: string, viewKey: string, handles: readonly string[]): Section {
  const all = modelTexts(relative);
  const texts = handles.map((handle) => {
    const found = all.find((text) => text.handle === handle);
    if (found === undefined) throw new Error(`${relative} holds no model-space TEXT ${handle}`);
    return found;
  });
  // The extent the named texts span, and every text of the model inside it: none may be left out.
  const [left, right] = [Math.min(...texts.map((t) => t.x)), Math.max(...texts.map((t) => t.x))];
  const [foot, head] = [Math.min(...texts.map((t) => t.y)), Math.max(...texts.map((t) => t.y))];
  const inside = all.filter((text) => text.x >= left && text.x <= right && text.y >= foot && text.y <= head).map((text) => text.handle);

  const entities = texts.map((text) => ({ key: `DXF_HANDLE:${text.handle}`, type: "TEXT", space: "model", layer: "", colour: { rgb: [0, 0, 0], source: "bylayer" }, text: text.text, points: [[text.x, text.y]] }));
  const view = { viewKey, type: VIEW_TYPE.MEMBER_SECTION, reason: null, caption: "SECTION A-A", anchorKey: viewKey.slice(viewKey.indexOf(":") + 1) } as PartitionedView;
  const stack = proposeLevelStack({ graph: { entities } as unknown as EntityGraph, views: [view], assignments: new Map(entities.map((entity) => [entity.key, viewKey])) });
  return { view, stack, proposed: [...stack.levels], handles, inside };
}

/** S-25's building section, F-RCC6-BNBC: eight storey marks, four figures on the left, the caption. */
export function s25Section(): Section {
  return sectionOf("fixtures/rcc6-bnbc/rcc6-bnbc.dxf", "MEMBER_SECTION:DXF_HANDLE:1D96", [
    "1D4A", "1D4C", "1D4E", "1D50", "1D52", "1D54", "1D56", "1D58", "1D90", "1D91", "1D92", "1D93", "1D96",
  ]);
}

/** F-RCC6's section A-A: eight storey marks, the ground's word, the caption and its note. */
export function rcc6Section(): Section {
  return sectionOf("fixtures/rcc6/rcc6.dxf", "MEMBER_SECTION:DXF_HANDLE:669", ["5AC", "5AE", "5B0", "5B2", "5B4", "5B6", "5B8", "5BA", "5F8", "669", "66A"]);
}
