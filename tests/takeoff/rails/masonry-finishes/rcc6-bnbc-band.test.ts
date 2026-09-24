/**
 * AC-5 — where F-RCC6-BNBC's brickwork is billed, after D-009 (AM-01, AM-07, L-QTY-06, B-17).
 *
 * TEST_AMENDED (session 9, R0-G3, D-009): this case staged one register object per brick wall of
 * BNBC's model and graded the brickwork rail against BNBC's BRICKWORK rows, per level and thickness.
 * D-009 (docs/decisions/deviations.md) gave masonry one home: brick walls are the architect's members,
 * F-ARCH's golden bills them wall by wall at GF..6F (538.041 m³, S-25's lintels deducted), and BNBC
 * mints no BRICK_WALL member and bills no BRICKWORK row — BNBC's lump (a perimeter and a 60 m partition
 * allowance a floor) was the second copy of one quantity. Nothing is left here to stage: grading a band
 * over members the model no longer states would grade nothing.
 *
 * What this file holds instead is the hand-over itself, so neither side can drift back unseen: BNBC
 * states no brick wall and bills no brickwork, keeps its thirty LINTEL rows, and F-ARCH's golden holds
 * the fourteen (level × wall type) rows brickwork is reconciled against. F-ARCH's own band waits on the
 * wall's height: the product reads each wall's length and thickness off the architect's set and keeps
 * its row naming WALL_HEIGHT_UNSTATED (./arch-walls.test.ts), never a figure over an unread height.
 */
import { describe, expect, test } from "vitest";
import {
  BNBC_FIXTURE,
  BNBC_MODEL,
  BRICK_WALL,
  GOLDEN_CLASS,
  GOLDEN_KIND,
  MASONRY_BRICKWORK,
  MODEL_BRICK_WALL,
  RCC6_FIXTURE,
  goldenBrickworkRows,
  goldenRows,
  modelMembers,
  type GoldenRow,
} from "./support/masonry-contract";

/** F-ARCH, brickwork's one home under D-009. */
const ARCH_FIXTURE = "arch";

/** The levels F-ARCH draws walls at and the two wall types S-25 prints (D-009). */
const ARCH_LEVELS: readonly string[] = ["GF", "1F", "2F", "3F", "4F", "5F", "6F"];
const WALL_TYPES: readonly string[] = ["BW125", "BW250"];

const isBrickwork = (row: GoldenRow): boolean => row.kind === GOLDEN_KIND[MASONRY_BRICKWORK] || row.class === GOLDEN_CLASS[BRICK_WALL];

describe("AC-5 under D-009: F-RCC6-BNBC's brickwork is billed in F-ARCH, its one home", () => {
  test("BNBC's model states no brick wall, and its golden bills no brickwork", () => {
    expect(modelMembers(BNBC_MODEL).filter((member) => member.class === MODEL_BRICK_WALL).map((member) => member.id), `${BNBC_MODEL} mints no ${MODEL_BRICK_WALL} member (D-009)`).toEqual([]);
    expect(goldenRows(BNBC_FIXTURE).filter(isBrickwork), "and BNBC's golden carries no BRICK_WALL or BRICKWORK row — the architect's set bills them").toEqual([]);
    expect(goldenRows(BNBC_FIXTURE).filter((row) => row.class === "LINTEL").length, "its thirty LINTEL rows stand unchanged: F-ARCH reads and deducts them").toBe(30);
  });

  test("F-RCC6 still asserts nothing on masonry — the frozen fixture is untouched", () => {
    expect(goldenRows(RCC6_FIXTURE).filter(isBrickwork), "F-RCC6 is byte-frozen at v1.1 and is the fast regression lane (AM-01)").toEqual([]);
  });

  test("F-ARCH's golden holds brickwork per level and wall type, GF..6F, the one set of rows the band reconciles against", () => {
    const rows = goldenBrickworkRows(ARCH_FIXTURE);
    expect(rows.map((row) => `${row.level}|${String(row.component)}`).sort(), "one row per level and wall type").toEqual(ARCH_LEVELS.flatMap((level) => WALL_TYPES.map((type) => `${level}|${type}`)).sort());
    expect(new Set(rows.map((row) => row.unit)), "in cubic metres").toEqual(new Set(["m3"]));
    expect(rows.filter((row) => !/^\d+\.\d{3}$/.test(String(row.quantity))), "each printed to the litre").toEqual([]);
    const litres = rows.reduce((sum, row) => sum + BigInt(String(row.quantity).replace(".", "")), 0n);
    expect(litres, "538.041 m³ in all, as D-009 records it").toBe(538_041n);
  });
});
