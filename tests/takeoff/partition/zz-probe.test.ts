/** Temporary probe — deleted before handoff. */
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, test } from "vitest";
import { closeStage, field, registerRowsOf, stageRcc6, type Rcc6Stage } from "../rails/support/rcc6-stage";

let measured: Rcc6Stage;

beforeAll(async () => {
  measured = await stageRcc6("zz-probe");
}, 1_800_000);

afterAll(async () => {
  await closeStage();
});

test("probe", () => {
  const byLevelId = new Map(measured.levels.map((l) => [l.levelId, l.label]));
  const placementOf = new Map(measured.partition.placementRows.map((r) => [r.placementKey, r]));
  const seen = new Map<string, Set<string>>();
  for (const row of registerRowsOf(measured)) {
    const key = String(field(row, "placementKey", "placement_key"));
    const p = placementOf.get(key);
    const levelId = field(row, "levelId", "level_id");
    const label = levelId === null || levelId === undefined ? "FDN" : (byLevelId.get(String(levelId)) ?? "?");
    const mark = `${String(field(row, "mark", "mark"))}@${String(p?.viewKey ?? "?").slice(-3)}`;
    const held = seen.get(mark) ?? new Set<string>();
    held.add(label);
    seen.set(mark, held);
  }
  const lines = [...seen.entries()].map(([m, s]) => `${m} ${[...s].sort().join("/")}`).sort();
  writeFileSync("/tmp/builder-scratch/inc-306-rails-frame/levels.log", lines.join("\n"));
});
